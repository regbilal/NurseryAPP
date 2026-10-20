using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Nursery.Api.Auth;
using Nursery.Api.Data;

namespace Nursery.Api.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController(AppDbContext db, JwtTokenService jwt) : ControllerBase
{
    public record LoginRequest(string Email, string Password);
    public record LanguageRequest(string Language);

    [HttpPost("login")]
    public async Task<IActionResult> Login(LoginRequest req)
    {
        var user = await db.Users.FirstOrDefaultAsync(u => u.Email == req.Email && u.Active);
        if (user is null || !BCrypt.Net.BCrypt.Verify(req.Password, user.PasswordHash))
            return Unauthorized(new { message = "Invalid credentials" });

        return Ok(new
        {
            token = jwt.Create(user),
            user = new
            {
                user.Id,
                user.Email,
                user.FullName,
                role = user.Role.ToString(),
                user.PreferredLanguage,
                user.ClassroomId,
                user.NurseryId
            }
        });
    }

    [Authorize]
    [HttpPatch("language")]
    public async Task<IActionResult> SetLanguage(LanguageRequest req)
    {
        var user = await db.Users.FindAsync(User.Id());
        if (user is null) return NotFound();
        user.PreferredLanguage = req.Language is "ar" or "fr" or "en" ? req.Language : "en";
        await db.SaveChangesAsync();
        return Ok(new { user.PreferredLanguage });
    }
}
