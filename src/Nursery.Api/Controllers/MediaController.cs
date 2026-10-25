using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Nursery.Api.Data;
using Nursery.Api.Models;
using Nursery.Api.Services;

namespace Nursery.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/media")]
public class MediaController(AppDbContext db, MediaUploadService mediaUpload) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Feed([FromQuery] Guid? childId)
    {
        var accessible = await AccessibleChildIdsAsync();
        if (childId is Guid cid)
        {
            if (!accessible.Contains(cid)) return Forbid();
            accessible = [cid];
        }

        var rows = (await db.Media
                .Include(m => m.Child)
                .Where(m => accessible.Contains(m.ChildId))
                .ToListAsync())
            .OrderByDescending(m => m.CreatedAt)
            .ToList();

        var feed = rows
            .GroupBy(m => m.Url)
            .Select(g =>
            {
                var first = g.First();
                return new
                {
                    id = first.Id,
                    url = first.Url,
                    kind = first.Kind,
                    caption = first.Caption,
                    createdAt = first.CreatedAt,
                    children = g
                        .Select(x => new { childId = x.ChildId, name = $"{x.Child.FirstName} {x.Child.LastName}" })
                        .DistinctBy(x => x.childId)
                        .ToList()
                };
            })
            .OrderByDescending(x => x.createdAt)
            .ToList();

        return Ok(feed);
    }

    [Authorize(Roles = "Educator,Admin")]
    [HttpPost]
    [Consumes("multipart/form-data")]
    [RequestSizeLimit(20_000_000)]
    public async Task<IActionResult> Upload([FromForm] IFormFile file, [FromForm] string? caption, [FromForm] string kind = "Photo", [FromForm] string? childIds = null)
    {
        if (file is null || file.Length == 0) return BadRequest(new { message = "File required." });
        var ids = ParseChildIds(childIds);
        if (ids.Count == 0) return BadRequest(new { message = "Select at least one child." });

        foreach (var id in ids)
        {
            if (!await CanPostMediaForChild(id)) return Forbid();
        }

        var items = await mediaUpload.SaveForChildrenAsync(file, ids, caption, kind, User.Id());
        return Ok(items.Select(ApiJson.Media));
    }

    internal static List<Guid> ParseChildIds(string? childIds)
    {
        if (string.IsNullOrWhiteSpace(childIds)) return [];
        return childIds
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(s => Guid.TryParse(s, out var g) ? g : Guid.Empty)
            .Where(g => g != Guid.Empty)
            .Distinct()
            .ToList();
    }

    private async Task<List<Guid>> AccessibleChildIdsAsync()
    {
        var nurseryId = User.NurseryId();
        if (User.Role() == nameof(UserRole.Admin))
            return await db.Children.Where(c => c.NurseryId == nurseryId).Select(c => c.Id).ToListAsync();

        if (User.Role() == nameof(UserRole.Parent))
        {
            var uid = User.Id();
            return await db.ParentChildren.Where(p => p.ParentId == uid).Select(p => p.ChildId).ToListAsync();
        }

        var me = await db.Users.FindAsync(User.Id());
        if (me?.ClassroomId is Guid classroomId)
            return await db.Children.Where(c => c.NurseryId == nurseryId && c.ClassroomId == classroomId).Select(c => c.Id).ToListAsync();

        return [];
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
}
