import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';
import type { DashboardRouteName } from '../config/roleRoutes';
import {
  DEFAULT_ROLE_KEY,
  ROLE_ROUTES,
  resolveDashboardRouteFromProfile,
} from '../config/roleRoutes';
import { supabase } from '../lib/supabase.js';
import { loadUserProfile } from '../services/loadUserProfile.js';
import type { PublicUser } from '../types/publicUser';

type AuthState = {
  session: Session | null;
  user: PublicUser | null;
  isReady: boolean;
  dashboardRoute: DashboardRouteName;
  setSession: (session: Session | null) => void;
  setUser: (user: PublicUser | null) => void;
  setDashboardRoute: (route: DashboardRouteName) => void;
  setReady: (ready: boolean) => void;
  fetchPublicUser: () => Promise<void>;
  initializeAuth: () => Promise<void>;
  signOut: () => Promise<void>;
};

const defaultDashboard = ROLE_ROUTES[DEFAULT_ROLE_KEY];

/** Lets OTP + syncUserAfterOtp finish before auth listener refetches (avoids wrong dashboard). */
const AUTH_LISTENER_FETCH_DELAY_MS = 400;

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  isReady: false,
  dashboardRoute: defaultDashboard,

  setSession: (session) => set({ session }),
  setUser: (user) => set({ user }),
  setDashboardRoute: (dashboardRoute) => set({ dashboardRoute }),
  setReady: (isReady) => set({ isReady }),

  fetchPublicUser: async () => {
    const session = get().session;
    if (!session?.user?.id) {
      set({ user: null });
      return;
    }
    try {
      const profile = await loadUserProfile();
      const dashboardRoute = resolveDashboardRouteFromProfile(
        profile as PublicUser
      );
      
      set({
        user: profile as PublicUser,
        dashboardRoute,
      });
    } catch {
      // Don't wipe an existing profile / dashboard on transient errors (race with OTP insert).
      const prev = get().user;
      if (!prev) {
        set({ user: null });
      }
    }
  },

  initializeAuth: async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    set({
      session,
      dashboardRoute: defaultDashboard,
    });

    if (session) {
      await get().fetchPublicUser();
    }

    set({ isReady: true });

    let fetchTimer: ReturnType<typeof setTimeout> | undefined;

    supabase.auth.onAuthStateChange((_event, nextSession) => {
      set({ session: nextSession });

      if (fetchTimer) {
        clearTimeout(fetchTimer);
        fetchTimer = undefined;
      }

      if (nextSession) {
        fetchTimer = setTimeout(() => {
          fetchTimer = undefined;
          void get().fetchPublicUser();
        }, AUTH_LISTENER_FETCH_DELAY_MS);
      } else {
        set({ user: null, dashboardRoute: defaultDashboard });
      }
    });
  },

  signOut: async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      
      throw error;
    }
    set({
      session: null,
      user: null,
      dashboardRoute: defaultDashboard,
    });
  },
}));
