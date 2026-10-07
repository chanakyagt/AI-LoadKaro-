# Handoff — LoadKaro APK test pass (Mobile MCP only)

Written 2026-10-04 for the next Claude session. Read all of this before acting.

## The one rule

**Test using the Mobile MCP tools only** (`mobile-mcp`, package
`@mobilenext/mobile-mcp`, configured in this folder's `.mcp.json`).

- Do **not** drive the emulator with raw `adb`, screencap scripts, PowerShell or Bash.
- Do **not** query or change the Supabase database while testing.
- Do **not** fix code while testing. Report the findings first; the founder decides.
- If no `mobile-mcp` tools are available in the session, **stop and say so**.
  Don't improvise with other tools. The founder said so explicitly.

## What was done before this handoff (context, already finished)

| Area | State |
|---|---|
| Design-review fixes | Compact search bar on browse screens, inactive cards no longer faded, single state badge on truck cards, shipper Home leads with **Post a Load**, Recent Loads restyled as a compact tinted list, 48dp "View all". LoadKaro `c07cfc1`. |
| Pre-launch fixes | Return-load switch filters (open + loading today or later), Android back on shipper/truck-owner tabs → Home, truck-delete warns about live availability posts, light status bar on navy screens, Add Truck returns via goBack, raw keys `truck_id`/`variant_id` fixed. LoadKaro `c1af036`. |
| Database (live) | `broker_write_access` was already live; `profile_lock_when_verified` + `crm_schema` + function hardening applied 2026-10-03 and verified. |
| CRM + portal | Built in `admin-dashboard` (Matching, Pipeline, Support, KYC desks + `/portal`), pushed. |
| Code location | App: `LoadKaro/` (branch `LOADKARO-final-testing`, pushed). Parent repo pushed to branch `loadkaro-app` (GitHub `main` is an unrelated project — never push there). |

**Build under test** (everything above + coordinate matching + security hardening, app commit `40e4a8f`):
https://expo.dev/artifacts/eas/w2EcGPXFfPogKpIX7U4yXDbnWSGNUDNw_YIwSVkH5fg.apk

**Emulator on this machine:** AVD `Medium_Phone_API_36.1`.

**Test logins:** see `.env.test` in this folder (gitignored). Supabase test
numbers, no SMS sent, fixed OTP. In the app, the +91 chip is preselected, so
type the **10 digits after the 91**. Example: test number `916000000001` → type `6000000001`.

Use one number per role and don't reuse them:

| Role | Number to type |
|---|---|
| Shipper | `6000000001` |
| Truck owner | `6000000002` |
| Broker | `6000000003` |

If a number already has an account, sign in with it. If not, register it with
the role in the table, using the name `Test Shipper`, `Test Owner` or `Test Broker`.

## Exactly what to do

1. Confirm the `mobile-mcp` tools are loaded. If not, stop (see the rule above).
2. With Mobile MCP: list devices. If the emulator isn't running, start
   `Medium_Phone_API_36.1`, or ask the founder to start it from Android Studio.
3. With Mobile MCP: install the APK from the link above (download it first if
   the MCP needs a local file), then launch LoadKaro.
4. Run the checklist below **in order**, one role at a time. **Take a screenshot at
   every step marked 📸.**
5. Sign out between roles (Profile → Sign out).
6. Report back in the format at the bottom. Don't fix anything yet.

### Checklist

**A. First launch / sign-in (once)**
- [ ] Splash animates and the app reaches the landing/sign-in screen without crashing 📸
- [ ] Country chip shows +91; other countries greyed out
- [ ] Status bar icons are readable on the white sign-in screen

**B. Shipper (`6000000001`)**
- [ ] Sign in → OTP → lands on shipper Home 📸
- [ ] Home: orange **Post a Load** is the first card, visible without scrolling 📸
- [ ] Status bar icons are **white** on the navy header (not dark-on-navy)
- [ ] "Latest trucks" strip and "Recent Loads" look clearly different (Recent Loads = tinted compact list with package icons) 📸
- [ ] Post a Load: fill it in and submit → success; it then appears in My Loads 📸
- [ ] Trucks tab: opens on a **one-line search bar**, not the full form; results visible below 📸
- [ ] Tap the bar → full search opens; pick a route → applies and collapses; the bar shows `City → City`; ✕ clears it
- [ ] Any closed truck card: photo greyed, dark "Closed" badge in the corner, text **not** faded 📸
- [ ] From the Trucks / My Loads / Profile tabs, press the **Android back button** → goes to Home; pressing back on Home exits

**C. Truck owner (`6000000002`)**
- [ ] Sign in → truck-owner Home; status bar icons white 📸
- [ ] Add a truck → success → **returns to the previous screen** (not a fresh truck list on top of the form) 📸
- [ ] Add Truck form shows the label "Variant", **not** "variant_id"
- [ ] Post Availability: submit with no truck selected → the message names "Select truck", **not** "truck_id" 📸
- [ ] Post Availability with the new truck → success
- [ ] Find Loads: the **Return load** switch on with an origin → only open, future loads; off → closed ones show too 📸
- [ ] Delete the truck that has the live availability → the warning mentions the live availability post(s) 📸 → cancel (or confirm, then check the availability is gone)
- [ ] Android back from each tab → Home

**D. Broker (`6000000003`)**
- [ ] Sign in → broker Home 📸
- [ ] Post a load → **succeeds** (this failed before the database fix) 📸
- [ ] Add a truck + post availability → succeed
- [ ] Market tab: switching loads/trucks works; compact search bar present
- [ ] Android back → Home

**E. Profile lock (any role, only if an account is already verified)**
- [ ] Editing the name on a verified profile shows a locked/"contact support" message rather than saving

**F. Near-me matching (new in this build; spec: `docs/MATCHING_SPEC.md`)**
- [ ] First open of Find Trucks / Find Loads asks for **approximate** location once 📸
- [ ] Allow it (with Mobile MCP's set-location, put the device near Ballari, ~15.14, 76.92) → the bar says "Near Ballari" 📸
- [ ] Deny it (fresh install) → message asks you to pick a city; "Change" opens a city search and picking one updates the bar
- [ ] The location button (crosshair) re-detects; no second permission prompt after the first answer
- [ ] With live postings within 100 km: cards show "about X km away"; nearest first 📸
- [ ] Shipper with an open load: truck cards show a fit label (Good fit / Different truck type / Truck too small / Dates don't match) and a note naming the load it compares against 📸
- [ ] Truck owner: **no** fit labels on loads, only distance and "On your way"
- [ ] Nothing within 100 km → note "Nothing within 100 km of … Showing everything" and the newest-first list (not an empty screen)
- [ ] Typing a route in the search bar still filters exactly as before; clearing it returns to near-me order
- [ ] Profile footer shows "City locations © GeoNames (CC BY 4.0)"

There are no live listings right now, so the distance/fit items will be ⏭ blocked
unless the founder has posted real ones. Don't create listings to unblock them;
report and ask.

### Expected blockers (report them, don't work around them)

- **Posting may require a verified account.** New test accounts start
  unverified. If posting is blocked for that reason, report it and ask the
  founder whether to approve the test accounts from the admin dashboard. Don't
  approve them yourself and don't touch the database.
- If the OTP is rejected, the test numbers may have been removed or changed in
  Supabase. Report it; don't try other numbers beyond the three above.

## Report format

For each checklist item: ✅ pass / ❌ fail / ⏭ blocked, with one line of what
happened, plus the screenshot for every ❌. Send the screenshots with
SendUserFile. End with a short list of the failures in priority order, with a
proposed fix for each, and **wait for the founder's go-ahead** before changing code.

## After testing (remind the founder)

- **Delete the 150 Supabase test phone numbers** (Authentication → Phone → Test
  phone numbers). They share one fixed OTP and work on the live database.
- Optionally delete the three test accounts and their posts. Ask first.
- Still pending, outside the code: DLT/MSG91 SMS registration, privacy policy +
  Play Data Safety, key rotation, dashboard hosting, real listings.
