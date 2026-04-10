import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

/**
 * @param {{
 *   page: number;
 *   totalPages: number;
 *   totalCount: number;
 *   onPrev: () => void;
 *   onNext: () => void;
 *   t: (key: string) => string;
 * }} props
 */
export function PaginationBar({
  page,
  totalPages,
  totalCount,
  onPrev,
  onNext,
  t,
}) {
  const atFirst = page <= 1;
  const atLast = page >= totalPages || totalCount === 0;

  return (
    <View style={styles.row}>
      <TouchableOpacity
        style={[styles.btn, atFirst && styles.btnDisabled]}
        onPress={onPrev}
        disabled={atFirst}
        activeOpacity={0.85}
      >
        <Text style={styles.btnText}>{t('previous')}</Text>
      </TouchableOpacity>
      <Text style={styles.pageText}>
        {t('page')} {page} / {totalPages}
      </Text>
      <TouchableOpacity
        style={[styles.btn, atLast && styles.btnDisabled]}
        onPress={onNext}
        disabled={atLast}
        activeOpacity={0.85}
      >
        <Text style={styles.btnText}>{t('next')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 4,
    gap: 8,
  },
  btn: {
    backgroundColor: '#111827',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    minWidth: 96,
    alignItems: 'center',
  },
  btnDisabled: {
    opacity: 0.45,
  },
  btnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  pageText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
    flex: 1,
    textAlign: 'center',
  },
});
