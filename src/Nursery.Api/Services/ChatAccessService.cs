using Microsoft.EntityFrameworkCore;
using Nursery.Api.Data;
using Nursery.Api.Models;

namespace Nursery.Api.Services;

public class ChatAccessService(AppDbContext db)
{
    public async Task<bool> CanAccessConversationAsync(Guid userId, string role, Guid conversationId, CancellationToken ct = default)
    {
        var c = await db.Conversations.AsNoTracking().FirstOrDefaultAsync(x => x.Id == conversationId, ct);
        if (c is null) return false;
        return await CanAccessConversationAsync(userId, role, c, ct);
    }

    public async Task<bool> CanAccessConversationAsync(Guid userId, string role, Conversation c, CancellationToken ct = default)
    {
        if (c.NurseryId != await NurseryIdForUserAsync(userId, ct)) return false;
        if (role == nameof(UserRole.Admin)) return true;
        if (role == nameof(UserRole.Parent)) return c.ParentUserId == userId;
        if (role == nameof(UserRole.Educator))
            return c.StaffUserId == userId || c.OtherStaffUserId == userId;
        return false;
    }

    public static bool IsParentThread(Conversation c) => c.ParentUserId is not null;

    public async Task<List<AppUser>> AllowedStaffForParentAsync(Guid parentId, Guid childId, CancellationToken ct = default)
    {
        var linked = await db.ParentChildren.AnyAsync(p => p.ParentId == parentId && p.ChildId == childId, ct);
        if (!linked) return [];

        var child = await db.Children.AsNoTracking().FirstOrDefaultAsync(c => c.Id == childId, ct);
        if (child is null) return [];

        var admins = await db.Users.AsNoTracking()
            .Where(u => u.NurseryId == child.NurseryId && u.Role == UserRole.Admin && u.Active)
            .ToListAsync(ct);
        var teachers = await db.Users.AsNoTracking()
            .Where(u => u.NurseryId == child.NurseryId && u.Role == UserRole.Educator && u.ClassroomId == child.ClassroomId && u.Active)
            .ToListAsync(ct);

        return admins.Concat(teachers).GroupBy(u => u.Id).Select(g => g.First()).OrderBy(u => u.Role).ThenBy(u => u.FullName).ToList();
    }

    public async Task<bool> IsStaffAllowedForParentAsync(Guid parentId, Guid childId, Guid staffUserId, CancellationToken ct = default)
    {
        var allowed = await AllowedStaffForParentAsync(parentId, childId, ct);
        return allowed.Any(u => u.Id == staffUserId);
    }

    public async Task<IQueryable<Conversation>> ConversationsForUserAsync(Guid userId, string role, Guid nurseryId, CancellationToken ct = default)
    {
        var q = db.Conversations.AsNoTracking().Where(c => c.NurseryId == nurseryId);
        if (role == nameof(UserRole.Parent))
        {
            var childIds = await db.ParentChildren.Where(p => p.ParentId == userId).Select(p => p.ChildId).ToListAsync(ct);
            q = q.Where(c => c.ParentUserId == userId && childIds.Contains(c.ChildId));
        }
        else if (role == nameof(UserRole.Educator))
        {
            q = q.Where(c => c.StaffUserId == userId || c.OtherStaffUserId == userId);
        }

        return q;
    }

    private async Task<Guid> NurseryIdForUserAsync(Guid userId, CancellationToken ct)
    {
        var user = await db.Users.AsNoTracking().FirstAsync(u => u.Id == userId, ct);
        return user.NurseryId;
    }
}
