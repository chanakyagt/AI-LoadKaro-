# LoadKaro

## Supabase

1. Open `.env` in the project root and paste your values from **Supabase Dashboard → Project Settings → API**:
   - `EXPO_PUBLIC_SUPABASE_URL` — Project URL  
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY` — `anon` `public` key (alias: `EXPO_PUBLIC_SUPABASE_KEY` is also read by `lib/supabase.js`)

2. Restart the dev server after changing `.env` (`Ctrl+C`, then `npm start`).

3. Use the client anywhere:

```ts
import { supabase, isSupabaseConfigured } from './lib/supabase.js';
```

`.env` is gitignored; use `.env.example` as a template.

## Auth (phone OTP only)

The app uses **`signInWithOtp`** and **`verifyOtp`** only. Registration UI is **name**, **phone** (E.164 `+91…`), and **role** — then SMS OTP.

**Supabase Dashboard:** Authentication → Providers — enable **Phone**; disable any providers you do not use so only phone OTP runs.

- **Session**: Restored on launch via Supabase + AsyncStorage.
- **Profile**: `services/loadUserProfile.js` loads `public.users` by `auth.users.id`.
- **Role → dashboard**: `config/roleRoutes.ts` maps `public.users.role` to stack screen names (`AdminDashboard`, `BrokerDashboard`, …). `resolveDashboardRoute(role)` picks the screen (no per-role `if` chains in UI).
- **Dashboards**: One component `screens/RoleDashboardScreen.js` for all routes; labels in `config/dashboardUi.ts`.
- **Register**: `signInWithOtp` → OTP → `syncUserAfterOtp` (insert if new) → `loadUserProfile` → store sets `dashboardRoute` from role.
- **Stacks**: `navigation/RootNavigator.js` — `AuthStack` (Landing → Register / SignIn → OTP) and `AppStack` (role dashboards only).
