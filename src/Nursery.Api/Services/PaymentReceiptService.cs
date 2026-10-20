using System.Globalization;
using System.Net;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Nursery.Api.Data;
using Nursery.Api.Models;

namespace Nursery.Api.Services;

public class PaymentReceiptService(AppDbContext db, IWebHostEnvironment env, BrandingService branding)
{
    public async Task<(string Number, string Url, string Html)> GenerateAsync(
        Invoice invoice,
        Guid payerUserId,
        string lang,
        CancellationToken ct = default)
    {
        var copy = ReceiptTexts.Get(lang);
        var payer = await db.Users.FindAsync([payerUserId], ct);
        var child = await db.Children.Include(c => c.Classroom).FirstAsync(c => c.Id == invoice.ChildId, ct);
        var nursery = await db.Nurseries.FirstAsync(n => n.Id == child.NurseryId, ct);

        var paidAt = invoice.PaidAt ?? DateTimeOffset.Now;
        var number = invoice.ReceiptNumber ?? $"RCP-{paidAt:yyyyMMdd}-{invoice.Id.ToString()[..8].ToUpperInvariant()}";
        var nurseryName = lang switch
        {
            "ar" => nursery.NameAr,
            "fr" => nursery.NameFr,
            _ => nursery.Name
        };

        var amount = string.Format(CultureInfo.InvariantCulture, "{0:N2} {1}", invoice.Amount, invoice.Currency);
        var paidDate = paidAt.ToLocalTime().ToString("f", CultureInfo.GetCultureInfo(lang switch
        {
            "ar" => "ar-MA",
            "fr" => "fr-FR",
            _ => "en-US"
        }));

        var logoDataUri = await branding.GetLogoDataUriAsync(child.NurseryId, ct);
        var html = BuildHtml(lang, copy, nurseryName, number, invoice.Period, child, amount, paidDate, payer?.FullName ?? "—", logoDataUri);

        var dir = Path.Combine(env.ContentRootPath, "wwwroot", "receipts");
        Directory.CreateDirectory(dir);
        var fileName = $"{invoice.Id}-{ReceiptTexts.NormalizeLang(lang)}.html";
        var fullPath = Path.Combine(dir, fileName);
        await File.WriteAllTextAsync(fullPath, html, Encoding.UTF8, ct);

        var url = $"/receipts/{fileName}";
        return (number, url, html);
    }

    static string BuildHtml(
        string lang,
        ReceiptCopy t,
        string nurseryName,
        string receiptNumber,
        string period,
        Child child,
        string amount,
        string paidOn,
        string payerName,
        string? logoDataUri)
    {
        var childName = WebUtility.HtmlEncode($"{child.FirstName} {child.LastName}");
        var classroom = WebUtility.HtmlEncode(child.Classroom.Name);
        static string esc(string? s) => WebUtility.HtmlEncode(s ?? "");

        var sb = new StringBuilder();
        BrandedDocumentBuilder.WriteDocumentStart(sb, lang, t.Dir, $"{t.Title} — {receiptNumber}", logoDataUri);
        sb.Append("<h1>").Append(esc(t.Title)).Append("</h1>");
        sb.Append("<p class=\"muted\">").Append(esc(t.Nursery)).Append(": <strong>").Append(esc(nurseryName)).Append("</strong></p>");
        sb.Append("<p class=\"muted\">").Append(esc(t.ReceiptNo)).Append(": <strong>").Append(esc(receiptNumber)).Append("</strong></p><table>");
        sb.Append("<tr><th>").Append(esc(t.PaidOn)).Append("</th><td>").Append(esc(paidOn)).Append("</td></tr>");
        sb.Append("<tr><th>").Append(esc(t.Payer)).Append("</th><td>").Append(esc(payerName)).Append("</td></tr>");
        sb.Append("<tr><th>").Append(esc(t.Child)).Append("</th><td>").Append(childName).Append("</td></tr>");
        sb.Append("<tr><th>").Append(esc(t.Classroom)).Append("</th><td>").Append(classroom).Append("</td></tr>");
        sb.Append("<tr><th>").Append(esc(t.InvoicePeriod)).Append("</th><td>").Append(esc(period)).Append("</td></tr>");
        sb.Append("<tr><th>").Append(esc(t.Status)).Append("</th><td>").Append(esc(t.Paid)).Append("</td></tr>");
        sb.Append("<tr><th>").Append(esc(t.Amount)).Append("</th><td class=\"total\">").Append(esc(amount)).Append("</td></tr>");
        sb.Append("</table>");
        BrandedDocumentBuilder.WriteDocumentEnd(sb, t.Footer);
        return sb.ToString();
    }
}
