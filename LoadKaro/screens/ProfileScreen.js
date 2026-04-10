import React, { useCallback, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LabeledInput } from '../components/LabeledInput';
import { PrimaryButton } from '../components/PrimaryButton';
import { VerificationBadge } from '../components/VerificationBadge';
import { useTranslation } from '../i18n/LanguageContext';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';

export default function ProfileScreen() {
  const { t } = useTranslation();
  const profile = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const [name, setName] = useState(profile?.name ?? '');
  const [saving, setSaving] = useState(false);

  const onSave = useCallback(async () => {
    if (!profile?.id || !isSupabaseConfigured) return;
    const trimmed = name.trim();
    if (!trimmed) {
      Alert.alert(t('required'), t('name_required'));
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({ name: trimmed })
        .eq('id', profile.id);
      if (error) {
        Alert.alert(t('error'), error.message);
        return;
      }
      setUser({ ...profile, name: trimmed });
      Alert.alert(t('success'), t('profile_saved'));
    } finally {
      setSaving(false);
    }
  }, [name, profile, setUser, t]);

  if (!profile) {
    return (
      <View style={styles.centered}>
        <Text style={styles.muted}>{t('profile_not_available')}</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
      <Text style={styles.heading}>{t('my_profile_title')}</Text>

      <View style={styles.infoCard}>
        <View style={styles.infoRow}>
          <Text style={styles.label}>{t('profile_phone')}</Text>
          <Text style={styles.value}>{profile.phone ?? t('dash')}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.label}>{t('profile_role')}</Text>
          <Text style={styles.value}>{profile.role ?? t('dash')}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.label}>{t('profile_verification')}</Text>
          <VerificationBadge status={profile.verification_status} compact />
        </View>
      </View>

      <View style={styles.editSection}>
        <LabeledInput
          label={t('name')}
          value={name}
          onChangeText={setName}
          placeholder={t('your_full_name')}
        />
        <PrimaryButton
          title={saving ? t('saving') : t('save_changes')}
          onPress={() => void onSave()}
          disabled={saving}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, padding: 20, paddingBottom: 40, backgroundColor: '#fff' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  muted: { color: '#9ca3af', fontSize: 16 },
  heading: { fontSize: 22, fontWeight: '700', color: '#111827', marginBottom: 20 },
  infoCard: { backgroundColor: '#f9fafb', borderRadius: 12, padding: 16, marginBottom: 24, borderWidth: 1, borderColor: '#e5e7eb' },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  label: { fontSize: 15, fontWeight: '600', color: '#6b7280' },
  value: { fontSize: 15, fontWeight: '600', color: '#111827' },
  editSection: { gap: 16 },
});
