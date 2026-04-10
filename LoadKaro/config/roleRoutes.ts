/**
 * Maps normalized `public.users.role` values to App stack screen names.
 */
export const ROLE_ROUTES = {
  admin: 'AdminDashboard',
  broker: 'BrokerDashboard',
  shipper: 'ShipperDashboard',
  truck_owner: 'TruckOwnerDashboard',
  moderator: 'ModeratorDashboard',
} as const;

export type RoleKey = keyof typeof ROLE_ROUTES;

export type DashboardRouteName = (typeof ROLE_ROUTES)[RoleKey];

export const DEFAULT_ROLE_KEY: RoleKey = 'shipper';

/**
 * Common DB / UI variants → canonical ROLE_ROUTES keys
 * (e.g. "Truck Owner", "truck-owner", "TruckOwner" → "truck_owner")
 */
const ROLE_ALIASES: Record<string, RoleKey> = {
  truckowner: 'truck_owner',
  truckowners: 'truck_owner',
};

/**
 * Normalize role string for lookup into ROLE_ROUTES.
 */
export function normalizeRoleKey(role: string | null | undefined): string {
  if (role == null) return '';
  let s = String(role).trim().toLowerCase();
  if (!s) return '';

  // "truck owner", "truck-owner", multiple spaces → "truck_owner"
  s = s.replace(/[\s-]+/g, '_').replace(/_+/g, '_');

  // camelCase without separators: TruckOwner → truckowner (after lower)
  if (s in ROLE_ALIASES) {
    return ROLE_ALIASES[s];
  }

  return s;
}

export function resolveDashboardRoute(
  role: string | null | undefined
): DashboardRouteName {
  const key = normalizeRoleKey(role);

  if (key && key in ROLE_ROUTES) {
    return ROLE_ROUTES[key as RoleKey];
  }

  return ROLE_ROUTES[DEFAULT_ROLE_KEY];
}

export function resolveDashboardRouteFromProfile(profile: {
  role?: string | null;
  [key: string]: unknown;
}): DashboardRouteName {
  return resolveDashboardRoute(profile?.role as string);
}
