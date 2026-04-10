import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

/**
 * @param {{ status: string | null | undefined; compact?: boolean }} props
 */
export function VerificationBadge({ status, compact = false }) {
  const s = String(status ?? '').toLowerCase();
  let style = styles.gray;
  let textStyle = styles.badgeText;
  if (s === 'verified') style = styles.green;
  else if (s === 'pending') style = styles.yellow;
  else if (s === 'rejected') {
    style = styles.red;
    textStyle = styles.badgeTextLight;
  }

  return (
    <View style={[styles.badge, style, compact && styles.compact]}>
      <Text style={textStyle}>{String(status ?? '—')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 8,
  },
  compact: {
    marginTop: 0,
  },
  green: { backgroundColor: '#d1fae5' },
  yellow: { backgroundColor: '#fef3c7' },
  red: { backgroundColor: '#fecaca' },
  gray: { backgroundColor: '#f3f4f6' },
  badgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
  },
  badgeTextLight: {
    fontSize: 13,
    fontWeight: '600',
    color: '#991b1b',
  },
});
