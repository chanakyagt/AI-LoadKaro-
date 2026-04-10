# AI-LoadKaro-

https://youtu.be/jwnyEk_55hU
---LoadKaro App
---LoadKaro Admin Dashboard
---Voice transcriber

## LoadKaro Monorepo

Single repository containing both LoadKaro applications:

- `LoadKaro/` -> mobile app for shippers and truck owners (Expo + React Native)
- `admin-dashboard/` -> admin/moderator dashboard (Next.js App Router)

Both apps use the same Supabase backend.

## What this repository contains

### 1) LoadKaro Mobile App (`LoadKaro/`)
- Expo SDK 54 + React Native
- Phone OTP authentication via Supabase Auth
- Role-based UX for shipper and truck owner flows
- Core marketplace workflows:
  - post loads
  - manage trucks
  - create availabilities
  - browse market listings
  - call counterparty
  - record "Show Interest" lead entries

### 2) Admin Dashboard (`admin-dashboard/`)
- Next.js 16 (App Router) + Tailwind + shadcn/ui
- Admin and moderator views
- Verification review workflows
- Universal data table for CRUD/ops screens
- `/api/admin/*` route handlers using service-role access

## System architecture (high level)

- Mobile app uses Supabase anon key and RLS-protected access.
- Dashboard uses authenticated role checks (`admin` / `moderator`) and service-role-backed API routes for operations.
- Shared data model includes:
  - `users`
  - `loads`
  - `trucks`
  - `availabilities`
  - `interests` (lead tracking)
  - verification and audit tables

Reference docs are in `LoadKaro/`:
- `DOCS_SYSTEM_ARCHITECTURE.md`
- `DOCS_MOBILE_APP.md`
- `DOCS_ADMIN_DASHBOARD.md`
- `DOCS_SUPABASE_DATABASE.md`

## Monorepo structure

```text
mobile App/
  package.json                  # npm workspaces root
  README.md                     # this file
  .gitignore
  LoadKaro/                     # Expo mobile app
    package.json
    app.json
    i18n/
    screens/
    services/
    lib/
    ...
  admin-dashboard/              # Next.js dashboard
    package.json
    src/app/
    src/components/
    src/lib/
    middleware.ts
    ...
```

## Prerequisites

- Node.js 20+ (recommended)
- npm 10+ (recommended)
- Expo Go / Android Studio / Xcode (for mobile targets)
- A Supabase project with schema configured for this app

## Environment variables

Create env files from examples in each project.

### Mobile (`LoadKaro/.env`)
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_SUPABASE_KEY` (legacy alias, optional)

### Dashboard (`admin-dashboard/.env.local` or `.env`)
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Optional dashboard dev bypass flags:
- `DASHBOARD_BYPASS_AUTH=true`
- `NEXT_PUBLIC_DASHBOARD_BYPASS_AUTH=true`

## Setup and run

Install all dependencies once at repo root:

```bash
npm install
```

Run mobile app:

```bash
npm --workspace LoadKaro run start
```

Run admin dashboard:

```bash
npm --workspace admin-dashboard run dev
```

Build dashboard for production:

```bash
npm --workspace admin-dashboard run build
npm --workspace admin-dashboard run start
```

Useful mobile commands:

```bash
npm --workspace LoadKaro run android
npm --workspace LoadKaro run ios
npm --workspace LoadKaro run web
```

## Authentication model

### Mobile app
- Uses phone OTP sign-in and verification.
- After OTP verification, app resolves profile/role and routes to the role dashboard.

### Dashboard
- Uses role-aware access (`admin` and `moderator`).
- Middleware guards `/admin/*`, `/moderator/*`, `/login`, and `/api/admin/*`.
- API layer applies auth checks, then performs data ops using service role where required.

## Key product workflows

- Shipper posts load -> Truck owner browses load -> calls shipper and/or taps "Show Interest"
- Truck owner posts availability -> Shipper browses availability -> calls owner and/or taps "Show Interest"
- Moderators/admins track and update lead lifecycle via `interests` status
- Verification docs submitted from mobile are reviewed in dashboard

## Quality and safety notes

- Keep secrets out of git (`.env*` excluded by `.gitignore`).
- Never expose `SUPABASE_SERVICE_ROLE_KEY` to client-side code.
- Prefer API route handlers for privileged dashboard operations.
- Follow role allowlists for editable/deletable fields in dashboard tables.

## Repository hygiene

This repo should not track generated or local-only files such as:
- `node_modules/`
- `.next/`
- `*.log`
- `.cursor/`
- local env files

Review staged files before each commit:

```bash
git status
git diff --cached --name-only
```

## Primary scripts by package

### Root
- `npm install` -> installs workspace dependencies

### `LoadKaro`
- `npm run start`
- `npm run android`
- `npm run ios`
- `npm run web`

### `admin-dashboard`
- `npm run dev`
- `npm run build`
- `npm run start`
- `npm run lint`

## AI assistant context

If an AI coding assistant is used in this repo, treat this as a two-app monorepo with a shared backend contract:
- mobile (`LoadKaro`) is user-facing marketplace app
- dashboard (`admin-dashboard`) is backoffice moderation and operations app
- Supabase schema and policies are source of truth for data constraints and access behavior

When making changes, update relevant docs in `LoadKaro/DOCS_*.md` if behavior or API contracts change.
