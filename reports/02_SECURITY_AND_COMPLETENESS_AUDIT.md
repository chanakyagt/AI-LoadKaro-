# LoadKaro — Security & Completeness Audit

> Database/RLS, mobile client, dashboard/secrets, product-workflow gaps, and Questions for the Founder.
> Generated 2026-06-30 from an automated multi-agent audit. Read-only analysis; nothing in the app or database was modified.

---

## Database & RLS Security

Scope: live `public` schema policies (read via `pg_policies` and the Supabase security advisor on 2026-06-30), the RLS backup at `C:\Users\chana\OneDrive\Desktop\mobile App\rls_backup_2026-05-25.sql`, and the mobile/dashboard code that consumes these tables. Note: the live policies have **drifted** from the 2026-05-25 backup — several "KNOWN ISSUE" items in that backup were already fixed in the live DB (good), but the headline `users` exposure remains.

---

### 1. `view users USING (true)` — every authenticated user can read every user's name + phone — **CRITICAL**

Confirmed in live DB. The `users` table has two SELECT policies for the `authenticated` role, and because RLS policies are OR-combined, the permissive one wins:

- `select own user` → `USING (auth.uid() = id)`
- `view users` → `USING (true)` ← exposes all rows

The `users` columns are `id, name, phone, role, verification_status, subscription_type, created_at, updated_at, unique_id` (verified via `information_schema.columns`). So **any logged-in account can read the full name, phone number, role, and verification/subscription status of every other user on the platform**.

Severity rationale: this is a phone-based marketplace in India with no DLT registration. The single most sensitive field (mobile number, which is the identity/login key) is bulk-readable. The backup file itself flags it (line 207).

**Attack scenario:** An attacker registers a normal shipper account (self-serve, phone-OTP). Once authenticated, they call `GET /rest/v1/users?select=name,phone,role` (PostgREST honors the `USING(true)` policy) and page through the entire table — harvesting every truck owner's and shipper's phone number. At the 6000-user target this is a one-request scrape of 6000 verified Indian mobile numbers tied to names and business roles: a ready-made list for SMS spam, competitor poaching (BlackBuck-style), SIM-swap targeting, or resale. No rate limit or anomaly detection is implied anywhere in the stack.

**Why a naive fix breaks the marketplace:** The app legitimately needs the *counterparty's* name + phone so the two sides can call each other. Confirmed usage: `ViewAvailabilitiesScreen.js:155-158` and `shipper/ShipperTrucksScreen.js:122-125` both do `from('users').select('id, name, phone').in('id', ownerIds)` where `ownerIds` come from trucks that have an `available` availability. So contact info disclosure must be scoped to *users who have an active public listing*, not all users.

**Remediation SQL sketch (do NOT apply):**

```sql
-- Drop the blanket policy
DROP POLICY "view users" ON public.users;

-- Replace with a scoped policy: you may read a user row only if that user
-- currently exposes a public listing you are entitled to contact.
CREATE POLICY "view counterparties" ON public.users
  FOR SELECT TO authenticated
  USING (
    -- truck owners who have an available truck (visible to shipper/broker)
    EXISTS (
      SELECT 1 FROM availabilities a
      WHERE a.owner_id = users.id
        AND a.status = 'available'
    )
    OR
    -- shippers who posted a load visible to the current truck_owner/broker
    EXISTS (
      SELECT 1 FROM loads l
      WHERE l.posted_by = users.id
    )
  );
-- 'select own user' already covers reading your own row.
```

A stricter, recommended alternative is to **never expose `phone` via the table at all** and instead serve contact details through a `SECURITY DEFINER` RPC (e.g. `get_listing_contact(listing_id)`) that returns the counterparty phone only for a specific listing the caller can see, optionally logging the access to `audit_log` for abuse detection. That removes bulk-enumeration entirely. Either way, also consider revoking column-level access to `phone` for `authenticated` (`REVOKE SELECT (phone) ... ; GRANT SELECT (phone) ...` is not how RLS works — use the RPC pattern for true column hiding). QUESTION for the team: is broad name visibility (without phone) an intentional product choice? If so, split into a public-safe view (id, name, role) plus an RPC for phone.

---

### 2. SECURITY DEFINER view `active_locations` — **OKAYISH (advisor ERROR, but low real risk here)**

Advisor flags `public.active_locations` as `security_definer_view` at **ERROR** level. Verified definition:

```sql
SELECT l.id, l.state, l.city, l.latitude, l.longitude, l.created_at
FROM locations l
LEFT JOIN location_states s ON s.state = l.state
WHERE l.is_active = true AND COALESCE(s.is_active, true) = true;
```

A `SECURITY DEFINER` (a.k.a. non-`security_invoker`) view runs with the *view owner's* privileges and bypasses the querying user's RLS on the underlying tables. The data here is just a reference list of active cities/states (no PII), and it is consumed read-only across the app for dropdowns (`useLocations.js`, `UploadLoadScreen.js`, `ShipperPostLoadScreen.js`, etc.). So the **confidentiality impact is low**. The reason it's not "GOOD" is structural: this view is the app's deliberate workaround for `location_states` having RLS-with-no-policy (see #4) — i.e. it's leaning on the DEFINER bypass to read a table users otherwise can't. That coupling is fragile, and ERROR-level advisors block a clean security posture.

**Attack scenario:** Limited. The view cannot be used to read other tables, and the location data is non-sensitive. The main risk is *precedent*: if someone later adds a sensitive column or a join to `users`/`trucks` in this view, the DEFINER property would silently bypass RLS on those tables. Low severity today, latent footgun.

**Remediation SQL sketch (do NOT apply):**

```sql
ALTER VIEW public.active_locations SET (security_invoker = on);
-- then ensure the querying roles can actually read base tables:
--   locations already has "read locations" USING(true) -> fine
--   location_states needs a SELECT policy (see #4) so the invoker read succeeds
```

After enabling `security_invoker`, confirm the dropdowns still load for `anon`/`authenticated` (they will need the `location_states` policy from #4, otherwise the `LEFT JOIN` filter `COALESCE(s.is_active,true)` quietly drops state-gated rows).

---

### 3. 18 functions with mutable `search_path` — **OKAYISH (defense-in-depth WARN)**

Advisor lists 18 `function_search_path_mutable` WARNs (e.g. `generate_unique_id`, `auto_expire_listings`, `enforce_load_status_transition`, all `trg_generate_*_unique_id`, `luhn_check_digit`, `update_*_updated_at`). Many of these are also `SECURITY DEFINER` and `EXECUTE`-able by `authenticated`/`anon` (separate advisor warnings 0028/0029). A `SECURITY DEFINER` function without a pinned `search_path` is the classic privilege-escalation vector.

**Attack scenario:** A `SECURITY DEFINER` function with mutable `search_path` that calls an unqualified object (e.g. `select ... from users` rather than `from public.users`, or an operator/`nextval`) can be hijacked: an attacker creates a same-named object in a schema that precedes `public` on their session `search_path`, then triggers the function; the function executes the attacker's object **with the definer's (elevated) rights**. Practically, exploitability here depends on each function body — the ID-generator triggers fire on INSERT and reference `id_sequences`/`unique_id`; if any reference is unqualified, a crafted insert path could be abused. Note the good example to copy: `phone_exists` is correctly hardened with `SET search_path TO 'public'` (verified via `pg_get_functiondef`), so the team already knows the pattern — it just wasn't applied to the other 18.

**Remediation SQL sketch (do NOT apply):**

```sql
-- Pin search_path on every flagged function, e.g.:
ALTER FUNCTION public.generate_unique_id(text)            SET search_path = '';
ALTER FUNCTION public.enforce_load_status_transition()    SET search_path = '';
ALTER FUNCTION public.auto_expire_listings()              SET search_path = '';
-- ...repeat for all 18; use '' (empty) and fully-qualify every object
-- reference inside the body (public.users, public.id_sequences, etc.).

-- Separately, for the SECURITY DEFINER funcs that should NOT be client-callable
-- (the trg_* trigger functions, rls_auto_enable), revoke API exposure:
REVOKE EXECUTE ON FUNCTION public.trg_generate_user_unique_id()   FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable()               FROM anon, authenticated;
-- (trigger functions don't need direct EXECUTE grants to fire on triggers.)
```

---

### 4. `location_states` has RLS enabled but **zero policies** — **OKAYISH (availability bug, not a breach)**

Confirmed by advisor `rls_enabled_no_policy` on `public.location_states`. With RLS on and no policy, only `service_role` can read it; `anon`/`authenticated` get zero rows. This is a confidentiality non-issue (fail-closed) but a **correctness/availability** problem: the `active_locations` view currently masks it only because the view is `SECURITY DEFINER` (#2). The moment #2 is fixed to `security_invoker`, the `LEFT JOIN location_states` will silently treat every state as having no override — and any logic that *deactivates* a state via `location_states.is_active=false` will stop working for end users.

**Attack scenario:** None (no data exposed). Risk is operational: admins toggle a state off in the dashboard (`admin/locations/page.tsx`), expect it to disappear from the app, but it won't filter correctly once the view is fixed, or the dropdown breaks if any code reads `location_states` directly.

**Remediation SQL sketch (do NOT apply):**

```sql
CREATE POLICY "read location states" ON public.location_states
  FOR SELECT TO anon, authenticated
  USING (true);   -- reference data, same posture as "read locations"
```

---

### 5. `phone_exists` anon-callable — phone-number enumeration — **OKAYISH / borderline BAD (intentional, but abusable)**

Verified: `phone_exists(p_phone text)` is `SECURITY DEFINER`, hardened with `SET search_path='public'`, and `EXECUTE` is granted to `PUBLIC` + `anon` + `authenticated` (routine_privileges). It returns a boolean of whether a phone is registered. Used pre-login in `RegisterScreen.js:50` and `SignInScreen.js:36`. Per project notes this is **intentional** (added to fix a pre-login existence check), so I rate it OKAYISH rather than CRITICAL — but flag it as a deliberate, exploitable enumeration oracle.

**Attack scenario:** Anyone (no auth) can POST to `/rest/v1/rpc/phone_exists` with arbitrary `+91XXXXXXXXXX` values and learn, true/false, whether each number is a LoadKaro user. The Indian mobile space is a small, well-known numbering range, so an attacker can brute-force-confirm membership for targeted numbers (or sweep ranges) and build a roster of users without ever registering — then combine with #1 (after registering) to attach names/roles. It also leaks business intelligence (your user base size/growth) to competitors.

This is a genuine privacy-vs-UX tradeoff (the same tradeoff WhatsApp/Truecaller face). It's acceptable for an MVP **if** access is rate-limited, but Supabase RPC has no built-in per-IP limit on the free tier.

**Remediation options (do NOT apply) — QUESTION for product:**

```sql
-- Option A: keep anon UX but throttle. Move the check behind an Edge Function
-- that enforces per-IP rate limiting / CAPTCHA, and revoke direct anon EXECUTE:
REVOKE EXECUTE ON FUNCTION public.phone_exists(text) FROM anon, public;

-- Option B (cleaner): drop the explicit pre-check entirely and rely on the
-- OTP flow itself to branch register-vs-login after the OTP is sent,
-- so existence is never disclosed pre-auth.
```
If kept as-is, document it as an accepted MVP risk and add Supabase rate-limiting/WAF before scaling toward 6000 users.

---

### Cross-cutting notes (verified against live policies)

- **GOOD — drift in the safe direction:** Several backup "KNOWN ISSUE" comments are already fixed live. `admin_alerts insert` is now `WITH CHECK (EXISTS admin/moderator)` (backup had `WITH CHECK(true)`); `trucks view` no longer has the `OR true` blanket — it now correctly requires shipper/broker **AND** an `available` availability. `users update` now also blocks self role-escalation via `WITH CHECK (... role NOT DISTINCT FROM current role)`. These are real improvements over the 2026-05-25 snapshot.
- **OKAYISH — `loads` visibility is role-wide, not match-scoped:** `view loads` lets *any* `truck_owner`/`broker` read *every* posted load (not just loads relevant to a region/truck). Likely intentional for a load board, but combined with #1 it means a truck owner can read all loads and join to all poster phone numbers. Re-evaluate once #1 is scoped. QUESTION: is full load-board visibility intended for every truck owner regardless of route?
- **WARN — `auth_leaked_password_protection` disabled:** Irrelevant. Auth is phone-OTP (Twilio); there are no passwords. Safe to ignore. **GOOD/N-A.**
- Performance-side RLS issues (un-wrapped `auth.uid()` re-evaluated per row, redundant dual SELECT policies on `users`) are covered by the performance auditor; note that fixing #1 also removes one of the two `users` SELECT policies, helping both security and per-row eval cost.

**Severity summary:** #1 `view users USING(true)` = **CRITICAL** (fix before any further growth). #5 `phone_exists` enumeration = **BAD/OKAYISH** (intentional; throttle or remove). #2 DEFINER view, #3 search_path×18, #4 `location_states` = **OKAYISH** (hardening + one latent availability bug). Leaked-password = **N/A**.

I have everything needed. Here is my audit section.

## Mobile Client Security

Scope reviewed (files actually read): `lib/supabase.js`, `store/authStore.ts`, `services/syncUserAfterOtp.js`, `services/loadUserProfile.js`, `utils/phone.js`, `screens/RegisterScreen.js`, `screens/SignInScreen.js`, `screens/OTPScreen.js`, `screens/ProfileScreen.js`, `screens/shipper/ShipperProfileScreen.js`, `navigation/RootNavigator.js`, `config/roleRoutes.ts`, `lib/verificationUpload.js`, `lib/logger.js`, `app.json`, `eas.json`, `.gitignore`, `.env`, `.env.example`.

### 1. Secrets in the bundle / committed secrets — OKAYISH
- `lib/supabase.js:11-13` reads only `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`/`EXPO_PUBLIC_SUPABASE_KEY`. No service-role key is referenced anywhere in the client. Good — the privileged key is not in the app.
- The Supabase URL + anon key are `EXPO_PUBLIC_*`, so by design they are embedded in the shipped JS bundle. This is correct/expected for a Supabase mobile client (the anon key is a public identifier; security must come from RLS, not key secrecy). Flagging it only so the auditors confirm RLS is the sole guard — see the DB seed finding that `users` has a `USING(true)` SELECT policy, which combined with a public anon key means **anyone who extracts the anon key from the APK can read every user's name/phone/role**. The mobile client is not the bug, but it is the exposure vector.
- `.env` is correctly git-ignored (`.gitignore:34`) and is **not** tracked (`git ls-files` shows only `.env.example`). Good — no committed live secrets.

### 2. Leftover TEST_OTP / TEST_MODE auth-bypass switches — OKAYISH (verify)
- `.env` contains `EXPO_PUBLIC_TEST_MODE` and `EXPO_PUBLIC_TEST_OTP=...`. I grepped the entire non-`node_modules` source: **neither variable is read by any code** (`TEST_OTP` appears nowhere in code; `TEST_MODE` appears only in `eas.json` where every build profile pins it to `"false"`). So there is no live OTP-bypass path in the current code. **QUESTION / residual risk:** because these are `EXPO_PUBLIC_` vars, the value of `EXPO_PUBLIC_TEST_OTP` would be baked into any bundle built from a `.env` that still has it. Confirm no historical/branch code consumes it, and remove these vars from `.env` before a production build so a stale test OTP value never ships.

### 3. OTP register trusts client-supplied role + name — BAD (depends on DB trigger; verify)
This is the most important client-side finding to validate against the DB.

The role/name a user picks on `RegisterScreen` flows to the backend through **two** independent channels:
- **Auth user metadata:** `RegisterScreen.js:62-65` calls `signInWithOtp({ phone, options: { data: { name, role, phone } } })`, putting the client-chosen `role` into `auth.users.raw_user_meta_data`.
- **Direct table insert:** `syncUserAfterOtp.js:68-75` inserts `{ id, name, phone, role: canonicalRole }` straight into `public.users` from the client.

Client-side there is an allow-list (`syncUserAfterOtp.js:61-66`) restricting `role` to `shipper | truck_owner | broker`, so a user cannot self-assign `admin`/`moderator` *through this code path*. **But this is a client-side check and is trivially bypassable** — anyone with the (public) anon key can call `supabase.from('users').insert({ id: <their auth uid>, role: 'admin', ... })` directly, skipping this JS entirely. Whether that succeeds is **entirely** decided by the `users` INSERT RLS policy.
- **Action for DB auditor:** confirm the `users` INSERT policy (a) forces `id = auth.uid()`, and (b) constrains/ignores the `role` column (e.g. via a trigger or `WITH CHECK role IN ('shipper','truck_owner','broker')`). If the INSERT policy permits an arbitrary `role`, this is a **CRITICAL privilege-escalation to admin/moderator**. If a DB trigger instead derives `role` from `raw_user_meta_data`, note that metadata is *also* client-controlled (set in the `signInWithOtp` options), so it is not a trustworthy source either.
- Severity rating here is **BAD as written on the client and potentially CRITICAL system-wide**, contingent on the RLS policy. The remediation is server-side: never let the client set `role`; assign it in a `SECURITY DEFINER` function / trigger with a hard allow-list, and add a `WITH CHECK` on the INSERT policy.

### 4. Role escalation via profile update — GOOD
- `ProfileScreen.js:32-35` and the shipper profile only ever `update({ name })` (and verification flips `verification_status` to `'pending'` in `verificationUpload.js:148-151`). No client screen writes `role` after registration. Provided the `users` UPDATE RLS policy doesn't allow a user to change their own `role`/`verification_status` to `verified`, post-registration escalation isn't exposed by the UI. **QUESTION for DB auditor:** does the `users` UPDATE `WITH CHECK` prevent a user from flipping their own `role` or self-setting `verification_status='verified'` via a direct API call? The client respects the boundary; confirm the DB enforces it.

### 5. Session / token storage — OKAYISH
- `lib/supabase.js:27-32` stores the session in `AsyncStorage` with `persistSession: true` and `autoRefreshToken: true`. AsyncStorage is **unencrypted** plaintext on device (SQLite/files). On a rooted/jailbroken device or via a device backup, the refresh+access tokens are recoverable. For an MVP freight app this is the common Expo default and broadly acceptable, but the long-lived refresh token in plaintext is the main risk. **Recommendation:** before scaling, move the auth storage to `expo-secure-store` (Keychain/Keystore) via a custom `storage` adapter. Rated OKAYISH for MVP, would be BAD at scale with sensitive shipment/contact data.
- `detectSessionInUrl: false` is correct for native (avoids URL-token parsing). Good.

### 6. Deep-link / navigation auth gaps — GOOD
- `app.json` defines **no** `scheme` and no `expo-router`/Linking `prefixes`; `NavigationContainer` (`RootNavigator.js:198`) is configured without a `linking` prop. There is therefore no custom-scheme/universal-link surface that could deep-link past the auth gate into an authenticated screen.
- Navigation is gated structurally: `RootNavigator.js:199-205` renders `AuthNavigator` when `!session`, and only mounts `ShipperNavigator`/`AppNavigator` when a `session` exists. A user cannot reach a dashboard screen without a Supabase session. Note this is a **UX gate, not a security boundary** — actual data protection still relies on RLS (the navigator just decides which screens render), which is the correct model. Good.
- `AppNavigator` maps every role to the same `RoleDashboardScreen` (`RootNavigator.js:91-98`) and picks `initialRouteName` from `dashboardRoute`. Cross-role data exposure is again an RLS question, not a client-routing one.

### 7. Input validation — OKAYISH
- Phone: `utils/phone.js` strictly validates `+91` + `[6-9]\d{9}` before any network call (`RegisterScreen.js:26`, `SignInScreen.js:22`). OTP: `OTPScreen.js:29` enforces exactly 6 digits and sanitizes input to digits-only (`:109`). Good.
- Name: only `trim()` + non-empty (`syncUserAfterOtp.js:71`, `ProfileScreen.js:25`). No length cap or content sanitization on `name` before insert. Low severity (RLS/DB types should bound it), but worth a max-length and basic sanitization since `name` is later rendered in the admin dashboard (stored-XSS surface lives in the dashboard, not here). OKAYISH.
- File upload: `verificationUpload.js:35-43` allow-lists extensions and `:98` sanitizes the storage filename (`[^a-zA-Z0-9._-] → _`). MIME is **guessed from the extension** (`:26-28`), not verified from bytes, and `size_bytes` is recorded but **no max-size limit is enforced client-side** — a user could upload a very large file (DoS / storage-cost). Enforce a size cap and rely on a Storage bucket policy / size limit server-side. OKAYISH.

### 8. PII / sensitive data in logs — BAD (easy fix)
- A `logger` helper exists (`lib/logger.js`) that gates `log`/`warn` behind `__DEV__`, but the **auth flow does not use it**. `RegisterScreen.js:48,52`, `SignInScreen.js:34,38`, `OTPScreen.js:37,...`, and `syncUserAfterOtp.js:19,33,41,...` use **raw `console.log`** and print **phone numbers in E.164, auth user IDs, and registration mode** (e.g. `OTPScreen.js:37` logs the phone; `syncUserAfterOtp.js:33` logs `user.id`). In a release build these `console.*` calls are not stripped by default in bare/EAS React Native, so PII can land in device logs / logcat readable by other tooling. 36 raw `console.*` occurrences across 16 source files.
- **Remediation (low effort, do before launch):** replace the raw `console.*` in the auth path with the existing `logger.*`, and never log phone numbers or auth IDs even in dev. Optionally add `babel-plugin-transform-remove-console` for production builds. Severity BAD because it's PII in a phone-based marketplace and the fix is trivial.

### 9. `phone_exists` probe from the client — OKAYISH (note, matches DB seed)
- `RegisterScreen.js:49-50` and `SignInScreen.js:35-36` call the `phone_exists` RPC (anon-executable, `SECURITY DEFINER` per DB seed) to pre-check registration. This is an intentional product decision, but it confirms the client exposes a **phone-number enumeration oracle**: anyone with the anon key can probe whether any given number is registered. For an MVP this is usually accepted; flagging as a privacy/enumeration item for the product owner to acknowledge. Consider rate-limiting the RPC. OKAYISH.

### Summary table
| # | Finding | Rating |
|---|---------|--------|
| 1 | Anon key/URL in bundle (by design; exposure hinges on RLS) | OKAYISH |
| 2 | Unused `EXPO_PUBLIC_TEST_OTP`/`TEST_MODE` in `.env` (no live bypass) | OKAYISH |
| 3 | Client-supplied `role` to `users` insert + auth metadata; only client-side allow-list | BAD (CRITICAL if INSERT RLS allows arbitrary role) |
| 4 | Post-register role/verification not client-writable via UI | GOOD |
| 5 | Session tokens in plaintext AsyncStorage | OKAYISH |
| 6 | No deep-link surface; nav gated on session | GOOD |
| 7 | Input validation (phone/OTP strong; name/file weaker) | OKAYISH |
| 8 | Raw `console.log` of phone + auth IDs in auth flow | BAD |
| 9 | `phone_exists` enumeration oracle exposed to anon | OKAYISH |

**Top priorities:** (3) verify and lock down server-side `role` assignment — this is the only path to admin/moderator escalation and must be confirmed against the `users` INSERT/UPDATE RLS; then (8) stop logging PII; then (5) move session storage to `expo-secure-store` before scaling.

I have everything needed. The prod guard (`NODE_ENV === "production"` short-circuit in `isDashboardAuthBypassed`) is the single line preventing the bypass from ever activating in production, which is critical to assess. Writing the section now.

## Dashboard & Secrets Security

Scope audited: `admin-dashboard/middleware.ts`, `.env.example` / `.env.local.example`, the `@supabase/ssr` and service-role wiring (`src/lib/supabase/*`), all nine `/api/admin/*` route handlers, the auth/bypass helpers (`src/lib/auth/*`, `src/lib/admin/patch-allowlist.ts`), `next.config.ts`, and a git-tracked-secret scan of both repos.

Overall the dashboard authorization model is **GOOD** and noticeably more mature than typical MVP code: every privileged route re-checks authorization in-handler (defense-in-depth, not just middleware), the service-role client is server-only, table/column writes are allowlisted, and no secrets are committed. The findings below are mostly hardening items plus one design risk around the demo auth-bypass.

### Findings

#### 1. Committed secrets — GOOD (no exposure found)
- `.gitignore` in both the dashboard (`admin-dashboard/.gitignore:31-33`) and repo root correctly ignores `.env*` except `.env.example`. `git ls-files` confirms only `.env.example` and `.env.local.example` are tracked; `.env` and `.env.local` are untracked.
- `git log --all --diff-filter=A -- .env .env.local` returns nothing — the secret files were **never** committed in history, so no scrubbing is needed.
- `git grep` for JWTs (`eyJ…`), Twilio SIDs (`AC[0-9a-f]{32}`), Stripe keys, and `service_role` values across all tracked files found only documentation references in `README.md` (lines 98, 160) and empty placeholders in `.env.example`. The Postman-style `admin_dashboard_api_collection.json` contains no embedded keys.
- The local (untracked) `admin-dashboard/.env` does contain a real `SUPABASE_SERVICE_ROLE_KEY` and `EXPO_PUBLIC_SUPABASE_KEY` — this is the correct place for them. No remediation; just keep them out of git (current state is fine).

**Remediation:** none required. As good hygiene, confirm the same keys in Vercel are scoped to Server-side env (not exposed) and rotate the service-role key once before launch since it has lived in a local file on a dev laptop.

#### 2. Service-role key handling — GOOD
- `src/lib/supabase/service-role.ts:9-20` reads `SUPABASE_SERVICE_ROLE_KEY` only from `process.env` (never `NEXT_PUBLIC_*`), with `persistSession:false`. `next.config.ts:26-30` inlines **only** the URL and anon key into the client `env` map — the service-role key is never placed in `env:` and therefore cannot leak into the browser bundle. The file header comment ("never in client bundles") matches the implementation.
- All service-role usage is confined to route handlers and server libs (`audit.ts`, `queries/stats.ts`); no client component imports it.

**Severity:** none. This is correctly implemented.

#### 3. Every admin API route enforces its own authZ before using the service role — GOOD
This is the most important positive finding. Despite the `matcher` in `middleware.ts:96-103` covering `/api/admin/:path*`, none of the routes rely on middleware alone. Each handler independently calls `requireDashboardAccess()` (`src/lib/auth/dashboard-access.ts:33-64`), which validates the Supabase session via `auth.getUser()` and confirms `public.users.role ∈ {admin, moderator}`. Verified in all nine routes:
- `data/route.ts:54`, `row/route.ts:61,137,224`, `search/route.ts:34`, `moderator/create/route.ts:22`, `moderator/send-otp/route.ts:21`, `verification/{decision,documents,signed-url,submissions}/route.ts`.
- Privilege separation is enforced beyond mere login: admin-only tables are gated (`data/route.ts:30,70-72`; `row/route.ts:26-30,88-90`), moderator creation requires `role==="admin"` (`moderator/create/route.ts:25`, `send-otp/route.ts:24`), and inserts/deletes are admin-only (`row/route.ts:141,227`).
- Column-level writes go through `filterPatchByAllowlist()` (`src/lib/admin/patch-allowlist.ts:65-81`), which drops any field not in a per-role allowlist and hard-blocks `phone`/`email` regardless of role (line 63). This is a strong control — a moderator who tampers with a PATCH body can at most touch `verification_status`/`status`.

No route was found that uses the service role to mutate data without a preceding role check. **No RLS-bypass-without-authZ vulnerability found.**

#### 4. Demo auth-bypass — OKAYISH / BAD-if-misconfigured (design risk)
`isDashboardAuthBypassed()` (`src/lib/auth/bypass.ts:19-25`) makes `/admin`, `/moderator`, and **all `/api/admin/*` service-role routes** reachable with **no login**, assuming the `admin` role by default (`dashboard-access.ts:34-36`). The only thing preventing this in production is a single early return:

```ts
if (process.env.NODE_ENV === "production") return false;
```

Observed current state: `admin-dashboard/.env.local` has **both** `DASHBOARD_BYPASS_AUTH=true` **and** `NEXT_PUBLIC_DASHBOARD_BYPASS_AUTH=true` (the committed `.env` correctly has them `false`). So today, any local/preview build that does not set `NODE_ENV=production` exposes the entire admin surface unauthenticated.

Risk assessment:
- The `NODE_ENV==="production"` guard is correct and is the right pattern, but it is a single point of failure. A Vercel **Preview** deployment (or any non-prod hosting) runs with the bypass live and a real service-role key + real Supabase data — that is a fully open admin panel over production data. Vercel Preview URLs are guessable/shared and are not behind auth by default.
- `NEXT_PUBLIC_DASHBOARD_BYPASS_AUTH=true` additionally inlines the bypass intent into the client bundle (used by `login/login-client.tsx`), making the demo mode discoverable.

**Severity:** BAD if a non-production deployment with production data/keys is ever published; otherwise an accepted dev convenience. **Remediation (do before launch):**
1. Ensure the production AND every preview deployment that has access to the real service-role key sets `NODE_ENV=production` (Vercel production does; **preview does not by default** — add an explicit guard).
2. Strengthen the guard to also require a non-prod marker, e.g. fail-closed unless an explicit `process.env.VERCEL_ENV === "development"`/local flag is set, so a misconfigured preview can't open the panel.
3. Remove `NEXT_PUBLIC_DASHBOARD_BYPASS_AUTH` entirely if the server-side flag suffices (the login page already reads the server value), to avoid shipping the toggle to the browser.
4. Treat the live service-role key in `.env` as exposed-to-dev and rotate before production.

**QUESTION:** Is the dashboard ever deployed to a Vercel Preview/staging environment that points at the production Supabase project? If yes, item #4 above is CRITICAL, not just hardening.

#### 5. `getUser()` vs `getSession()` — GOOD
Both `middleware.ts:49-51` and `dashboard-access.ts:42` use `supabase.auth.getUser()`, which revalidates the JWT with the Supabase Auth server rather than trusting an unverified cookie (`getSession()`). This is the recommended secure pattern for `@supabase/ssr`.

#### 6. Open-redirect handling on login `next` param — GOOD
`middleware.ts:82-91` only honors the `next` param if it starts with `/admin/` or `/moderator/`, otherwise falls back to a safe default — open-redirect is prevented.

#### 7. Minor hardening notes — OKAYISH
- `data/route.ts` builds PostgREST filters from arbitrary client-supplied `filters` JSON keys (`coerceFilterValue` / `Object.entries(filterValues)` at lines 116-118) and `searchColumn` (line 86) against service-role queries. Table and select are allowlisted/regex-validated, and `sortColumn`/`dateColumn` are `^\w+$`-checked, but `searchColumn` and filter **keys** are not validated against a column allowlist. Impact is bounded (service role + PostgREST escapes values; worst case is an enumeration/error on a bad column name), so this is low severity, but consider validating filter/search columns against a per-table column allowlist. **Severity: LOW.**
- `signed-url/route.ts:40` correctly pins the bucket to `verification-docs` and uses a 300s expiry — good. Note it does not call `requireDashboardAccess` role-gate beyond login; any admin **or moderator** can mint signed URLs for any path in that bucket. That is likely intended (moderators review docs) — flagging as a **QUESTION**: should moderators be able to fetch arbitrary verification-doc paths, or only paths tied to a submission they are reviewing? Current code allows arbitrary `path`.
- `moderator/send-otp` and `moderator/create` send/verify OTP via the service-role auth client with no rate limiting at the app layer (`send-otp/route.ts:68`). Since it is admin-gated, abuse risk is low, but each call consumes Twilio SMS credits and the project is not yet on TRAI DLT. **Severity: LOW** — consider a simple per-admin throttle. (Cross-references the broader SMS/Twilio cost concern.)

### Severity summary

| # | Finding | Rating |
|---|---------|--------|
| 1 | No secrets committed; `.env*` gitignored & never in history | GOOD |
| 2 | Service-role key server-only, not inlined to client | GOOD |
| 3 | Every admin route enforces session+role before service-role use; column allowlist | GOOD |
| 4 | Demo auth-bypass relies solely on `NODE_ENV` guard; `.env.local` currently `true`; risky on previews | OKAYISH → BAD if non-prod deploy has prod keys |
| 5 | `getUser()` (server-validated) used everywhere | GOOD |
| 6 | Login `next` open-redirect prevented | GOOD |
| 7 | Unvalidated filter/search columns; broad signed-URL access for moderators; no OTP throttle | OKAYISH / LOW |

Files cited (all read): `admin-dashboard/middleware.ts`, `.env.example`, `.env.local.example`, `src/lib/auth/bypass.ts`, `src/lib/auth/dashboard-access.ts`, `src/lib/auth/dashboard-role.ts`, `src/lib/supabase/{service-role,server-auth,server,client,env}.ts`, `src/lib/admin/patch-allowlist.ts`, `src/lib/audit.ts`, `next.config.ts`, and `src/app/api/admin/{data,row,search,moderator/create,moderator/send-otp,verification/decision,verification/signed-url,verification/submissions}/route.ts`.

I now have everything needed. Let me confirm one thing: the ShipperTrucksScreen queries `availabilities` directly with the truck join — a shipper reading availabilities is permitted, and trucks are visible only when an availability is 'available' (RLS confirms). Note the shipper trucks screen filters by truck route (origin/dest of the availability), not by matching against the shipper's own load. There is no automatic return-load pre-allocation anywhere. The truck_owner uses `FindReturnLoadScreen` (manual search). I have enough to write the report.

## Product Workflow & Completeness

I reviewed the end-to-end role flows against the actual screens and the live DB (enums, RLS policies, triggers, and the pg_cron job). Overall the core marketplace loop is **functionally complete for an MVP**, but the signature "return load" feature is **manual search, not the pre-allocation pitched**, and several lifecycle gaps exist.

### Core loop: shipper posts → truck owner posts → discovery → contact

| Stage | Where | Verdict |
|---|---|---|
| Shipper posts load | `LoadKaro/screens/shipper/ShipperPostLoadScreen.js:247` (insert into `loads`, status defaults to `open` via `load_status_enum`) | GOOD |
| Truck owner adds truck + posts availability | `AddTruckScreen.js`, `CreateAvailabilityScreen.js:262` (insert into `availabilities`, status `available`) | GOOD |
| Shipper discovers trucks | `ShipperTrucksScreen.js:150` queries `availabilities` where `status='available'`, joins truck + owner | GOOD |
| Truck owner discovers loads | `FindReturnLoadScreen.js` / `ViewLoadsScreen` (market variant) | OKAYISH (see below) |
| Contact | Both sides use `Linking.openURL('tel:...')` — `ShipperTrucksScreen.js:240`, `FindReturnLoadScreen.js:204` | OKAYISH — contact is a raw phone call; no in-app messaging, no "interested"/booking record, no way for either party to know who called. Fine for MVP, but the platform captures **zero** signal that a match happened. |

The loop closes via a phone call and nothing else. This is a deliberate, defensible MVP choice, but it has a real downstream consequence (next section).

### The "return load" anti-deadhead feature — RATING: BAD (vs. how it's pitched)

The business pitch is: *when a shipper posts where goods are going, LoadKaro pre-allocates a return load so the truck doesn't travel back empty.* **That pre-allocation does not exist in code.**

What actually exists (`FindReturnLoadScreen.js`):
- It is a **manual, truck-owner-initiated search**. The truck owner opens the screen, manually picks an origin state/city (where the truck is now) and optional destination, taps Apply, and gets a list of open loads (`FindReturnLoadScreen.js:118-133`).
- There is **no linkage to the truck owner's own availability or current trip**. Nothing reads "this truck is going A→B, so suggest B→A loads." The origin/destination are typed in fresh each time.
- The shipper side has **no awareness of return loads at all** — `ShipperPostLoadScreen.js` does not surface, request, or pre-allocate anything on the return leg. The shipper just posts a one-way load.
- There is no matching engine, no scoring, no notification, no `matched` status being written anywhere (the `load_status_enum` *has* a `matched` value — confirmed in DB — but **no screen ever sets it**; loads only move `open → closed/cancelled`).

So the differentiator that the whole product is sold on is, today, a generic load-board search filter relabeled "Find Return Load." It is not wrong as an MVP step, but it is **materially different from the pitch** and the founder should know the gap is large.

### Verification (KYC) flow — RATING: GOOD

- User-level KYC: `RoleDashboardScreen.js:107` and `ShipperProfileScreen` submit docs via `submitVerificationDocs`, flipping status to `pending`; admin reviews in the dashboard. Clean.
- Truck-level KYC is separate (`ManageTrucksScreen.js:135`), which is correct — a verified owner can still have an unverified truck.
- Discovery does **not** gate on verification: an `unverified` truck owner's availability is still visible to shippers (`ShipperTrucksScreen` shows a `StatusPill` with the status but does not filter), and unverified shippers' loads are visible to truck owners. Verification is informational, not access-controlling. This is plausibly intentional (don't starve a new marketplace) but worth confirming.

### Lifecycle gaps

1. **Shippers cannot close, cancel, or mark a load fulfilled.** `ShipperMyLoadsScreen.js` is read-only — it renders `statusToPill` for `closed`/`cancelled` (lines 33-38) but provides **no action to set them**. Only truck owners can change availability status (`ManageAvailabilitiesScreen.js:88`). So a shipper whose load is taken via a phone call has no way to take it down. It will sit `open` until `auto_expire_listings` closes it the day after `loading_date` (`pg_cron` job `auto-expire-listings`, `0 1 * * *`, confirmed). RATING: BAD — stale loads stay live and waste truck-owner calls. The DB currently shows **0 open / 14 closed loads**, consistent with everything just aging out via the cron.
2. **No "matched" transition is ever used.** The enum value and the `enforce_load_status_transition` trigger exist, but no code path marks a deal as done. Combined with phone-only contact, the platform has **no record of a successful match** — which undermines any future return-load matching, analytics, or monetization.
3. **`limit_open_loads_per_user` caps a shipper at 10 open loads** (DB trigger, confirmed). The insert in `ShipperPostLoadScreen.js:247` does **not** anticipate this — the 11th post throws `Open load limit reached` and surfaces as a raw `save_error` alert with the Postgres message. Minor UX gap.

### Role access observations

- **Trucks visible to shippers only when an availability is `available`** — confirmed in both code (`ShipperTrucksScreen.js:154`) and RLS (`trucks` "view trucks" policy requires an `EXISTS` available availability). Consistent and intentional-looking; a truck with no live availability is correctly invisible. GOOD.
- **Trucks become uneditable after verification** — `ManageTrucksScreen.js:88-99` blocks edit when status is `pending` or `verified`; only `unverified` is editable. RLS likely mirrors this. Reasonable anti-tamper rule, but rigid (see Questions).
- **Broker shares shipper-style access AND truck-owner-style access.** Broker buttons (`dashboardButtons.ts:9`) include `upload_loads` (post loads like a shipper) + `browse_loads` + `view_availabilities`. The RLS confirms broker is in **both** the `loads` viewer set (with truck_owner) **and** the `availabilities`/`trucks` viewer set (with shipper). So a broker can see loads, see trucks/availabilities, and post loads — effectively a superset. Plausibly intentional (a broker brokers both sides), but it's the loosest role and deserves scrutiny.

## Questions for the Founder

1. **Return-load: is the manual search the intended MVP, or a placeholder for the real feature?** Today `FindReturnLoadScreen` is a generic load search the truck owner runs by hand; there is no automatic pre-allocation of a return load when a shipper posts, and the shipper is never asked about / shown the return leg. The product is pitched on this exact differentiator. Is the auto-allocation deferred to the post-3000-user rebuild, or was it expected in the MVP?

2. **Should the truck owner's *own availability* drive return-load suggestions?** Right now the owner re-types origin/destination every search. Would you want "your truck is going Delhi→Mumbai, here are Mumbai→Delhi loads" surfaced automatically from their active availability? That's the smallest change that would make the feature match its name.

3. **Why can't a shipper close/cancel/mark-fulfilled their own load?** `ShipperMyLoadsScreen` is read-only. Loads only leave `open` via the nightly `auto_expire_listings` cron (day after loading date). Is leaving stale open loads live until expiry intentional, or should shippers get a "close / mark taken" action?

4. **The `matched` load status is defined but never written.** No screen marks a load (or availability) as matched when a deal happens — contact is a phone call only. Do you want the app to capture "this load was matched/taken" (even a simple confirm button), given that future return-load matching and analytics depend on knowing what matched?

5. **Verification does not gate visibility — intentional?** Unverified shippers' loads and unverified truck owners' availabilities are fully discoverable and callable; the status is shown but never filtered. Is open-to-all discovery the deliberate choice to avoid a cold-start, or should unverified listings be hidden / down-ranked?

6. **Trucks become permanently uneditable once `verified`** (`ManageTrucksScreen.js:93`). If an owner mistypes capacity/registration or genuinely re-fits the truck, the only path is delete-and-re-add (losing the truck's verified status and history). Is a "request re-verification / edit" path desired, or is hard-lock the intended anti-fraud behavior?

7. **Broker is the broadest role — is that the intent?** A broker can post loads (like a shipper) *and* view trucks/availabilities (like a shipper) — RLS puts broker in every viewer set. Should a broker also be able to post availabilities, or is the current "sees everything, posts loads only" the deliberate scope? Confirm the broker is meant to be a superset rather than a distinct intermediary with its own surface.

8. **The 10 open-loads cap** (`limit_open_loads_per_user` trigger) is enforced in the DB but the post-load screen shows the raw Postgres error on the 11th post. Is 10 the intended business limit, and should the UI explain it before the user hits it?

Files cited: `LoadKaro/screens/shipper/ShipperPostLoadScreen.js`, `LoadKaro/screens/shipper/ShipperTrucksScreen.js`, `LoadKaro/screens/shipper/ShipperMyLoadsScreen.js`, `LoadKaro/screens/shipper/ShipperHomeScreen.js`, `LoadKaro/screens/FindReturnLoadScreen.js`, `LoadKaro/screens/CreateAvailabilityScreen.js`, `LoadKaro/screens/ManageTrucksScreen.js`, `LoadKaro/screens/ManageAvailabilitiesScreen.js`, `LoadKaro/screens/EditTruckScreen.js`, `LoadKaro/screens/RoleDashboardScreen.js`, `LoadKaro/config/dashboardButtons.ts`, `LoadKaro/config/roleRoutes.ts`; DB: `load_status_enum` (open/matched/cancelled/closed), `loads`/`trucks`/`availabilities` SELECT RLS policies, triggers `enforce_load_status_transition` / `limit_open_loads_per_user`, function `auto_expire_listings` + pg_cron job `auto-expire-listings` (`0 1 * * *`).
