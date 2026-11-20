using Microsoft.EntityFrameworkCore;
using Nursery.Api.Data;
using Nursery.Api.Models;

namespace Nursery.Api.Services;

public class ChildAccessService(AppDbContext db)
{
    public async Task<bool> CanAccessAsync(Guid userId, string role, Guid nurseryId, Guid childId, CancellationToken ct = default)
    {
        var child = await db.Children.Include(c => c.Parents).FirstOrDefaultAsync(c => c.Id == childId, ct);
        if (child is null || child.NurseryId != nurseryId || !child.Active) return false;
        if (role == nameof(UserRole.Admin)) return true;
        if (role == nameof(UserRole.Parent))
            return child.Parents.Any(p => p.ParentId == userId);
        var me = await db.Users.FindAsync([userId], ct);
        return me?.ClassroomId == child.ClassroomId;
    }

    public async Task<bool> CanManageChildRecordsAsync(Guid userId, string role, Guid nurseryId, Guid childId, CancellationToken ct = default)
    {
        var child = await db.Children.AsNoTracking().FirstOrDefaultAsync(c => c.Id == childId, ct);
        if (child is null || child.NurseryId != nurseryId || !child.Active) return false;
        if (role == nameof(UserRole.Admin)) return true;
        if (role == nameof(UserRole.Parent))
            return await db.ParentChildren.AnyAsync(p => p.ChildId == childId && p.ParentId == userId, ct);
        return false;
    }

    public async Task<bool> CanPostMediaForChildAsync(Guid userId, string role, Guid nurseryId, Guid childId, CancellationToken ct = default)
    {
        var child = await db.Children.AsNoTracking().FirstOrDefaultAsync(c => c.Id == childId, ct);
        if (child is null || child.NurseryId != nurseryId || !child.Active) return false;
        if (role == nameof(UserRole.Admin)) return true;
        if (role == nameof(UserRole.Educator))
        {
            var me = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId, ct);
            return me?.ClassroomId == child.ClassroomId;
        }
        return false;
    }
}