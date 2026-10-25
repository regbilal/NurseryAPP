using Nursery.Api.Models;

namespace Nursery.Api.Services;

public static class ApiJson
{
    public static object CareEvent(CareEvent e) => new
    {
        e.Id,
        e.ChildId,
        e.At,
        type = e.Type.ToString(),
        e.Subtype,
        e.Amount,
        e.Notes,
        e.ClientId,
        e.PendingSync
    };

    public static object Attendance(Attendance a) => new
    {
        a.Id,
        a.ChildId,
        a.At,
        a.Type,
        a.Method,
        a.RecordedById
    };

    public static object Media(MediaItem m) => new
    {
        m.Id,
        m.ChildId,
        m.Url,
        m.Kind,
        m.Caption,
        m.CreatedAt
    };

    public static object StaffShift(StaffShift s) => new
    {
        s.Id,
        s.UserId,
        userName = s.User?.FullName,
        s.Date,
        start = s.Start.ToString("HH:mm"),
        end = s.End.ToString("HH:mm"),
        status = s.Status.ToString(),
        s.AbsenceReason
    };
}
