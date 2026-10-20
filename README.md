# Little Stars Nursery

A nursery (crèche) app for **parents**, **educators**, and **admin**. One ASP.NET Core API, one Expo React Native client that publishes to **Android**, **iOS**, and **web**. Interface languages: **English, French, Arabic** (RTL).

## Stack

- API: ASP.NET Core 8, EF Core, SQLite, JWT, SignalR
- App: Expo 57 / React Native (web + stores via EAS)

## Demo logins

| Role | Email | Password |
| --- | --- | --- |
| Parent | `parent@nursery.local` | `Parent123!` |
| Educator | `educator@nursery.local` | `Educator123!` |
| Admin | `admin@nursery.local` | `Admin123!` |

On the login screen you can switch EN / FR / AR before signing in.

## Run locally

Terminal 1 — API:

```bash
cd src/Nursery.Api
dotnet run --launch-profile http
```

Swagger: http://localhost:5285/swagger

Terminal 2 — app:

```bash
cd apps/mobile
npx expo start
```

- Press `w` for the admin-friendly web UI
- Scan the QR with Expo Go for a phone
- For a physical device, set **API URL** on login to `http://YOUR-LAN-IP:5285` (Windows firewall must allow port 5285)

## Publish to stores

```bash
cd apps/mobile
npx eas-cli login
npx eas-cli build -p android
npx eas-cli build -p ios
```

Bundle IDs: `com.littlestars.nursery`

## Features (from the product PDF)

**Parents:** daily report (meals, sleep, diapers, mood), photos, in-app chat, check-in/out notices, invoices, health file, authorized pickup.

**Educators:** QR or tap attendance, one-tap daily log, weekly activities + development notes, photo sharing to that child’s parents only, allergy banners, incident reports.

**Admin:** children registry, classrooms, invoicing, staff shifts, waitlist, announcements/events, attendance stats.

**Differentiators:** role permissions, 3 languages, phone + web, generated weekly summary, offline queue for care logs, reminders (vaccines, invoices, meetings).

The weekly summary is generated from the week’s care events (swap `WeeklySummaryService` for an LLM later if you want).
