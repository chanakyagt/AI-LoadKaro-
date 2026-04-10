import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
} from 'react-native';
import { LabeledInput } from '../components/LabeledInput';
import { PrimaryButton } from '../components/PrimaryButton';
import { useTranslation } from '../i18n/LanguageContext';
import { supabase } from '../lib/supabase.js';
import { resolveDashboardRouteFromProfile } from '../config/roleRoutes';
import { syncUserAfterOtp } from '../services/syncUserAfterOtp.js';
import { useAuthStore } from '../store/authStore';
import { getAuthErrorMessage } from '../utils/authErrors';

export default function OTPScreen({ route }) {
  const { t } = useTranslation();
  const { mode, phone, name, role } = route.params;
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);

  const onVerify = async () => {
    const code = otp.trim();
    if (code.length !== 6 || !/^\d{6}$/.test(code)) {
      Alert.alert(t('error_title'), t('invalid_otp'));
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        phone,
        token: code,
        type: 'sms',
      });

      if (error) {
        Alert.alert(t('error_title'), getAuthErrorMessage(error));
        return;
      }

      if (!data.session) {
        Alert.alert(t('error_title'), t('generic_error'));
        return;
      }

      const {
        data: { user },
        error: getUserError,
      } = await supabase.auth.getUser();
      if (getUserError || !user) {
        Alert.alert(t('error_title'), t('generic_error'));
        return;
      }

      let profile;
      try {
        profile = await syncUserAfterOtp({
          mode,
          phoneE164: phone,
          name,
          role,
        });
      } catch (syncErr) {
        Alert.alert(
          t('error_title'),
          syncErr instanceof Error ? syncErr.message : t('generic_error')
        );
        return;
      }

      const dashboardRoute = resolveDashboardRouteFromProfile(profile);

      useAuthStore.setState({
        user: profile,
        dashboardRoute,
        session: data.session,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.meta}>
          {mode === 'register' ? t('register') : t('sign_in')}
        </Text>
        <Text style={styles.phone}>{phone}</Text>
        <LabeledInput
          label={t('otp_placeholder')}
          value={otp}
          onChangeText={(val) => setOtp(val.replace(/\D/g, '').slice(0, 6))}
          placeholder="000000"
          keyboardType="number-pad"
        />
        <PrimaryButton
          title={t('verify_otp')}
          onPress={onVerify}
          disabled={loading}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#fff' },
  scroll: { padding: 20, paddingBottom: 40 },
  meta: { fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 8 },
  phone: { fontSize: 14, color: '#6b7280', marginBottom: 16 },
});
