namespace Nursery.Api.Models;

public enum UserRole { Admin, Educator, Parent }

public enum CareEventType { Meal, Nap, Diaper, Mood, Note }

public enum InvoiceStatus { Pending, Paid, Overdue }

public enum WaitlistStatus { Pending, Approved, Rejected }

public enum ShiftStatus { Scheduled, Completed, Absent }

public class NurseryOrg
{
    public Guid Id { get; set; }
    public string Name { get; set; } = default!;
    public string NameAr { get; set; } = default!;
    public string NameFr { get; set; } = default!;
    public string Timezone { get; set; } = "Africa/Casablanca";
}

public class AppUser
{
    public Guid Id { get; set; }
    public Guid NurseryId { get; set; }
    public NurseryOrg Nursery { get; set; } = default!;
    public string Email { get; set; } = default!;
    public string PasswordHash { get; set; } = default!;
    public string FullName { get; set; } = default!;
    public UserRole Role { get; set; }
    public string PreferredLanguage { get; set; } = "en";
    public string? Phone { get; set; }
    public Guid? ClassroomId { get; set; }
    public Classroom? Classroom { get; set; }
    public bool Active { get; set; } = true;
}

public class Classroom
{
    public Guid Id { get; set; }
    public Guid NurseryId { get; set; }
    public string Name { get; set; } = default!;
    public int MinAgeMonths { get; set; }
    public int MaxAgeMonths { get; set; }
    public ICollection<Child> Children { get; set; } = new List<Child>();
}

public class Child
{
    public Guid Id { get; set; }
    public Guid NurseryId { get; set; }
    public Guid ClassroomId { get; set; }
    public Classroom Classroom { get; set; } = default!;
    public string FirstName { get; set; } = default!;
    public string LastName { get; set; } = default!;
    public DateOnly DateOfBirth { get; set; }
    public string QrCode { get; set; } = default!;
    public string? PhotoUrl { get; set; }
    public string? Notes { get; set; }
    public ICollection<ParentChild> Parents { get; set; } = new List<ParentChild>();
}

public class ParentChild
{
    public Guid ParentId { get; set; }
    public AppUser Parent { get; set; } = default!;
    public Guid ChildId { get; set; }
    public Child Child { get; set; } = default!;
}

public class Attendance
{
    public Guid Id { get; set; }
    public Guid ChildId { get; set; }
    public Child Child { get; set; } = default!;
    public DateTimeOffset At { get; set; }
    public string Type { get; set; } = "CheckIn"; // CheckIn | CheckOut
    public Guid RecordedById { get; set; }
    public string? Method { get; set; } // Qr | Tap
}

public class CareEvent
{
    public Guid Id { get; set; }
    public Guid ChildId { get; set; }
    public Child Child { get; set; } = default!;
    public DateTimeOffset At { get; set; }
    public CareEventType Type { get; set; }
    public string? Subtype { get; set; }
    public string? Amount { get; set; }
    public string? Notes { get; set; }
    public Guid CreatedById { get; set; }
    public bool PendingSync { get; set; }
    public string? ClientId { get; set; }
}

public class MediaItem
{
    public Guid Id { get; set; }
    public Guid ChildId { get; set; }
    public Child Child { get; set; } = default!;
    public string Url { get; set; } = default!;
    public string Kind { get; set; } = "Photo"; // Photo | Video
    public string? Caption { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public Guid CreatedById { get; set; }
}

public class Conversation
{
    public Guid Id { get; set; }
    public Guid NurseryId { get; set; }
    public Guid ChildId { get; set; }
    public string Title { get; set; } = default!;
}

public class ChatMessage
{
    public Guid Id { get; set; }
    public Guid ConversationId { get; set; }
    public Conversation Conversation { get; set; } = default!;
    public Guid SenderId { get; set; }
    public AppUser Sender { get; set; } = default!;
    public string Body { get; set; } = default!;
    public DateTimeOffset SentAt { get; set; }
}

public class Invoice
{
    public Guid Id { get; set; }
    public Guid ChildId { get; set; }
    public Child Child { get; set; } = default!;
    public string Period { get; set; } = default!;
    public decimal Amount { get; set; }
    public string Currency { get; set; } = "MAD";
    public DateOnly DueDate { get; set; }
    public InvoiceStatus Status { get; set; }
    public DateTimeOffset? PaidAt { get; set; }
}

public class Allergy
{
    public Guid Id { get; set; }
    public Guid ChildId { get; set; }
    public string Name { get; set; } = default!;
    public string Severity { get; set; } = "High";
}

public class Vaccine
{
    public Guid Id { get; set; }
    public Guid ChildId { get; set; }
    public string Name { get; set; } = default!;
    public DateOnly? AdministeredOn { get; set; }
    public DateOnly? DueOn { get; set; }
}

public class Medication
{
    public Guid Id { get; set; }
    public Guid ChildId { get; set; }
    public string Name { get; set; } = default!;
    public string Dosage { get; set; } = default!;
    public string Schedule { get; set; } = default!;
    public bool Active { get; set; } = true;
}

public class AuthorizedPickup
{
    public Guid Id { get; set; }
    public Guid ChildId { get; set; }
    public string FullName { get; set; } = default!;
    public string Relation { get; set; } = default!;
    public string Phone { get; set; } = default!;
    public string Pin { get; set; } = default!;
}

public class ParentDocument
{
    public Guid Id { get; set; }
    public Guid ChildId { get; set; }
    public string Title { get; set; } = default!;
    public string Url { get; set; } = default!;
}

public class ActivityPlan
{
    public Guid Id { get; set; }
    public Guid ClassroomId { get; set; }
    public DateOnly WeekStart { get; set; }
    public string Theme { get; set; } = default!;
    public string PlanJson { get; set; } = "{}";
}

public class DevelopmentNote
{
    public Guid Id { get; set; }
    public Guid ChildId { get; set; }
    public DateOnly WeekStart { get; set; }
    public string Body { get; set; } = default!;
    public Guid AuthorId { get; set; }
}

public class Incident
{
    public Guid Id { get; set; }
    public Guid ChildId { get; set; }
    public Child Child { get; set; } = default!;
    public DateTimeOffset At { get; set; }
    public string Title { get; set; } = default!;
    public string Details { get; set; } = default!;
    public bool ParentsNotified { get; set; }
    public Guid ReportedById { get; set; }
}

public class StaffShift
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public AppUser User { get; set; } = default!;
    public DateOnly Date { get; set; }
    public TimeOnly Start { get; set; }
    public TimeOnly End { get; set; }
    public ShiftStatus Status { get; set; }
    public string? AbsenceReason { get; set; }
}

public class WaitlistApplication
{
    public Guid Id { get; set; }
    public Guid NurseryId { get; set; }
    public string ChildName { get; set; } = default!;
    public DateOnly DateOfBirth { get; set; }
    public string ParentName { get; set; } = default!;
    public string ParentEmail { get; set; } = default!;
    public string ParentPhone { get; set; } = default!;
    public WaitlistStatus Status { get; set; }
    public DateTimeOffset SubmittedAt { get; set; }
}

public class Announcement
{
    public Guid Id { get; set; }
    public Guid NurseryId { get; set; }
    public string Title { get; set; } = default!;
    public string Body { get; set; } = default!;
    public DateTimeOffset PublishedAt { get; set; }
}

public class CalendarEvent
{
    public Guid Id { get; set; }
    public Guid NurseryId { get; set; }
    public string Title { get; set; } = default!;
    public DateTimeOffset StartsAt { get; set; }
    public DateTimeOffset EndsAt { get; set; }
    public string? Location { get; set; }
}

public class Reminder
{
    public Guid Id { get; set; }
    public Guid NurseryId { get; set; }
    public Guid? ChildId { get; set; }
    public string Kind { get; set; } = default!; // Medication | Vaccine | Meeting | Invoice
    public string Title { get; set; } = default!;
    public DateTimeOffset DueAt { get; set; }
    public bool Sent { get; set; }
}

public class Notification
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public string Title { get; set; } = default!;
    public string Body { get; set; } = default!;
    public DateTimeOffset CreatedAt { get; set; }
    public bool Read { get; set; }
}
