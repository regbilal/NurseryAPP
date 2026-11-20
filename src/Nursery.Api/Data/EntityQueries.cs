using Nursery.Api.Models;

namespace Nursery.Api.Data;

public static class EntityQueries
{
    public static IQueryable<Child> ActiveOnly(this IQueryable<Child> q) => q.Where(c => c.Active);
    public static IQueryable<Classroom> ActiveOnly(this IQueryable<Classroom> q) => q.Where(c => c.Active);
    public static IQueryable<Announcement> NotDeleted(this IQueryable<Announcement> q) => q.Where(x => x.DeletedAt == null);
    public static IQueryable<CalendarEvent> NotDeleted(this IQueryable<CalendarEvent> q) => q.Where(x => x.DeletedAt == null);
    public static IQueryable<ActivityPlan> NotDeleted(this IQueryable<ActivityPlan> q) => q.Where(x => x.DeletedAt == null);
    public static IQueryable<Incident> NotDeleted(this IQueryable<Incident> q) => q.Where(x => x.DeletedAt == null);
    public static IQueryable<WaitlistApplication> NotDeleted(this IQueryable<WaitlistApplication> q) => q.Where(x => x.DeletedAt == null);
    public static IQueryable<StaffShift> NotDeleted(this IQueryable<StaffShift> q) => q.Where(x => x.DeletedAt == null);
    public static IQueryable<MediaItem> NotDeleted(this IQueryable<MediaItem> q) => q.Where(x => x.DeletedAt == null);
    public static IQueryable<CareEvent> NotDeleted(this IQueryable<CareEvent> q) => q.Where(x => x.DeletedAt == null);
    public static IQueryable<DevelopmentNote> NotDeleted(this IQueryable<DevelopmentNote> q) => q.Where(x => x.DeletedAt == null);
    public static IQueryable<Invoice> NotDeleted(this IQueryable<Invoice> q) => q.Where(x => x.DeletedAt == null);
    public static IQueryable<Reminder> NotDeleted(this IQueryable<Reminder> q) => q.Where(x => x.DeletedAt == null);
}