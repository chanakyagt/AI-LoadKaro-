# AI-LoadKaro-

https://youtu.be/jwnyEk_55hU

The reason I selected this project for LoadKaro is a real logistics issue in the Indian trucking marketplace: empty return truck loads. This inflates trucking prices for shippers and also creates inefficiency in load procurement for transporters. I noticed this problem when I shifted to Hyderabad a week ago, and my friend's uncle (also connected to this space) shared the same pain point.

Another recurring problem I personally face is that many websites still do not provide voice typing. I am a voice-first person, so I created a small extension that converts my voice to text, which I can directly copy and paste.

---LoadKaro App
---LoadKaro Admin Dashboard
---Voice transcriber

## LoadKaro Monorepo

Single repository containing all LoadKaro applications:

- `LoadKaro/` -> mobile app for shippers and truck owners (Expo + React Native)
- `admin-dashboard/` -> admin/moderator dashboard (Next.js App Router)
- `voice extention/` -> browser extension for voice transcription workflow

The mobile app and dashboard use the same Supabase backend.

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

### 3) Voice Extension (`voice extention/`)
- Browser extension with popup/options/recorder UI
- Content script and background script support
- Includes extension manifest and icon assets

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
  voice extention/              # Browser voice extension
    manifest.json
    popup.html
    recorder.html
    content.js
    background.js
    icons/
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

Load unpacked browser extension:

```text
Open Chrome/Edge -> Extensions -> Developer mode -> Load unpacked -> select `voice extention/`
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

If an AI coding assistant is used in this repo, treat this as a three-project monorepo:
- mobile (`LoadKaro`) is user-facing marketplace app
- dashboard (`admin-dashboard`) is backoffice moderation and operations app
- extension (`voice extention`) is browser-based voice/transcription UI
- Supabase schema and policies are source of truth for data constraints and access behavior

When making changes, update relevant docs in `LoadKaro/DOCS_*.md` if behavior or API contracts change.
