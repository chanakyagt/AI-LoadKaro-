import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { dashboardUi } from '../config/dashboardUi';
import { ROLE_ROUTES } from '../config/roleRoutes';
import { strings } from '../constants/strings';
import { AVAILABILITY_LABELS } from '../config/availabilityLabels';
import { SHIPPER_LABELS } from '../config/shipperLabels';
import { LABELS as TRUCK_LABELS } from '../config/truckLabels';
import { LanguagePicker } from '../components/LanguagePicker';
import AddTruckScreen from '../screens/AddTruckScreen';
import CreateAvailabilityScreen from '../screens/CreateAvailabilityScreen';
import EditTruckScreen from '../screens/EditTruckScreen';
import LandingScreen from '../screens/LandingScreen';
import ManageAvailabilitiesScreen from '../screens/ManageAvailabilitiesScreen';
import ManageTrucksScreen from '../screens/ManageTrucksScreen';
import OTPScreen from '../screens/OTPScreen';
import RegisterScreen from '../screens/RegisterScreen';
import RoleDashboardScreen from '../screens/RoleDashboardScreen';
import SignInScreen from '../screens/SignInScreen';
import UploadLoadScreen from '../screens/UploadLoadScreen';
import ViewAvailabilitiesScreen from '../screens/ViewAvailabilitiesScreen';
import ProfileScreen from '../screens/ProfileScreen';
import ViewLoadsScreen from '../screens/ViewLoadsScreen';
import { useAuthStore } from '../store/authStore';

const AuthStack = createNativeStackNavigator();
const AppStack = createNativeStackNavigator();

const DASHBOARD_NAMES = Object.values(ROLE_ROUTES);

function AuthNavigator() {
  return (
    <AuthStack.Navigator
      screenOptions={{
        headerShown: true,
        animation: 'slide_from_right',
        headerRight: () => <LanguagePicker />,
      }}
    >
      <AuthStack.Screen
        name="Landing"
        component={LandingScreen}
        options={{ title: strings.app_name }}
      />
      <AuthStack.Screen
        name="Register"
        component={RegisterScreen}
        options={{ title: strings.create_account }}
      />
      <AuthStack.Screen
        name="SignIn"
        component={SignInScreen}
        options={{ title: strings.sign_in }}
      />
      <AuthStack.Screen
        name="OTP"
        component={OTPScreen}
        options={{ title: strings.verify_otp }}
      />
    </AuthStack.Navigator>
  );
}

function AppNavigator() {
  const dashboardRoute = useAuthStore((s) => s.dashboardRoute);

  return (
    <AppStack.Navigator
      key={dashboardRoute}
      initialRouteName={dashboardRoute}
      screenOptions={{
        headerShown: true,
        headerRight: () => <LanguagePicker />,
      }}
    >
      {DASHBOARD_NAMES.map((name) => (
        <AppStack.Screen
          key={name}
          name={name}
          component={RoleDashboardScreen}
          options={{ title: dashboardUi.screenTitles[name] }}
        />
      ))}
      <AppStack.Screen
        name="AddTruckScreen"
        component={AddTruckScreen}
        options={{ title: TRUCK_LABELS.add_truck }}
      />
      <AppStack.Screen
        name="ManageTrucksScreen"
        component={ManageTrucksScreen}
        options={{ title: TRUCK_LABELS.manage_trucks }}
      />
      <AppStack.Screen
        name="EditTruckScreen"
        component={EditTruckScreen}
        options={{ title: TRUCK_LABELS.edit_truck }}
      />
      <AppStack.Screen
        name="CreateAvailabilityScreen"
        component={CreateAvailabilityScreen}
        options={{ title: AVAILABILITY_LABELS.create_availability }}
      />
      <AppStack.Screen
        name="ManageAvailabilitiesScreen"
        component={ManageAvailabilitiesScreen}
        options={{ title: AVAILABILITY_LABELS.manage_availabilities }}
      />
      <AppStack.Screen
        name="UploadLoadScreen"
        component={UploadLoadScreen}
        options={{ title: SHIPPER_LABELS.upload_load }}
      />
      <AppStack.Screen
        name="ViewLoadsScreen"
        component={ViewLoadsScreen}
        options={{ title: SHIPPER_LABELS.view_previous_loads }}
      />
      <AppStack.Screen
        name="ViewAvailabilitiesScreen"
        component={ViewAvailabilitiesScreen}
        options={{ title: SHIPPER_LABELS.view_available_trucks }}
      />
      <AppStack.Screen
        name="ProfileScreen"
        component={ProfileScreen}
        options={{ title: 'My Profile' }}
      />
    </AppStack.Navigator>
  );
}

export function RootNavigator() {
  const session = useAuthStore((s) => s.session);
  const user = useAuthStore((s) => s.user);
  const isReady = useAuthStore((s) => s.isReady);

  useEffect(() => {
    void useAuthStore.getState().initializeAuth();
  }, []);

  if (!isReady) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#111827" />
      </View>
    );
  }

  // Session can flip to "signed in" before public.users is loaded (OTP verify fires
  // onAuthStateChange before syncUserAfterOtp finishes). Don't mount App stack with
  // default Shipper route until we have the profile + resolved dashboardRoute.
  if (session && !user) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#111827" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {session ? <AppNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
});
