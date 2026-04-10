import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from '../i18n/LanguageContext';

/**
 * @param {{
 *   value: 'shipper' | 'truck_owner' | null;
 *   onChange: (role: 'shipper' | 'truck_owner') => void;
 * }} props
 */
export function RoleToggle({ value, onChange }) {
  const { t } = useTranslation();
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{t('role')}</Text>
      <View style={styles.row}>
        <TouchableOpacity
          style={[styles.chip, value === 'shipper' && styles.chipActive]}
          onPress={() => onChange('shipper')}
          activeOpacity={0.85}
        >
          <Text style={[styles.chipText, value === 'shipper' && styles.chipTextActive]}>
            {t('shipper')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.chip, value === 'truck_owner' && styles.chipActive]}
          onPress={() => onChange('truck_owner')}
          activeOpacity={0.85}
        >
          <Text style={[styles.chipText, value === 'truck_owner' && styles.chipTextActive]}>
            {t('truck_owner')}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 20 },
  label: { fontSize: 16, fontWeight: '600', color: '#374151', marginBottom: 10 },
  row: { flexDirection: 'row', gap: 10 },
  chip: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d1d5db',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  chipActive: { backgroundColor: '#111827', borderColor: '#111827' },
  chipText: { fontSize: 15, fontWeight: '600', color: '#374151' },
  chipTextActive: { color: '#fff' },
});
