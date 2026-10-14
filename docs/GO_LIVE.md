# LoadKaro — going live (as of 2026-10-14)

## What goes where

| Piece | What it is | Where it goes | Who uses it |
|---|---|---|---|
| **Database + login** | Supabase project `ffbbujudebmtbuyssnsn` | Already live — nothing to upload | everything below |
| **Mobile app** | `LoadKaro/` (Expo) | **Google Play Store** (Android). Built by EAS as an `.aab` | shippers, truck owners, brokers |
| **Dashboard + ops CRM + client portal** | `admin-dashboard/` (one Next.js app) | **Netlify** (site #1). `/admin` + `/moderator` = staff dashboard & CRM desks; `/portal` = client web portal | staff; clients on a computer |
| **App as a website** (optional) | `LoadKaro/` built for web | **Netlify** (site #2) | people who won't install the app |

Two Netlify sites, one Play Store listing, one Supabase project.

## Before uploading — must be true

1. **SMS for OTP works for real numbers.** Supabase → Authentication → Providers → Phone. Until the DLT/MSG91 registration is live, check that a real (non-test) Indian number receives a code. If not, nobody but the test numbers can sign in.
2. **Privacy policy URL** (required by Play): what you collect (phone, name, KYC documents, approximate location) and why. Host it on the website or as a public page.
3. **Rotate secrets** (they passed through many sessions): Supabase → Project Settings → API → roll the **service-role key**; put the new one in Netlify (step B4). Revoke old **access tokens** at supabase.com/dashboard/account/tokens.
4. **One test pass on a phone** with the latest APK (`HANDOFF_APK_TESTING.md`).
6. **Remove leftover EAS variables** `EXPO_PUBLIC_TEST_MODE` and `EXPO_PUBLIC_TEST_OTP` from both the preview and production environments (expo.dev → project → Environment variables). No code reads them, so they are not in the app — this is housekeeping.
5. **After testing: delete the 150 test phone numbers** (Authentication → Phone → Test phone numbers) — they share one fixed OTP and work on the live database.

## A. Mobile app → Google Play

1. Create a Google Play developer account (one-time $25) at play.google.com/console.
2. Create the app: name **LoadKaro**, default language, app (not game), free.
3. Build the store file from `C:\eastmp\loadkaro-build` (see the EAS Windows workaround):
   `git pull` → `npx eas-cli@latest build --platform android --profile production`
   This makes an **.aab** (Android App Bundle). Package name: `in.loadkaro.app`.
4. Play Console → Testing → **Internal testing** → create a release → upload the .aab → add your testers' emails → roll out. Install from the Play link and test.
5. Fill the store listing: short + full description, icon (512×512), feature graphic (1024×500), at least 2 phone screenshots.
6. **App content**: privacy policy URL; **Data safety** (collected: phone number, name, photos/documents for verification, approximate location — used for app functionality and account management, not sold, encrypted in transit); content rating questionnaire; target audience 18+; ads: none.
7. Production → create release → same .aab (or a newer build) → submit for review. New developer accounts may need a 14-day closed test with 12+ testers before production is unlocked — plan for it.

## B. Dashboard + CRM + client portal → Netlify (site #1)

1. netlify.com → Add new site → Import from GitHub → repo **`chanakyagt/LoadKaro-dashbopard-app-before-documents-verification-options`**, branch `main`. Netlify reads `netlify.toml` (build `npm run build`, Node 22).
2. Before the first build, Site configuration → Environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL` — Builds + Functions
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Builds + Functions
   - `SUPABASE_SERVICE_ROLE_KEY` — Functions only (secret; the **new** rotated key)
   - Do **not** set `DASHBOARD_BYPASS_AUTH`.
3. Deploy. Then Supabase → Authentication → URL Configuration: Site URL = the Netlify URL; add `https://<site>.netlify.app/**` to Redirect URLs.
4. Check: `/login` → admin sign-in → `/admin/dashboard` shows numbers; signed out, `/admin/users` redirects to `/login`; `/portal/login` works for a client; no CSP errors in the browser console. Full list: `admin-dashboard/DEPLOY_NETLIFY.md`.
5. Optional: custom domain (e.g. `ops.loadkaro.in` for staff, `app.loadkaro.in/portal` for clients).

## C. App as a website → Netlify (site #2, optional)

1. Add new site → Import from GitHub → repo **`chanakyagt/Load_karo_initial`**, branch `LOADKARO-final-testing`. `netlify.toml` builds `expo export --platform web` into `dist`.
2. Environment variables before the first build: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
3. Deploy; sign in with a test number and post a load from the browser.

## Who uses which "CRM"

- **Staff (your ops team)** → dashboard `/admin` or `/moderator` → CRM section: Matching Desk (suggested load↔truck pairs), Match Pipeline, Support Desk, KYC Desk, plus Change History / Activity Log for admins.
- **Shippers who want to send a load** → the **app**, or on a computer the **client portal `/portal`**: sign in with their phone, post / close their loads, see their verification status, raise support tickets that land in the Support Desk. Registration happens in the app only.
