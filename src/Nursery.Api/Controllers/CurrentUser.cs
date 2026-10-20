using System.Security.Claims;

namespace Nursery.Api.Controllers;

public static class CurrentUser
{
    public static Guid Id(this ClaimsPrincipal user) =>
        Guid.Parse(user.FindFirstValue(ClaimTypes.NameIdentifier)!);

    public static Guid NurseryId(this ClaimsPrincipal user) =>
        Guid.Parse(user.FindFirstValue("nurseryId")!);

    public static string Role(this ClaimsPrincipal user) =>
        user.FindFirstValue(ClaimTypes.Role)!;
}
