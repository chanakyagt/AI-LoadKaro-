export const FIELD_CONFIG = {
  category: { required: true },
  variant_id: { required: true },
  capacity_tons: { required: true },
  permit_type: { required: false },
  axle_count: { required: false },
  wheel_count: { required: false },
  gps_available: { required: false },
} as const;

export type TruckFieldKey = keyof typeof FIELD_CONFIG;
