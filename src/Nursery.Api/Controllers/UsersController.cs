using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Nursery.Api.Data;
using Nursery.Api.Models;

namespace Nursery.Api.Controllers;

[ApiController]
[Authorize(Roles = "Admin")]
[Route("api/users")]
public class UsersController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List([FromQuery] string? role)
    {
        var nurseryId = User.NurseryId();
        var q = db.Users.AsNoTracking().Where(u => u.NurseryId == nurseryId && u.Active);
        if (!string.IsNullOrWhiteSpace(role) && Enum.TryParse<UserRole>(role, true, out var r))
            q = q.Where(u => u.Role == r);

        var items = await q
            .Include(u => u.Classroom)
            .OrderBy(u => u.FullName)
            .Select(u => new
            {
                u.Id,
                u.Email,
                u.FullName,
                u.Phone,
                role = u.Role.ToString(),
                u.PreferredLanguage,
                u.ClassroomId,
                classroomName = u.Classroom != null ? u.Classroom.Name : null
            })
            .ToListAsync();

        return Ok(items);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] UserCreateDto dto)
    {
        if (!Enum.TryParse<UserRole>(dto.Role, true, out var role))
            return BadRequest(new { message = "Invalid role" });
        if (role is not (UserRole.Parent or UserRole.Educator or UserRole.Admin))
            return BadRequest(new { message = "Invalid role" });

        var nurseryId = User.NurseryId();
        var email = dto.Email.Trim().ToLowerInvariant();
        if (await db.Users.AnyAsync(u => u.NurseryId == nurseryId && u.Email == email))
            return Conflict(new { message = "Email already in use" });

        if (string.IsNullOrWhiteSpace(dto.Password) || dto.Password.Length < 8)
            return BadRequest(new { message = "Password must be at least 8 characters" });

        Guid? classroomId = null;
        if (role == UserRole.Educator)
        {
            if (dto.ClassroomId is not Guid cid)
                return BadRequest(new { message = "Classroom is required for educators" });
            var room = await db.Classrooms.FirstOrDefaultAsync(c => c.Id == cid && c.NurseryId == nurseryId);
            if (room is null) return BadRequest(new { message = "Invalid classroom" });
            classroomId = cid;
        }
        else if (dto.ClassroomId is not null)
            return BadRequest(new { message = "Only educators can be assigned to a classroom" });

        var lang = dto.PreferredLanguage is "ar" or "fr" or "en" ? dto.PreferredLanguage : "en";
        var user = new AppUser
        {
            Id = Guid.NewGuid(),
            NurseryId = nurseryId,
            Email = email,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password),
            FullName = dto.FullName.Trim(),
            Role = role,
            Phone = dto.Phone?.Trim(),
            PreferredLanguage = lang,
            ClassroomId = classroomId,
            Active = true
        };
        db.Users.Add(user);
        await db.SaveChangesAsync();

        return Ok(new
        {
            user.Id,
            user.Email,
            user.FullName,
            user.Phone,
            role = user.Role.ToString(),
            user.PreferredLanguage,
            user.ClassroomId
        });
    }

    [HttpPatch("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UserUpdateDto dto)
    {
        var nurseryId = User.NurseryId();
        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == id && u.NurseryId == nurseryId && u.Active);
        if (user is null) return NotFound();

        if (dto.Email is not null)
        {
            var email = dto.Email.Trim().ToLowerInvariant();
            if (await db.Users.AnyAsync(u => u.NurseryId == nurseryId && u.Email == email && u.Id != id))
                return Conflict(new { message = "Email already in use" });
            user.Email = email;
        }

        if (dto.FullName is not null) user.FullName = dto.FullName.Trim();
        if (dto.Phone is not null) user.Phone = string.IsNullOrWhiteSpace(dto.Phone) ? null : dto.Phone.Trim();
        if (dto.PreferredLanguage is "ar" or "fr" or "en") user.PreferredLanguage = dto.PreferredLanguage;

        if (!string.IsNullOrWhiteSpace(dto.Password))
        {
            if (dto.Password.Length < 8)
                return BadRequest(new { message = "Password must be at least 8 characters" });
            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password);
        }

        if (user.Role == UserRole.Educator)
        {
            if (dto.ClassroomId is Guid cid)
            {
                var room = await db.Classrooms.FirstOrDefaultAsync(c => c.Id == cid && c.NurseryId == nurseryId);
                if (room is null) return BadRequest(new { message = "Invalid classroom" });
                user.ClassroomId = cid;
            }
        }
        else if (dto.ClassroomId is not null)
            return BadRequest(new { message = "Only educators can be assigned to a classroom" });

        await db.SaveChangesAsync();
        return Ok(new
        {
            user.Id,
            user.Email,
            user.FullName,
            user.Phone,
            role = user.Role.ToString(),
            user.PreferredLanguage,
            user.ClassroomId
        });
    }

    public record UserCreateDto(
        string Email,
        string Password,
        string FullName,
        string Role,
        string? Phone,
        string? PreferredLanguage,
        Guid? ClassroomId);

    public record UserUpdateDto(
        string? Email,
        string? Password,
        string? FullName,
        string? Phone,
        string? PreferredLanguage,
        Guid? ClassroomId);
}
