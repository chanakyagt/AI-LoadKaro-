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
import { getAuthErrorMessage } from '../utils/authErrors';
import { formatPhoneOtpIndia } from '../utils/phone';

export default function SignInScreen({ navigation }) {
  const { t } = useTranslation();
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  const onSendOtp = async () => {
    const parsed = formatPhoneOtpIndia(phone);
    if (!parsed.ok) {
      Alert.alert(t('error_title'), t('phone_invalid'));
      return;
    }
    const { formattedPhone } = parsed;
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({ phone: formattedPhone });
      if (error) {
        Alert.alert(t('error_title'), getAuthErrorMessage(error));
        return;
      }
      navigation.navigate('OTP', { mode: 'signin', phone: formattedPhone });
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
        <Text style={styles.hint}>{t('sign_in')}</Text>
        <LabeledInput
          label={t('phone')}
          value={phone}
          onChangeText={setPhone}
          placeholder={t('phone_placeholder')}
          keyboardType="phone-pad"
        />
        <PrimaryButton title={t('send_otp')} onPress={onSendOtp} disabled={loading} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#fff' },
  scroll: { padding: 20, paddingBottom: 40 },
  hint: { fontSize: 16, fontWeight: '600', marginBottom: 16, color: '#111827' },
});
