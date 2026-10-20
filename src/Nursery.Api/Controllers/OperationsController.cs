using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Nursery.Api.Data;
using Nursery.Api.Hubs;
using Nursery.Api.Models;

namespace Nursery.Api.Controllers;

[ApiController]
[Authorize]
[Route("api")]
public class OperationsController(AppDbContext db, IHubContext<ChatHub> hub) : ControllerBase
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
        var items = await db.Notifications.Where(n => n.UserId == User.Id())
            .OrderByDescending(n => n.CreatedAt).Take(50).ToListAsync();
        foreach (var n in items) n.Read = true;
        await db.SaveChangesAsync();
        return Ok(items);
    }

    [HttpGet("conversations")]
    public async Task<IActionResult> Conversations()
    {
        var q = db.Conversations.Where(c => c.NurseryId == User.NurseryId());
        if (User.Role() == nameof(UserRole.Parent))
        {
            var ids = await db.ParentChildren.Where(p => p.ParentId == User.Id()).Select(p => p.ChildId).ToListAsync();
            q = q.Where(c => ids.Contains(c.ChildId));
        }
        var list = await q.ToListAsync();
        var last = await db.Messages.OrderByDescending(m => m.SentAt).ToListAsync();
        return Ok(list.Select(c => new
        {
            c.Id,
            c.Title,
            c.ChildId,
            lastMessage = last.FirstOrDefault(m => m.ConversationId == c.Id)?.Body
        }));
    }

    [HttpGet("conversations/{id:guid}/messages")]
    public async Task<IActionResult> Messages(Guid id)
    {
        var msgs = await db.Messages.Include(m => m.Sender)
            .Where(m => m.ConversationId == id)
            .OrderBy(m => m.SentAt)
            .Select(m => new { m.Id, m.Body, m.SentAt, senderId = m.SenderId, senderName = m.Sender.FullName })
            .ToListAsync();
        return Ok(msgs);
    }

    [HttpPost("conversations/{id:guid}/messages")]
    public async Task<IActionResult> Send(Guid id, [FromBody] SendMessage req)
    {
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
        await hub.Clients.Group(id.ToString()).SendAsync("message", new { msg.Id, msg.Body, msg.SentAt, senderId = msg.SenderId, senderName = User.Identity!.Name });
        return Ok(msg);
    }

    [HttpGet("announcements")]
    public async Task<IActionResult> Announcements() =>
        Ok(await db.Announcements.Where(a => a.NurseryId == User.NurseryId()).OrderByDescending(a => a.PublishedAt).ToListAsync());

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

    [HttpGet("events")]
    public async Task<IActionResult> Events() =>
        Ok(await db.Events.Where(e => e.NurseryId == User.NurseryId()).OrderBy(e => e.StartsAt).ToListAsync());

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

    [HttpGet("reminders")]
    public async Task<IActionResult> Reminders() =>
        Ok(await db.Reminders.Where(r => r.NurseryId == User.NurseryId()).OrderBy(r => r.DueAt).ToListAsync());

    [HttpGet("activities")]
    public async Task<IActionResult> Activities() =>
        Ok(await db.ActivityPlans.OrderByDescending(a => a.WeekStart).ToListAsync());

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
    [HttpPost("incidents")]
    public async Task<IActionResult> Incident([FromBody] IncidentCreate req)
    {
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

    [HttpGet("incidents")]
    public async Task<IActionResult> Incidents()
    {
        var q = db.Incidents.Include(i => i.Child).AsQueryable();
        if (User.Role() == nameof(UserRole.Parent))
        {
            var ids = await db.ParentChildren.Where(p => p.ParentId == User.Id()).Select(p => p.ChildId).ToListAsync();
            q = q.Where(i => ids.Contains(i.ChildId));
        }
        return Ok(await q.OrderByDescending(i => i.At).Select(i => new { i.Id, i.Title, i.Details, i.At, child = i.Child.FirstName }).ToListAsync());
    }

    [Authorize(Roles = "Admin")]
    [HttpGet("staff")]
    public async Task<IActionResult> Staff()
    {
        var staff = await db.Users.Where(u => u.NurseryId == User.NurseryId() && u.Role != UserRole.Parent)
            .Select(u => new { u.Id, u.FullName, u.Email, role = u.Role.ToString(), u.ClassroomId, u.Phone })
            .ToListAsync();
        var shifts = await db.Shifts.Include(s => s.User).OrderByDescending(s => s.Date).Take(40).ToListAsync();
        return Ok(new { staff, shifts });
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
    [HttpGet("waitlist")]
    public async Task<IActionResult> Waitlist() =>
        Ok(await db.Waitlist.Where(w => w.NurseryId == User.NurseryId()).OrderBy(w => w.SubmittedAt).ToListAsync());

    [Authorize(Roles = "Admin")]
    [HttpPatch("waitlist/{id:guid}")]
    public async Task<IActionResult> UpdateWaitlist(Guid id, [FromBody] WaitlistPatch req)
    {
        var w = await db.Waitlist.FindAsync(id);
        if (w is null) return NotFound();
        w.Status = req.Status;
        await db.SaveChangesAsync();
        return Ok(w);
    }

    [Authorize(Roles = "Admin")]
    [HttpGet("classrooms")]
    public async Task<IActionResult> Classrooms() =>
        Ok(await db.Classrooms.Where(c => c.NurseryId == User.NurseryId())
            .Select(c => new { c.Id, c.Name, c.MinAgeMonths, c.MaxAgeMonths, children = c.Children.Count })
            .ToListAsync());

    [Authorize(Roles = "Admin")]
    [HttpGet("stats")]
    public async Task<IActionResult> Stats()
    {
        var nid = User.NurseryId();
        var children = await db.Children.CountAsync(c => c.NurseryId == nid);
        var start = DateTime.Today;
        var end = start.AddDays(1);
        var attendances = await db.Attendances.AsNoTracking().ToListAsync();
        var checkedIn = attendances
            .Where(a => a.Type == "CheckIn" && a.At.LocalDateTime >= start && a.At.LocalDateTime < end)
            .Select(a => a.ChildId)
            .Distinct()
            .Count();
        var overdue = await db.Invoices.CountAsync(i => i.Status != InvoiceStatus.Paid && i.DueDate < DateOnly.FromDateTime(DateTime.Today));
        var wait = await db.Waitlist.CountAsync(w => w.Status == Models.WaitlistStatus.Pending);
        var rate = children == 0 ? 0 : Math.Round(100.0 * checkedIn / children, 1);
        return Ok(new { children, checkedIn, attendanceRate = rate, overdueInvoices = overdue, waitlist = wait });
    }

    [Authorize(Roles = "Admin")]
    [HttpGet("invoices")]
    public async Task<IActionResult> AllInvoices()
    {
        var items = await db.Invoices.Include(i => i.Child)
            .OrderByDescending(i => i.DueDate)
            .Select(i => new { i.Id, i.Period, i.Amount, i.Currency, i.DueDate, i.Status, i.PaidAt, child = i.Child.FirstName + " " + i.Child.LastName })
            .ToListAsync();
        foreach (var i in await db.Invoices.Where(x => x.Status == InvoiceStatus.Pending && x.DueDate < DateOnly.FromDateTime(DateTime.Today)).ToListAsync())
            i.Status = InvoiceStatus.Overdue;
        await db.SaveChangesAsync();
        return Ok(items);
    }

    public record SendMessage(string Body);
    public record AnnouncementCreate(string Title, string Body);
    public record EventCreate(string Title, DateTimeOffset StartsAt, DateTimeOffset EndsAt, string? Location);
    public record ActivityCreate(Guid ClassroomId, DateOnly WeekStart, string Theme, string PlanJson);
    public record IncidentCreate(Guid ChildId, string Title, string Details);
    public record ShiftCreate(Guid UserId, DateOnly Date, TimeOnly Start, TimeOnly End, ShiftStatus Status, string? AbsenceReason);
    public record WaitlistPatch(WaitlistStatus Status);
}
