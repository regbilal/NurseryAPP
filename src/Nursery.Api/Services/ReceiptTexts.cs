namespace Nursery.Api.Services;

public static class ReceiptTexts
{
    public static string NormalizeLang(string? lang) =>
        lang?.ToLowerInvariant() switch
        {
            "ar" or "fr" or "en" => lang!.ToLowerInvariant(),
            _ => "en"
        };

    public static ReceiptCopy Get(string lang) =>
        NormalizeLang(lang) switch
        {
            "ar" => Ar,
            "fr" => Fr,
            _ => En
        };

    public static readonly ReceiptCopy En = new(
        Title: "Payment receipt",
        PaidOn: "Paid on",
        ReceiptNo: "Receipt no.",
        InvoicePeriod: "Billing period",
        Child: "Child",
        Classroom: "Classroom",
        Amount: "Amount",
        Status: "Status",
        Paid: "Paid",
        Payer: "Paid by",
        Nursery: "Nursery",
        Footer: "Thank you for your trust.",
        Dir: "ltr");

    public static readonly ReceiptCopy Fr = new(
        Title: "Reçu de paiement",
        PaidOn: "Payé le",
        ReceiptNo: "N° de reçu",
        InvoicePeriod: "Période facturée",
        Child: "Enfant",
        Classroom: "Classe",
        Amount: "Montant",
        Status: "Statut",
        Paid: "Payé",
        Payer: "Payé par",
        Nursery: "Crèche",
        Footer: "Merci pour votre confiance.",
        Dir: "ltr");

    public static readonly ReceiptCopy Ar = new(
        Title: "إيصال الدفع",
        PaidOn: "تاريخ الدفع",
        ReceiptNo: "رقم الإيصال",
        InvoicePeriod: "فترة الفوترة",
        Child: "الطفل",
        Classroom: "القسم",
        Amount: "المبلغ",
        Status: "الحالة",
        Paid: "مدفوع",
        Payer: "دفع بواسطة",
        Nursery: "الحضانة",
        Footer: "شكراً لثقتكم.",
        Dir: "rtl");
}

public record ReceiptCopy(
    string Title,
    string PaidOn,
    string ReceiptNo,
    string InvoicePeriod,
    string Child,
    string Classroom,
    string Amount,
    string Status,
    string Paid,
    string Payer,
    string Nursery,
    string Footer,
    string Dir);
