import type { DashboardRouteName } from '../config/roleRoutes';

export type AuthStackParamList = {
  Landing: undefined;
  Register: { role?: 'shipper' | 'truck_owner' };
  SignIn: undefined;
  OTP: {
    mode: 'register' | 'signin';
    phone: string;
    name?: string;
    role?: 'shipper' | 'truck_owner';
  };
};

type DashboardScreens = {
  [K in DashboardRouteName]: { profile?: Record<string, unknown> } | undefined;
};

export type AppStackParamList = DashboardScreens & {
  AddTruckScreen: undefined;
  ManageTrucksScreen: undefined;
  EditTruckScreen: { truck: Record<string, unknown> };
  CreateAvailabilityScreen: undefined;
  ManageAvailabilitiesScreen: undefined;
  UploadLoadScreen: undefined;
  ViewLoadsScreen: { variant?: 'posted' | 'market' } | undefined;
  ViewAvailabilitiesScreen: undefined;
};
