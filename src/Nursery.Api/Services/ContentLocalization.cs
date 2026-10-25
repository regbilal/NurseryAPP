using System.Text.Json;

namespace Nursery.Api.Services;

public static class ContentLocalization
{
    private static readonly JsonSerializerOptions JsonOpts = new() { PropertyNameCaseInsensitive = true };

    public static string NormalizeLang(string? lang)
    {
        if (string.IsNullOrWhiteSpace(lang)) return "en";
        var code = lang.Split(',', '-')[0].Trim().ToLowerInvariant();
        return code is "ar" or "fr" or "en" ? code : "en";
    }

    public static string LangFromRequest(HttpRequest request)
    {
        if (request.Query.TryGetValue("lang", out var q) && !string.IsNullOrWhiteSpace(q))
            return NormalizeLang(q.ToString());
        var header = request.Headers.AcceptLanguage.ToString();
        if (!string.IsNullOrWhiteSpace(header))
            return NormalizeLang(header);
        return "en";
    }

    /// <summary>JSON: { "ar": { "title": "...", "body": "..." }, "fr": { ... } }</summary>
    public static string ResolveField(string fallback, string? localizationsJson, string lang, string field)
    {
        lang = NormalizeLang(lang);
        if (lang == "en" || string.IsNullOrWhiteSpace(localizationsJson)) return fallback;
        try
        {
            var map = JsonSerializer.Deserialize<Dictionary<string, Dictionary<string, string>>>(localizationsJson, JsonOpts);
            if (map is null) return fallback;
            if (map.TryGetValue(lang, out var block) && block.TryGetValue(field, out var value) && !string.IsNullOrWhiteSpace(value))
                return value.Trim();
        }
        catch
        {
            /* use fallback */
        }
        return fallback;
    }
}
