/**
 * Canonical enum option lists for the admin dashboard (align with Postgres enums / product).
 * Update here when schema changes.
 */

export const USER_ROLE_OPTIONS = [
  "admin",
  "moderator",
  "shipper",
  "truck_owner",
  "broker",
] as const;

/** `public.users.verification_status` */
export const USER_VERIFICATION_STATUS_OPTIONS = [
  "pending",
  "verified",
  "rejected",
  "unverified",
] as const;

/** Truck / load category labels (shared across loads + trucks). */
export const TRUCK_CATEGORY_OPTIONS = [
  "open",
  "container",
  "lcv",
  "mini_pickup",
  "trailer",
  "tipper",
  "tanker",
  "dumper",
  "bulker",
] as const;

/** `loads.payment_type` */
export const LOAD_PAYMENT_TYPE_OPTIONS = [
  "advance",
  "partial_advance",
  "after_delivery",
] as const;

/** `loads.status` */
export const LOAD_STATUS_OPTIONS = [
  "open",
  "matched",
  "cancelled",
  "closed",
] as const;

/** `trucks.permit_type` */
export const TRUCK_PERMIT_TYPE_OPTIONS = [
  "national_permit",
  "state_permit",
  "all_india_permit",
  "goods_carriage",
  "contract_carriage",
] as const;

/** `trucks.verification_status` */
export const TRUCK_VERIFICATION_STATUS_OPTIONS = [
  "unverified",
  "pending",
  "verified",
  "rejected",
] as const;

/** `availabilities.status` */
export const AVAILABILITY_STATUS_OPTIONS = [
  "available",
  "closed",
  "cancelled",
] as const;
