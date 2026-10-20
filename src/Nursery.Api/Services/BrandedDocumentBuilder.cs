using System.Net;
using System.Text;

namespace Nursery.Api.Services;

/// <summary>Shared HTML shell for receipts, weekly reports, and other generated documents.</summary>
public static class BrandedDocumentBuilder
{
    public static void WriteDocumentStart(StringBuilder sb, string lang, string dir, string title, string? logoDataUri)
    {
        var esc = static (string? s) => WebUtility.HtmlEncode(s ?? "");
        sb.Append("<!DOCTYPE html><html lang=\"").Append(ReceiptTexts.NormalizeLang(lang)).Append("\" dir=\"").Append(dir).Append("\"><head>");
        sb.Append("<meta charset=\"utf-8\" /><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />");
        sb.Append("<title>").Append(esc(title)).Append("</title>");
        sb.Append("<style>");
        sb.Append("body{font-family:system-ui,Segoe UI,Tahoma,Arial,sans-serif;margin:0;padding:24px;background:#f6f4ef;color:#1a1a1a}");
        sb.Append(".card{position:relative;max-width:520px;margin:0 auto;background:#fff;border-radius:16px;padding:28px;box-shadow:0 8px 32px rgba(0,0,0,.08);overflow:hidden}");
        sb.Append(".card-body{position:relative;z-index:1}");
        if (!string.IsNullOrEmpty(logoDataUri))
        {
            var safe = logoDataUri.Replace("\"", "%22");
            sb.Append(".watermark{position:absolute;inset:0;z-index:0;pointer-events:none;opacity:.09;");
            sb.Append("background-image:url(\"").Append(safe).Append("\");background-repeat:no-repeat;background-position:center;background-size:min(70%,280px)}");
            sb.Append(".logo-header{display:block;max-height:72px;max-width:200px;object-fit:contain;margin:0 0 16px}");
        }
        sb.Append("h1{margin:0 0 8px;font-size:1.5rem;color:#2d6a4f}.muted{color:#666;font-size:.9rem}");
        sb.Append("table{width:100%;border-collapse:collapse;margin-top:20px}th,td{text-align:start;padding:10px 0;border-bottom:1px solid #eee;vertical-align:top}");
        sb.Append("th{width:42%;font-weight:600;color:#444}.total{font-size:1.35rem;font-weight:800;color:#2d6a4f}");
        sb.Append(".prose{line-height:1.55;font-size:1rem;margin-top:12px}");
        sb.Append("footer{margin-top:24px;font-size:.85rem;color:#888;text-align:center}");
        sb.Append("@media print{body{background:#fff}.card{box-shadow:none}}");
        sb.Append("</style></head><body><div class=\"card\">");
        if (!string.IsNullOrEmpty(logoDataUri))
        {
            sb.Append("<div class=\"watermark\" aria-hidden=\"true\"></div>");
            sb.Append("<div class=\"card-body\">");
            sb.Append("<img class=\"logo-header\" src=\"").Append(logoDataUri.Replace("\"", "%22")).Append("\" alt=\"\" />");
        }
        else
        {
            sb.Append("<div class=\"card-body\">");
        }
    }

    public static void WriteDocumentEnd(StringBuilder sb, string footerText)
    {
        var esc = static (string? s) => WebUtility.HtmlEncode(s ?? "");
        sb.Append("<footer>").Append(esc(footerText)).Append("</footer>");
        sb.Append("</div></div></body></html>");
    }
}
