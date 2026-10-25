using Microsoft.EntityFrameworkCore;
using Nursery.Api.Models;

namespace Nursery.Api.Data;

public static class SeedData
{
    public static async Task EnsureAsync(AppDbContext db)
    {
        if (await db.Users.AnyAsync()) return;

        var nurseryId = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
        var classId = Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
        var adminId = Guid.Parse("11111111-1111-1111-1111-111111111111");
        var eduId = Guid.Parse("22222222-2222-2222-2222-222222222222");
        var parentId = Guid.Parse("33333333-3333-3333-3333-333333333333");
        var parent2Id = Guid.Parse("44444444-4444-4444-4444-444444444444");
        var linaId = Guid.Parse("55555555-5555-5555-5555-555555555555");
        var adamId = Guid.Parse("66666666-6666-6666-6666-666666666666");
        var saraId = Guid.Parse("77777777-7777-7777-7777-777777777777");
        var convId = Guid.Parse("88888888-8888-8888-8888-888888888888");

        db.Nurseries.Add(new NurseryOrg
        {
            Id = nurseryId,
            Name = "Little Stars Nursery",
            NameAr = "حضانة النجوم الصغار",
            NameFr = "Crèche Petites Étoiles"
        });

        db.Classrooms.Add(new Classroom
        {
            Id = classId,
            NurseryId = nurseryId,
            Name = "Butterflies / الفراشات / Papillons",
            MinAgeMonths = 24,
            MaxAgeMonths = 48
        });

        db.Users.AddRange(
            new AppUser
            {
                Id = adminId,
                NurseryId = nurseryId,
                Email = "admin@nursery.local",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("Admin123!"),
                FullName = "Amina El Fassi",
                Role = UserRole.Admin,
                PreferredLanguage = "ar",
                Phone = "+212600000001"
            },
            new AppUser
            {
                Id = eduId,
                NurseryId = nurseryId,
                Email = "educator@nursery.local",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("Educator123!"),
                FullName = "Fatima Zahra",
                Role = UserRole.Educator,
                PreferredLanguage = "fr",
                Phone = "+212600000002",
                ClassroomId = classId
            },
            new AppUser
            {
                Id = parentId,
                NurseryId = nurseryId,
                Email = "parent@nursery.local",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("Parent123!"),
                FullName = "Karim Benali",
                Role = UserRole.Parent,
                PreferredLanguage = "en",
                Phone = "+212600000003"
            },
            new AppUser
            {
                Id = parent2Id,
                NurseryId = nurseryId,
                Email = "parent2@nursery.local",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("Parent123!"),
                FullName = "Claire Dupont",
                Role = UserRole.Parent,
                PreferredLanguage = "fr",
                Phone = "+212600000004"
            });

        db.Children.AddRange(
            new Child
            {
                Id = linaId,
                NurseryId = nurseryId,
                ClassroomId = classId,
                FirstName = "Lina",
                LastName = "Benali",
                DateOfBirth = new DateOnly(2022, 4, 12),
                QrCode = "LINA-BENALI",
                Notes = "Loves painting and story time."
            },
            new Child
            {
                Id = adamId,
                NurseryId = nurseryId,
                ClassroomId = classId,
                FirstName = "Adam",
                LastName = "Rossi",
                DateOfBirth = new DateOnly(2022, 9, 3),
                QrCode = "ADAM-ROSSI"
            },
            new Child
            {
                Id = saraId,
                NurseryId = nurseryId,
                ClassroomId = classId,
                FirstName = "Sara",
                LastName = "Dupont",
                DateOfBirth = new DateOnly(2023, 1, 20),
                QrCode = "SARA-DUPONT"
            });

        db.ParentChildren.AddRange(
            new ParentChild { ParentId = parentId, ChildId = linaId },
            new ParentChild { ParentId = parent2Id, ChildId = saraId });

        var today = DateTimeOffset.Now.Date;
        db.Attendances.Add(new Attendance
        {
            Id = Guid.NewGuid(),
            ChildId = linaId,
            At = today.AddHours(8).AddMinutes(15),
            Type = "CheckIn",
            RecordedById = eduId,
            Method = "Qr"
        });

        db.CareEvents.AddRange(
            new CareEvent { Id = Guid.NewGuid(), ChildId = linaId, At = today.AddHours(9), Type = CareEventType.Meal, Subtype = "Breakfast", Amount = "All", Notes = "Oatmeal and banana", CreatedById = eduId },
            new CareEvent { Id = Guid.NewGuid(), ChildId = linaId, At = today.AddHours(11).AddMinutes(30), Type = CareEventType.Nap, Subtype = "Nap", Amount = "70min", CreatedById = eduId },
            new CareEvent { Id = Guid.NewGuid(), ChildId = linaId, At = today.AddHours(10), Type = CareEventType.Diaper, Subtype = "Wet", CreatedById = eduId },
            new CareEvent { Id = Guid.NewGuid(), ChildId = linaId, At = today.AddHours(10).AddMinutes(5), Type = CareEventType.Mood, Subtype = "Happy", CreatedById = eduId });

        db.Allergies.Add(new Allergy { Id = Guid.NewGuid(), ChildId = linaId, Name = "Peanuts", Severity = "High" });
        db.Vaccines.AddRange(
            new Vaccine { Id = Guid.NewGuid(), ChildId = linaId, Name = "MMR", AdministeredOn = new DateOnly(2023, 6, 1) },
            new Vaccine { Id = Guid.NewGuid(), ChildId = linaId, Name = "DTP booster", DueOn = DateOnly.FromDateTime(DateTime.Today.AddDays(12)) });
        db.Medications.Add(new Medication { Id = Guid.NewGuid(), ChildId = linaId, Name = "Vitamin D", Dosage = "2 drops", Schedule = "Morning" });
        db.Pickups.Add(new AuthorizedPickup { Id = Guid.NewGuid(), ChildId = linaId, FullName = "Nadia Benali", Relation = "Aunt", Phone = "+212600000099", Pin = "4821" });
        db.Documents.Add(new ParentDocument { Id = Guid.NewGuid(), ChildId = linaId, Title = "Enrollment form", Url = "/uploads/placeholder.pdf" });

        db.Invoices.AddRange(
            new Invoice { Id = Guid.NewGuid(), ChildId = linaId, Period = DateTime.Today.ToString("yyyy-MM"), Amount = 1800, DueDate = DateOnly.FromDateTime(DateTime.Today.AddDays(5)), Status = InvoiceStatus.Pending },
            new Invoice { Id = Guid.NewGuid(), ChildId = linaId, Period = DateTime.Today.AddMonths(-1).ToString("yyyy-MM"), Amount = 1800, DueDate = DateOnly.FromDateTime(DateTime.Today.AddDays(-20)), Status = InvoiceStatus.Paid, PaidAt = DateTimeOffset.Now.AddDays(-18) });

        var convAdminId = Guid.Parse("99999999-9999-9999-9999-999999999991");
        db.Conversations.AddRange(
            new Conversation
            {
                Id = convId,
                NurseryId = nurseryId,
                ChildId = linaId,
                ParentUserId = parentId,
                StaffUserId = eduId,
                Title = "Lina · Fatima Zahra"
            },
            new Conversation
            {
                Id = convAdminId,
                NurseryId = nurseryId,
                ChildId = linaId,
                ParentUserId = parentId,
                StaffUserId = adminId,
                Title = "Lina · Amina El Fassi"
            });
        db.Messages.Add(new ChatMessage
        {
            Id = Guid.NewGuid(),
            ConversationId = convId,
            SenderId = eduId,
            Body = "Lina had a wonderful morning painting sunflowers.",
            SentAt = DateTimeOffset.Now.AddHours(-2)
        });

        db.ActivityPlans.Add(new ActivityPlan
        {
            Id = Guid.NewGuid(),
            ClassroomId = classId,
            WeekStart = DateOnly.FromDateTime(DateTime.Today.AddDays(-(int)DateTime.Today.DayOfWeek + 1)),
            Theme = "Colors of the garden",
            PlanJson = """{"monday":"Finger painting","tuesday":"Garden walk","wednesday":"Story: The Tiny Seed","thursday":"Music","friday":"Free play"}"""
        });
        db.DevelopmentNotes.Add(new DevelopmentNote
        {
            Id = Guid.NewGuid(),
            ChildId = linaId,
            WeekStart = DateOnly.FromDateTime(DateTime.Today.AddDays(-3)),
            Body = "Sharing toys more easily this week.",
            AuthorId = eduId
        });

        db.Announcements.Add(new Announcement
        {
            Id = Guid.NewGuid(),
            NurseryId = nurseryId,
            Title = "Parent-teacher meetings",
            Body = "Meetings will be held next Thursday afternoon.",
            LocalizationsJson = """
                {"ar":{"title":"لقاءات أولياء الأمور والمعلمين","body":"ستُعقد اللقاءات يوم الخميس بعد الظهر."},
                 "fr":{"title":"Rencontres parents-enseignants","body":"Les rencontres auront lieu jeudi après-midi."}}
                """,
            PublishedAt = DateTimeOffset.Now.AddDays(-1)
        });
        db.Events.Add(new CalendarEvent
        {
            Id = Guid.NewGuid(),
            NurseryId = nurseryId,
            Title = "Spring picnic",
            StartsAt = DateTimeOffset.Now.AddDays(6).Date.AddHours(10),
            EndsAt = DateTimeOffset.Now.AddDays(6).Date.AddHours(13),
            Location = "Garden",
            LocalizationsJson = """
                {"ar":{"title":"نزهة الربيع","location":"الحديقة"},
                 "fr":{"title":"Pique-nique de printemps","location":"Jardin"}}
                """
        });
        db.Waitlist.Add(new WaitlistApplication
        {
            Id = Guid.NewGuid(),
            NurseryId = nurseryId,
            ChildName = "Youssef Amrani",
            DateOfBirth = new DateOnly(2023, 5, 8),
            ParentName = "Leila Amrani",
            ParentEmail = "leila@example.com",
            ParentPhone = "+212600000088",
            Status = WaitlistStatus.Pending,
            SubmittedAt = DateTimeOffset.Now.AddDays(-4)
        });
        db.Shifts.Add(new StaffShift
        {
            Id = Guid.NewGuid(),
            UserId = eduId,
            Date = DateOnly.FromDateTime(DateTime.Today),
            Start = new TimeOnly(8, 0),
            End = new TimeOnly(16, 0),
            Status = ShiftStatus.Scheduled
        });
        db.Reminders.AddRange(
            new Reminder
            {
                Id = Guid.NewGuid(), NurseryId = nurseryId, ChildId = linaId, Kind = "Vaccine", Title = "DTP booster due",
                LocalizationsJson = """{"ar":{"kind":"تطعيم","title":"جرعة DTP"},"fr":{"kind":"Vaccin","title":"Rappel DTP"}}""",
                DueAt = DateTimeOffset.Now.AddDays(12)
            },
            new Reminder
            {
                Id = Guid.NewGuid(), NurseryId = nurseryId, ChildId = linaId, Kind = "Invoice", Title = "Monthly tuition",
                LocalizationsJson = """{"ar":{"kind":"فاتورة","title":"الرسوم الشهرية"},"fr":{"kind":"Facture","title":"Mensualité"}}""",
                DueAt = DateTimeOffset.Now.AddDays(5)
            },
            new Reminder
            {
                Id = Guid.NewGuid(), NurseryId = nurseryId, ChildId = linaId, Kind = "Meeting", Title = "Parent meeting",
                LocalizationsJson = """{"ar":{"kind":"موعد","title":"لقاء أولياء الأمور"},"fr":{"kind":"Rendez-vous","title":"Réunion parents"}}""",
                DueAt = DateTimeOffset.Now.AddDays(6)
            });
        db.Notifications.Add(new Notification
        {
            Id = Guid.NewGuid(),
            UserId = parentId,
            Title = "Check-in",
            Body = "Lina arrived at 08:15",
            CreatedAt = today.AddHours(8).AddMinutes(15)
        });

        await db.SaveChangesAsync();
    }

    /// <summary>Backfill locale JSON for demo content on existing databases.</summary>
    public static async Task PatchContentLocalizationsAsync(AppDbContext db)
    {
        const string annJson = """
            {"ar":{"title":"لقاءات أولياء الأمور والمعلمين","body":"ستُعقد اللقاءات يوم الخميس بعد الظهر."},
             "fr":{"title":"Rencontres parents-enseignants","body":"Les rencontres auront lieu jeudi après-midi."}}
            """;
        const string eventJson = """
            {"ar":{"title":"نزهة الربيع","location":"الحديقة"},
             "fr":{"title":"Pique-nique de printemps","location":"Jardin"}}
            """;
        foreach (var a in await db.Announcements.Where(a => a.Title == "Parent-teacher meetings" && a.LocalizationsJson == null).ToListAsync())
            a.LocalizationsJson = annJson;
        foreach (var e in await db.Events.Where(e => e.Title == "Spring picnic" && e.LocalizationsJson == null).ToListAsync())
            e.LocalizationsJson = eventJson;
        foreach (var r in await db.Reminders.Where(r => r.Title == "DTP booster due" && r.LocalizationsJson == null).ToListAsync())
            r.LocalizationsJson = """{"ar":{"kind":"تطعيم","title":"جرعة DTP"},"fr":{"kind":"Vaccin","title":"Rappel DTP"}}""";
        foreach (var r in await db.Reminders.Where(r => r.Title == "Monthly tuition" && r.LocalizationsJson == null).ToListAsync())
            r.LocalizationsJson = """{"ar":{"kind":"فاتورة","title":"الرسوم الشهرية"},"fr":{"kind":"Facture","title":"Mensualité"}}""";
        foreach (var r in await db.Reminders.Where(r => r.Title == "Parent meeting" && r.LocalizationsJson == null).ToListAsync())
            r.LocalizationsJson = """{"ar":{"kind":"موعد","title":"لقاء أولياء الأمور"},"fr":{"kind":"Rendez-vous","title":"Réunion parents"}}""";
        await db.SaveChangesAsync();
    }
}
