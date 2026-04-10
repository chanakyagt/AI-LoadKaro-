import React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';

/**
 * @param {{ title: string; onPress: () => void; disabled?: boolean; variant?: 'primary' | 'danger' }} props
 */
export function PrimaryButton({ title, onPress, disabled, variant = 'primary' }) {
  const danger = variant === 'danger';
  return (
    <TouchableOpacity
      style={[
        styles.btn,
        danger && styles.btnDanger,
        disabled && styles.btnDisabled,
      ]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.85}
    >
      <Text style={styles.btnText}>{title}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    backgroundColor: '#111827',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDanger: {
    backgroundColor: '#b91c1c',
  },
  btnDisabled: {
    opacity: 0.5,
  },
  btnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});
