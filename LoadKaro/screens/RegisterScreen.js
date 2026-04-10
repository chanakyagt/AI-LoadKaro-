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
import { RoleToggle } from '../components/RoleToggle';
import { useTranslation } from '../i18n/LanguageContext';
import { supabase } from '../lib/supabase.js';
import { getAuthErrorMessage } from '../utils/authErrors';
import { formatPhoneOtpIndia } from '../utils/phone';

export default function RegisterScreen({ navigation, route }) {
  const { t } = useTranslation();
  const initialRole = route.params?.role ?? null;
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState(initialRole);
  const [loading, setLoading] = useState(false);

  const onRegister = async () => {
    if (!role) {
      Alert.alert(t('error_title'), t('select_role'));
      return;
    }
    const parsed = formatPhoneOtpIndia(phone);
    if (!parsed.ok) {
      Alert.alert(t('error_title'), t('phone_invalid'));
      return;
    }
    const { formattedPhone } = parsed;
    const nameTrim = name.trim();

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        phone: formattedPhone,
        options: { data: { name: nameTrim, role, phone: formattedPhone } },
      });
      if (error) {
        Alert.alert(t('error_title'), getAuthErrorMessage(error));
        return;
      }
      navigation.navigate('OTP', {
        mode: 'register',
        phone: formattedPhone,
        name: nameTrim,
        role,
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
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.hint}>{t('create_account')}</Text>
        <LabeledInput
          label={t('name')}
          value={name}
          onChangeText={setName}
          placeholder={t('name')}
        />
        <LabeledInput
          label={t('phone')}
          value={phone}
          onChangeText={setPhone}
          placeholder={t('phone_placeholder')}
          keyboardType="phone-pad"
        />
        <RoleToggle value={role} onChange={setRole} />
        <PrimaryButton
          title={t('send_otp')}
          onPress={onRegister}
          disabled={loading}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#fff' },
  scroll: { padding: 20, paddingBottom: 40 },
  hint: { fontSize: 16, fontWeight: '600', marginBottom: 16, color: '#111827' },
});
