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
public class ChildrenController(AppDbContext db, WeeklySummaryService summary, PaymentReceiptService receipts) : ControllerBase
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
        var child = new Child
        {
            Id = Guid.NewGuid(),
            NurseryId = User.NurseryId(),
            ClassroomId = req.ClassroomId,
            FirstName = req.FirstName,
            LastName = req.LastName,
            DateOfBirth = req.DateOfBirth,
            QrCode = $"{req.FirstName}-{req.LastName}-{Guid.NewGuid().ToString()[..4]}".ToUpperInvariant(),
            Notes = req.Notes
        };
        db.Children.Add(child);
        if (req.ParentId is Guid pid)
            db.ParentChildren.Add(new ParentChild { ParentId = pid, ChildId = child.Id });
        await db.SaveChangesAsync();
        return Ok(child);
    }

    [HttpGet("{id:guid}/care")]
    public async Task<IActionResult> Care(Guid id, [FromQuery] DateTime? day)
    {
        if (!await CanAccess(id)) return Forbid();
        var start = (day ?? DateTime.Today).Date;
        var end = start.AddDays(1);
        var events = (await db.CareEvents.Where(e => e.ChildId == id).ToListAsync())
            .Where(e => e.At.LocalDateTime >= start && e.At.LocalDateTime < end)
            .OrderBy(e => e.At).ToList();
        var attendance = (await db.Attendances.Where(a => a.ChildId == id).ToListAsync())
            .Where(a => a.At.LocalDateTime >= start && a.At.LocalDateTime < end)
            .OrderBy(a => a.At).ToList();
        return Ok(new { events, attendance });
    }

    [Authorize(Roles = "Educator,Admin")]
    [HttpPost("{id:guid}/care")]
    public async Task<IActionResult> AddCare(Guid id, [FromBody] CareCreate req)
    {
        if (!await CanAccess(id)) return Forbid();
        if (!string.IsNullOrWhiteSpace(req.ClientId))
        {
            var existing = await db.CareEvents.FirstOrDefaultAsync(e => e.ClientId == req.ClientId);
            if (existing is not null) return Ok(existing);
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
        return Ok(ev);
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
        return Ok(rec);
    }

    [HttpGet("{id:guid}/media")]
    public async Task<IActionResult> Media(Guid id)
    {
        if (!await CanAccess(id)) return Forbid();
        return Ok(await db.Media.Where(m => m.ChildId == id).OrderByDescending(m => m.CreatedAt).ToListAsync());
    }

    [Authorize(Roles = "Educator,Admin")]
    [HttpPost("{id:guid}/media")]
    public async Task<IActionResult> UploadMedia(Guid id, IFormFile file, [FromForm] string? caption, [FromForm] string kind = "Photo")
    {
        if (!await CanAccess(id)) return Forbid();
        Directory.CreateDirectory(Path.Combine("wwwroot", "uploads"));
        var name = $"{Guid.NewGuid()}{Path.GetExtension(file.FileName)}";
        var path = Path.Combine("wwwroot", "uploads", name);
        await using (var stream = System.IO.File.Create(path))
            await file.CopyToAsync(stream);
        var item = new MediaItem
        {
            Id = Guid.NewGuid(),
            ChildId = id,
            Url = $"/uploads/{name}",
            Kind = kind,
            Caption = caption,
            CreatedAt = DateTimeOffset.Now,
            CreatedById = User.Id()
        };
        db.Media.Add(item);
        var parentIds = await db.ParentChildren.Where(p => p.ChildId == id).Select(p => p.ParentId).ToListAsync();
        var child = await db.Children.FindAsync(id);
        foreach (var pid in parentIds)
            db.Notifications.Add(new Notification { Id = Guid.NewGuid(), UserId = pid, Title = "New photo", Body = $"{child!.FirstName}: {caption ?? "photo"}", CreatedAt = DateTimeOffset.Now });
        await db.SaveChangesAsync();
        return Ok(item);
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

    [HttpPost("{id:guid}/pickups")]
    public async Task<IActionResult> AddPickup(Guid id, [FromBody] PickupCreate req)
    {
        if (!await CanAccess(id)) return Forbid();
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

    public record ChildCreate(string FirstName, string LastName, DateOnly DateOfBirth, Guid ClassroomId, Guid? ParentId, string? Notes);
    public record CareCreate(CareEventType Type, string? Subtype, string? Amount, string? Notes, DateTimeOffset? At, string? ClientId);
    public record AttendanceCreate(Guid? ChildId, string? QrCode, string Type, string? Method);
    public record InvoiceCreate(string Period, decimal Amount, DateOnly DueDate);
    public record PickupCreate(string FullName, string Relation, string Phone, string? Pin);
    public record NoteCreate(string Body);
    public record PayInvoiceRequest(string? Lang);
}
