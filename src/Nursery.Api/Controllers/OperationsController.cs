using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Nursery.Api.Data;
using Nursery.Api.Hubs;
using Nursery.Api.Models;
using Nursery.Api.Services;

namespace Nursery.Api.Controllers;

[ApiController]
[Authorize]
[Route("api")]
public class OperationsController(AppDbContext db, IHubContext<ChatHub> hub, ChatAccessService chatAccess, ChildAccessService childAccess) : ControllerBase
{
    [HttpGet("me")]
    public async Task<IActionResult> Me()
    {
        var user = await db.Users.FindAsync(User.Id());
        var nursery = await db.Nurseries.FindAsync(User.NurseryId());
        var unread = await db.Notifications.CountAsync(n => n.UserId == User.Id() && !n.Read);
        return Ok(new
        {
            user!.Id,
            user.Email,
            user.FullName,
            role = user.Role.ToString(),
            user.PreferredLanguage,
            user.ClassroomId,
            nursery = new { nursery!.Name, nursery.NameAr, nursery.NameFr, logoUrl = nursery.LogoUrl },
            unread
        });
    }

    [HttpGet("notifications")]
    public async Task<IActionResult> Notifications()
    {
        var items = (await db.Notifications.Where(n => n.UserId == User.Id()).ToListAsync())
            .OrderByDescending(n => n.CreatedAt)
            .Take(50)
            .ToList();
        foreach (var n in items) n.Read = true;
        await db.SaveChangesAsync();
        return Ok(items);
    }

    [HttpGet("conversations")]
    public async Task<IActionResult> Conversations()
    {
        var userId = User.Id();
        var role = User.Role();
        var nurseryId = User.NurseryId();
        var q = await chatAccess.ConversationsForUserAsync(userId, role, nurseryId);
        var list = await q.ToListAsync();
        var convIds = list.Select(conv => conv.Id).ToList();
        var allMsgs = await db.Messages.Where(m => convIds.Contains(m.ConversationId)).ToListAsync();
        var lastByConv = allMsgs.GroupBy(m => m.ConversationId)
            .ToDictionary(g => g.Key, g => g.OrderByDescending(m => m.SentAt).First());
        var staffIds = list.Where(c => c.StaffUserId.HasValue).Select(c => c.StaffUserId!.Value).Distinct().ToList();
        var parentIds = list.Where(c => c.ParentUserId.HasValue).Select(c => c.ParentUserId!.Value).Distinct().ToList();
        var otherStaffIds = list.Where(c => c.OtherStaffUserId.HasValue).Select(c => c.OtherStaffUserId!.Value).Distinct().ToList();
        var allStaffIds = staffIds.Concat(otherStaffIds).Distinct().ToList();
        var childIds = list.Where(c => ChatAccessService.IsParentThread(c)).Select(c => c.ChildId).Distinct().ToList();
        var staffMap = await db.Users.Where(u => allStaffIds.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, u => new { u.FullName, role = u.Role.ToString(), u.ClassroomId });
        var parentMap = await db.Users.Where(u => parentIds.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, u => u.FullName);
        var childMap = await db.Children.Where(c => childIds.Contains(c.Id))
            .ToDictionaryAsync(c => c.Id, c => $"{c.FirstName} {c.LastName}");
        var classroomIds = staffMap.Values.Where(s => s.ClassroomId.HasValue).Select(s => s.ClassroomId!.Value).Distinct().ToList();
        var classroomMap = await db.Classrooms.Where(c => classroomIds.Contains(c.Id))
            .ToDictionaryAsync(c => c.Id, c => c.Name);
        var ordered = list
            .OrderByDescending(conv => lastByConv.GetValueOrDefault(conv.Id)?.SentAt ?? DateTimeOffset.MinValue)
            .ThenBy(conv => conv.Title)
            .ToList();
        return Ok(ordered.Select(conv =>
        {
            var isParent = ChatAccessService.IsParentThread(conv);
            string? classroomName = null;
            if (conv.StaffUserId is Guid eduId && staffMap.GetValueOrDefault(eduId)?.ClassroomId is Guid cid)
                classroomName = classroomMap.GetValueOrDefault(cid);
            return new
            {
                id = conv.Id,
                title = conv.Title,
                kind = isParent ? "parent" : "staff",
                childId = isParent ? conv.ChildId : (Guid?)null,
                childName = isParent ? childMap.GetValueOrDefault(conv.ChildId) : null,
                parentUserId = conv.ParentUserId,
                parentName = conv.ParentUserId is Guid pid ? parentMap.GetValueOrDefault(pid) : null,
                staffUserId = conv.StaffUserId,
                staffName = conv.StaffUserId is Guid sid ? staffMap.GetValueOrDefault(sid)?.FullName : null,
                staffRole = conv.StaffUserId is Guid sid2 ? staffMap.GetValueOrDefault(sid2)?.role : null,
                classroomName,
                otherStaffUserId = conv.OtherStaffUserId,
                otherStaffName = conv.OtherStaffUserId is Guid oid ? staffMap.GetValueOrDefault(oid)?.FullName : null,
                otherStaffRole = conv.OtherStaffUserId is Guid oid2 ? staffMap.GetValueOrDefault(oid2)?.role : null,
                lastMessage = lastByConv.GetValueOrDefault(conv.Id)?.Body
            };
        }));
    }

    [HttpGet("conversations/contacts")]
    public async Task<IActionResult> ChatContacts([FromQuery] Guid? childId)
    {
        var userId = User.Id();
        var role = User.Role();

        if (role == nameof(UserRole.Parent))
        {
            if (childId is null)
            {
                var kids = await db.ParentChildren.Where(p => p.ParentId == userId)
                    .Join(db.Children, p => p.ChildId, c => c.Id, (_, c) => new { c.Id, name = $"{c.FirstName} {c.LastName}" })
                    .ToListAsync();
                return Ok(new { children = kids });
            }
            var linked = await db.ParentChildren.AnyAsync(p => p.ParentId == userId && p.ChildId == childId);
            if (!linked) return Forbid();
            var staff = await chatAccess.AllowedStaffForParentAsync(userId, childId.Value);
            return Ok(new
            {
                childId,
                contacts = staff.Select(u => new { userId = u.Id, fullName = u.FullName, role = u.Role.ToString() })
            });
        }

        if (role == nameof(UserRole.Educator))
        {
            var classroomId = await db.Users.Where(u => u.Id == userId).Select(u => u.ClassroomId).FirstOrDefaultAsync();
            if (classroomId is null) return Ok(new { parents = Array.Empty<object>() });
            var parents = await db.Children.Where(c => c.ClassroomId == classroomId)
                .Join(db.ParentChildren, c => c.Id, pc => pc.ChildId, (c, pc) => new { c.Id, c.FirstName, c.LastName, pc.ParentId })
                .Join(db.Users, x => x.ParentId, u => u.Id, (x, u) => new
                {
                    childId = x.Id,
                    childName = $"{x.FirstName} {x.LastName}",
                    parentId = u.Id,
                    parentName = u.FullName
                })
                .Distinct()
                .ToListAsync();
            var directors = await db.Users.Where(u => u.NurseryId == User.NurseryId() && u.Role == UserRole.Admin && u.Active)
                .Select(u => new { userId = u.Id, fullName = u.FullName, role = u.Role.ToString() })
                .ToListAsync();
            return Ok(new { parents, directors });
        }

        var nurseryId = User.NurseryId();
        var allParents = await db.ParentChildren
            .Join(db.Users, pc => pc.ParentId, u => u.Id, (pc, u) => new { pc.ChildId, u.Id, u.FullName })
            .Join(db.Children, x => x.ChildId, c => c.Id, (x, c) => new
            {
                childId = c.Id,
                childName = $"{c.FirstName} {c.LastName}",
                parentId = x.Id,
                parentName = x.FullName
            })
            .Distinct()
            .ToListAsync();
        var teachers = await db.Users.Where(u => u.NurseryId == nurseryId && u.Role == UserRole.Educator && u.Active)
            .GroupJoin(db.Classrooms, u => u.ClassroomId, cl => cl.Id, (u, cls) => new { u, cls })
            .SelectMany(x => x.cls.DefaultIfEmpty(), (x, cl) => new
            {
                userId = x.u.Id,
                fullName = x.u.FullName,
                role = x.u.Role.ToString(),
                classroomName = cl != null ? cl.Name : null
            })
            .OrderBy(t => t.fullName)
            .ToListAsync();
        return Ok(new { parents = allParents, teachers });
    }

    [HttpPost("conversations")]
    public async Task<IActionResult> CreateConversation([FromBody] CreateConversationDto dto)
    {
        var userId = User.Id();
        var role = User.Role();
        var nurseryId = User.NurseryId();

        if (dto.ParentUserId is null && dto.StaffUserId is Guid peerStaffId && dto.ChildId is null)
        {
            Guid educatorId;
            Guid adminId;
            if (role == nameof(UserRole.Admin))
            {
                var peer = await db.Users.FindAsync(peerStaffId);
                if (peer is null || peer.Role != UserRole.Educator || peer.NurseryId != nurseryId) return BadRequest();
                educatorId = peerStaffId;
                adminId = userId;
            }
            else if (role == nameof(UserRole.Educator))
            {
                var peer = await db.Users.FindAsync(peerStaffId);
                if (peer is null || peer.Role != UserRole.Admin || peer.NurseryId != nurseryId) return BadRequest();
                educatorId = userId;
                adminId = peerStaffId;
            }
            else return Forbid();

            var staffConv = await GetOrCreateStaffStaffConversationAsync(nurseryId, educatorId, adminId);
            return Ok(staffConv);
        }

        if (dto.ChildId is not Guid childId || childId == Guid.Empty) return BadRequest();

        Guid parentUserId;
        Guid staffUserId;

        if (role == nameof(UserRole.Parent))
        {
            if (dto.StaffUserId is null) return BadRequest();
            parentUserId = userId;
            staffUserId = dto.StaffUserId.Value;
            var linked = await db.ParentChildren.AnyAsync(p => p.ParentId == userId && p.ChildId == childId);
            if (!linked) return Forbid();
            if (!await chatAccess.IsStaffAllowedForParentAsync(userId, childId, staffUserId)) return Forbid();
        }
        else if (role == nameof(UserRole.Educator))
        {
            if (dto.ParentUserId is null) return BadRequest();
            parentUserId = dto.ParentUserId.Value;
            staffUserId = userId;
            var classroomId = await db.Users.Where(u => u.Id == userId).Select(u => u.ClassroomId).FirstOrDefaultAsync();
            var child = await db.Children.FindAsync(childId);
            if (child is null || classroomId is null || child.ClassroomId != classroomId) return Forbid();
            if (!await db.ParentChildren.AnyAsync(p => p.ParentId == parentUserId && p.ChildId == childId)) return Forbid();
        }
        else if (role == nameof(UserRole.Admin))
        {
            if (dto.ParentUserId is null) return BadRequest();
            parentUserId = dto.ParentUserId.Value;
            staffUserId = userId;
            if (!await db.ParentChildren.AnyAsync(p => p.ParentId == parentUserId && p.ChildId == childId)) return Forbid();
        }
        else return Forbid();

        var existing = await db.Conversations.FirstOrDefaultAsync(c =>
            c.NurseryId == nurseryId && c.ChildId == childId &&
            c.ParentUserId == parentUserId && c.StaffUserId == staffUserId);
        if (existing is not null) return Ok(existing);

        var staff = await db.Users.FindAsync(staffUserId);
        var childEntity = await db.Children.FindAsync(childId);
        if (staff is null || childEntity is null) return BadRequest();

        var conv = new Conversation
        {
            Id = Guid.NewGuid(),
            NurseryId = nurseryId,
            ChildId = childId,
            ParentUserId = parentUserId,
            StaffUserId = staffUserId,
            Title = $"{childEntity.FirstName} · {staff.FullName}"
        };
        db.Conversations.Add(conv);
        await db.SaveChangesAsync();
        return Ok(conv);
    }

    async Task<Conversation> GetOrCreateStaffStaffConversationAsync(Guid nurseryId, Guid educatorId, Guid adminId)
    {
        var existing = await db.Conversations.FirstOrDefaultAsync(c =>
            c.NurseryId == nurseryId && c.ParentUserId == null &&
            c.StaffUserId == educatorId && c.OtherStaffUserId == adminId);
        if (existing is not null) return existing;

        var educator = await db.Users.FindAsync(educatorId);
        if (educator is null) throw new InvalidOperationException("Educator not found");

        var conv = new Conversation
        {
            Id = Guid.NewGuid(),
            NurseryId = nurseryId,
            ChildId = Guid.Empty,
            ParentUserId = null,
            StaffUserId = educatorId,
            OtherStaffUserId = adminId,
            Title = educator.FullName
        };
        db.Conversations.Add(conv);
        await db.SaveChangesAsync();
        return conv;
    }

    [HttpGet("conversations/{id:guid}/messages")]
    public async Task<IActionResult> Messages(Guid id)
    {
        if (!await chatAccess.CanAccessConversationAsync(User.Id(), User.Role(), id))
            return Forbid();
        var msgs = (await db.Messages.Include(m => m.Sender)
                .Where(m => m.ConversationId == id)
                .ToListAsync())
            .OrderBy(m => m.SentAt)
            .Select(m => new { m.Id, m.Body, m.SentAt, senderId = m.SenderId, senderName = m.Sender.FullName })
            .ToList();
        return Ok(msgs);
    }

    [HttpPost("conversations/{id:guid}/messages")]
    public async Task<IActionResult> Send(Guid id, [FromBody] SendMessage req)
    {
        if (!await chatAccess.CanAccessConversationAsync(User.Id(), User.Role(), id))
            return Forbid();
        var sender = await db.Users.FindAsync(User.Id());
        var msg = new ChatMessage
        {
            Id = Guid.NewGuid(),
            ConversationId = id,
            SenderId = User.Id(),
            Body = req.Body,
            SentAt = DateTimeOffset.Now
        };
        db.Messages.Add(msg);
        await db.SaveChangesAsync();
        await hub.Clients.Group(id.ToString()).SendAsync("message", new { msg.Id, msg.Body, msg.SentAt, senderId = msg.SenderId, senderName = sender?.FullName });
        return Ok(msg);
    }

    [HttpGet("announcements")]
    public async Task<IActionResult> Announcements()
    {
        var lang = ContentLocalization.LangFromRequest(Request);
        var items = (await db.Announcements.NotDeleted().Where(a => a.NurseryId == User.NurseryId()).ToListAsync())
            .OrderByDescending(a => a.PublishedAt)
            .Select(a => new
            {
                a.Id,
                title = ContentLocalization.ResolveField(a.Title, a.LocalizationsJson, lang, "title"),
                body = ContentLocalization.ResolveField(a.Body, a.LocalizationsJson, lang, "body"),
                a.PublishedAt
            })
            .ToList();
        return Ok(items);
    }

    [Authorize(Roles = "Admin")]
    [HttpPost("announcements")]
    public async Task<IActionResult> CreateAnnouncement([FromBody] AnnouncementCreate req)
    {
        var a = new Announcement
        {
            Id = Guid.NewGuid(),
            NurseryId = User.NurseryId(),
            Title = req.Title,
            Body = req.Body,
            PublishedAt = DateTimeOffset.Now
        };
        db.Announcements.Add(a);
        var parents = await db.Users.Where(u => u.NurseryId == User.NurseryId() && u.Role == UserRole.Parent).ToListAsync();
        foreach (var p in parents)
            db.Notifications.Add(new Notification { Id = Guid.NewGuid(), UserId = p.Id, Title = a.Title, Body = a.Body, CreatedAt = a.PublishedAt });
        await db.SaveChangesAsync();
        return Ok(a);
    }

    [Authorize(Roles = "Admin")]
    [HttpPatch("announcements/{id:guid}")]
    public async Task<IActionResult> UpdateAnnouncement(Guid id, [FromBody] AnnouncementCreate req)
    {
        var a = await db.Announcements.NotDeleted().FirstOrDefaultAsync(x => x.Id == id && x.NurseryId == User.NurseryId());
        if (a is null) return NotFound();
        a.Title = req.Title.Trim();
        a.Body = req.Body.Trim();
        await db.SaveChangesAsync();
        return Ok(a);
    }

    [Authorize(Roles = "Admin")]
    [HttpDelete("announcements/{id:guid}")]
    public async Task<IActionResult> DeleteAnnouncement(Guid id)
    {
        var a = await db.Announcements.NotDeleted().FirstOrDefaultAsync(x => x.Id == id && x.NurseryId == User.NurseryId());
        if (a is null) return NotFound();
        a.DeletedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync();
        return NoContent();
    }

    [HttpGet("events")]
    public async Task<IActionResult> Events()
    {
        var lang = ContentLocalization.LangFromRequest(Request);
        var items = (await db.Events.NotDeleted().Where(e => e.NurseryId == User.NurseryId()).ToListAsync())
            .OrderBy(e => e.StartsAt)
            .Select(e => new
            {
                e.Id,
                title = ContentLocalization.ResolveField(e.Title, e.LocalizationsJson, lang, "title"),
                location = ContentLocalization.ResolveField(e.Location ?? "", e.LocalizationsJson, lang, "location"),
                e.StartsAt,
                e.EndsAt
            })
            .ToList();
        return Ok(items);
    }

    [Authorize(Roles = "Admin")]
    [HttpPost("events")]
    public async Task<IActionResult> CreateEvent([FromBody] EventCreate req)
    {
        var e = new CalendarEvent
        {
            Id = Guid.NewGuid(),
            NurseryId = User.NurseryId(),
            Title = req.Title,
            StartsAt = req.StartsAt,
            EndsAt = req.EndsAt,
            Location = req.Location
        };
        db.Events.Add(e);
        await db.SaveChangesAsync();
        return Ok(e);
    }

    [Authorize(Roles = "Admin")]
    [HttpPatch("events/{id:guid}")]
    public async Task<IActionResult> UpdateEvent(Guid id, [FromBody] EventCreate req)
    {
        var e = await db.Events.NotDeleted().FirstOrDefaultAsync(x => x.Id == id && x.NurseryId == User.NurseryId());
        if (e is null) return NotFound();
        e.Title = req.Title.Trim();
        e.StartsAt = req.StartsAt;
        e.EndsAt = req.EndsAt;
        e.Location = req.Location;
        await db.SaveChangesAsync();
        return Ok(e);
    }

    [Authorize(Roles = "Admin")]
    [HttpDelete("events/{id:guid}")]
    public async Task<IActionResult> DeleteEvent(Guid id)
    {
        var e = await db.Events.NotDeleted().FirstOrDefaultAsync(x => x.Id == id && x.NurseryId == User.NurseryId());
        if (e is null) return NotFound();
        e.DeletedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync();
        return NoContent();
    }

    [HttpGet("reminders")]
    public async Task<IActionResult> Reminders()
    {
        var lang = ContentLocalization.LangFromRequest(Request);
        var items = (await db.Reminders.NotDeleted().Where(r => r.NurseryId == User.NurseryId()).ToListAsync())
            .OrderBy(r => r.DueAt)
            .Select(r => new
            {
                r.Id,
                kind = ContentLocalization.ResolveField(r.Kind, r.LocalizationsJson, lang, "kind"),
                title = ContentLocalization.ResolveField(r.Title, r.LocalizationsJson, lang, "title"),
                r.DueAt,
                r.ChildId
            })
            .ToList();
        return Ok(items);
    }

    [HttpGet("activities")]
    public async Task<IActionResult> Activities() =>
        Ok(await db.ActivityPlans.NotDeleted().OrderByDescending(a => a.WeekStart).ToListAsync());

    [Authorize(Roles = "Educator,Admin")]
    [HttpPost("activities")]
    public async Task<IActionResult> SaveActivity([FromBody] ActivityCreate req)
    {
        var plan = new ActivityPlan
        {
            Id = Guid.NewGuid(),
            ClassroomId = req.ClassroomId,
            WeekStart = req.WeekStart,
            Theme = req.Theme,
            PlanJson = req.PlanJson
        };
        db.ActivityPlans.Add(plan);
        await db.SaveChangesAsync();
        return Ok(plan);
    }

    [Authorize(Roles = "Educator,Admin")]
    [HttpPatch("activities/{id:guid}")]
    public async Task<IActionResult> UpdateActivity(Guid id, [FromBody] ActivityCreate req)
    {
        var plan = await db.ActivityPlans.NotDeleted().FirstOrDefaultAsync(a => a.Id == id);
        if (plan is null) return NotFound();
        var nurseryId = await db.Classrooms.Where(c => c.Id == plan.ClassroomId).Select(c => c.NurseryId).FirstOrDefaultAsync();
        if (nurseryId != User.NurseryId()) return NotFound();
        if (User.Role() == nameof(UserRole.Educator))
        {
            var classroomId = await db.Users.Where(u => u.Id == User.Id()).Select(u => u.ClassroomId).FirstOrDefaultAsync();
            if (classroomId is null || plan.ClassroomId != classroomId) return Forbid();
        }
        plan.ClassroomId = req.ClassroomId;
        plan.WeekStart = req.WeekStart;
        plan.Theme = req.Theme.Trim();
        plan.PlanJson = req.PlanJson;
        await db.SaveChangesAsync();
        return Ok(plan);
    }

    [Authorize(Roles = "Educator,Admin")]
    [HttpDelete("activities/{id:guid}")]
    public async Task<IActionResult> DeleteActivity(Guid id)
    {
        var plan = await db.ActivityPlans.NotDeleted().FirstOrDefaultAsync(a => a.Id == id);
        if (plan is null) return NotFound();
        var nurseryId = await db.Classrooms.Where(c => c.Id == plan.ClassroomId).Select(c => c.NurseryId).FirstOrDefaultAsync();
        if (nurseryId != User.NurseryId()) return NotFound();
        if (User.Role() == nameof(UserRole.Educator))
        {
            var classroomId = await db.Users.Where(u => u.Id == User.Id()).Select(u => u.ClassroomId).FirstOrDefaultAsync();
            if (classroomId is null || plan.ClassroomId != classroomId) return Forbid();
        }
        plan.DeletedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync();
        return NoContent();
    }

    [Authorize(Roles = "Educator,Admin")]
    [HttpPost("incidents")]
    public async Task<IActionResult> Incident([FromBody] IncidentCreate req)
    {
        if (!await childAccess.CanAccessAsync(User.Id(), User.Role(), User.NurseryId(), req.ChildId))
            return Forbid();
        var inc = new Incident
        {
            Id = Guid.NewGuid(),
            ChildId = req.ChildId,
            At = DateTimeOffset.Now,
            Title = req.Title,
            Details = req.Details,
            ParentsNotified = true,
            ReportedById = User.Id()
        };
        db.Incidents.Add(inc);
        var child = await db.Children.FindAsync(req.ChildId);
        var parentIds = await db.ParentChildren.Where(p => p.ChildId == req.ChildId).Select(p => p.ParentId).ToListAsync();
        foreach (var pid in parentIds)
            db.Notifications.Add(new Notification { Id = Guid.NewGuid(), UserId = pid, Title = "Incident", Body = $"{child!.FirstName}: {req.Title}", CreatedAt = DateTimeOffset.Now });
        await db.SaveChangesAsync();
        return Ok(inc);
    }

    [Authorize(Roles = "Educator,Admin")]
    [HttpDelete("incidents/{id:guid}")]
    public async Task<IActionResult> DeleteIncident(Guid id)
    {
        var inc = await db.Incidents.NotDeleted().Include(i => i.Child).FirstOrDefaultAsync(i => i.Id == id);
        if (inc is null || inc.Child.NurseryId != User.NurseryId()) return NotFound();
        if (User.Role() == nameof(UserRole.Educator))
        {
            if (!await childAccess.CanAccessAsync(User.Id(), User.Role(), User.NurseryId(), inc.ChildId))
                return Forbid();
        }
        inc.DeletedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync();
        return NoContent();
    }

    [HttpGet("incidents")]
    public async Task<IActionResult> Incidents()
    {
        var q = db.Incidents.NotDeleted().Include(i => i.Child).Where(i => i.Child.Active).AsQueryable();
        if (User.Role() == nameof(UserRole.Parent))
        {
            var ids = await db.ParentChildren.Where(p => p.ParentId == User.Id()).Select(p => p.ChildId).ToListAsync();
            q = q.Where(i => ids.Contains(i.ChildId));
        }
        else if (User.Role() == nameof(UserRole.Educator))
        {
            var classroomId = await db.Users.Where(u => u.Id == User.Id()).Select(u => u.ClassroomId).FirstOrDefaultAsync();
            if (classroomId is Guid cid) q = q.Where(i => i.Child.ClassroomId == cid);
            else q = q.Where(_ => false);
        }
        var incidents = (await q.ToListAsync())
            .OrderByDescending(i => i.At)
            .Select(i => new { i.Id, i.Title, i.Details, i.At, child = i.Child.FirstName })
            .ToList();
        return Ok(incidents);
    }

    [Authorize(Roles = "Admin")]
    [HttpGet("staff")]
    public async Task<IActionResult> Staff()
    {
        var staff = await db.Users.Where(u => u.NurseryId == User.NurseryId() && u.Role != UserRole.Parent)
            .Select(u => new { u.Id, u.FullName, u.Email, role = u.Role.ToString(), u.ClassroomId, u.Phone, u.PreferredLanguage })
            .ToListAsync();
        var shifts = await db.Shifts.NotDeleted().Include(s => s.User).OrderByDescending(s => s.Date).Take(40).ToListAsync();
        return Ok(new { staff, shifts = shifts.Select(ApiJson.StaffShift) });
    }

    [Authorize(Roles = "Admin")]
    [HttpPost("staff/shifts")]
    public async Task<IActionResult> Shift([FromBody] ShiftCreate req)
    {
        var s = new StaffShift
        {
            Id = Guid.NewGuid(),
            UserId = req.UserId,
            Date = req.Date,
            Start = req.Start,
            End = req.End,
            Status = req.Status,
            AbsenceReason = req.AbsenceReason
        };
        db.Shifts.Add(s);
        await db.SaveChangesAsync();
        return Ok(s);
    }

    [Authorize(Roles = "Admin")]
    [HttpPatch("staff/shifts/{id:guid}")]
    public async Task<IActionResult> UpdateShift(Guid id, [FromBody] ShiftCreate req)
    {
        var s = await db.Shifts.NotDeleted().Include(x => x.User).FirstOrDefaultAsync(x => x.Id == id);
        if (s is null || s.User.NurseryId != User.NurseryId()) return NotFound();
        s.UserId = req.UserId;
        s.Date = req.Date;
        s.Start = req.Start;
        s.End = req.End;
        s.Status = req.Status;
        s.AbsenceReason = req.AbsenceReason;
        await db.SaveChangesAsync();
        return Ok(s);
    }

    [Authorize(Roles = "Admin")]
    [HttpDelete("staff/shifts/{id:guid}")]
    public async Task<IActionResult> DeleteShift(Guid id)
    {
        var s = await db.Shifts.NotDeleted().Include(x => x.User).FirstOrDefaultAsync(x => x.Id == id);
        if (s is null || s.User.NurseryId != User.NurseryId()) return NotFound();
        s.DeletedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync();
        return NoContent();
    }

    [Authorize(Roles = "Admin")]
    [HttpGet("waitlist")]
    public async Task<IActionResult> Waitlist()
    {
        var items = (await db.Waitlist.NotDeleted().Where(w => w.NurseryId == User.NurseryId()).ToListAsync())
            .OrderBy(w => w.SubmittedAt)
            .ToList();
        return Ok(items);
    }

    [Authorize(Roles = "Admin")]
    [HttpPost("waitlist")]
    public async Task<IActionResult> CreateWaitlist([FromBody] WaitlistCreate req)
    {
        var w = new WaitlistApplication
        {
            Id = Guid.NewGuid(),
            NurseryId = User.NurseryId(),
            ChildName = req.ChildName.Trim(),
            DateOfBirth = req.DateOfBirth,
            ParentName = req.ParentName.Trim(),
            ParentEmail = req.ParentEmail.Trim().ToLowerInvariant(),
            ParentPhone = req.Phone?.Trim() ?? "",
            SubmittedAt = DateTimeOffset.UtcNow,
            Status = WaitlistStatus.Pending
        };
        db.Waitlist.Add(w);
        await db.SaveChangesAsync();
        return Ok(w);
    }

    [Authorize(Roles = "Admin")]
    [HttpPatch("waitlist/{id:guid}")]
    public async Task<IActionResult> UpdateWaitlist(Guid id, [FromBody] WaitlistPatch req)
    {
        var w = await db.Waitlist.NotDeleted().FirstOrDefaultAsync(x => x.Id == id && x.NurseryId == User.NurseryId());
        if (w is null) return NotFound();
        if (req.Status is not null) w.Status = req.Status.Value;
        if (req.ChildName is not null) w.ChildName = req.ChildName.Trim();
        if (req.DateOfBirth is not null) w.DateOfBirth = req.DateOfBirth.Value;
        if (req.ParentName is not null) w.ParentName = req.ParentName.Trim();
        if (req.ParentEmail is not null) w.ParentEmail = req.ParentEmail.Trim().ToLowerInvariant();
        if (req.Phone is not null) w.ParentPhone = req.Phone.Trim();
        await db.SaveChangesAsync();
        return Ok(w);
    }

    [Authorize(Roles = "Admin")]
    [HttpDelete("waitlist/{id:guid}")]
    public async Task<IActionResult> DeleteWaitlist(Guid id)
    {
        var w = await db.Waitlist.NotDeleted().FirstOrDefaultAsync(x => x.Id == id && x.NurseryId == User.NurseryId());
        if (w is null) return NotFound();
        w.DeletedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync();
        return NoContent();
    }

    [Authorize(Roles = "Educator,Admin")]
    [HttpGet("classrooms")]
    public async Task<IActionResult> Classrooms()
    {
        var q = db.Classrooms.ActiveOnly().Where(c => c.NurseryId == User.NurseryId());
        if (User.Role() == nameof(UserRole.Educator))
        {
            var classroomId = await db.Users.Where(u => u.Id == User.Id()).Select(u => u.ClassroomId).FirstOrDefaultAsync();
            if (classroomId is Guid cid) q = q.Where(c => c.Id == cid);
            else return Ok(Array.Empty<object>());
        }
        return Ok(await q
            .Select(c => new { c.Id, c.Name, c.MinAgeMonths, c.MaxAgeMonths, children = c.Children.Count(ch => ch.Active) })
            .ToListAsync());
    }

    [Authorize(Roles = "Admin")]
    [HttpPost("classrooms")]
    public async Task<IActionResult> CreateClassroom([FromBody] ClassroomCreate req)
    {
        if (string.IsNullOrWhiteSpace(req.Name))
            return BadRequest(new { message = "Classroom name is required" });
        if (req.MinAgeMonths < 0 || req.MaxAgeMonths < req.MinAgeMonths)
            return BadRequest(new { message = "Invalid age range" });

        var room = new Classroom
        {
            Id = Guid.NewGuid(),
            NurseryId = User.NurseryId(),
            Name = req.Name.Trim(),
            MinAgeMonths = req.MinAgeMonths,
            MaxAgeMonths = req.MaxAgeMonths
        };
        db.Classrooms.Add(room);
        await db.SaveChangesAsync();
        return Ok(new { room.Id, room.Name, room.MinAgeMonths, room.MaxAgeMonths, children = 0 });
    }

    [Authorize(Roles = "Admin")]
    [HttpPatch("classrooms/{id:guid}")]
    public async Task<IActionResult> UpdateClassroom(Guid id, [FromBody] ClassroomUpdate req)
    {
        var room = await db.Classrooms.ActiveOnly().FirstOrDefaultAsync(c => c.Id == id && c.NurseryId == User.NurseryId());
        if (room is null) return NotFound();
        if (req.Name is not null)
        {
            if (string.IsNullOrWhiteSpace(req.Name)) return BadRequest(new { message = "Classroom name is required" });
            room.Name = req.Name.Trim();
        }
        if (req.MinAgeMonths is int min) room.MinAgeMonths = min;
        if (req.MaxAgeMonths is int max) room.MaxAgeMonths = max;
        if (room.MaxAgeMonths < room.MinAgeMonths)
            return BadRequest(new { message = "Invalid age range" });
        await db.SaveChangesAsync();
        return Ok(new { room.Id, room.Name, room.MinAgeMonths, room.MaxAgeMonths });
    }

    [Authorize(Roles = "Admin")]
    [HttpDelete("classrooms/{id:guid}")]
    public async Task<IActionResult> DeleteClassroom(Guid id)
    {
        var room = await db.Classrooms.ActiveOnly().FirstOrDefaultAsync(c => c.Id == id && c.NurseryId == User.NurseryId());
        if (room is null) return NotFound();
        var hasChildren = await db.Children.ActiveOnly().AnyAsync(c => c.ClassroomId == id);
        if (hasChildren) return BadRequest(new { message = "Move or remove children before deleting this classroom" });
        room.Active = false;
        await db.SaveChangesAsync();
        return NoContent();
    }

    [Authorize(Roles = "Admin")]
    [HttpPost("reminders")]
    public async Task<IActionResult> CreateReminder([FromBody] ReminderCreate req)
    {
        if (req.DueAt is null || string.IsNullOrWhiteSpace(req.Kind) || string.IsNullOrWhiteSpace(req.Title))
            return BadRequest(new { message = "Kind, title, and due date are required" });
        var r = new Reminder
        {
            Id = Guid.NewGuid(),
            NurseryId = User.NurseryId(),
            ChildId = req.ChildId,
            Kind = req.Kind.Trim(),
            Title = req.Title.Trim(),
            DueAt = req.DueAt.Value
        };
        db.Reminders.Add(r);
        await db.SaveChangesAsync();
        return Ok(r);
    }

    [Authorize(Roles = "Admin")]
    [HttpPatch("reminders/{id:guid}")]
    public async Task<IActionResult> UpdateReminder(Guid id, [FromBody] ReminderCreate req)
    {
        var r = await db.Reminders.NotDeleted().FirstOrDefaultAsync(x => x.Id == id && x.NurseryId == User.NurseryId());
        if (r is null) return NotFound();
        if (req.ChildId is not null) r.ChildId = req.ChildId;
        if (req.Kind is not null) r.Kind = req.Kind.Trim();
        if (req.Title is not null) r.Title = req.Title.Trim();
        if (req.DueAt is not null) r.DueAt = req.DueAt.Value;
        await db.SaveChangesAsync();
        return Ok(r);
    }

    [Authorize(Roles = "Admin")]
    [HttpDelete("reminders/{id:guid}")]
    public async Task<IActionResult> DeleteReminder(Guid id)
    {
        var r = await db.Reminders.NotDeleted().FirstOrDefaultAsync(x => x.Id == id && x.NurseryId == User.NurseryId());
        if (r is null) return NotFound();
        r.DeletedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync();
        return NoContent();
    }

    [Authorize(Roles = "Admin")]
    [HttpGet("stats")]
    public async Task<IActionResult> Stats()
    {
        var nid = User.NurseryId();
        var children = await db.Children.ActiveOnly().CountAsync(c => c.NurseryId == nid);
        var start = DateTime.Today;
        var end = start.AddDays(1);
        var attendances = await db.Attendances.AsNoTracking().ToListAsync();
        var checkedIn = attendances
            .Where(a => a.Type == "CheckIn" && a.At.LocalDateTime >= start && a.At.LocalDateTime < end)
            .Select(a => a.ChildId)
            .Distinct()
            .Count();
        var overdue = await db.Invoices.NotDeleted().CountAsync(i => i.Status != InvoiceStatus.Paid && i.DueDate < DateOnly.FromDateTime(DateTime.Today));
        var wait = await db.Waitlist.NotDeleted().CountAsync(w => w.Status == Models.WaitlistStatus.Pending);
        var rate = children == 0 ? 0 : Math.Round(100.0 * checkedIn / children, 1);
        return Ok(new { children, checkedIn, attendanceRate = rate, overdueInvoices = overdue, waitlist = wait });
    }

    [Authorize(Roles = "Admin")]
    [HttpGet("invoices")]
    public async Task<IActionResult> AllInvoices()
    {
        var items = await db.Invoices.NotDeleted().Include(i => i.Child).Where(i => i.Child.Active)
            .OrderByDescending(i => i.DueDate)
            .Select(i => new { i.Id, childId = i.ChildId, i.Period, i.Amount, i.Currency, i.DueDate, status = i.Status.ToString(), i.PaidAt, child = i.Child.FirstName + " " + i.Child.LastName })
            .ToListAsync();
        foreach (var i in await db.Invoices.NotDeleted().Where(x => x.Status == InvoiceStatus.Pending && x.DueDate < DateOnly.FromDateTime(DateTime.Today)).ToListAsync())
            i.Status = InvoiceStatus.Overdue;
        await db.SaveChangesAsync();
        return Ok(items);
    }

    public record SendMessage(string Body);
    public record CreateConversationDto(Guid? ChildId, Guid? StaffUserId, Guid? ParentUserId);
    public record AnnouncementCreate(string Title, string Body);
    public record EventCreate(string Title, DateTimeOffset StartsAt, DateTimeOffset EndsAt, string? Location);
    public record ActivityCreate(Guid ClassroomId, DateOnly WeekStart, string Theme, string PlanJson);
    public record IncidentCreate(Guid ChildId, string Title, string Details);
    public record ShiftCreate(Guid UserId, DateOnly Date, TimeOnly Start, TimeOnly End, ShiftStatus Status, string? AbsenceReason);
    public record WaitlistPatch(WaitlistStatus? Status, string? ChildName, DateOnly? DateOfBirth, string? ParentName, string? ParentEmail, string? Phone);
    public record ReminderCreate(Guid? ChildId, string? Kind, string? Title, DateTimeOffset? DueAt);
    public record WaitlistCreate(string ChildName, DateOnly DateOfBirth, string ParentName, string ParentEmail, string? Phone);
    public record ClassroomCreate(string Name, int MinAgeMonths, int MaxAgeMonths);
    public record ClassroomUpdate(string? Name, int? MinAgeMonths, int? MaxAgeMonths);
}
