# LoadKaro — Technical MVP Readiness & Scale

> Mobile app, backend scalability to 6,000 users, and admin dashboard completeness.
> Generated 2026-06-30 from an automated multi-agent audit. Read-only analysis; nothing in the app or database was modified.

---

## Mobile App

Reviewed the Expo/React Native source under `LoadKaro/` (screens, components, navigation, store, lib, config, i18n, `app.json`, `eas.json`, `package.json`). This is a **real, coherent MVP** — not a scaffold. Auth, posting, browsing, verification-doc upload, i18n (en/hi/te/kn), offline detection, and a polished shipper experience all exist and are wired together. It is close to Play-submittable but has a handful of store-listing and robustness gaps that should be closed first.

### 1. Google Play submission readiness

| Item | Status | Notes |
|---|---|---|
| Android package id | **BAD** | `app.json:23` → `"package": "com.anonymous.LoadKaro"`. The `com.anonymous.*` prefix is the Expo default and looks unprofessional / squats a namespace you don't own. **This is permanent once published** — Play locks the package id forever. Change to e.g. `in.loadkaro.app` or `com.loadkaro.app` **before the first upload**. CRITICAL to fix now, trivial later. |
| App icon / adaptive icon / splash | **GOOD** | `assets/icon.png`, `android-icon-foreground.png`, `android-icon-monochrome.png`, `android-icon-background.png`, `splash-icon.png`, `favicon.png` all present (`assets/`). Adaptive icon + monochrome (themed-icon) configured in `app.json:18-22`. |
| `versionCode` / versioning | **OKAYISH** | No `android.versionCode` in `app.json`. With EAS this is fine **only if** `cli.appVersionSource` is `remote` (not set in `eas.json`). On the new default this errors or warns at build. QUESTION: is remote versioning configured at the EAS project level? If not, add `"appVersionSource": "remote"` to `eas.json` or pin `versionCode`. |
| Permissions | **GOOD** | No `android.permissions` over-declared. Only `expo-document-picker` (doc upload) and `@react-native-community/netinfo` (network state) are used — both low-risk. No camera/location/contacts requested, so no Play data-safety friction there. |
| Privacy policy | **BAD (blocker)** | Play **requires** a privacy-policy URL for any app that collects personal data, and this app collects **name + phone number** and uploads **ID/verification documents**. No privacy policy file or URL found anywhere in the repo. You must host one and add the URL in the Play Console + the app's profile screen before review. |
| Data-safety form | **OKAYISH** | You'll need to declare collection of phone number, name, and uploaded documents (KYC). Straightforward but must be done. |
| EAS build profiles | **GOOD** | `eas.json` has clean `development` / `preview` (apk) / `production` (app-bundle) / `production-apk` profiles with `EXPO_PUBLIC_TEST_MODE=false`. Production correctly emits an `.aab`. |
| Secrets / env | **GOOD** | `.env` is gitignored (`.gitignore` covers `.env` and `.env*.local`). Supabase URL + anon key are read from `EXPO_PUBLIC_*` (`lib/supabase.js:11-13`) — anon key is safe to ship (it's public by design); real protection is RLS, reviewed separately. |
| Undeclared dependency | **OKAYISH** | `@expo/vector-icons` is imported in 9 source files (e.g. `ShipperHomeScreen.js:13`, `ShipperPostLoadScreen.js:13`) but is **not** in `package.json` dependencies. It resolves today as a transitive dep of `expo` (confirmed `require.resolve` succeeds, present in `package-lock.json`), so builds won't break — but relying on a transitive for a direct import is fragile across SDK bumps. Add it explicitly. |

### 2. Crash / robustness risks

- **No global Error Boundary — CRITICAL.** Grep for `ErrorBoundary` / `componentDidCatch` returns nothing. `App.js` wraps the tree in providers but has no error boundary. Any unhandled render error in a screen white-screens the whole app with no recovery. For an MVP shipping to non-technical truckers/shippers this is the single highest-value robustness fix. Add one boundary around `RootNavigator`.
- **Logged-in-but-no-profile spinner has a 15s safety net — GOOD.** `RootNavigator.js:165-177` signs the user out if stuck on `session && !user`, and `authStore.fetchPublicUser` (`authStore.ts:64-71`) clears the session if the profile fetch fails with no prior user. This is thoughtful and avoids the classic infinite-spinner lockout.
- **Offline handling — GOOD (presentational only).** `OfflineBanner.js` + `useNetworkStatus.js` show a red "no internet" banner via NetInfo. However it is **only a banner** — actions (post load, send OTP, upload docs) still fire while offline and surface a raw Supabase network error in an `Alert`. OKAYISH for MVP; the banner at least tells users why things fail.
- **Network/DB error handling — OKAYISH.** Most Supabase calls check `error` and show `Alert.alert(...)` (e.g. `ShipperPostLoadScreen.js:104,131,259`; `ViewLoadsScreen.js:87`). But several surface `error.message` (raw Postgres text) directly to the user — fine for debugging, unpolished for production. `authErrors.ts` does a nice job mapping auth errors to localized copy; that pattern should be extended to data calls.
- **Null-safety — GOOD.** Heavy, consistent optional chaining and `?? '—'` fallbacks (`RoleDashboardScreen.js:41-45`, `ShipperHomeScreen.js:228-229,239`). Nested relational reads default to `{}` before access. Low null-crash risk.
- **Verification upload blob path — OKAYISH (watch).** `verificationUpload.js:101-104` does `fetch(file.uri)` → `.blob()` → `new Response(blob).arrayBuffer()`. This is the known workaround for RN/Hermes upload quirks and is fine for small KYC images/PDFs, but is memory-heavy and historically flaky for large files on some Android devices. Acceptable for MVP; add a file-size guard.
- **PII in production logs — BAD.** A `logger.js` exists that strips `console.log` in production — but the auth flow ignores it and uses raw `console.log` with **phone numbers and user ids**: `OTPScreen.js:37,45,50,60` (`'[OTP] Verifying OTP for phone:', phone`), `SignInScreen.js:34,38`, `syncUserAfterOtp.js:19,33` (auth user id). These persist in release builds (Hermes keeps `console.*`), leaking PII to logcat. Route them through `logger` or delete them.
- **No crash reporting.** No Sentry/Crashlytics. Expected for an MVP, but you'll be blind to field crashes. `logger.error` is intentionally left active "for crash reporting integrations later" (`logger.js:19-22`) — good hook point.

### 3. UX coherence: shipper (revamped) vs truck_owner/broker (shared)

- **Two visually distinct worlds — BAD coherence, acceptable trade-off.** `RootNavigator.js:195-205` branches: shippers get `ShipperNavigator` (bottom tabs, navy/orange brand, hero header, animated splash, `theme/theme.js` design tokens, `@expo/vector-icons`); truck_owner/broker/admin/moderator get `AppNavigator` → the older `RoleDashboardScreen` (`screens/RoleDashboardScreen.js`) — a plain stacked list of navy buttons with hardcoded `#0C2356` colors, no icons, no tabs. The two halves look like different apps.
- For a load-board, the **truck owner is half the marketplace** (they supply the trucks that make shipper loads useful). Shipping a markedly more primitive UI to truck owners risks weaker retention on the supply side — the side that's usually harder to acquire. This is a known/intentional staged-rollout decision per the memory notes, so flagging as the top **post-MVP** priority rather than a launch blocker.
- **Shipper tab state is local, not navigation state — OKAYISH/watch.** `ShipperNavigator.js:17` keeps the active tab in `useState('home')` inside `ShipperTabsScreen` and conditionally renders one screen. Consequence: Android hardware **back button won't move between tabs** (no nav history), and a tab switch unmounts/remounts the previous screen (state lost, refetch on return — `ShipperHomeScreen` reloads via `useFocusEffect`). Functional, but not idiomatic; a real tab navigator would handle back + state preservation for free.
- **Shipper flows themselves — GOOD.** `ShipperPostLoadScreen.js` is genuinely well-built: stepped section cards, required-field validation, past-date guard (`:196-201`), payment-type logic, decimal/locale-comma parsing (`:203`), min-rate check. `ShipperHomeScreen.js` has pull-to-refresh, empty states, live counts, and a verification nudge. This is solid MVP product work.

### 4. GOOD / OKAYISH / BAD / CRITICAL summary

- **CRITICAL:** No global error boundary (one render crash = dead app); `com.anonymous.LoadKaro` package id (permanent once published); missing privacy policy (Play review blocker for PII/KYC collection).
- **BAD:** PII (phone numbers, user ids) logged via raw `console.log` in release builds; truck_owner/broker stuck on the visibly older `RoleDashboardScreen`.
- **OKAYISH:** Offline banner is cosmetic only (no action gating); raw `error.message` shown to users on data errors; `versionCode`/EAS remote-versioning config unverified; `@expo/vector-icons` undeclared in `package.json`; verification upload memory pattern; shipper tabs use local state (no Android-back / state-preservation).
- **GOOD:** Null-safety discipline; stuck-spinner self-recovery; localized auth-error mapping; clean EAS profiles; gitignored secrets; full 4-language i18n; polished, validated shipper post-load + home flows; adaptive/monochrome icons present; production-safe `logger` utility (just under-used).

### 5. Top quick wins before launch (fast for an AI coding agent)

1. **Rename the Android package** in `app.json:23` to a real namespace (`in.loadkaro.app`) — do this before the first Play upload; it can never change afterward. (1 line)
2. **Add a global Error Boundary** component wrapping `RootNavigator` in `App.js`, with a friendly "Something went wrong — restart" fallback. Highest crash-safety ROI. (~1 file)
3. **Strip PII logs:** replace the raw `console.log` calls in `OTPScreen.js`, `SignInScreen.js`, and `syncUserAfterOtp.js` with `logger.log` (already exists) or delete them. (mechanical)
4. **Declare `@expo/vector-icons`** in `package.json` dependencies at the Expo-compatible version. (1 line)
5. **Confirm/set EAS versioning:** add `"cli": { "appVersionSource": "remote" }` to `eas.json` (or pin `android.versionCode`) so production builds don't fail or collide. (1 line)
6. **Host a privacy policy** and add the URL to the Play listing + a "Privacy Policy" link in the shipper profile / role dashboard. (content + 1 link)
7. **Gate destructive actions when offline:** in `useNetworkStatus`-aware screens, disable the Post/Send/Upload buttons (or short-circuit with a localized "you're offline" alert) instead of letting them throw a raw network error. (small, repeatable edit)

Files most relevant to these fixes: `LoadKaro/app.json`, `LoadKaro/eas.json`, `LoadKaro/App.js`, `LoadKaro/screens/OTPScreen.js`, `LoadKaro/screens/SignInScreen.js`, `LoadKaro/services/syncUserAfterOtp.js`, `LoadKaro/package.json`, `LoadKaro/navigation/RootNavigator.js`, `LoadKaro/navigation/ShipperNavigator.js`, `LoadKaro/screens/RoleDashboardScreen.js`, `LoadKaro/lib/logger.js`.

I have enough to write the verdict. The query patterns are scoped/paginated (good), no `select('*')` full-table user reads in app code, no realtime. Key risks are RLS initplan, indexes, and the `view users USING(true)` enabling full-table reads despite app not doing it. Let me confirm whether there's a `.in('id', ownerIds)` that could batch many users (N+1-ish) — that's bounded by PAGE_SIZE=20, fine.

## Backend & Scale to 6,000 Users

**Overall verdict: OKAYISH — will reach 6,000 users without an emergency, but only because traffic for an MVP is low. The schema has three concrete time-bombs (RLS `initplan` re-eval, missing indexes, and the `view users USING(true)` full-table-read policy) that should be fixed before, not after, growth. None of these require an app rewrite; all are one-time SQL migrations.**

The good news up front: the client-side query patterns are genuinely well-built for an MVP and are *not* the scaling bottleneck. The risk is entirely in the database policy/index layer plus external-service economics (Twilio, storage). I read the actual fetch code; below is what holds up and what does not.

---

### 1. Client query patterns — GOOD

I read every list screen and the profile/auth services. The data-access discipline is better than typical MVP code:

- **Pagination is real, not cosmetic.** `PAGE_SIZE = 20` (`LoadKaro/constants/pagination.js:2`) and every list uses keyset/cursor pagination, not `OFFSET`. `ViewLoadsScreen.js:183-189`, `ViewAvailabilitiesScreen.js:225-228`, and `ShipperTrucksScreen.js:157-158` all do `.lt('created_at', cursor).order('created_at', desc).limit(PAGE_SIZE)`. Cursor pagination keeps page-N cost constant as tables grow — this is the single most important thing they got right and it removes the classic load-board scaling failure.
- **No `select('*')` full-table scans of `users`.** Every `users` read is keyed: by `id` (`loadUserProfile.js:19-23`, `ShipperProfileScreen.js:64`) or by `.in('id', ownerIds)` bounded to one page (`ShipperTrucksScreen.js:122-125`, `ViewAvailabilitiesScreen.js:155-158`). So the app does **not** exploit the dangerous `USING(true)` users policy (see §3) — but the policy still leaves the door open.
- **Counts use `head: true`.** `ShipperHomeScreen.js:68-77` does `count: 'exact', head: true` so the dashboard stat cards transfer no rows, only counts. At 6k users a shipper's own load count is tiny, so even `exact` counts are fine here.
- **No realtime / websockets anywhere.** Grep for `.channel(`/`.subscribe(`/`removeChannel` hit only `package-lock.json`, never app code. This is a *positive* for scale: Supabase free/low tiers cap concurrent realtime connections (200 on free, 500 on Pro), and 6k installs polling-on-focus (`useFocusEffect`, `ShipperHomeScreen.js:80-84`) is far cheaper than 6k live sockets. Keep it this way until well past 6k.

**One correctness QUESTION, not a scale bug:** `FindReturnLoadScreen.js:129-133` paginates with `loading_date` using `.gt(cursor)` while ordering by `loading_date ascending`. Because many loads can share the same `loading_date`, `gt` can **skip rows** that share the boundary date across a page boundary (the other screens avoid this by paginating on `created_at`, which is near-unique). At 6k users with many same-day loads on a popular lane this could silently drop return-load matches. Is `loading_date` intended as the cursor, or should this also key on `created_at`?

---

### 2. RLS `auth.uid()` re-evaluation on 24 policies — BAD (cheap fix, real impact at scale)

The seed finding (24 policies call `auth.uid()`/`current_setting()` unwrapped → `auth_rls_initplan`) is the most material *performance* item. Postgres re-evaluates an unwrapped `auth.uid()` **once per candidate row** instead of once per query. On the hot paths this matters:

- The market feeds (`ViewLoadsScreen` market variant, `ShipperTrucksScreen`, `FindReturnLoadScreen`) filter `loads`/`availabilities` with `status='open'/'available'`. Every row the planner considers re-runs the policy's `auth.uid()`. With a 20-row `LIMIT` the *returned* set is small, but the policy is evaluated against every row scanned before the limit/filter is satisfied — which grows with table size, not page size.
- Fix is trivial and standard: wrap as `(select auth.uid())` so the planner hoists it to an InitPlan evaluated once. This is a pure migration, no app change. **Do this before 6k.** It is the highest value/lowest risk fix in this whole review.

---

### 3. `view users` policy `USING(true)` — CRITICAL as a scaling+privacy footgun

The seed flagged `users` has both `select own user` (`auth.uid()=id`) **and** `view users` (`USING(true)`) for role `authenticated`. Two angles, both relevant to scale:

- **Performance:** two permissive SELECT policies on `users` means Postgres OR-evaluates *both* on every users read (redundant-policy finding), and the `USING(true)` branch makes the table fully readable. The app code today is well-behaved (§1), but the policy permits any authenticated client to issue `supabase.from('users').select('*')` and pull **all 6,000 rows — names, phone numbers, roles** — in one request. At 6k rows that is one cheap query returning the entire user base; it is both a data-exfiltration vector (every phone number in a phone-OTP marketplace) and an easy way for a misbehaving/abusive client to hammer the DB egress.
- This is the kind of thing that is invisible at 50 users and becomes a headline at 6,000. **Recommend:** drop `USING(true)`, replace with a policy that exposes only the *minimal* columns counterparties legitimately need (name, phone, verification_status) and ideally only for users who have an active load/availability — which is exactly the join the feeds already do. If a blanket policy must stay for the MVP, at minimum restrict it to non-sensitive columns via a view.

---

### 4. Missing indexes — BAD before 6k, but pinpointed

Two index gaps will bite specifically as `loads`/`availabilities` grow:

- **Unindexed FKs** (`admin_alerts.handled_by`, `verification_submissions.reviewed_by`, `verification_submissions.submitted_by`) — these are dashboard/admin paths, low row count, low urgency. OKAYISH to defer.
- **The feed filters need composite indexes that the seed didn't confirm exist.** The hot queries filter+sort on `(status, origin_location_id, created_at)` for availabilities (`ShipperTrucksScreen.js:154-158`) and `(status, loading_date, origin_location_id)` for loads (`FindReturnLoadScreen.js:121-133`). Without a composite index covering `status` + the location filter + the sort/cursor column, each market query degrades toward a scan-and-sort as these tables grow into the tens/hundreds of thousands of rows (6k users posting repeatedly over months). **Recommend verifying/adding:** `availabilities(status, origin_location_id, created_at desc)` and `loads(status, origin_location_id, loading_date)` (plus destination variants if destination-filtered queries are common). This is the difference between sub-10ms feeds and creeping latency at month 6.
- The ~11 unused indexes are harmless pre-launch (just write overhead); ignore until they show up as bloat.

---

### 5. `active_locations` SECURITY DEFINER view + `location_states` zero-policy — OKAYISH/QUESTION

Every list screen's state/city dropdowns hit `active_locations` (`ShipperTrucksScreen.js:64-66`, `ViewLoadsScreen.js:82-85`, `FindReturnLoadScreen.js:60-63`, `ViewAvailabilitiesScreen.js:64-67`). This view is queried on nearly every screen mount, unfiltered `.select('state').order('state')`, then de-duped client-side. At scale concerns:

- It is a **near-constant reference dataset** but is re-fetched on every screen focus with no client cache. At 6k users this is a steady stream of identical queries. Low per-query cost, but trivially cacheable — consider caching the states list in the zustand store once per session. Minor.
- `location_states` has RLS enabled with **zero policies** (seed) — only `service_role` can read it. The dropdowns use `active_locations` (the SECURITY DEFINER view), so they likely work, but is anything meant to read `location_states` directly? Flag as a QUESTION — could be a latent broken dropdown.
- The SECURITY DEFINER view being linter-flagged is a security note (it bypasses the querying user's RLS); for a public locations list that is probably intentional, but confirm it only exposes location reference data, not anything joined to user data.

---

### 6. External-service economics at 6k — the real ceiling

The DB will scale fine with the fixes above. The harder limits at 6,000 users are *cost and capacity*, not Postgres:

- **Twilio SMS / phone OTP — the dominant cost and risk.** Every login and re-verification is a billed Twilio SMS. India A2P SMS plus the fact that **the project is NOT registered on TRAI DLT** (per business context) means at 6k-user scale you face (a) per-message cost that scales linearly with logins, and (b) regulatory/deliverability risk — non-DLT-registered traffic to Indian numbers is increasingly filtered/blocked by carriers, so OTP delivery failures will rise *as volume rises and you become visible*. `phone_exists()` being anon-callable also means an attacker can drive OTP sends (SMS-pumping / toll-fraud) — at 6k-user visibility this is a concrete bill-shock vector. **Before scaling: register DLT, and add rate-limiting on OTP sends.** This is arguably the #1 scale blocker ahead of anything in the DB.
- **Connection limits.** `supabase-js` uses PgBouncer transaction pooling, so 6k mobile clients do not map to 6k Postgres connections — fine. Just ensure server-side code (dashboard) uses the pooled connection string, not direct.
- **Storage for verification docs.** Free tier is ~1GB, Pro 8GB+. If most of 6k users upload ID + vehicle docs (say 2-4 images, 0.5-2MB each), that is realistically 6-40GB. **You will exceed free tier and likely the Pro base allotment** — budget for storage add-ons and set an upload size/compression limit client-side.
- **Row counts.** 6k users + their loads/trucks/availabilities over time is comfortably within even the free row ceiling; not a concern.

---

### Priority fix list before 6,000 users

| Priority | Fix | Type | Why it matters at scale |
|---|---|---|---|
| 1 | Register **TRAI DLT** + rate-limit OTP sends (and `phone_exists`) | Ops/regulatory | OTP delivery failures + SMS-pump cost are the true growth ceiling |
| 2 | Wrap RLS `auth.uid()` → `(select auth.uid())` on all 24 policies | SQL migration | Per-row → per-query eval; biggest perf win, zero app change |
| 3 | Replace `users` `USING(true)` SELECT policy with column/scope-limited policy | SQL migration | Full-table phone-number exfiltration + redundant double-eval |
| 4 | Add composite indexes on `availabilities(status, origin_location_id, created_at)` & `loads(status, origin_location_id, loading_date)` | SQL migration | Keeps the market feeds fast as tables grow |
| 5 | Plan/budget Supabase **storage** for verification docs; cap upload size | Ops + small client change | Will exceed free/base tier with 6k uploaders |
| 6 | Fix `FindReturnLoadScreen` cursor (`loading_date`+`gt` skips same-date rows) | App fix | Correctness, not perf — but lost matches at high lane density |
| 7 | Cache `active_locations`/states in store; index 3 admin FKs | Minor | Reduces repeat reads; defer-able |

**Bottom line:** the application layer is built to scale (cursor pagination, scoped queries, no realtime, head-count queries) and needs little change. The backend reaches 6,000 users safely *if* items 1-4 are applied as one-time migrations/ops work. The genuine red flags are the Twilio/DLT economics and the `USING(true)` users policy — both invisible today and painful at scale. Files cited: `LoadKaro/lib/supabase.js`, `constants/pagination.js:2`, `screens/ShipperHomeScreen.js:55-77`, `screens/ShipperTrucksScreen.js:103-182`, `screens/ViewLoadsScreen.js:138-217`, `screens/ViewAvailabilitiesScreen.js:120-263`, `screens/FindReturnLoadScreen.js:102-156`, `services/loadUserProfile.js:19-23`.

I have everything needed. Here is my report section.

## Admin Dashboard

Reviewed: `admin-dashboard/middleware.ts`, all routes under `src/app/admin/*` and `src/app/moderator/*`, the `src/app/api/admin/*` handlers, `src/lib/auth/*`, `src/lib/supabase/*`, `src/lib/admin/patch-allowlist.ts`, `src/lib/audit.ts`, and the major components (`dashboard-shell.tsx`, `verification-docs-modal.tsx`, `common-data-table.tsx`).

### Overall completeness: GOOD

For an MVP this is a surprisingly complete and well-structured admin surface. Nearly every core freight-marketplace admin need is present, with a clean role split (admin vs moderator), a hardened service-role API layer, an allowlist for writable columns, an audit trail, and a verification approve/reject workflow tied to private storage. The gaps are mostly product depth, not architectural holes.

### What EXISTS vs what a freight-marketplace admin NEEDS

| Capability | Status | Evidence |
|---|---|---|
| Metrics / overview dashboard | GOOD | `app/admin/dashboard/page.tsx` + `lib/supabase/queries/stats.ts` — totals, open loads, active availabilities, pending verifications, unhandled alerts, breakdowns by role/status |
| Verification approval/rejection workflow | GOOD | `app/admin/verifications/page.tsx` (queue sorted by wait time), `components/admin/verification-docs-modal.tsx` (view docs → approve/reject with reason), `api/admin/verification/{submissions,documents,decision,signed-url}` |
| User management | OKAYISH | `app/admin/users/page.tsx`, `users/[id]/page.tsx` (405 lines), plus `shippers`/`truck-owners` segmented views; edit limited to allowlisted columns |
| Role management | OKAYISH | Admin may PATCH `users.role` (`patch-allowlist.ts:6`); dedicated "Add Moderator" via OTP (`api/admin/moderator/create`). No self-serve demote/suspend UI beyond raw role edit |
| Load / truck / availability moderation | GOOD | `loads`, `trucks`, `availabilities` pages; PATCH status / close / edit fields via `api/admin/row` |
| admin_alerts handling | GOOD | `app/admin/alerts/page.tsx`, mark-handled writes `handled_by`/`handled_at` (`api/admin/row/route.ts:100`); live unhandled badge in nav |
| Audit log viewing | GOOD | `app/admin/activity-log/page.tsx` — filter by action/entity/date, paginated (admin-only; not in moderator nav) |
| Global search / filter | GOOD | `api/admin/search` (users/trucks/loads/availabilities, UUID + unique_id + fuzzy), per-table search/filter/date/location in `common-data-table.tsx` |
| Locations / coverage catalog | GOOD | `app/admin/locations/page.tsx`, insert + activate/deactivate (admin-only) |

### Auth protection of routes: GOOD

- `middleware.ts` matches `/admin/:path*`, `/moderator/:path*`, `/login`, `/api/admin/:path*` (lines 96–103). It calls `supabase.auth.getUser()`, reads `public.users.role`, and redirects non-`admin`/non-`moderator` to `/login`. `/admin` requires `role === "admin"`; `/moderator` requires `role === "moderator"` (lines 66–80).
- Defense-in-depth: every `/api/admin/*` handler independently calls `requireDashboardAccess()` (returns 401/403) rather than trusting the middleware — good. Admin-only mutations (moderator-create, locations insert/delete, alerts, `location_states`) re-check `access.role !== "admin"`.
- The PATCH allowlist (`patch-allowlist.ts`) correctly constrains moderators to `verification_status`/`status` only and strips `phone`/`email` from any patch (`SENSITIVE`, line 63). DELETE and INSERT are admin-only.

QUESTIONS / WEAKNESSES on auth:
- BAD (verify intent): `isDashboardAuthBypassed()` (`lib/auth/bypass.ts`) lets `DASHBOARD_BYPASS_AUTH=true` or `NEXT_PUBLIC_DASHBOARD_BYPASS_AUTH=true` disable ALL login — middleware returns `NextResponse.next()` (line 22) and `requireDashboardAccess` returns `{ok:true, role}` from a cookie with no session. It is gated by `NODE_ENV === "production"` returning `false` first (line 20), so it cannot fire in a prod build. Confirm that the deployed Vercel environment is actually `NODE_ENV=production` and that neither bypass var is set there; if a staging deploy runs non-production with the public var set, the entire dashboard (and service-role API) is open to anyone. This is the single highest-risk item in the dashboard.
- OKAYISH: middleware reads the role via a per-request DB query on every matched request (including each `/api/admin/*` call, which then queries again in `requireDashboardAccess`) — two `users` lookups per API call. Fine at MVP scale; note for the 6000-user rebuild.

### Service-role key usage: GOOD (server-only)

- `lib/supabase/service-role.ts` reads `SUPABASE_SERVICE_ROLE_KEY` (no `NEXT_PUBLIC_` prefix), so it is never bundled to the client. `createServiceRoleClient()` is imported only by files under `app/api/admin/*` and server `lib/*` (audit, stats) — I found no client component importing it.
- Signed-URL route restricts to the `verification-docs` bucket and issues 300s URLs (`signed-url/route.ts:40,48`) — good.
- `api/admin/data` hardens the generic read: table allowlist, `SELECT_SAFE` regex on the select param, sort-column regex, page-size cap of 100, and admin-only gating for `admin_alerts`/`location_states` (lines 11–84). Solid for a service-role-backed endpoint.

QUESTION: `api/admin/data` exposes a near-arbitrary read over 12 tables with the service-role key (RLS bypassed). Any authenticated moderator can therefore read full `users` rows (phone numbers, etc.) and all `verification_submissions`/`audit_log` via `?table=...&select=*`. That is likely intended (moderators need to see users), but confirm moderators are trusted to see every user's phone/PII, since RLS no longer constrains them here.

### Missing options (rate: OKAYISH — product depth gaps, not blockers)

- BAD: No metrics over time. `stats.ts` is all point-in-time counts via N separate `head:true` count queries (12+ round trips per dashboard load, `stats.ts:79–107`). No growth/trend charts, no daily-new-loads, no match-rate, and no visibility into the product's core differentiator — return-load / empty-miles pre-allocation. For a load-board the "matched vs open" funnel and return-load fill rate are the metrics that matter; none exist.
- OKAYISH: No suspend/ban or deactivate-user action. Admin can change `role` and `verification_status` but there is no `is_active`/blocked flag on users (locations have `is_active`; users do not). For a marketplace, the ability to disable a bad actor is usually table-stakes.
- OKAYISH: Verification queue counts documents as `docsCount: 0` hard-coded (`verifications/page.tsx:106,119`) — the column is dead. Minor.
- OKAYISH: Rejection reason is "optional" and free-text only (`verification-docs-modal.tsx:266`); no standardized reason codes, and no way to re-open / re-request docs from the queue (a new submission must arrive).
- OKAYISH: No bulk actions (approve/close/handle multiple rows), no CSV export, and no notifications/escalation when verifications age past the 3-day red threshold the UI already computes.
- OKAYISH: Moderator nav has no Activity Log and no Alerts page (`MODERATOR_SECTIONS`, `dashboard-shell.tsx:90–112`) — moderators can take actions that are audited but cannot see the audit log or the alerts queue. Confirm intended.
- OKAYISH: No admin-side messaging/contact between shipper and truck owner, and no dispute handling — reasonable to defer for MVP.

### Notable good touches
- Audit log is written for every mutating action with actor id/role and a derived action type (`audit.ts`, `row/route.ts:42–58`), and is viewable+filterable.
- `coming-soon.tsx` placeholder exists, suggesting deliberate scoping of unfinished areas.
- Live polling badges for pending alerts/verifications in the sidebar (`dashboard-shell.tsx:114–158`) give operators an at-a-glance queue.
