using System.Text;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using Nursery.Api.Auth;
using Nursery.Api.Data;
using Nursery.Api.Hubs;
using Nursery.Api.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers().AddJsonOptions(o =>
{
    o.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
    o.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
    o.JsonSerializerOptions.ReferenceHandler = ReferenceHandler.IgnoreCycles;
});
builder.Services.AddSignalR();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo { Title = "Nursery API", Version = "v1" });
    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        In = ParameterLocation.Header,
        Description = "JWT Bearer token",
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "bearer"
    });
    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme { Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" } },
            Array.Empty<string>()
        }
    });
});
builder.Services.AddDbContext<AppDbContext>(o =>
    o.UseSqlite(builder.Configuration.GetConnectionString("Default") ?? "Data Source=nursery.db"));
builder.Services.AddScoped<JwtTokenService>();
builder.Services.AddScoped<WeeklySummaryService>();
builder.Services.AddScoped<PaymentReceiptService>();
builder.Services.AddScoped<BrandingService>();
builder.Services.AddScoped<ChatAccessService>();
builder.Services.AddScoped<MediaUploadService>();
builder.Services.AddCors(o => o.AddDefaultPolicy(p =>
    p.AllowAnyHeader().AllowAnyMethod().SetIsOriginAllowed(_ => true).AllowCredentials()));

var jwtKey = builder.Configuration["Jwt:Key"] ?? "dev-nursery-secret-key-change-me-32chars!!";
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(o =>
    {
        o.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"] ?? "Nursery",
            ValidAudience = builder.Configuration["Jwt:Audience"] ?? "NurseryApp",
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey))
        };
        o.Events = new JwtBearerEvents
        {
            OnMessageReceived = ctx =>
            {
                var access = ctx.Request.Query["access_token"];
                if (!string.IsNullOrEmpty(access) && ctx.HttpContext.Request.Path.StartsWithSegments("/hubs"))
                    ctx.Token = access;
                return Task.CompletedTask;
            }
        };
    });
builder.Services.AddAuthorization();

var app = builder.Build();

Directory.CreateDirectory(Path.Combine(app.Environment.ContentRootPath, "wwwroot", "uploads"));

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await db.Database.EnsureCreatedAsync();
    await EnsureSchemaPatchesAsync(db);
    await SeedData.EnsureAsync(db);
    await SeedData.PatchContentLocalizationsAsync(db);
    await MigrateChatConversationsAsync(db);
}

app.UseSwagger();
app.UseSwaggerUI();
app.UseCors();
app.UseStaticFiles(new StaticFileOptions
{
    OnPrepareResponse = ctx =>
    {
        ctx.Context.Response.Headers.Append("Access-Control-Allow-Origin", "*");
    }
});
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.MapHub<ChatHub>("/hubs/chat");
app.MapGet("/health", () => Results.Ok(new { ok = true }));

app.Run();

static async Task EnsureSchemaPatchesAsync(AppDbContext db)
{
    foreach (var sql in new[]
             {
                 "ALTER TABLE Invoices ADD COLUMN ReceiptNumber TEXT",
                 "ALTER TABLE Invoices ADD COLUMN ReceiptUrl TEXT",
                 "ALTER TABLE Nurseries ADD COLUMN LogoUrl TEXT",
                 "ALTER TABLE Conversations ADD COLUMN ParentUserId TEXT",
                 "ALTER TABLE Conversations ADD COLUMN StaffUserId TEXT",
                 "ALTER TABLE Conversations ADD COLUMN OtherStaffUserId TEXT",
                 "ALTER TABLE Announcements ADD COLUMN LocalizationsJson TEXT",
                 "ALTER TABLE Events ADD COLUMN LocalizationsJson TEXT",
                 "ALTER TABLE Reminders ADD COLUMN LocalizationsJson TEXT"
             })
    {
        try { await db.Database.ExecuteSqlRawAsync(sql); }
        catch { /* column already exists */ }
    }
}

static async Task MigrateChatConversationsAsync(AppDbContext db)
{
    var parentId = Guid.Parse("33333333-3333-3333-3333-333333333333");
    var eduId = Guid.Parse("22222222-2222-2222-2222-222222222222");
    var adminId = Guid.Parse("11111111-1111-1111-1111-111111111111");
    var linaId = Guid.Parse("55555555-5555-5555-5555-555555555555");
    var nurseryId = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");

    var legacy = await db.Conversations.Where(c => c.ParentUserId == null || c.StaffUserId == null).ToListAsync();
    foreach (var c in legacy)
    {
        c.ParentUserId ??= await db.ParentChildren.Where(p => p.ChildId == c.ChildId).Select(p => p.ParentId).FirstOrDefaultAsync();
        if (c.StaffUserId is null)
        {
            var hasEduMsg = await db.Messages.AnyAsync(m => m.ConversationId == c.Id && m.SenderId == eduId);
            c.StaffUserId = hasEduMsg ? eduId : eduId;
        }
        if (string.IsNullOrWhiteSpace(c.Title) || c.Title == "Lina Benali")
        {
            var staff = await db.Users.FindAsync(c.StaffUserId);
            var child = await db.Children.FindAsync(c.ChildId);
            if (staff is not null && child is not null)
                c.Title = $"{child.FirstName} · {staff.FullName}";
        }
    }

    await db.SaveChangesAsync();

    async Task EnsureThread(Guid childId, Guid parent, Guid staff)
    {
        var exists = await db.Conversations.AnyAsync(c =>
            c.ChildId == childId && c.ParentUserId == parent && c.StaffUserId == staff);
        if (exists) return;
        var staffUser = await db.Users.FindAsync(staff);
        var child = await db.Children.FindAsync(childId);
        if (staffUser is null || child is null) return;
        db.Conversations.Add(new Nursery.Api.Models.Conversation
        {
            Id = Guid.NewGuid(),
            NurseryId = nurseryId,
            ChildId = childId,
            ParentUserId = parent,
            StaffUserId = staff,
            Title = $"{child.FirstName} · {staffUser.FullName}"
        });
    }

    await EnsureThread(linaId, parentId, eduId);
    await EnsureThread(linaId, parentId, adminId);
    await db.SaveChangesAsync();
}
