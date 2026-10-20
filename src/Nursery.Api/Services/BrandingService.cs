using Microsoft.EntityFrameworkCore;
using Nursery.Api.Data;
using Nursery.Api.Models;

namespace Nursery.Api.Services;

public class BrandingService(AppDbContext db, IWebHostEnvironment env)
{
    public async Task<NurseryOrg?> GetNurseryAsync(Guid nurseryId, CancellationToken ct = default) =>
        await db.Nurseries.FindAsync([nurseryId], ct);

    public async Task<string?> GetLogoDataUriAsync(Guid nurseryId, CancellationToken ct = default)
    {
        var nursery = await GetNurseryAsync(nurseryId, ct);
        if (string.IsNullOrWhiteSpace(nursery?.LogoUrl)) return null;

        var relative = nursery.LogoUrl.TrimStart('/').Replace('/', Path.DirectorySeparatorChar);
        var path = Path.Combine(env.ContentRootPath, "wwwroot", relative);
        if (!File.Exists(path)) return null;

        var bytes = await File.ReadAllBytesAsync(path, ct);
        var mime = MimeFromExtension(Path.GetExtension(path));
        return $"data:{mime};base64,{Convert.ToBase64String(bytes)}";
    }

    public async Task<string> SaveLogoAsync(Guid nurseryId, IFormFile file, CancellationToken ct = default)
    {
        var nursery = await db.Nurseries.FindAsync([nurseryId], ct)
            ?? throw new InvalidOperationException("Nursery not found");

        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (ext is not (".png" or ".jpg" or ".jpeg" or ".webp" or ".svg"))
            ext = ".png";

        var dir = Path.Combine(env.ContentRootPath, "wwwroot", "branding");
        Directory.CreateDirectory(dir);
        var fileName = $"{nurseryId}{ext}";
        var fullPath = Path.Combine(dir, fileName);

        await using (var stream = File.Create(fullPath))
            await file.CopyToAsync(stream, ct);

        nursery.LogoUrl = $"/branding/{fileName}";
        await db.SaveChangesAsync(ct);
        return nursery.LogoUrl;
    }

    static string MimeFromExtension(string ext) => ext.ToLowerInvariant() switch
    {
        ".png" => "image/png",
        ".jpg" or ".jpeg" => "image/jpeg",
        ".webp" => "image/webp",
        ".svg" => "image/svg+xml",
        _ => "application/octet-stream"
    };
}
