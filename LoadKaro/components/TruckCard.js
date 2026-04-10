import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from '../i18n/LanguageContext';
import { VerificationBadge } from './VerificationBadge';

export function TruckCard({
  truck,
  variantDisplayName,
  onEditPress,
  onDeletePress,
  isEditDisabled = false,
  onVerifyPress,
  onViewDocsPress,
}) {
  const { t } = useTranslation();
  const vstatus = String(truck?.verification_status ?? '').toLowerCase();
  const isUnverified = vstatus === 'unverified';
  const showViewDocs = vstatus === 'pending' || vstatus === 'rejected';

  return (
    <View style={styles.card}>
      <Text style={styles.line}>
        {t('variant_name')}: {String(variantDisplayName ?? t('dash'))}
      </Text>
      <Text style={styles.line}>
        {t('category')}: {String(truck.category ?? t('dash'))}
      </Text>
      <Text style={styles.line}>
        {t('capacity_tons')}: {String(truck.capacity_tons ?? t('dash'))}
      </Text>
      <View style={styles.statusRow}>
        <Text style={styles.statusLabel}>{t('verification_status')}:</Text>
        <VerificationBadge status={truck.verification_status} compact />
        {isUnverified && onVerifyPress ? (
          <TouchableOpacity style={styles.verifyBtn} onPress={onVerifyPress} activeOpacity={0.85}>
            <Text style={styles.verifyBtnText}>{t('verify')}</Text>
          </TouchableOpacity>
        ) : null}
        {showViewDocs && onViewDocsPress ? (
          <TouchableOpacity style={styles.verifyBtn} onPress={onViewDocsPress} activeOpacity={0.85}>
            <Text style={styles.verifyBtnText}>{t('view_documents')}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={[styles.actionBtn, isEditDisabled && styles.actionBtnDisabled]}
          onPress={onEditPress}
          activeOpacity={0.85}
        >
          <Text style={styles.actionText}>{t('edit_truck')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, styles.deleteBtn]}
          onPress={onDeletePress}
          activeOpacity={0.85}
        >
          <Text style={styles.actionText}>{t('delete_error').split(' ')[0] || 'Delete'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#e5e7eb' },
  line: { fontSize: 15, color: '#374151', marginBottom: 4 },
  statusRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  verifyBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#6b7280', backgroundColor: '#fff' },
  verifyBtnText: { fontSize: 13, fontWeight: '600', color: '#374151' },
  statusLabel: { fontSize: 15, fontWeight: '600', color: '#374151' },
  actionsRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  actionBtn: { flex: 1, backgroundColor: '#111827', borderRadius: 8, paddingVertical: 10, alignItems: 'center', justifyContent: 'center' },
  actionBtnDisabled: { opacity: 0.5 },
  deleteBtn: { backgroundColor: '#b91c1c' },
  actionText: { color: '#ffffff', fontSize: 14, fontWeight: '600' },
});
