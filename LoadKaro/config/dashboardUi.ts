import type { DashboardRouteName } from './roleRoutes';

/**
 * UI copy for dashboards — swap / i18n later without touching screen layout.
 */
export const dashboardUi = {
  fieldLabels: {
    name: 'Name',
    phone: 'Phone',
    role: 'Role',
    verification: 'Verification',
  },
  errors: {
    title: 'Something went wrong',
    generic: 'Please try again.',
  },
  logoutLabel: 'Log out',
  screenTitles: {
    AdminDashboard: 'Admin',
    BrokerDashboard: 'Broker',
    ShipperDashboard: 'Shipper',
    TruckOwnerDashboard: 'Truck owner',
    ModeratorDashboard: 'Moderator',
  } satisfies Record<DashboardRouteName, string>,
} as const;
