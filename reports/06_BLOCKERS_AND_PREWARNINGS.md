# LoadKaro — Pre-Warnings & Landmines

*A founder's field guide to the traps ahead. Each item: what it is, when/why it bites, the early warning sign, and how to pre-empt it. Ordered by a blend of severity and how soon it lands. Read top to bottom — the first five can stop your launch or your business cold.*

---

## How to read this

| Tier | Meaning |
|---|---|
| 🟥 **LANDMINE** | Will stop launch, break the law, or kill the business if hit unprepared. Act before launch. |
| 🟧 **TRAP** | Won't stop launch, but bites hard during early growth (weeks-to-months). Plan now, fix soon. |
| 🟨 **STEPPING STONE** | A known cliff you'll cross *as you scale* (toward 6,000 users). Pre-stage the fix; don't fire-fight it. |

A blunt framing for the team: **today nothing is on fire, and that is exactly the danger.** Every one of the worst items below (full phone-number exposure, no DLT, the auth-bypass flag, the package id) is *invisible at 50 users* and *a headline at 6,000*. You are pre-paying attention now so you don't pay in a crisis later.

---

## 🟥 LANDMINE 1 — The Android package id `com.anonymous.LoadKaro` is permanent once you publish

- **What it is:** `app.json:23` ships `"package": "com.anonymous.LoadKaro"`. The `com.anonymous.*` prefix is the Expo scaffold default — a namespace you don't own, and it looks unprofessional in a Play listing.
- **When/why it bites:** The *instant* you upload your first build to the Play Console. Google **locks the package id forever** — it is the app's permanent identity. You can never change it without publishing a brand-new app (new listing, zero installs, zero reviews, lost URL).
- **Early warning sign:** There is none after the fact — by the time you'd want to change it, it's already frozen. The only "sign" is reading this before your first upload.
- **How to pre-empt:** Change it to a real namespace you control (e.g. `in.loadkaro.app` or `com.loadkaro.app`) **before the first Play upload**. One-line change today; impossible later. This is the single cheapest-now / catastrophic-later item in the whole report.

---

## 🟥 LANDMINE 2 — No privacy policy = automatic Play rejection (you collect phone numbers + KYC docs)

- **What it is:** No privacy-policy file or URL exists anywhere in the repo. The app collects **name + phone number** and uploads **ID / verification documents** (KYC).
- **When/why it bites:** At Play review, before you ever go live. Google **requires** a privacy-policy URL for any app collecting personal data, and you collect the most sensitive kind. You will also be forced to complete the **Data Safety form** declaring exactly what you collect (phone, name, uploaded documents) and why. A wrong or missing declaration is a rejection — and a *false* declaration is an account-level risk.
- **Early warning sign:** Play Console flags "Privacy policy required" and "Data safety section incomplete" during the submission flow. If you see these, you are already blocked.
- **How to pre-empt:**
  1. Host a privacy policy (a static page on your domain is fine) covering phone, name, KYC docs, retention, and Twilio/Supabase as processors.
  2. Add the URL in the Play Console **and** a "Privacy Policy" link inside the app (shipper profile / role dashboard).
  3. Fill the Data Safety form to match reality (collected: phone, name, documents; purpose: account + verification).
- **Pair this with the DPDP exposure in Landmine 3** — your privacy policy is also your legal cover under Indian law.

---

## 🟥 LANDMINE 3 — Every logged-in user can read every user's name + phone number (DPDP Act exposure)

- **What it is:** The `users` table has two SELECT policies for `authenticated`, and because RLS is OR-combined, the permissive one wins: `view users → USING (true)`. **Any logged-in account can read the full name, phone, role, and verification status of every other user.** Confirmed live on 2026-06-30.
- **When/why it bites:** It bites *silently from day one* and becomes a catastrophe at scale. An attacker self-registers (free, phone-OTP), then issues one paginated `GET /rest/v1/users?select=name,phone,role` and scrapes your **entire** user base. At 6,000 users that is a one-request export of 6,000 verified Indian mobile numbers tied to names and business roles — ready-made for SMS spam, competitor poaching (BlackBuck-style), SIM-swap targeting, or resale.
- **The legal dimension (India DPDP Act 2023):** Phone numbers + names + KYC documents are personal data. A bulk-readable phone table is a textbook **personal-data breach**. Under DPDP you face breach-notification duties and penalties that can run to crores. "An attacker could scrape us" stops being a security note and becomes a **regulatory liability** the moment you have real users.
- **Early warning sign:** Unusual egress on the `users` table; a spike in `phone_exists` calls; users reporting spam SMS shortly after signup; a competitor that suddenly knows your truck owners. You likely won't see it until the damage is done — which is why this is a pre-launch fix, not a monitoring item.
- **Why the naive fix breaks the app:** The two sides legitimately need each other's name + phone to call (`ViewAvailabilitiesScreen.js:155-158`, `ShipperTrucksScreen.js:122-125` read `id, name, phone` of counterparties with an active listing). So you **cannot just lock the table** — you must *scope* it.
- **How to pre-empt (one SQL migration, no app change):**
  - Drop `view users USING(true)`. Replace with a policy that exposes a row only when that user has an **active public listing** the caller can contact (truck owner with an `available` availability, or shipper with a posted load).
  - **Stronger, recommended:** stop exposing `phone` via the table at all. Serve contact via a `SECURITY DEFINER` RPC `get_listing_contact(listing_id)` that returns the counterparty's number only for a listing the caller can see, and **logs the access to `audit_log`** for abuse detection. This removes bulk enumeration entirely.
  - Settle the product **QUESTION** first: is broad *name* visibility (without phone) acceptable, or should everything be listing-scoped?

---

## 🟥 LANDMINE 4 — The dashboard auth-bypass flag (one env var from a fully open admin panel over production data)

- **What it is:** `isDashboardAuthBypassed()` makes `/admin`, `/moderator`, **and all `/api/admin/*` service-role routes** reachable with **no login**, defaulting to the `admin` role. The *only* thing stopping it is a single guard: `if (process.env.NODE_ENV === "production") return false;`. Right now `admin-dashboard/.env.local` has **both** bypass vars set to `true`.
- **When/why it bites:** The moment a **non-production deployment that can reach your real Supabase project goes live** — most realistically a **Vercel Preview** build. Vercel Preview does **not** set `NODE_ENV=production` by default, so the guard doesn't fire, the bypass is live, and the preview URL (guessable, unauthenticated) becomes a **fully open admin console with a real service-role key over real data** — every phone number, every KYC doc, every mutation.
- **Early warning sign:** A preview/staging URL that loads the admin dashboard without asking you to log in. If you can open `/admin` on any deployed URL and you're already "in," you are exposed.
- **How to pre-empt:**
  1. Confirm production runs `NODE_ENV=production` (Vercel prod does) **and** that no preview/staging deploy points at the production Supabase project.
  2. Harden the guard to **fail closed** — require an explicit local/dev marker (e.g. `VERCEL_ENV === "development"`) rather than merely "not production."
  3. Remove `NEXT_PUBLIC_DASHBOARD_BYPASS_AUTH` entirely (it ships the toggle to the browser).
  4. **Rotate the service-role key once before launch** — it has lived in a developer's local `.env`.

---

## 🟥 LANDMINE 5 — The TRAI DLT / SMS deliverability cliff (your login *is* an SMS, and it's unregistered)

- **What it is:** Every login and re-verification sends an OTP SMS via Twilio. You are **not registered on TRAI DLT** — the mandatory Indian blockchain registry for *all* commercial SMS, OTPs included.
- **When/why it bites:** It bites on **two timelines at once**:
  - **Now / soft:** Your OTPs probably still arrive because Twilio is routing them over an **international long code** that bypasses DLT. That route is unbranded (a random foreign number, not "LoadKaro"), pricier (~₹7/SMS vs ~₹0.18 on a DLT-registered Indian gateway), lower-priority, and **increasingly filtered** as carriers tighten scrubbing.
  - **At scale / hard:** As volume rises and you become visible, carrier filtering of non-DLT traffic increases. **OTP delivery failures climb exactly as you grow** — meaning users can't log in precisely when you have the most users. This is arguably your **#1 growth blocker**, ahead of anything in the database.
- **Early warning sign:** Rising "didn't receive OTP" complaints; OTP delivery rate dropping below ~95%; Twilio SMS spend climbing faster than logins; OTPs arriving from a foreign number instead of a branded sender.
- **How to pre-empt:**
  1. **Confirm the route today:** check the Twilio console whether OTPs go via an international long code (likely) or a registered sender. This single fact sets urgency.
  2. **Start DLT registration now** — and note the good news: it **does not require incorporation**. A sole proprietor can register on a **personal PAN** (GST not mandatory for a proprietor). Budget ~₹5,900/yr + 3–7 business days per template/header approval.
  3. **Decouple from Twilio cheaply:** the app only calls `signInWithOtp` / `verifyOtp` — provider choice lives entirely on the Supabase backend. Use Supabase's **Send-SMS Auth Hook** → an Edge Function → an Indian gateway (**MSG91** first choice: cheapest INR rates, native DLT tooling, best-documented Supabase integration). **No app release, no store resubmission.** (Gotcha: once the hook is on, *disable* the built-in Twilio provider — running both fails sends.)
  4. **Bridge while DLT is pending:** Supabase test phone numbers for your team/QA (zero SMS), and Firebase Phone Auth as a no-DLT fallback only if launch can't wait (note: that one *is* app-code work).

---

## 🟥 LANDMINE 6 — Twilio SMS-pump / toll-fraud: an unauthenticated, unthrottled OTP send button

- **What it is:** `phone_exists()` is anon-callable (intentionally, for the pre-login check), and OTP send has **no rate limiting anywhere** in the stack. Supabase free-tier RPC has no built-in per-IP limit.
- **When/why it bites:** The moment you have any public visibility. An attacker can script OTP sends against arbitrary `+91` numbers (**SMS pumping** — they profit from the carrier traffic) or simply enumerate your user base via `phone_exists`. On the expensive international route (~₹7/SMS), a sustained attack is **direct bill-shock** with no upper bound.
- **Early warning sign:** A sudden spike in OTP-send volume or Twilio spend with no matching signups; bursts of `phone_exists` calls; SMS to number ranges you've never seen.
- **How to pre-empt:**
  1. **Rate-limit OTP sends** (per phone, per IP) — ideally in the same Edge Function you build for DLT (Landmine 5), giving you one chokepoint.
  2. Move `phone_exists` behind a throttled Edge Function (or drop the pre-check and branch register-vs-login *after* the OTP is sent, so existence is never disclosed pre-auth).
  3. Set a **Twilio spend cap / billing alert** today as a hard backstop while you build the above.

---

## 🟧 TRAP 7 — One render crash white-screens the entire app (no error boundary)

- **What it is:** There is no global React error boundary. `App.js` wraps the tree in providers but nothing catches a render error.
- **When/why it bites:** Any unhandled render error in *any* screen — a malformed API row, an unexpected null on a device you didn't test — white-screens the whole app with no recovery, for a non-technical trucker/shipper who will simply uninstall.
- **Early warning sign:** "App just shows a blank/white screen" reports with no crash log (because there's no crash reporting either — see below). One-star reviews citing "doesn't open."
- **How to pre-empt:** Add **one** error boundary around `RootNavigator` with a friendly "Something went wrong — restart" fallback. Highest crash-safety ROI in the codebase. Pair with a crash reporter (Sentry/Crashlytics) so field crashes stop being invisible — `logger.error` is already left active as a hook point.

---

## 🟧 TRAP 8 — PII (phone numbers + auth IDs) logged in release builds

- **What it is:** A production-safe `logger` exists but the **auth flow ignores it** — `OTPScreen.js`, `SignInScreen.js`, and `syncUserAfterOtp.js` use raw `console.log` printing phone numbers in E.164 and auth user IDs (36 raw `console.*` across 16 files). React Native does **not** strip `console.*` in release, so this PII lands in device logcat readable by other tooling.
- **When/why it bites:** Continuously, in every shipped build — and it compounds your DPDP exposure (Landmine 3): you are now *writing* personal data to a place other apps can read.
- **Early warning sign:** `adb logcat` on a release build showing phone numbers during login.
- **How to pre-empt:** Route those calls through the existing `logger` (or delete them); never log phone/auth-id even in dev. Optionally add `babel-plugin-transform-remove-console` for production. Mechanical, do before launch.

---

## 🟧 TRAP 9 — Trust & fraud: verification doesn't gate anything, and no one can take down a bad listing

- **What it is:** Three gaps compound into a fraud surface:
  1. **Verification is informational, not access-controlling** — unverified truck owners' availabilities and unverified shippers' loads are fully discoverable and callable; status is shown but never filtered.
  2. **Shippers cannot close/cancel/mark-fulfilled their own loads** — `ShipperMyLoadsScreen` is read-only. A taken load sits `open` until the nightly `auto_expire_listings` cron closes it the day after the loading date.
  3. **Client-supplied `role` on registration** — the client allow-lists `role` to shipper/truck_owner/broker, but that's bypassable; whether self-assignment of `admin` is possible depends entirely on the `users` INSERT RLS policy (**must be verified**).
- **When/why it bites:** As soon as you have enough liquidity to be worth abusing. Fake/ghost loads from unverified accounts waste truck-owner calls and erode trust (your scarcest early asset); stale loads make the board look dead-or-dishonest; an unlocked `role` insert is a **privilege-escalation to admin**.
- **Early warning sign:** Truck owners complaining loads are "already gone" or fake; rising unverified-account activity; the board feeling stale. For role escalation: any non-admin account appearing with elevated access.
- **How to pre-empt:**
  - **Verify the `users` INSERT/UPDATE RLS now** — confirm it forces `id = auth.uid()` and hard-constrains `role` to the three self-serve values (server-side, never trusting client metadata). This is the one item here that could be CRITICAL; treat as a launch blocker until confirmed.
  - Give shippers a **close / mark-taken** action so the board self-cleans (also unlocks match analytics — see Trap 11).
  - Decide the verification-gating product question: hide/down-rank unverified listings, or accept open discovery to avoid cold-start? At minimum, badge prominently.
  - Add an admin **suspend/ban** capability (there is no `is_active` flag on users today) so you can remove a bad actor.

---

## 🟧 TRAP 10 — Cold-start liquidity: loads vs trucks chicken-and-egg

- **What it is:** A two-sided marketplace is worthless to either side until the *other* side is present. Shippers won't post without trucks to call; truck owners won't browse without loads to find. The DB currently shows **0 open / 14 closed loads** — i.e. the board is, today, empty.
- **When/why it bites:** At launch and for the first several weeks. This is the classic marketplace death-zone — most freight load-boards die here, not from tech.
- **Compounding factor — the supply side gets the worse app:** shippers got the revamped bottom-tab UI; **truck owners and brokers are still on the older, plainer `RoleDashboardScreen`** (hardcoded colors, no icons, no tabs). Truck owners are the supply side that's usually *harder* to acquire, and you're shipping them the weaker experience. That risks weak retention on exactly the side you can least afford to lose.
- **Early warning sign:** Signups that never post; a board that stays empty in one or more lanes; truck owners installing and not returning.
- **How to pre-empt:**
  - **Seed one side manually.** Pick 2–3 high-density lanes and concentrate supply *or* demand there rather than spreading thin nationally — liquidity in one corridor beats emptiness everywhere.
  - Prioritise the **truck-owner UI uplift** as the top post-MVP item (it's flagged as an intentional staged rollout — just don't let it slip).
  - Lean on your **return-load differentiator** to bootstrap supply: a guaranteed backhaul is the one reason a truck owner picks you over Vahak — *but see Trap 11, because it doesn't actually exist yet.*

---

## 🟧 TRAP 11 — Your signature feature (return-load pre-allocation) is not built

- **What it is:** The business is pitched on: *shipper posts an outbound load → LoadKaro pre-allocates a return load so the truck doesn't drive back empty.* **That pre-allocation does not exist in code.** `FindReturnLoadScreen` is a **manual, truck-owner-initiated search** — the owner re-types an origin/destination each time. There is no link to the truck's own trip/availability, the shipper is never asked about the return leg, and the `matched` load status exists in the enum but **is never written by any screen**.
- **When/why it bites:** The day an investor, partner, or power user tests the "no empty miles" promise and finds a generic search filter relabeled "Find Return Load." It also undercuts monetization (see below) — the return load is the *one* thing users can't replicate off-platform, so it's the only defensible thing to charge for.
- **Early warning sign:** Pitch feedback like "how is this different from Vahak?"; truck owners not using the return-load screen; no data on what actually matched (because nothing records a match).
- **How to pre-empt:**
  - Be honest internally about the gap: today it's a load-board search, not a matching engine. Decide explicitly whether real pre-allocation is **MVP scope or deferred to the rebuild**.
  - Smallest step that makes the feature match its name: drive return-load suggestions from the **truck owner's own active availability** ("your truck is going Delhi→Mumbai — here are Mumbai→Delhi loads").
  - **Start recording matches** (even a simple "mark taken / interested" confirm). Without a `matched` signal you have no funnel, no analytics, and no foundation for the return-load engine or any commission product.

---

## 🟨 STEPPING STONE 12 — Supabase scaling & cost cliffs (storage is the one that actually hits)

- **What it is:** Postgres itself scales fine to 6,000 users — the app is well-built (real cursor pagination, scoped queries, no realtime sockets, head-count queries). The cliffs are elsewhere:
  - **Storage for KYC docs is the real ceiling.** If most of 6,000 users upload 2–4 ID/vehicle images at 0.5–2 MB each, that's realistically **6–40 GB**. Free tier is ~1 GB; Pro base is ~8 GB. **You will blow past both.** Uploads currently have **no client-side size cap**, and the upload path (`fetch→blob→arrayBuffer`) is memory-heavy and flaky for large files on some Android devices.
  - **RLS `auth.uid()` re-evaluated per row** on 24 policies — degrades feed queries as tables grow.
  - **Missing composite indexes** on the hot feed filters (`availabilities(status, origin_location_id, created_at)`, `loads(status, origin_location_id, loading_date)`).
- **When/why it bites:** Storage bites within months of real KYC adoption (a surprise bill + failed uploads). The RLS/index issues bite as `loads`/`availabilities` grow into tens/hundreds of thousands of rows over months — creeping feed latency, not a crash.
- **Early warning sign:** Supabase storage usage approaching the tier limit; failed/slow document uploads on cheaper Android phones; feed queries creeping from <10 ms toward hundreds of ms in the dashboard.
- **How to pre-empt:**
  - **Cap upload size client-side** (and compress images) + set a Storage bucket size limit; budget for storage add-ons before you cross the tier.
  - **One-time SQL migration before 6k:** wrap RLS as `(select auth.uid())` on all 24 policies; add the two composite indexes. No app change, highest perf ROI.
  - Ensure server-side (dashboard) uses the **pooled** connection string.

---

## 🟨 STEPPING STONE 13 — Single-developer bus-factor

- **What it is:** One main developer (a fresh grad) plus three part-time contributors, building an MVP pitched by someone else, with a plan to rebuild from scratch at ~3,000–4,000 users.
- **When/why it bites:** The instant the main developer is unavailable (illness, exam season, burnout, leaving) — and that risk peaks right when DLT, a security incident, or a Play rejection demands fast action. With no second person who knows the Supabase schema, RLS policies, and EAS build setup, the project stalls.
- **Early warning sign:** Only one person can answer "how does X work"; commits all from one author; no written runbook for build/deploy/DB.
- **How to pre-empt:**
  - **Write down the tribal knowledge now**, while it's small: the EAS build/submit steps, the Supabase project layout + RLS intent, env vars, and the SMS/OTP config. The docs in the repo (`DOCS_*`) are a good start — keep them current.
  - Ensure **at least two people** have Supabase + Play Console + Vercel access (and rotate keys when anyone leaves).
  - Capture the **open product QUESTIONS** (return-load scope, verification gating, broker role breadth, 0%-commission stance) as written decisions so they survive a personnel change.

---

## 🟨 STEPPING STONE 14 — Data migration when you rebuild from scratch

- **What it is:** The plan is to rebuild the app at ~3,000–4,000 users. By then you'll have thousands of real users, loads, trucks, availabilities, KYC documents, and an audit trail in the live Supabase project.
- **When/why it bites:** At the rebuild. A "rebuild from scratch" that doesn't plan data continuity means either (a) you migrate live production data into the new schema — non-trivial with phone-OTP identities, KYC docs in storage, and enum/status semantics — or (b) you ask 4,000 hard-won users to **re-register and re-verify**, which will churn a large fraction of them. Either path is far cheaper to plan now than to improvise then.
- **Early warning sign:** Rebuild discussions that focus only on the new stack and never mention the existing rows; schema changes made in the MVP with no thought to how they'd map forward.
- **How to pre-empt:**
  - Treat the **Supabase database (auth identities + data + storage) as the durable asset** and the app as replaceable. If the rebuild keeps Supabase, migration is mostly schema evolution, not a user reset — strongly prefer this.
  - Keep `unique_id`/identity semantics stable; avoid destructive enum churn.
  - Keep regular DB backups (you already have an RLS backup discipline — extend it to data) and document the schema so the rebuild team can map it.

---

## One-page action checklist

**Before first Play upload (do not skip — several are irreversible):**
1. 🟥 Rename Android package `com.anonymous.LoadKaro` → real namespace *(irreversible after upload)*.
2. 🟥 Host privacy policy + complete Data Safety form + in-app policy link.
3. 🟥 Fix `users` `USING(true)` RLS (scope contact, or RPC-gate phone) — DPDP exposure.
4. 🟥 Verify `users` INSERT/UPDATE RLS locks `role` server-side *(possible admin escalation)*.
5. 🟥 Harden the dashboard auth-bypass guard (fail closed); remove the public flag; rotate service-role key.
6. 🟧 Add a global error boundary around `RootNavigator`.
7. 🟧 Stop logging phone numbers / auth IDs in release builds.
8. 🟥 Set a Twilio spend cap + basic OTP rate-limit (bill-shock backstop).

**Start now, runs in parallel (long lead times):**
9. 🟥 Begin TRAI DLT registration on a founder's personal PAN; plan the Supabase Send-SMS Hook → MSG91 cutover.
10. 🟨 One-time SQL migration: `(select auth.uid())` on 24 policies + two composite indexes.
11. 🟧 Cap KYC upload size client-side; budget Supabase storage.
12. 🟨 Write the runbook (build/deploy/DB/SMS); give two people all admin access.

**Strategic decisions to settle on paper:**
13. 🟧 Return-load: real pre-allocation in MVP, or deferred to rebuild? Start recording `matched`.
14. 🟧 Cold-start: which 2–3 lanes to seed; when to uplift the truck-owner UI.
15. 🟨 Rebuild: commit to keeping Supabase as the durable data layer to avoid a user reset.
16. 💰 0%-commission branding? (Decides whether a take-rate is ever on the table — settle before pricing UI.)

*Bottom line: the code is a genuinely competent MVP. What will hurt you is not bad code — it's the off-code landmines (a permanent package id, a privacy law, an SMS regulator, a single env var, a single developer) that are silent today and loud at 6,000 users. Defuse the five red items before launch and you've removed every scenario that could end the project outright.*
