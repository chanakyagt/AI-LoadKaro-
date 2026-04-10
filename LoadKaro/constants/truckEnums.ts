/** Align `trucks.category` with your DB enum; `permit_type` uses `PERMIT_TYPES` below. */
export const CATEGORY_OPTIONS = [
  'open',
  'container',
  'lcv',
  'mini_pickup',
  'trailer',
  'tipper',
  'tanker',
  'dumper',
  'bulker',
] as const;

export const CATEGORY_LABELS: Record<(typeof CATEGORY_OPTIONS)[number], string> = {
  open: 'Open Body',
  container: 'Container',
  lcv: 'LCV',
  mini_pickup: 'Mini Pickup',
  trailer: 'Trailer',
  tipper: 'Tipper',
  tanker: 'Tanker',
  dumper: 'Dumper',
  bulker: 'Bulker',
};

export const TRUCK_CATEGORIES = CATEGORY_OPTIONS;

export type TruckCategory = (typeof TRUCK_CATEGORIES)[number];

/** Matches Postgres `permit_type_enum` on `trucks.permit_type`. */
export const PERMIT_TYPES = [
  'national_permit',
  'state_permit',
  'all_india_permit',
  'goods_carriage',
  'contract_carriage',
] as const;

export type PermitType = (typeof PERMIT_TYPES)[number];

export const PERMIT_TYPE_LABELS: Record<PermitType, string> = {
  national_permit: 'National permit',
  state_permit: 'State permit',
  all_india_permit: 'All India permit',
  goods_carriage: 'Goods carriage',
  contract_carriage: 'Contract carriage',
};
