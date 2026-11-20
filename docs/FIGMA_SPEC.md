# Little Stars — Figma / UI specification

This document mirrors the product UI implemented in `apps/mobile`. Use it for design tools or QA checklists.

## Design tokens

- Background `#FAF8F5`, cards `#FFFFFF`, primary `#F59E0B`, ink `#292524`, muted `#78716C`, sage `#059669`, danger `#E11D48`, border `#E7E5E4`
- Radius 12–16px cards, pill chips; tab bar height 60px with Ionicons + labels
- Care accents: meal amber, nap indigo, diaper cyan, mood green

## Roles & tabs

| Parent | Educator | Admin |
|--------|----------|-------|
| Today | Attendance | Dashboard |
| Photos | Log | Photos |
| Chat | Photos | Chat |
| Child | Chat | More |
| More | More | |

## Screens

See README and in-app routes: Login, Today, Attendance, Log, Gallery, Chat (list/compose/thread), Child (+ health + invoices), More, Admin (8 sub-tabs).

## Patterns

- **RowActions:** Edit + Delete (rose) with native confirm dialog
- **Soft delete:** rows disappear after confirm (no trash UI)
- **RTL:** Arabic via `setAppLanguage('ar')`

Implementation source of truth: `apps/mobile/src/theme.ts`, `apps/mobile/src/ui.tsx`.