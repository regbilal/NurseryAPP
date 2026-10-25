using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Nursery.Api.Data;
using Nursery.Api.Models;
using Nursery.Api.Services;

namespace Nursery.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/children")]
public class ChildrenController(AppDbContext db, WeeklySummaryService summary, PaymentReceiptService receipts, MediaUploadService mediaUpload) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List()
    {
        var nurseryId = User.NurseryId();
        IQueryable<Child> q = db.Children.Include(c => c.Classroom).Where(c => c.NurseryId == nurseryId);
        if (User.Role() == nameof(UserRole.Parent))
        {
            var uid = User.Id();
            q = q.Where(c => c.Parents.Any(p => p.ParentId == uid));
        }
        else if (User.Role() == nameof(UserRole.Educator))
        {
            var me = await db.Users.FindAsync(User.Id());
            if (me?.ClassroomId is Guid cid) q = q.Where(c => c.ClassroomId == cid);
        }

        var allergies = await db.Allergies.ToListAsync();
        var items = await q.OrderBy(c => c.FirstName).ToListAsync();
        var parentLinks = await db.ParentChildren.ToListAsync();
        return Ok(items.Select(c => new
        {
            c.Id,
            c.FirstName,
            c.LastName,
            c.DateOfBirth,
            c.QrCode,
            c.PhotoUrl,
            classroom = c.Classroom.Name,
            classroomId = c.ClassroomId,
            parentIds = parentLinks.Where(p => p.ChildId == c.Id).Select(p => p.ParentId).ToList(),
            allergies = allergies.Where(a => a.ChildId == c.Id).Select(a => new { a.Name, a.Severity })
        }));
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id)
    {
        var child = await db.Children.Include(c => c.Classroom).FirstOrDefaultAsync(c => c.Id == id);
        if (child is null || !await CanAccess(id)) return NotFound();
        var allergies = await db.Allergies.Where(a => a.ChildId == id).ToListAsync();
        var vaccines = await db.Vaccines.Where(v => v.ChildId == id).ToListAsync();
        var meds = await db.Medications.Where(m => m.ChildId == id).ToListAsync();
        var pickups = await db.Pickups.Where(p => p.ChildId == id).ToListAsync();
        var docs = await db.Documents.Where(d => d.ChildId == id).ToListAsync();
        var parents = await db.ParentChildren.Where(p => p.ChildId == id)
            .Join(db.Users, pc => pc.ParentId, u => u.Id, (_, u) => new { u.Id, u.FullName, u.Email, u.Phone })
            .ToListAsync();
        return Ok(new
        {
            child.Id,
            child.FirstName,
            child.LastName,
            child.DateOfBirth,
            child.QrCode,
            child.PhotoUrl,
            child.Notes,
            classroom = child.Classroom.Name,
            classroomId = child.ClassroomId,
            parents,
            allergies,
            vaccines,
            medications = meds,
            pickups,
            documents = docs
        });
    }

    [Authorize(Roles = "Admin")]
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] ChildCreate req)
    {
        var nurseryId = User.NurseryId();
        var room = await db.Classrooms.FirstOrDefaultAsync(c => c.Id == req.ClassroomId && c.NurseryId == nurseryId);
        if (room is null) return BadRequest(new { message = "Invalid classroom" });

        var child = new Child
        {
            Id = Guid.NewGuid(),
            NurseryId = nurseryId,
            ClassroomId = req.ClassroomId,
            FirstName = req.FirstName.Trim(),
            LastName = req.LastName.Trim(),
            DateOfBirth = req.DateOfBirth,
            QrCode = $"{req.FirstName}-{req.LastName}-{Guid.NewGuid().ToString()[..4]}".ToUpperInvariant(),
            Notes = req.Notes
        };
        db.Children.Add(child);

        var parentIds = (req.ParentIds ?? []).ToList();
        if (req.ParentId is Guid single) parentIds.Add(single);
        parentIds = parentIds.Distinct().ToList();
        foreach (var pid in parentIds)
        {
            var parent = await db.Users.FirstOrDefaultAsync(u =>
                u.Id == pid && u.NurseryId == nurseryId && u.Role == UserRole.Parent && u.Active);
            if (parent is null) return BadRequest(new { message = "Invalid parent id" });
            db.ParentChildren.Add(new ParentChild { ParentId = pid, ChildId = child.Id });
        }

        await db.SaveChangesAsync();
        return Ok(new
        {
            child.Id,
            child.FirstName,
            child.LastName,
            child.ClassroomId,
            classroom = room.Name,
            parentIds
        });
    }

    [Authorize(Roles = "Admin")]
    [HttpPatch("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] ChildUpdate req)
    {
        var child = await db.Children.FirstOrDefaultAsync(c => c.Id == id && c.NurseryId == User.NurseryId());
        if (child is null) return NotFound();

        if (req.ClassroomId is Guid cid)
        {
            var room = await db.Classrooms.FirstOrDefaultAsync(c => c.Id == cid && c.NurseryId == child.NurseryId);
            if (room is null) return BadRequest(new { message = "Invalid classroom" });
            child.ClassroomId = cid;
        }

        if (req.ParentIds is not null)
        {
            var nurseryId = child.NurseryId;
            var validParents = await db.Users
                .Where(u => req.ParentIds.Contains(u.Id) && u.NurseryId == nurseryId && u.Role == UserRole.Parent && u.Active)
                .Select(u => u.Id)
                .ToListAsync();
            if (validParents.Count != req.ParentIds.Distinct().Count())
                return BadRequest(new { message = "Invalid parent id" });

            var existing = await db.ParentChildren.Where(p => p.ChildId == id).ToListAsync();
            db.ParentChildren.RemoveRange(existing);
            foreach (var pid in validParents)
                db.ParentChildren.Add(new ParentChild { ParentId = pid, ChildId = id });
        }

        if (req.FirstName is not null) child.FirstName = req.FirstName.Trim();
        if (req.LastName is not null) child.LastName = req.LastName.Trim();
        if (req.DateOfBirth is not null) child.DateOfBirth = req.DateOfBirth.Value;
        if (req.Notes is not null) child.Notes = req.Notes;

        await db.SaveChangesAsync();
        return Ok(new { child.Id, child.ClassroomId, child.FirstName, child.LastName });
    }

    [HttpGet("{id:guid}/care")]
    public async Task<IActionResult> Care(Guid id, [FromQuery] DateOnly? day)
    {
        if (!await CanAccess(id)) return Forbid();
        var target = day ?? DateOnly.FromDateTime(DateTime.Today);
        var events = (await db.CareEvents.Where(e => e.ChildId == id).ToListAsync())
            .Where(e => DateOnly.FromDateTime(e.At.LocalDateTime) == target)
            .OrderByDescending(e => e.At)
            .ToList();
        var attendance = (await db.Attendances.Where(a => a.ChildId == id).ToListAsync())
            .Where(a => DateOnly.FromDateTime(a.At.LocalDateTime) == target)
            .OrderByDescending(a => a.At)
            .ToList();
        return Ok(new
        {
            events = events.Select(ApiJson.CareEvent),
            attendance = attendance.Select(ApiJson.Attendance)
        });
    }

    [Authorize(Roles = "Educator,Admin")]
    [HttpPost("{id:guid}/care")]
    public async Task<IActionResult> AddCare(Guid id, [FromBody] CareCreate req)
    {
        if (!await CanAccess(id)) return Forbid();
        if (!string.IsNullOrWhiteSpace(req.ClientId))
        {
            var existing = await db.CareEvents.FirstOrDefaultAsync(e => e.ClientId == req.ClientId);
            if (existing is not null) return Ok(ApiJson.CareEvent(existing));
        }
        var ev = new CareEvent
        {
            Id = Guid.NewGuid(),
            ChildId = id,
            At = req.At ?? DateTimeOffset.Now,
            Type = req.Type,
            Subtype = req.Subtype,
            Amount = req.Amount,
            Notes = req.Notes,
            CreatedById = User.Id(),
            ClientId = req.ClientId
        };
        db.CareEvents.Add(ev);
        await db.SaveChangesAsync();
        return Ok(ApiJson.CareEvent(ev));
    }

    [Authorize(Roles = "Educator,Admin")]
    [HttpPost("attendance")]
    public async Task<IActionResult> Attendance([FromBody] AttendanceCreate req)
    {
        Child? child = null;
        if (req.ChildId is Guid cid) child = await db.Children.FindAsync(cid);
        else if (!string.IsNullOrWhiteSpace(req.QrCode))
            child = await db.Children.FirstOrDefaultAsync(c => c.QrCode == req.QrCode);
        if (child is null) return NotFound(new { message = "Child not found" });

        var rec = new Attendance
        {
            Id = Guid.NewGuid(),
            ChildId = child.Id,
            At = DateTimeOffset.Now,
            Type = req.Type is "CheckOut" ? "CheckOut" : "CheckIn",
            RecordedById = User.Id(),
            Method = req.Method ?? "Tap"
        };
        db.Attendances.Add(rec);

        var parentIds = await db.ParentChildren.Where(p => p.ChildId == child.Id).Select(p => p.ParentId).ToListAsync();
        foreach (var pid in parentIds)
        {
            db.Notifications.Add(new Notification
            {
                Id = Guid.NewGuid(),
                UserId = pid,
                Title = rec.Type,
                Body = $"{child.FirstName} {rec.Type} at {rec.At:HH:mm}",
                CreatedAt = rec.At
            });
        }
        await db.SaveChangesAsync();
        return Ok(ApiJson.Attendance(rec));
    }

    [HttpGet("{id:guid}/media")]
    public async Task<IActionResult> Media(Guid id)
    {
        if (!await CanAccess(id)) return Forbid();
        var media = (await db.Media.Where(m => m.ChildId == id).ToListAsync())
            .OrderByDescending(m => m.CreatedAt)
            .ToList();
        return Ok(media.Select(ApiJson.Media));
    }

    [Authorize(Roles = "Educator,Admin")]
    [HttpPost("{id:guid}/media")]
    public async Task<IActionResult> UploadMedia(Guid id, IFormFile file, [FromForm] string? caption, [FromForm] string kind = "Photo")
    {
        if (file is null || file.Length == 0) return BadRequest(new { message = "File required." });
        if (!await CanPostMediaForChild(id)) return Forbid();
        var items = await mediaUpload.SaveForChildrenAsync(file, [id], caption, kind, User.Id());
        return Ok(ApiJson.Media(items[0]));
    }

    [HttpGet("{id:guid}/invoices")]
    public async Task<IActionResult> Invoices(Guid id)
    {
        if (!await CanAccess(id)) return Forbid();
        var items = await db.Invoices.Where(i => i.ChildId == id).OrderByDescending(i => i.DueDate)
            .Select(i => new
            {
                i.Id,
                i.ChildId,
                i.Period,
                i.Amount,
                i.Currency,
                i.DueDate,
                status = i.Status.ToString(),
                i.PaidAt,
                i.ReceiptNumber,
                i.ReceiptUrl
            })
            .ToListAsync();
        return Ok(items);
    }

    [Authorize(Roles = "Admin")]
    [HttpPost("{id:guid}/invoices")]
    public async Task<IActionResult> CreateInvoice(Guid id, [FromBody] InvoiceCreate req)
    {
        var inv = new Invoice
        {
            Id = Guid.NewGuid(),
            ChildId = id,
            Period = req.Period,
            Amount = req.Amount,
            DueDate = req.DueDate,
            Status = InvoiceStatus.Pending
        };
        db.Invoices.Add(inv);
        await db.SaveChangesAsync();
        return Ok(inv);
    }

    [Authorize(Roles = "Admin,Parent")]
    [HttpPost("invoices/{invoiceId:guid}/pay")]
    public async Task<IActionResult> Pay(Guid invoiceId, [FromBody] PayInvoiceRequest? req)
    {
        var inv = await db.Invoices.Include(i => i.Child).FirstOrDefaultAsync(i => i.Id == invoiceId);
        if (inv is null) return NotFound();
        if (!await CanAccess(inv.ChildId)) return Forbid();

        var user = await db.Users.FindAsync(User.Id());
        var lang = ReceiptTexts.NormalizeLang(req?.Lang ?? user?.PreferredLanguage);

        if (inv.Status != InvoiceStatus.Paid)
        {
            inv.Status = InvoiceStatus.Paid;
            inv.PaidAt = DateTimeOffset.Now;
        }

        if (string.IsNullOrEmpty(inv.ReceiptUrl))
        {
            var (number, url, html) = await receipts.GenerateAsync(inv, User.Id(), lang);
            inv.ReceiptNumber = number;
            inv.ReceiptUrl = url;
            db.Documents.Add(new ParentDocument
            {
                Id = Guid.NewGuid(),
                ChildId = inv.ChildId,
                Title = $"{ReceiptTexts.Get(lang).Title} {number}",
                Url = url
            });
            await db.SaveChangesAsync();
            return Ok(new
            {
                inv.Id,
                inv.ChildId,
                inv.Period,
                inv.Amount,
                inv.Currency,
                inv.DueDate,
                status = inv.Status.ToString(),
                inv.PaidAt,
                inv.ReceiptNumber,
                inv.ReceiptUrl,
                receiptHtml = html
            });
        }

        await db.SaveChangesAsync();
        return Ok(new
        {
            inv.Id,
            inv.ChildId,
            inv.Period,
            inv.Amount,
            inv.Currency,
            inv.DueDate,
            status = inv.Status.ToString(),
            inv.PaidAt,
            inv.ReceiptNumber,
            inv.ReceiptUrl
        });
    }

    [HttpGet("invoices/{invoiceId:guid}/receipt")]
    public async Task<IActionResult> Receipt(Guid invoiceId, [FromQuery] string? lang)
    {
        var inv = await db.Invoices.Include(i => i.Child).FirstOrDefaultAsync(i => i.Id == invoiceId);
        if (inv is null) return NotFound();
        if (!await CanAccess(inv.ChildId)) return Forbid();
        if (inv.Status != InvoiceStatus.Paid) return BadRequest(new { message = "Invoice is not paid" });

        var user = await db.Users.FindAsync(User.Id());
        var receiptLang = ReceiptTexts.NormalizeLang(lang ?? user?.PreferredLanguage);
        var generated = await receipts.GenerateAsync(inv, User.Id(), receiptLang);

        if (string.IsNullOrEmpty(inv.ReceiptNumber))
        {
            inv.ReceiptNumber = generated.Number;
            inv.ReceiptUrl = generated.Url;
            await db.SaveChangesAsync();
        }

        return Content(generated.Html, "text/html; charset=utf-8");
    }

    [Authorize(Roles = "Admin,Parent")]
    [HttpPost("{id:guid}/allergies")]
    public async Task<IActionResult> AddAllergy(Guid id, [FromBody] AllergyCreate req)
    {
        if (!await CanManageChildRecords(id)) return Forbid();
        var a = new Allergy { Id = Guid.NewGuid(), ChildId = id, Name = req.Name.Trim(), Severity = req.Severity.Trim() };
        db.Allergies.Add(a);
        await db.SaveChangesAsync();
        return Ok(a);
    }

    [Authorize(Roles = "Admin,Parent")]
    [HttpPatch("{id:guid}/allergies/{allergyId:guid}")]
    public async Task<IActionResult> UpdateAllergy(Guid id, Guid allergyId, [FromBody] AllergyCreate req)
    {
        if (!await CanManageChildRecords(id)) return Forbid();
        var a = await db.Allergies.FirstOrDefaultAsync(x => x.Id == allergyId && x.ChildId == id);
        if (a is null) return NotFound();
        a.Name = req.Name.Trim();
        a.Severity = req.Severity.Trim();
        await db.SaveChangesAsync();
        return Ok(a);
    }

    [Authorize(Roles = "Admin,Parent")]
    [HttpDelete("{id:guid}/allergies/{allergyId:guid}")]
    public async Task<IActionResult> DeleteAllergy(Guid id, Guid allergyId)
    {
        if (!await CanManageChildRecords(id)) return Forbid();
        var a = await db.Allergies.FirstOrDefaultAsync(x => x.Id == allergyId && x.ChildId == id);
        if (a is null) return NotFound();
        db.Allergies.Remove(a);
        await db.SaveChangesAsync();
        return NoContent();
    }

    [Authorize(Roles = "Admin,Parent")]
    [HttpPost("{id:guid}/vaccines")]
    public async Task<IActionResult> AddVaccine(Guid id, [FromBody] VaccineCreate req)
    {
        if (!await CanManageChildRecords(id)) return Forbid();
        var v = new Vaccine { Id = Guid.NewGuid(), ChildId = id, Name = req.Name.Trim(), AdministeredOn = req.AdministeredOn, DueOn = req.DueOn };
        db.Vaccines.Add(v);
        await db.SaveChangesAsync();
        return Ok(v);
    }

    [Authorize(Roles = "Admin,Parent")]
    [HttpPatch("{id:guid}/vaccines/{vaccineId:guid}")]
    public async Task<IActionResult> UpdateVaccine(Guid id, Guid vaccineId, [FromBody] VaccineCreate req)
    {
        if (!await CanManageChildRecords(id)) return Forbid();
        var v = await db.Vaccines.FirstOrDefaultAsync(x => x.Id == vaccineId && x.ChildId == id);
        if (v is null) return NotFound();
        v.Name = req.Name.Trim();
        v.AdministeredOn = req.AdministeredOn;
        v.DueOn = req.DueOn;
        await db.SaveChangesAsync();
        return Ok(v);
    }

    [Authorize(Roles = "Admin,Parent")]
    [HttpDelete("{id:guid}/vaccines/{vaccineId:guid}")]
    public async Task<IActionResult> DeleteVaccine(Guid id, Guid vaccineId)
    {
        if (!await CanManageChildRecords(id)) return Forbid();
        var v = await db.Vaccines.FirstOrDefaultAsync(x => x.Id == vaccineId && x.ChildId == id);
        if (v is null) return NotFound();
        db.Vaccines.Remove(v);
        await db.SaveChangesAsync();
        return NoContent();
    }

    [Authorize(Roles = "Admin,Parent")]
    [HttpPost("{id:guid}/medications")]
    public async Task<IActionResult> AddMedication(Guid id, [FromBody] MedicationCreate req)
    {
        if (!await CanManageChildRecords(id)) return Forbid();
        var m = new Medication
        {
            Id = Guid.NewGuid(),
            ChildId = id,
            Name = req.Name.Trim(),
            Dosage = req.Dosage.Trim(),
            Schedule = req.Schedule.Trim(),
            Active = req.Active
        };
        db.Medications.Add(m);
        await db.SaveChangesAsync();
        return Ok(m);
    }

    [Authorize(Roles = "Admin,Parent")]
    [HttpPatch("{id:guid}/medications/{medicationId:guid}")]
    public async Task<IActionResult> UpdateMedication(Guid id, Guid medicationId, [FromBody] MedicationCreate req)
    {
        if (!await CanManageChildRecords(id)) return Forbid();
        var m = await db.Medications.FirstOrDefaultAsync(x => x.Id == medicationId && x.ChildId == id);
        if (m is null) return NotFound();
        m.Name = req.Name.Trim();
        m.Dosage = req.Dosage.Trim();
        m.Schedule = req.Schedule.Trim();
        m.Active = req.Active;
        await db.SaveChangesAsync();
        return Ok(m);
    }

    [Authorize(Roles = "Admin,Parent")]
    [HttpDelete("{id:guid}/medications/{medicationId:guid}")]
    public async Task<IActionResult> DeleteMedication(Guid id, Guid medicationId)
    {
        if (!await CanManageChildRecords(id)) return Forbid();
        var m = await db.Medications.FirstOrDefaultAsync(x => x.Id == medicationId && x.ChildId == id);
        if (m is null) return NotFound();
        db.Medications.Remove(m);
        await db.SaveChangesAsync();
        return NoContent();
    }

    [Authorize(Roles = "Admin,Parent")]
    [HttpPost("{id:guid}/pickups")]
    public async Task<IActionResult> AddPickup(Guid id, [FromBody] PickupCreate req)
    {
        if (!await CanManageChildRecords(id)) return Forbid();
        var p = new AuthorizedPickup
        {
            Id = Guid.NewGuid(),
            ChildId = id,
            FullName = req.FullName,
            Relation = req.Relation,
            Phone = req.Phone,
            Pin = req.Pin ?? Random.Shared.Next(1000, 9999).ToString()
        };
        db.Pickups.Add(p);
        await db.SaveChangesAsync();
        return Ok(p);
    }

    [Authorize(Roles = "Admin,Parent")]
    [HttpPatch("{id:guid}/pickups/{pickupId:guid}")]
    public async Task<IActionResult> UpdatePickup(Guid id, Guid pickupId, [FromBody] PickupUpdate req)
    {
        if (!await CanManageChildRecords(id)) return Forbid();
        var p = await db.Pickups.FirstOrDefaultAsync(x => x.Id == pickupId && x.ChildId == id);
        if (p is null) return NotFound();
        if (req.FullName is not null) p.FullName = req.FullName.Trim();
        if (req.Relation is not null) p.Relation = req.Relation.Trim();
        if (req.Phone is not null) p.Phone = req.Phone.Trim();
        if (req.Pin is not null) p.Pin = req.Pin.Trim();
        await db.SaveChangesAsync();
        return Ok(p);
    }

    [Authorize(Roles = "Admin,Parent")]
    [HttpDelete("{id:guid}/pickups/{pickupId:guid}")]
    public async Task<IActionResult> DeletePickup(Guid id, Guid pickupId)
    {
        if (!await CanManageChildRecords(id)) return Forbid();
        var p = await db.Pickups.FirstOrDefaultAsync(x => x.Id == pickupId && x.ChildId == id);
        if (p is null) return NotFound();
        db.Pickups.Remove(p);
        await db.SaveChangesAsync();
        return NoContent();
    }

    [Authorize(Roles = "Admin")]
    [HttpPatch("invoices/{invoiceId:guid}")]
    public async Task<IActionResult> UpdateInvoice(Guid invoiceId, [FromBody] InvoiceUpdate req)
    {
        var inv = await db.Invoices.Include(i => i.Child).FirstOrDefaultAsync(i => i.Id == invoiceId);
        if (inv is null || inv.Child.NurseryId != User.NurseryId()) return NotFound();
        if (req.Period is not null) inv.Period = req.Period.Trim();
        if (req.Amount is not null) inv.Amount = req.Amount.Value;
        if (req.DueDate is not null) inv.DueDate = req.DueDate.Value;
        if (req.Status is not null && Enum.TryParse<InvoiceStatus>(req.Status, true, out var st)) inv.Status = st;
        await db.SaveChangesAsync();
        return Ok(inv);
    }

    [HttpGet("{id:guid}/weekly-summary")]
    public async Task<IActionResult> Weekly(Guid id, [FromQuery] string lang = "en")
    {
        if (!await CanAccess(id)) return Forbid();
        return Ok(new { summary = await summary.GenerateAsync(id, lang, HttpContext.RequestAborted) });
    }

    [HttpGet("{id:guid}/weekly-summary/document")]
    public async Task<IActionResult> WeeklyDocument(Guid id, [FromQuery] string lang = "en")
    {
        if (!await CanAccess(id)) return Forbid();
        var html = await summary.GenerateDocumentHtmlAsync(id, lang, HttpContext.RequestAborted);
        return Content(html, "text/html; charset=utf-8");
    }

    [Authorize(Roles = "Educator,Admin")]
    [HttpPost("{id:guid}/notes")]
    public async Task<IActionResult> Note(Guid id, [FromBody] NoteCreate req)
    {
        db.DevelopmentNotes.Add(new DevelopmentNote
        {
            Id = Guid.NewGuid(),
            ChildId = id,
            WeekStart = DateOnly.FromDateTime(DateTime.Today),
            Body = req.Body,
            AuthorId = User.Id()
        });
        await db.SaveChangesAsync();
        return Ok();
    }

    [HttpGet("{id:guid}/notes")]
    public async Task<IActionResult> Notes(Guid id)
    {
        if (!await CanAccess(id)) return Forbid();
        return Ok(await db.DevelopmentNotes.Where(n => n.ChildId == id).ToListAsync());
    }

    private async Task<bool> CanAccess(Guid childId)
    {
        var child = await db.Children.Include(c => c.Parents).FirstOrDefaultAsync(c => c.Id == childId);
        if (child is null || child.NurseryId != User.NurseryId()) return false;
        if (User.Role() == nameof(UserRole.Admin)) return true;
        if (User.Role() == nameof(UserRole.Parent))
            return child.Parents.Any(p => p.ParentId == User.Id());
        var me = await db.Users.FindAsync(User.Id());
        return me?.ClassroomId == child.ClassroomId;
    }

    private async Task<bool> CanPostMediaForChild(Guid childId)
    {
        var child = await db.Children.AsNoTracking().FirstOrDefaultAsync(c => c.Id == childId);
        if (child is null || child.NurseryId != User.NurseryId()) return false;
        if (User.Role() == nameof(UserRole.Admin)) return true;
        if (User.Role() == nameof(UserRole.Educator))
        {
            var me = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == User.Id());
            return me?.ClassroomId == child.ClassroomId;
        }
        return false;
    }

    private async Task<bool> CanManageChildRecords(Guid childId)
    {
        var child = await db.Children.AsNoTracking().FirstOrDefaultAsync(c => c.Id == childId);
        if (child is null || child.NurseryId != User.NurseryId()) return false;
        if (User.Role() == nameof(UserRole.Admin)) return true;
        if (User.Role() == nameof(UserRole.Parent))
            return await db.ParentChildren.AnyAsync(p => p.ChildId == childId && p.ParentId == User.Id());
        return false;
    }

    public record ChildCreate(string FirstName, string LastName, DateOnly DateOfBirth, Guid ClassroomId, Guid? ParentId, IEnumerable<Guid>? ParentIds, string? Notes);
    public record ChildUpdate(string? FirstName, string? LastName, DateOnly? DateOfBirth, Guid? ClassroomId, IEnumerable<Guid>? ParentIds, string? Notes);
    public record CareCreate(CareEventType Type, string? Subtype, string? Amount, string? Notes, DateTimeOffset? At, string? ClientId);
    public record AttendanceCreate(Guid? ChildId, string? QrCode, string Type, string? Method);
    public record InvoiceCreate(string Period, decimal Amount, DateOnly DueDate);
    public record PickupCreate(string FullName, string Relation, string Phone, string? Pin);
    public record PickupUpdate(string? FullName, string? Relation, string? Phone, string? Pin);
    public record AllergyCreate(string Name, string Severity);
    public record VaccineCreate(string Name, DateOnly? AdministeredOn, DateOnly? DueOn);
    public record MedicationCreate(string Name, string Dosage, string Schedule, bool Active = true);
    public record InvoiceUpdate(string? Period, decimal? Amount, DateOnly? DueDate, string? Status);
    public record NoteCreate(string Body);
    public record PayInvoiceRequest(string? Lang);
}
