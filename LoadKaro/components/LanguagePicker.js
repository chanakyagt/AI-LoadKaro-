import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LANGUAGE_OPTIONS, useTranslation } from '../i18n/LanguageContext';

const CODE_LABELS = { en: 'EN', hi: 'हि', te: 'తె', kn: 'ಕ' };

export function LanguagePicker() {
  const { language, setLanguage, t } = useTranslation();
  const [open, setOpen] = useState(false);

  const shortLabel = CODE_LABELS[language] ?? language.toUpperCase();

  return (
    <>
      <TouchableOpacity
        style={styles.trigger}
        onPress={() => setOpen(true)}
        activeOpacity={0.7}
      >
        <Text style={styles.triggerText}>{shortLabel}</Text>
        <Text style={styles.arrow}>▾</Text>
      </TouchableOpacity>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <View style={styles.backdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setOpen(false)}
          />
          <View style={styles.sheet}>
            <Text style={styles.title}>{t('change_language')}</Text>
            {LANGUAGE_OPTIONS.map((lang) => {
              const isActive = lang.code === language;
              return (
                <TouchableOpacity
                  key={lang.code}
                  style={[styles.option, isActive && styles.optionActive]}
                  onPress={() => {
                    void setLanguage(lang.code);
                    setOpen(false);
                  }}
                  activeOpacity={0.85}
                >
                  <View style={styles.optionRow}>
                    <Text
                      style={[
                        styles.optionNative,
                        isActive && styles.optionTextActive,
                      ]}
                    >
                      {lang.nativeLabel}
                    </Text>
                    <Text
                      style={[
                        styles.optionLabel,
                        isActive && styles.optionLabelActive,
                      ]}
                    >
                      {lang.label}
                    </Text>
                  </View>
                  {isActive && <Text style={styles.check}>✓</Text>}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    marginRight: 8,
  },
  triggerText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  arrow: {
    fontSize: 10,
    color: '#6b7280',
    marginLeft: 3,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sheet: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    width: 280,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
    textAlign: 'center',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  optionActive: {
    backgroundColor: '#111827',
    borderColor: '#111827',
  },
  optionRow: {
    flex: 1,
  },
  optionNative: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
  },
  optionLabel: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 2,
  },
  optionTextActive: {
    color: '#ffffff',
  },
  optionLabelActive: {
    color: 'rgba(255,255,255,0.6)',
  },
  check: {
    fontSize: 16,
    color: '#ffffff',
    fontWeight: '700',
  },
});
