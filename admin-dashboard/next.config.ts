import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

/** Directory containing this config (the Next.js app root). */
const appRoot = path.dirname(fileURLToPath(import.meta.url));
/** npm workspaces hoist deps to the repo root — Turbopack must resolve from there. */
const workspaceRoot = path.resolve(appRoot, "..");

/**
 * LoadKaro mobile uses EXPO_PUBLIC_SUPABASE_* in `.env`.
 * Next.js client code only inlines NEXT_PUBLIC_* — map Expo names so the same
 * variables work for both apps (or duplicate keys with NEXT_PUBLIC_ in .env.local).
 */
const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
  process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ||
  "";
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
  process.env.NEXT_PUBLIC_SUPABASE_KEY?.trim() ||
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
  process.env.EXPO_PUBLIC_SUPABASE_KEY?.trim() ||
  "";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: supabaseAnonKey,
  },
  /**
   * Monorepo: dependencies live in the parent `node_modules` (workspaces).
   * Point Turbopack at the workspace root so `@supabase/*` and other hoisted
   * packages resolve; the app directory remains `appRoot` via Next's project detection.
   */
  turbopack: {
    root: workspaceRoot,
  },
  /**
   * Allow HMR / dev resources when opening the app from another device on your LAN
   * (e.g. http://192.168.x.x:3000). Add your machine's LAN IP if the terminal warns
   * about blocked cross-origin requests to /_next/webpack-hmr.
   */
  allowedDevOrigins: ["192.168.1.4", "127.0.0.1", "localhost"],
};

export default nextConfig;
