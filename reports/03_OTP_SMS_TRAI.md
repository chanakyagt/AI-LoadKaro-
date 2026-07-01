# LoadKaro — OTP, SMS & TRAI DLT

> India SMS regulation, DLT registration path, provider options, and migration.
> Generated 2026-06-30 from an automated multi-agent audit. Read-only analysis; nothing in the app or database was modified.

---

## TRAI DLT Registration

*(All information current as of June 2026; cited sources span 2024–2025. Verify portal fees at registration time — they change.)*

### 1. What TRAI DLT is and why your OTP SMS needs it

**DLT (Distributed Ledger Technology)** is a blockchain-based registration system mandated by **TRAI** (Telecom Regulatory Authority of India) under the *Telecom Commercial Communications Customer Preference Regulations (TCCCPR)*. Every commercial SMS sent to an Indian mobile number — **including OTPs**, which are classified as *transactional / service-implicit* traffic, **not** exempt — must originate from a registered entity, use a registered **Header (Sender ID)**, and match an **approved Content Template**. Indian operators (Jio, Airtel, Vi, BSNL) run "scrubbing" engines that drop any message not matching a pre-approved template/header. ([Twilio India SMS Guidelines](https://www.twilio.com/en-us/guidelines/in/sms), [WebEngage TCCCPR guide](https://docs.webengage.com/docs/trai-sms-dlt-regulations-india))

Three registration layers, in order ([Plivo DLT guide](https://www.plivo.com/blog/dlt-registration/)):
1. **Entity (Principal Entity) registration** → you receive a unique **Entity ID**. Done once on any operator's DLT portal.
2. **Header / Sender-ID registration** → your 6-character alphanumeric ID (e.g. `LDKARO`), tagged transactional/service. Operators deliver it with a 2-letter prefix (e.g. `VM-LDKARO`). After **6 May 2025**, headers also carry category suffixes `-T / -P / -S / -G`. ([Convertway](https://help.theconvertway.com/en/article/sender-id-registration-processdlt-for-sending-sms-to-india-noc9w3/))
3. **Content Template registration** → the exact OTP message text with variables in `{#var#}` format (max ~5–6 variables). Only approved templates get delivered.

You register on **one** operator portal and it is honoured across all operators ([SMSGatewayHub](https://crm.smsgatewayhub.com/knowledge-base/article/dlt-registration-charges-cost-breakdown-in-india)). Common portals: **Jio (trueconnect.jio.com), Airtel, Vi (Vilpower), BSNL**.

**Costs & timelines (2025):** Principal Entity registration is roughly **₹5,900 (₹5,000 + GST), billed annually**, broadly the same across Jio/Airtel/Vi. Template/header approvals take **~3–7 business days** each. ([SMSGatewayHub charges](https://crm.smsgatewayhub.com/knowledge-base/article/dlt-registration-charges-cost-breakdown-in-india), [2Factor DLT guide](https://2factor.in/v3/dlt/trai-mandatory-dlt-registration/))

### 2. Documents required + can a not-yet-incorporated team register?

Required for **Principal Entity** registration ([SMSGatewayHub](https://crm.smsgatewayhub.com/knowledge-base/article/dlt-registration-charges-cost-breakdown-in-india)):
- Company **PAN** card
- **GST** certificate (commonly required; some portals also accept other business proof)
- **Business registration** documents (incorporation / proprietorship proof)
- Authorized signatory's **PAN + Aadhaar**
- **Letter of Authorization** (LoA)

**Sole proprietor / not-yet-incorporated:** DLT registration is built for *registered* entities. A pure individual generally **cannot** register; a **registered proprietorship** can attempt it using proprietor PAN + Aadhaar + GST ([WebSearch synthesis of operator docs](https://crm.smsgatewayhub.com/knowledge-base/article/dlt-registration-charges-cost-breakdown-in-india)). **For your team this is a real blocker:** until LoadKaro is at least a registered proprietorship/company with PAN and (practically) GST, doing your own DLT entity registration will be difficult. **Rating: BAD** for an MVP that is not yet incorporated.

### 3. The exact consequence TODAY for Supabase + Twilio OTP to Indian numbers

This is the most important nuance, and it depends on **which Twilio route** Supabase Auth uses:

- **If sent over a registered Indian alphanumeric Sender ID (domestic/DLT route):** without entity + header + template registration, messages are **scrubbed and dropped** by operators. Twilio explicitly states you **cannot send** until DLT is complete on these routes. ([Twilio India SMS Guidelines](https://www.twilio.com/en-us/guidelines/in/sms))
- **If sent over an international long code / random ILDO short code (the default for most non-registered Twilio senders):** these **bypass DLT and the DND database** and **can still deliver OTPs today** ([Plivo](https://www.plivo.com/blog/dlt-registration/)). **This is almost certainly why your OTPs work right now.** However: this route is **higher-cost, lower-priority, less reliable** (delivery is best-effort and increasingly filtered), shows a random foreign numeric sender (not "LoadKaro"), and is the path TRAI/operators keep tightening. Twilio has even begun auto-prepending `[TWVerify]` to Verify OTPs to keep this traffic compliant. ([Twilio Oct 2025 regulatory update](https://www.twilio.com/en-us/blog/insights/2025-october-regulatory-updates))

**Bottom line / rating: OKAYISH-trending-BAD.** Not registered on DLT does **not** mean zero delivery today — international routing keeps OTPs flowing for an MVP. But it is unbranded, pricier per message, deliverability is degrading as scrubbing tightens, and at your ~6,000-user scale it becomes a reliability and cost liability. **QUESTION for the team:** confirm in the Twilio console whether your OTP traffic uses an international long code (current likely state) vs a registered sender ID — this single fact determines how urgent DLT is.

### Concrete step-by-step registration path

1. **Incorporate / register the business** (proprietorship minimum) and obtain **PAN + GST** — prerequisite, do this first.
2. **Pick one DLT portal** (Jio `trueconnect.jio.com` is commonly the smoothest; cost ~₹5,900/yr).
3. **Register as Principal Entity** → upload PAN, GST, business reg, signatory PAN/Aadhaar, LoA → obtain **Entity ID** (~1–3 days).
4. **Register the Header** `LDKARO` as **transactional/service** sender ID.
5. **Register the OTP Content Template** with `{#var#}` for the code, e.g. `{#var#} is your LoadKaro OTP. Do not share it.` (3–7 days approval).
6. **Link DLT credentials to Twilio**: submit Entity ID, Template IDs, header, and the DLT-portal screenshot via Twilio's India pre-registration form; Twilio provisions in **~10 business days**. ([Twilio India SMS Guidelines](https://www.twilio.com/en-us/guidelines/in/sms))
7. **Configure Supabase Auth** to use the now-registered Twilio sender for India.

**Sources:**
- [Twilio — India: SMS Guidelines](https://www.twilio.com/en-us/guidelines/in/sms)
- [Twilio — Documents Required to Register Alphanumeric Sender ID in India](https://help.twilio.com/articles/21162166457755-Documents-Required-and-Instructions-to-Register-Your-Alphanumeric-Sender-ID-in-India)
- [Twilio — Regulatory & Compliance, October 2025](https://www.twilio.com/en-us/blog/insights/2025-october-regulatory-updates)
- [Plivo — DLT Registration Process for SMS to India](https://www.plivo.com/blog/dlt-registration/)
- [SMSGatewayHub — DLT Registration Charges & Cost Breakdown](https://crm.smsgatewayhub.com/knowledge-base/article/dlt-registration-charges-cost-breakdown-in-india)
- [2Factor — TRAI Mandatory DLT Registration 2025 Guide](https://2factor.in/v3/dlt/trai-mandatory-dlt-registration/)
- [WebEngage — TRAI SMS DLT Regulations (India)](https://docs.webengage.com/docs/trai-sms-dlt-regulations-india)
- [Convertway — Sender ID (DLT) Registration Process](https://help.theconvertway.com/en/article/sender-id-registration-processdlt-for-sending-sms-to-india-noc9w3/)

Confirmed. The app uses Supabase's standard `auth.signInWithOtp({ phone })` and `auth.verifyOtp()` client SDK calls — these are provider-agnostic. Swapping the SMS backend is purely a Supabase dashboard/Edge Function change with zero app-code impact. I have everything I need.

## SMS Provider Options & Migration Path

*Researched 2026-06-30. Scope: India launch, Supabase phone-OTP auth currently routed through Twilio, NOT yet registered on TRAI DLT.*

### Key architectural finding (verified against code)

The mobile app authenticates exclusively through Supabase's standard client SDK calls — `supabase.auth.signInWithOtp({ phone })` (`LoadKaro/screens/SignInScreen.js:48`, `RegisterScreen.js:62`) and `supabase.auth.verifyOtp(...)` (`LoadKaro/screens/OTPScreen.js:38`). **The app never talks to Twilio directly.** Which SMS vendor actually delivers the OTP is decided entirely on the Supabase backend. This is the single most important fact for the migration question below: changing providers is a backend/config change, not an app change.

### (1) Provider landscape — who a pre-incorporation startup can realistically start with

The hard regulatory reality first: **TRAI DLT registration is mandatory for *anyone* sending SMS to Indian mobile numbers** — promotional, transactional, *and* OTP. Every "real" SMS provider (Twilio, AWS, Plivo, MSG91, Kaleyra, Gupshup) must attach a registered **Entity ID + Template ID** to each message; carriers (Jio/Airtel/Vi) hard-reject anything else. So the question is not "which provider avoids DLT" but "which provider lets us *get* DLT fast and cheaply, ideally pre-incorporation."

Good news for a fresh startup: **DLT registration does not require an incorporated company.** A Principal Entity may be an *individual or sole proprietor*, and a **personal PAN card suffices** as identity proof; GST is explicitly *not mandatory* for a proprietor (any one address proof — passport/voter ID/DL or a utility bill — works). MSG91's flow charges ~₹5,000 + GST one-time to SmartPing for entity approval. ([MSG91 required documents](https://msg91.com/help/dlt-registration-in-india/step-by-step-guide-to-implement-dlt-in-sms/required-documents---dlt-registration), [MSG91 DLT guide](https://msg91.com/help/dlt-registration-in-india)) — so the team's "pre-incorporation" status is *not* a blocker; one founder's PAN can do the DLT registration now.

| Provider | DLT still required? | Realistic for a pre-incorporation Indian startup? | Rating |
|---|---|---|---|
| **MSG91** (Indian) | Yes — but they *guide you through it*, accept sole-proprietor/personal-PAN, ₹5k entity fee. Cheapest INR OTP rates, native DLT tooling, best-documented Supabase hook integration. | **Best primary choice.** Onboard as a proprietor on a personal PAN. | **GOOD** |
| **Gupshup** (Indian) | Yes; supports transactional/OTP with approved sender + templates. Strong India delivery. | Good alternative to MSG91; similar DLT path. | GOOD |
| **Kaleyra** (Indian, now Tata) | Yes; DLT-compliant, custom sender IDs. More enterprise-oriented onboarding/minimums. | Workable but heavier sales process for a tiny MVP. | OKAYISH |
| **Plivo** | Yes — explicitly requires you to register org/headers/templates on DLT yourself before sending. ([Plivo DLT docs](https://www.plivo.com/docs/messaging/concepts/dlt-registration-process)) | You do the DLT work anyway; fine if you already use Plivo. | OKAYISH |
| **AWS SNS / End-User Messaging** | Yes — you register on VILPOWER, then **open a support case** to associate Entity ID + Template ID with your AWS account before sending via local routes. ([AWS India sender-ID docs](https://docs.aws.amazon.com/sms-voice/latest/userguide/registrations-sms-senderid-india.html)) | Extra AWS-side step + support ticket; clunky for an MVP. | OKAYISH |
| **Twilio (current)** | Yes — must register on DLT and pass Entity ID + Template ID per message; strict template allowlisting. ([Twilio India sender-ID](https://help.twilio.com/articles/21162166457755-Documents-Required-and-Instructions-to-Register-Your-Alphanumeric-Sender-ID-in-India)) | Works, but priced in USD (~$0.04+/SMS) and you *still* do all the DLT work — worst cost/effort ratio for India-only volume. | OKAYISH |
| **Fast2SMS** | Markets "bulk SMS without DLT," but that path is unbranded/unreliable; DLT-compliant route still needed for production OTP. ([Fast2SMS](https://www.fast2sms.com/), [Fast2SMS DLT](https://www.fast2sms.com/help/dlt-registration-process-for-sending-bulk-sms-in-india/)) | Cheap, but **not a Supabase-friendly OTP-grade provider**; treat as a stopgap only. | BAD for production |
| **Firebase Phone Auth** | **No carrier-level DLT for the developer** — Google sends OTP on its own infrastructure/sender. See bridge option below. | Fastest zero-DLT path, but it is a *separate auth system*, not a Supabase SMS provider. | See §3 |

**Bottom line for §1:** the recommended end-state is an **Indian provider (MSG91 first choice, Gupshup second)** behind the Supabase SMS hook, with DLT done now under a founder's personal PAN. None of the "real" providers let you skip DLT for production OTP.

### (2) Can Supabase use a CUSTOM SMS provider so you're NOT locked to Twilio? — YES

Supabase Auth ships built-in support for Twilio/MessageBird/Textlocal/Vonage, but the **"Send SMS" Auth Hook** lets you bypass all of them and point at your own HTTPS endpoint (typically a Supabase Edge Function). ([Supabase Send SMS Hook docs](https://supabase.com/docs/guides/auth/auth-hooks/send-sms-hook), [Supabase blog: phone send hooks](https://supabase.com/blog/third-party-auth-mfa-phone-send-hooks))

How it works, confirmed against the docs:
- Supabase **generates the OTP internally**, then POSTs a JSON payload to your hook: a full `user` object (`id`, `phone`, `email`, `app_metadata`, …) and an `sms` object — the key field being `sms.otp` (a 6-digit string, regex `^[0-9]{6}$`). Example: `"user": { …"phone": "+1333…"… }`, `"sms": { "otp": "561166" }`.
- Your Edge Function formats the message and calls *whatever provider you want* (MSG91/Gupshup/etc.), then returns **HTTP 200 with an empty body** to signal success.
- Enabling the hook **completely replaces** Supabase's built-in SMS sending.

**Why this means no app revamp on provider change:** because the app only calls `signInWithOtp` / `verifyOtp` (verified in code above), the *entire* provider choice lives in (a) the Supabase Auth Hook config and (b) the Edge Function body. Migrating Twilio → MSG91 → Gupshup later is editing one Edge Function and toggling a dashboard setting. The React Native bundle does not change, no resubmission to app stores, no client release. (Practical caveat surfaced repeatedly in the community: **once the Send-SMS hook is enabled you must NOT also keep Twilio selected as the built-in provider** or sends fail — the hook and the built-in provider are mutually exclusive.) ([MSG91+Supabase hook walkthrough](https://medium.com/@shreebhagwat94/implementing-custom-sms-authentication-in-supabase-using-sms-hook-and-msg91-366d13acc81c), [India-specific DEV guide](https://dev.to/acetrondi/using-supabase-sms-hook-to-send-custom-authentication-messages-in-india-4nj7))

Rating of "are we locked to Twilio?": **GOOD — not locked.** This is a clean, well-trodden path.

### (3) Temporary / bridge option to keep testing & launching while DLT is pending

Three viable bridges, in order of recommendation:

1. **Supabase test OTPs (zero cost, zero provider).** Supabase phone auth supports **pre-configured test phone numbers + fixed OTP codes** that never hit any SMS provider. Perfect for internal QA, demos, and the dev team's own logins while DLT is being approved. No DLT, no Twilio spend. Use immediately for the team and any pilot testers whose numbers you control.

2. **Firebase Phone Auth as a launch bridge (no DLT for you).** Firebase delivers +91 OTPs on Google's own infrastructure — **the developer does not register on DLT**. Free tier ~10K verifications/month, then ~$0.01/SMS (~₹0.63) for India. ([Firebase phone verification pricing](https://firebase.google.com/docs/phone-number-verification/pricing), [Firebase Auth cost guide](https://www.metacto.com/blogs/the-complete-guide-to-firebase-auth-costs-setup-integration-and-maintenance)) **Trade-off / QUESTION for the team:** Firebase is a *separate auth system*, not a Supabase SMS provider — adopting it means the client would call Firebase to verify the phone and you'd bridge that into a Supabase session, which *is* app-code work and partly defeats the "no revamp" benefit. Recommend this only if DLT approval stalls past launch and you must ship to real users immediately; otherwise prefer option 1 + getting DLT done.

3. **WhatsApp OTP via the same Send-SMS hook.** Supabase's hook explicitly supports "alternate messaging channels such as WhatsApp." WhatsApp Business OTP templates have their own Meta approval flow (not TRAI DLT) and can be wired through the exact same Edge Function. Useful as a parallel channel, but template approval + a BSP (e.g., Gupshup/MSG91 WhatsApp) is its own onboarding — more than a quick stopgap.

**Recommended bridge sequence:** use **Supabase test numbers now** for team/QA → start **DLT registration today under a founder's personal PAN via MSG91** (cheapest, best Supabase docs) → if real-user launch must happen before DLT clears, fall back to **Firebase** temporarily, accepting the small client-side bridge code.

### (4) Integration effort against the current Supabase + Twilio setup

- **Switching off Twilio, onto MSG91 (or any provider) via the hook:** Low effort, backend-only. Steps: write one Supabase **Edge Function** (Deno) that reads `phone` + `sms.otp` from the payload and calls the provider's OTP/SMS API with your DLT **Entity ID + Template ID**; deploy it; in Supabase Auth → Hooks enable **Send SMS Hook (HTTPS)** pointing at that function; **disable the built-in Twilio provider**. No mobile release. (~1 day of dev once DLT IDs are in hand, per the MSG91 walkthrough above.)
- **App code changes:** **None.** `signInWithOtp`/`verifyOtp` are unchanged (`OTPScreen.js`, `SignInScreen.js`, `RegisterScreen.js`).
- **The real long-pole is DLT approval, not engineering:** entity registration + sender header + the OTP **template** must be approved on the DLT portal before any production SMS will deliver. Template wording must match exactly what your Edge Function sends (carriers reject mismatches). Budget days-to-weeks for DLT approval; the code is the easy part.
- **One config gotcha to flag:** do not leave Twilio selected as the built-in provider once the Send-SMS hook is on — that combination is reported to fail.

**Net recommendation:** Keep the app exactly as-is. Treat this purely as a Supabase-side migration: test-numbers for QA now, DLT registration via MSG91 under a founder's PAN immediately, then a single Edge Function + hook flip to go live on an INR-priced Indian provider — with Firebase held in reserve as a no-DLT bridge only if launch can't wait for DLT.

**Sources:**
- [Supabase — Send SMS Hook](https://supabase.com/docs/guides/auth/auth-hooks/send-sms-hook) (docs, accessed 2026-06-30)
- [Supabase blog — third-party auth, MFA & phone send hooks](https://supabase.com/blog/third-party-auth-mfa-phone-send-hooks)
- [Implementing Custom SMS Auth in Supabase using SMS Hook + MSG91 — Medium](https://medium.com/@shreebhagwat94/implementing-custom-sms-authentication-in-supabase-using-sms-hook-and-msg91-366d13acc81c)
- [Using Supabase SMS-Hook for custom auth messages in India — DEV](https://dev.to/acetrondi/using-supabase-sms-hook-to-send-custom-authentication-messages-in-india-4nj7)
- [MSG91 — DLT registration in India](https://msg91.com/help/dlt-registration-in-india) and [required documents](https://msg91.com/help/dlt-registration-in-india/step-by-step-guide-to-implement-dlt-in-sms/required-documents---dlt-registration)
- [Plivo — DLT registration process](https://www.plivo.com/docs/messaging/concepts/dlt-registration-process)
- [AWS End User Messaging — India sender ID registration](https://docs.aws.amazon.com/sms-voice/latest/userguide/registrations-sms-senderid-india.html) and [Entity/Template ID](https://docs.aws.amazon.com/sms-voice/latest/userguide/registrations-sms-senderid-india-specify-ids.html)
- [Twilio — India alphanumeric sender ID / DLT](https://help.twilio.com/articles/21162166457755-Documents-Required-and-Instructions-to-Register-Your-Alphanumeric-Sender-ID-in-India)
- [Firebase — phone number verification pricing](https://firebase.google.com/docs/phone-number-verification/pricing) and [Firebase Auth cost guide](https://www.metacto.com/blogs/the-complete-guide-to-firebase-auth-costs-setup-integration-and-maintenance)
- [Fast2SMS](https://www.fast2sms.com/) and [Fast2SMS DLT process](https://www.fast2sms.com/help/dlt-registration-process-for-sending-bulk-sms-in-india/)
