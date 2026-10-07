# LoadKaro security & bug audit — 2026-10-07

Scope: Supabase database (live project `ffbbujudebmtbuyssnsn`, read-only checks),
admin dashboard + CRM + client portal (`admin-dashboard/`), mobile app (`LoadKaro/`).
Method: live policy/function/grant inspection + Supabase security advisor; two
static code audits; every database claim from the code audits was re-checked
against the **live** policies (several older findings turned out to be fixed).
Nothing was changed during the audit.

Severity: **Critical** = exploitable now by any signed-in user, real harm.
**High** = exploitable with some access, or serious integrity/privacy impact.
**Medium** = defence-in-depth gap or limited impact. **Low** = hygiene.

---

## Status after the fix pass (2026-10-07, same day)

Database migrations (full SQL kept by Supabase under these names):
`security_phase1_signup_and_functions`, `security_phase1_trucks_rejected_editable`,
`audit_trail_v1`, `staff_decide_verification`, `phone_exists_rate_limit(_tune)`.
Dashboard `922fb16`, app `7b0ddc3` + `40e4a8f`. Every DB fix was proven with a
rolled-back attack test as a normal user; every API fix with live requests.

| # | Status | How |
|---|---|---|
| C1 | ✅ Fixed | BEFORE INSERT trigger forces unverified / free / generated ID / OTP-verified phone; INSERT policy also requires unverified+free. Read-only check: nobody had abused it. |
| H1 | ✅ Fixed | Per-role table allowlist, forbidden embeds, column-name + reserved-word checks; every users read logged. |
| H2 | ✅ Fixed | `staff_decide_verification()` — submission must be open and belong to the record; atomic; closes all open submissions. |
| H3 | ✅ Fixed | `q` sanitised; moderators see masked phones and can't search by phone. |
| H4 | ✅ Fixed | Bypass only for localhost Host; dev server binds 127.0.0.1; bypass off in `.env.local`. |
| H5 | ✅ Fixed | `user_self_update_ok` answers only about the caller. |
| **NEW (found while fixing)** | ✅ Fixed | **`middleware.ts` had never run** (Next 16 + `src/` → `src/proxy.ts`), so /admin, /moderator and /portal pages had no page-level guard (APIs were still protected). Moved; layouts now check role server-side too; fail-closed when env missing. |
| M1 | ✅ Fixed | EXECUTE revoked on 13 helper/trigger functions (advisor: 16 → 3, the 3 are required by RLS/sign-in). |
| M2 | ✅ Mitigated | `phone_exists` rate-limited to 60/hour per IP (CGNAT-safe). Full removal needs a reworked sign-in flow — deferred. |
| M3 | ⚠️ Open — product decision | Any signed-in user can see the contact row of an *active* lister (that is how calling works). Options: only verified users see phones, or a narrower contact view. |
| M4 | ✅ Fixed | Rejected trucks can be edited and resubmitted; uploads create the submission only after all files are stored. |
| M5 | ✅ Fixed for the future | New decisions close every open submission. **The 8 existing stale submissions are not touched yet — awaiting founder OK.** |
| M6 | ✅ Fixed | Audit writes awaited and checked; promotions logged. |
| M7 | ✅ Fixed | Enum values validated; moderators can't edit staff rows or assign roles. |
| M8 | ✅ Fixed | Signed URLs by `document_id` only; each view logged. |
| M9 | ✅ Fixed (CSP partial) | CSP, frame-ancestors, XFO, nosniff, Referrer/Permissions-Policy, HSTS; `script-src` still allows inline (nonce-based CSP = follow-up). |
| M10 | ✅ Fixed | See NEW above. |
| M11 | ✅ Fixed | Staff OTP rate limit; generic DB errors everywhere (`dbError`); desk dates validated. |
| M12 | ✅ Fixed | Session in device keystore (expo-secure-store, chunked, migrates old sessions). |
| M13 | ✅ Fixed | OTP resend timer + 5-wrong-codes cap. |
| L1–L10 | ✅ Fixed | Origin check on mutations; signed-URL host check; server-only guards; bypass cookie cleared on logout; dead `shippers-table.tsx` removed; test vars removed from `.env`; role dropped from auth metadata; logout clears local data even offline; GPS rounded, iOS reduced accuracy, no foreground service; local-date "today"; delete verifies a row; logger silent in release. |
| L11 | ⏳ Founder | Rotate service-role key + access tokens; delete the 150 test numbers after testing. |
| B1–B5 | ✅ Fixed | Status-bar scrim; Latest strip shows known details only; Call hidden on closed listings; no-coordinates message; one 10 MB limit. |
| Tracking | ✅ Added | `audit_trail`: every INSERT/UPDATE/DELETE on 10 tables, with actor, role, source (app/dashboard/system), IP, request id and field-level old→new; immutable (no UPDATE/DELETE/TRUNCATE for any API role, plus a trigger guard); admin page **Change history**. Staff reads of personal data and document views logged to the Activity Log. |

Remaining, not security: 10 pre-existing `react-hooks/set-state-in-effect`
lint errors in older dashboard/portal files (build passes).

---

## Findings

### Critical

| # | Area | Finding | Evidence |
|---|---|---|---|
| C1 | DB | **Sign-up lets a user write any value into their own profile.** The `insert own user` policy checks only `id` and `role`. A new user can insert themselves as `verification_status='verified'` (fake verified badge), `subscription_type` premium, a chosen `unique_id` (e.g. `ADM-…`, or the *next* sequence number → every later registration of that role fails on the unique key), and **any phone number** — `phone` is not tied to the OTP-verified number. Because `phone` is UNIQUE, registering a victim's number first locks the victim out of LoadKaro for good, and callers on the attacker's listings reach the victim. | live `pg_policies` users/INSERT; no INSERT trigger resets these columns (`trg_users_unique_id` keeps a client-supplied `unique_id`); `LoadKaro/services/syncUserAfterOtp.js:72` writes the phone passed from the previous screen |

### High

| # | Area | Finding | Evidence |
|---|---|---|---|
| H1 | Dashboard | **Moderators can dump every user's phone and sensitive tables** via `/api/admin/data` (service role, free-form `select`, `users`/`audit_log`/`verification_documents` allowed). | `admin-dashboard/src/app/api/admin/data/route.ts:11-30,70,101` |
| H2 | Dashboard | **Verification decision trusts the request**: any staff member can mark any user/truck verified with a random `submission_id`; submission is not checked to belong to the entity or still be open; the two updates are not atomic. | `src/app/api/admin/verification/decision/route.ts:52-90` |
| H3 | Dashboard | **Global search** returns phone numbers to moderators and puts raw `q` into PostgREST `.or()` (filter injection). | `src/app/api/admin/search/route.ts:34-35,65,72,80,98,127,157` |
| H4 | Dashboard | **Dev auth bypass is reachable from the LAN**: `.env.local` has the bypass on, the dev server allows LAN origin, no cookie ⇒ admin, using the real service-role key against production. Anyone on the same Wi-Fi during `npm run dev` gets full admin. (Production builds and Vercel are correctly fail-closed.) | `src/lib/auth/bypass.ts:20-27`, `dashboard-access.ts:34-36`, `next.config.ts:44` |
| H5 | DB | **`user_self_update_ok()` is an oracle on any user**: SECURITY DEFINER, callable by every signed-in user with any `p_id`; returns whether a guessed role/phone/unique_id/status matches another user's row. | live function body + advisor 0029 |

### Medium

| # | Area | Finding | Evidence |
|---|---|---|---|
| M1 | DB | Privileged helper functions callable over the API by any signed-in user: `generate_unique_id` (burns ID sequences), `auto_expire_listings`, `luhn_check_digit`, all `trg_*` trigger functions, `rls_auto_enable`. Most fail when called directly, `generate_unique_id` does not. | Supabase advisor (16 findings) |
| M2 | DB | `phone_exists()` lets anyone (no login) check whether a phone number is registered — enumeration of the user base. Needed by the current sign-in flow. | advisor 0028; `LoadKaro/screens/SignInScreen.js:36`, `RegisterScreen.js:51` |
| M3 | DB | `view public listing contacts` exposes **all columns** of an active lister's row (phone, subscription, status…) to any signed-in user, including brand-new accounts — easy phone scraping of every active lister. | live users/SELECT policy |
| M4 | DB/App | **Rejected trucks can never be resubmitted** (update policy requires the truck still be `unverified`), and failed uploads leave half-made `submitted` rows. | live trucks/UPDATE policy; `LoadKaro/lib/verificationUpload.js:81-168` |
| M5 | Dashboard | **KYC desk shows 8 stale submissions while Verifications shows 0**: verifying from a table never closes `verification_submissions`; a decision closes only one submission; retries add rows. Two screens count different things. | `src/app/api/admin/row/route.ts:117-122`, `verification/decision/route.ts:77-86`, `crm/kyc/route.ts:47` |
| M6 | Dashboard | Audit log writes are fire-and-forget and their errors are never checked; promoting an existing user to moderator is not audited at all. | `src/lib/audit.ts:37`; `void writeAuditLog` in row/decision/moderator/CRM routes; `moderator/create/route.ts:86-101` |
| M7 | Dashboard | PATCH values not validated against enums; moderators can change staff rows' `verification_status`. | `src/app/api/admin/row/route.ts:101`, `src/lib/admin/patch-allowlist.ts:65-81` |
| M8 | Dashboard | Signed-URL route signs any path in the docs bucket (not tied to a document row). | `src/app/api/admin/verification/signed-url/route.ts:34-48` |
| M9 | Dashboard | No security headers (CSP, frame-ancestors/X-Frame-Options, HSTS, nosniff, Referrer-Policy); `X-Powered-By` exposed → clickjacking on verify/delete. | `next.config.ts` (no `headers()`), `middleware.ts` |
| M10 | Dashboard | Middleware lets everything through when Supabase env vars are missing; admin/moderator layouts have no own role check. | `middleware.ts:30-32`, `src/app/admin/layout.tsx` |
| M11 | Dashboard | No rate limit on staff send-OTP; raw database/auth errors returned to clients; desk `fromDate` interpolated into `.or()`. | `moderator/send-otp/route.ts:68`; `crm/route-helpers.ts:67-70` etc.; `crm/desk/route.ts:66` |
| M12 | App | Session tokens stored unencrypted in AsyncStorage. | `LoadKaro/lib/supabase.js:47` |
| M13 | App | No OTP resend timer / attempt limit in the app; relies only on Supabase limits. | `LoadKaro/screens/OTPScreen.js` |

### Low

| # | Area | Finding |
|---|---|---|
| L1 | Dashboard | No Origin/content-type check on mutating API routes (relies on SameSite=Lax). |
| L2 | Dashboard | Signed URLs opened without checking the host (`verification-docs-modal.tsx:138`). |
| L3 | Dashboard | Unvalidated column names in `/api/admin/data` (`searchColumn`, `filters` keys). |
| L4 | Dashboard | Service-role modules lack `import "server-only"` (safe today, unguarded). |
| L5 | Dashboard | Bypass role cookie set from client JS, not cleared on logout; dead `shippers-table.tsx` writes roles with the anon client; unused `NEXT_PUBLIC_DASHBOARD_BYPASS_AUTH`. |
| L6 | App | `.env` still has `EXPO_PUBLIC_TEST_MODE`/`EXPO_PUBLIC_TEST_OTP` (unused, but uploaded to EAS); unused `role` in auth metadata. |
| L7 | App | Logout keeps the near-me city and search history (shared phones); may not clear locally when offline. |
| L8 | App | GPS sent unrounded; iOS not set to reduced accuracy; possible foreground-service permission from the plugin. |
| L9 | App | "Today" computed in UTC (00:00–05:30 IST wrong day); truck delete reports success even if 0 rows deleted. |
| L10 | App | `logger.error` prints in release builds; a few raw `console.*` remain (no PII found). |
| L11 | Ops | 150 Supabase test phone numbers with one fixed OTP on the live project; service-role key and access tokens have passed through many sessions. |

### Functional bugs found alongside

| # | Bug | Cause |
|---|---|---|
| B1 | White status-bar icons over white cards when Home/Profile scrolls | edge-to-edge Android; the navy header scrolls away (Shipper/TruckOwner/Broker Home, both Profiles) |
| B2 | "Truck · — t" in Home's Latest trucks | trucks are only readable by shippers while an availability is live (by design); Home strip lists closed postings too |
| B3 | Call button shown on closed/expired listings | `ShipperTrucksScreen.js`, `TruckOwnerLoadsScreen.js` |
| B4 | "within 100 km" shown for a city without coordinates (142 cities) | `NearMeBar.js` |
| B5 | Upload limits disagree: app 100 MB, picker 5 MB, bucket 10 MB | `verificationUpload.js:17`, `VerificationModal.js:27` |

### Verified OK (no action)

Users can't edit their own verification/role/phone after sign-up (live `user_self_update_ok` lock + profile-lock trigger) · admin/moderator can't be chosen at sign-up · storage paths are owner-scoped, bucket private, 10 MB + MIME allowlist · no secrets in git history, no `NEXT_PUBLIC_` secrets, portal never imports the service role · bypass is off in production builds and on Vercel · every API route checks auth first; moderators can't delete/insert/create staff · no open redirects; no XSS sinks · CRM routes validate inputs · app: no injectable `.or()` strings, no deep links/WebViews, near-me sends GPS only to `nearest_location`, COARSE-only permission · RLS on every table; CRM staff tables locked to the service role.

---

## Fix plan

Order = risk first, and each phase ships on its own. Database changes go in as
migrations, each with a rolled-back test that impersonates a normal user
(`set local role authenticated` + JWT claims) proving the hole is closed and
the normal path still works.

### Phase 1 — Database, today (C1, H5, M1, M4 part)
1. **`users` BEFORE INSERT trigger** (new migration `users_insert_hardening`): when the caller is a normal user (`auth.uid()` not null), force `verification_status='unverified'`, `subscription_type='free'`, `unique_id=NULL` (so `trg_users_unique_id` generates it), and set `phone` from `auth.users.phone` (normalised to `+91…` as the app stores it). Service-role inserts (dashboard creating moderators) are untouched. Also tighten the INSERT policy to `verification_status='unverified'` as a second lock.
2. **Audit existing rows** for C1 abuse (read-only): users whose `phone` ≠ their auth phone, `verification_status='verified'` with no decided submission, non-free subscription, or a `unique_id` not matching their role prefix. Report to founder before changing any row.
3. **`user_self_update_ok`**: return false unless `p_id = auth.uid()` (keeps the policy working, kills the oracle).
4. **Revoke EXECUTE** from `public, anon, authenticated` on `generate_unique_id`, `auto_expire_listings`, `luhn_check_digit`, `rls_auto_enable`, all `trg_*` functions (triggers still fire; they run as owner).
5. **Trucks UPDATE policy**: allow owners to move `unverified|rejected → pending`.
6. Re-run the Supabase security advisor; expected remaining: `phone_exists` (Phase 3), CRM no-policy INFO (intentional).

### Phase 2 — Dashboard high-risk (H1–H4, M5)
1. `/api/admin/data`: per-role table + column allowlist; moderators get no `phone`, no `audit_log`/`verification_documents`/`id_sequences`; drop free-form `select` for moderators; validate column names (also L3).
2. `/api/admin/search`: mask phone for moderators; strip `,().:*` from `q`.
3. Verification decision → one Postgres function `staff_decide_verification(entity_type, entity_id, decision, reason)` called with the service role: checks an open submission exists for that entity, updates the entity, **closes all its open submissions**, writes the audit row — atomically. Row-route edits to `verification_status` go through the same function. One-time cleanup of today's 8 stale submissions (after showing the founder the list). Both screens then agree (M5).
4. Bypass: honour only when the request host is `localhost`/`127.0.0.1`; turn it off in `.env.local` by default; recommend a separate Supabase dev project.

### Phase 3 — Medium (M2, M3, M6–M13)
1. `phone_exists`: drop it — sign-in uses `signInWithOtp({ shouldCreateUser: false })` and maps the "user not found" error to "not registered"; registration uses `shouldCreateUser: true`. Then revoke `phone_exists` from anon.
2. Users SELECT: expose listing contacts through a narrow view/RPC (`id, name, phone, role, verification_status` only, live listers only) and restrict the base policy to own row + staff; update the app's embeds.
3. Audit: `await` + check `{error}` in `writeAuditLog`; audit moderator promotion.
4. PATCH value validation against `src/lib/schema/enums.ts`; moderators can't modify admin/moderator rows.
5. Signed URL by `document_id` only.
6. `next.config.ts` `headers()`: CSP (hash for the theme script), `frame-ancestors 'none'`, HSTS, nosniff, Referrer-Policy; `poweredByHeader: false`.
7. Middleware fail-closed (503) for `/admin` `/moderator` `/portal` when env is missing; role check in admin/moderator layouts.
8. Generic error responses (log details server-side); validate `fromDate`/`toDate` format; per-actor rate limit on staff send-OTP (small DB table).
9. App: SecureStore-backed session storage (chunked adapter); OTP resend timer (30 s) + max attempts message.

### Phase 4 — Functional bugs + Low (B1–B5, L1–L10)
1. Navy status-bar overlay (`insets.top` high, pointerEvents none) in the three role navigators.
2. Home "Latest" strips: only live postings.
3. Hide Call on non-live cards.
4. NearMeBar: "distance not available for this city" when the city has no coordinates.
5. One 10 MB upload limit everywhere, checked before reading; create the submission after uploads succeed.
6. Logout clears `lk_*` keys and local state even offline; GPS rounded to 2 dp; iOS reduced accuracy; plugin foreground service off; local-date "today"; delete checks a row came back.
7. Dashboard: Origin check on mutations, signed-URL host check, `server-only` imports, server-set HttpOnly bypass cookie cleared on logout, delete dead `shippers-table.tsx` + unused env var.
8. Remove test vars from `LoadKaro/.env`; drop `role` from auth metadata; route remaining `console.*` through `logger`, silence `logger.error` in release.

### Phase 5 — Founder actions (cannot be done by Claude)
- Rotate the Supabase **service-role key** (update dashboard env) and revoke old **access tokens**.
- **Delete the 150 test phone numbers** after the APK test pass.
- Check Supabase Auth → Rate limits for SMS/OTP; add a Twilio spend cap.
- Optional: a separate Supabase project for local development.

### Verification
- Each DB migration: rolled-back SQL tests as `authenticated` (attack fails, normal path passes) + advisor re-run.
- Dashboard: `tsc`, `eslint`, `next build`; browser click-through as admin and as moderator (bypass, localhost only) of every changed page; curl the hardened API routes with a moderator session to confirm 403/masked output.
- App: parse + `expo export`, new EAS build, then the Mobile-MCP test pass in `HANDOFF_APK_TESTING.md` (plus: sign-up as a new test number shows unverified; status bar over scrolled Home; rejected-truck resubmit).
- Re-run this audit's checks at the end and update this file with ✅ per finding.
