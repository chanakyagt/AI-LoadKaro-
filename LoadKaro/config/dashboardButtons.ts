import type { RoleKey } from './roleRoutes';
import { normalizeRoleKey } from './roleRoutes';

/**
 * Action button ids per role — add new roles / keys here only.
 */
export const BUTTON_CONFIG: Record<RoleKey, readonly string[]> = {
  admin: [],
  broker: [],
  shipper: [
    'upload_loads',
    'view_previous_loads',
    'view_availabilities',
    'profile',
  ],
  truck_owner: [
    'find_return_load',
    'add_trucks',
    'manage_trucks',
    'manage_availabilities',
    'view_loads',
    'profile',
  ],
  moderator: [],
} as const;

/**
 * Display labels for each action button id (i18n / copy lives here).
 */
export const LABELS: Record<string, string> = {
  upload_loads: 'Upload Loads',
  view_previous_loads: 'View Previous Loads',
  view_availabilities: 'View Availabilities',
  add_trucks: 'Add Trucks',
  add_availabilities: 'Add Availabilities',
  manage_availabilities: 'Manage Availabilities',
  manage_trucks: 'Manage Trucks',
  view_loads: 'View Loads',
  find_return_load: 'Find Return Load',
  profile: 'My Profile',
};

/** User block copy — no raw strings in screen components. */
export const DASHBOARD_USER_COPY = {
  hi: 'Hi',
  phone: 'Phone:',
  role: 'Role:',
  status: 'Status:',
} as const;

/**
 * Returns action button keys for the given profile role (normalized).
 */
export function getDashboardButtonKeys(
  role: string | null | undefined
): string[] {
  const key = normalizeRoleKey(role) as RoleKey;
  if (!key || !(key in BUTTON_CONFIG)) return [];
  return [...BUTTON_CONFIG[key]];
}
