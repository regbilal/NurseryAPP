using Microsoft.EntityFrameworkCore;
using Nursery.Api.Data;
using Nursery.Api.Models;

namespace Nursery.Api.Services;

public class WeeklySummaryService(AppDbContext db)
{
    public async Task<string> GenerateAsync(Guid childId, string lang, CancellationToken ct)
    {
        var child = await db.Children.FirstAsync(c => c.Id == childId, ct);
        var from = DateTimeOffset.UtcNow.AddDays(-7);
        var events = await db.CareEvents.Where(e => e.ChildId == childId && e.At >= from).ToListAsync(ct);
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
}
