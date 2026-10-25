using System.Net;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Nursery.Api.Data;
using Nursery.Api.Models;

namespace Nursery.Api.Services;

public class WeeklySummaryService(AppDbContext db, BrandingService branding)
{
    public async Task<string> GenerateAsync(Guid childId, string lang, CancellationToken ct)
    {
        var child = await db.Children.FirstAsync(c => c.Id == childId, ct);
        var from = DateTimeOffset.UtcNow.AddDays(-7);
        var events = (await db.CareEvents.Where(e => e.ChildId == childId).ToListAsync(ct))
            .Where(e => e.At >= from)
            .ToList();
        var meals = events.Count(e => e.Type == CareEventType.Meal);
        var naps = events.Count(e => e.Type == CareEventType.Nap);
        var happy = events.Count(e => e.Type == CareEventType.Mood && e.Subtype == "Happy");
        var name = child.FirstName;

        return lang switch
        {
            "ar" => $"ملخص أسبوع {name}: تناول {meals} وجبات، وأخذ {naps} قيلولات، وكان مزاجه سعيدًا في {happy} مرات. أسبوع مليء باللعب والاستكشاف.",
            "fr" => $"Résumé de la semaine de {name} : {meals} repas, {naps} siestes, et un humeur joyeuse {happy} fois. Une belle semaine de jeux et de découvertes.",
            _ => $"{name}'s week: {meals} meals, {naps} naps, and a happy mood {happy} times. A week full of play and exploration."
        };
    }

    public async Task<string> GenerateDocumentHtmlAsync(Guid childId, string lang, CancellationToken ct)
    {
        lang = ReceiptTexts.NormalizeLang(lang);
        var child = await db.Children.Include(c => c.Classroom).FirstAsync(c => c.Id == childId, ct);
        var summary = await GenerateAsync(childId, lang, ct);
        var logo = await branding.GetLogoDataUriAsync(child.NurseryId, ct);
        var (title, dir, footer) = lang switch
        {
            "ar" => ("الملخص الأسبوعي", "rtl", "حضانة النجوم الصغار"),
            "fr" => ("Résumé hebdomadaire", "ltr", "Crèche Petites Étoiles"),
            _ => ("Weekly summary", "ltr", "Little Stars Nursery")
        };

        var esc = static (string? s) => WebUtility.HtmlEncode(s ?? "");
        var sb = new StringBuilder();
        BrandedDocumentBuilder.WriteDocumentStart(sb, lang, dir, title, logo);
        sb.Append("<h1>").Append(esc(title)).Append("</h1>");
        sb.Append("<p class=\"muted\"><strong>").Append(esc($"{child.FirstName} {child.LastName}")).Append("</strong> · ");
        sb.Append(esc(child.Classroom.Name)).Append("</p>");
        sb.Append("<p class=\"prose\">").Append(esc(summary)).Append("</p>");
        BrandedDocumentBuilder.WriteDocumentEnd(sb, footer);
        return sb.ToString();
    }
}
