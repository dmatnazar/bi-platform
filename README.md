# BI Platform

Multi-tenant Business Intelligence web platform.
Electron Admin App + VPS Gateway bilen işleýär — **DataLens-e meňzeş** dashboard konstruktor.

## Stack

- **Next.js 15** (App Router) + TypeScript + Tailwind CSS 4
- **ECharts** + **react-grid-layout** — dashboard builder
- **jose** (JWT) + **bcryptjs** — auth
- JSON file store (`data/bi-platform.json`) — ilkinji işlatmak üçin

## Architecture

```
[Windows Server] Electron Admin App  --sync-->  VPS Gateway (Fastify)
                                                      |
                                                      | APIs (+ paramsSchema)
                                                      v
                                              BI Platform (Next.js)
                                         login / dashboards / builder
                                         global filters / param bindings
```

## Quick start

```bash
cd bi-platform
npm install
npm run dev
```

Open: **http://localhost:3000**

### Demo accounts

| Login  | Password  | Role        |
|--------|-----------|-------------|
| admin  | admin123  | super_admin |
| viewer | viewer123 | viewer      |

## Features

### Dashboard (DataLens-style)
- Drag-drop grid builder (KPI, bar, line, area, pie, table, text)
- **Global filter bar**: sene aralygy (beginDate/endDate), gözleg, custom parametrler
- Preset-ler: Bugün, 7 gün, 30 gün, Bu aý, Bu ýyl
- Widget → API baglanyşygy (catalog-dan)
- **API paramsSchema** (Electron-dan sync): her parametr üçin
  - Global filter-e bagla
  - Sabit baha
  - Widget-içi baha
- Auto-refresh, field mapping (category / value / series)
- Roles: super_admin, admin, editor, viewer

### Goldaw / Support chat
- Ulanyjylar diňe adminlere ýazýar (teklip, säwlik, sorag, maslahat)
- `/support` — ulanyjy ticketleri
- `/admin/support` — admin jogap / status
- Floating chat düwmesi + okalmadyk badge
- Polling 8s ticket içinde

### Admin
- Login / Logout (JWT cookie)
- Registration (select company → form → pending approval)
- Staff, registrations, companies
- VPS Gateway proxy (`/api/gateway/query`)

## API parametrleri (mysal)

Electron-da API döredeniňizde:

```json
{
  "queryParams": [
    { "name": "beginDate", "sqlParam": "@beginDate", "type": "datetime", "required": true },
    { "name": "endDate", "sqlParam": "@endDate", "type": "datetime", "required": true },
    { "name": "salesID", "sqlParam": "@salesID", "type": "int", "required": false }
  ]
}
```

BI Platform:
1. Widget sazlamasynda API saýlaň → parametrler awto görünýär
2. «Global filter et» basyň → dashboard-da sene aralygy + beýlekiler peýda bolýar
3. beginDate / endDate global filter-e baglanýar
4. Filter üýtgedeniňizde ähli baglanan widget-ler täzeden soralýar

## Environment

```
GATEWAY_URL=http://localhost:4000
JWT_SECRET=change-me-long-random-string
GATEWAY_ADMIN_SECRET=...   # Electron sync secret bilen birmeňzeş
```

## Project structure

```
src/
  app/
    login/ register/
    (app)/
      dashboards/       List, view, create, edit + filters
      admin/
    api/                Auth, CRUD, gateway proxy, catalog
  components/
    ui/
    layout/
    dashboard/
      DashboardView.tsx
      DashboardCanvas.tsx
      DashboardFilterBar.tsx   ← global filters UI
      WidgetConfigPanel.tsx    ← paramsSchema + bindings
      LiveWidget.tsx           ← resolveWidgetParams
      WidgetPalette.tsx
    charts/
  lib/
    types.ts            ← ParamDef, GlobalFilterDef, resolveWidgetParams
    gateway.ts auth.ts db.ts
data/
```
