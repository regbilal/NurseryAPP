using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Nursery.Api.Data;
using Nursery.Api.Services;

namespace Nursery.Api.Controllers;

[ApiController]
[Route("api/branding")]
public class BrandingController(AppDbContext db, BrandingService branding) : ControllerBase
{
    [AllowAnonymous]
    [HttpGet("public")]
    public async Task<IActionResult> Public()
    {
        var nursery = await db.Nurseries.AsNoTracking().OrderBy(n => n.Name).FirstOrDefaultAsync();
        if (nursery is null) return Ok(new { logoUrl = (string?)null });
        return Ok(new
        {
            nursery.Id,
            logoUrl = nursery.LogoUrl,
            name = nursery.Name,
            nameAr = nursery.NameAr,
            nameFr = nursery.NameFr
        });
    }

    [Authorize]
    [HttpGet]
    public async Task<IActionResult> Get()
    {
        var nursery = await branding.GetNurseryAsync(User.NurseryId());
        if (nursery is null) return NotFound();
        return Ok(new
        {
            nursery.Id,
            logoUrl = nursery.LogoUrl,
            name = nursery.Name,
            nameAr = nursery.NameAr,
            nameFr = nursery.NameFr
        });
    }

    [Authorize(Roles = "Admin")]
    [HttpPost("logo")]
    [RequestSizeLimit(5_000_000)]
    public async Task<IActionResult> UploadLogo(IFormFile file)
    {
        if (file.Length == 0) return BadRequest(new { message = "Empty file" });
        var url = await branding.SaveLogoAsync(User.NurseryId(), file);
        return Ok(new { logoUrl = url });
    }
}
