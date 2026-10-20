using Microsoft.EntityFrameworkCore;
using Nursery.Api.Models;

namespace Nursery.Api.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<NurseryOrg> Nurseries => Set<NurseryOrg>();
    public DbSet<AppUser> Users => Set<AppUser>();
    public DbSet<Classroom> Classrooms => Set<Classroom>();
    public DbSet<Child> Children => Set<Child>();
    public DbSet<ParentChild> ParentChildren => Set<ParentChild>();
    public DbSet<Attendance> Attendances => Set<Attendance>();
    public DbSet<CareEvent> CareEvents => Set<CareEvent>();
    public DbSet<MediaItem> Media => Set<MediaItem>();
    public DbSet<Conversation> Conversations => Set<Conversation>();
    public DbSet<ChatMessage> Messages => Set<ChatMessage>();
    public DbSet<Invoice> Invoices => Set<Invoice>();
    public DbSet<Allergy> Allergies => Set<Allergy>();
    public DbSet<Vaccine> Vaccines => Set<Vaccine>();
    public DbSet<Medication> Medications => Set<Medication>();
    public DbSet<AuthorizedPickup> Pickups => Set<AuthorizedPickup>();
    public DbSet<ParentDocument> Documents => Set<ParentDocument>();
    public DbSet<ActivityPlan> ActivityPlans => Set<ActivityPlan>();
    public DbSet<DevelopmentNote> DevelopmentNotes => Set<DevelopmentNote>();
    public DbSet<Incident> Incidents => Set<Incident>();
    public DbSet<StaffShift> Shifts => Set<StaffShift>();
    public DbSet<WaitlistApplication> Waitlist => Set<WaitlistApplication>();
    public DbSet<Announcement> Announcements => Set<Announcement>();
    public DbSet<CalendarEvent> Events => Set<CalendarEvent>();
    public DbSet<Reminder> Reminders => Set<Reminder>();
    public DbSet<Notification> Notifications => Set<Notification>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<AppUser>().HasIndex(u => u.Email).IsUnique();
        modelBuilder.Entity<Child>().HasIndex(c => c.QrCode).IsUnique();
        modelBuilder.Entity<ParentChild>().HasKey(pc => new { pc.ParentId, pc.ChildId });
        modelBuilder.Entity<ParentChild>()
            .HasOne(pc => pc.Parent)
            .WithMany()
            .HasForeignKey(pc => pc.ParentId)
            .OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<Invoice>().Property(i => i.Amount).HasPrecision(10, 2);
    }
}
