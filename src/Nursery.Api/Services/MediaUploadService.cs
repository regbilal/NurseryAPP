using Microsoft.EntityFrameworkCore;
using Nursery.Api.Data;
using Nursery.Api.Models;

namespace Nursery.Api.Services;

public class MediaUploadService(AppDbContext db)
{
    public async Task<List<MediaItem>> SaveForChildrenAsync(
        IFormFile file,
        IEnumerable<Guid> childIds,
        string? caption,
        string kind,
        Guid createdByUserId)
    {
        var ids = childIds.Distinct().ToList();
        Directory.CreateDirectory(Path.Combine("wwwroot", "uploads"));
        var ext = Path.GetExtension(file.FileName);
        if (string.IsNullOrEmpty(ext)) ext = ".jpg";
        var name = $"{Guid.NewGuid()}{ext}";
        var path = Path.Combine("wwwroot", "uploads", name);
        await using (var stream = File.Create(path))
            await file.CopyToAsync(stream);

        var url = $"/uploads/{name}";
        var now = DateTimeOffset.UtcNow;
        var items = ids.Select(childId => new MediaItem
        {
            Id = Guid.NewGuid(),
            ChildId = childId,
            Url = url,
            Kind = kind,
            Caption = caption,
            CreatedAt = now,
            CreatedById = createdByUserId
        }).ToList();

        db.Media.AddRange(items);

        var children = await db.Children.Where(c => ids.Contains(c.Id)).ToDictionaryAsync(c => c.Id, c => c.FirstName);
        var parentLinks = await db.ParentChildren.Where(p => ids.Contains(p.ChildId)).Select(p => new { p.ParentId, p.ChildId }).ToListAsync();
        var notified = new HashSet<Guid>();
        foreach (var link in parentLinks)
        {
            if (!notified.Add(link.ParentId)) continue;
            var names = parentLinks.Where(p => p.ParentId == link.ParentId)
                .Select(p => children.GetValueOrDefault(p.ChildId, "Child"))
                .Distinct();
            var label = string.Join(", ", names);
            db.Notifications.Add(new Notification
            {
                Id = Guid.NewGuid(),
                UserId = link.ParentId,
                Title = "New photo",
                Body = $"{label}: {caption ?? "photo"}",
                CreatedAt = now
            });
        }

        await db.SaveChangesAsync();
        return items;
    }
}
