import * as DocumentPicker from 'expo-document-picker';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  TRUCK_VERIFICATION_COPY,
  TRUCK_VERIFICATION_FIELDS,
  USER_KYC_INDIVIDUAL_COPY,
  USER_KYC_INDIVIDUAL_FIELDS,
  USER_KYC_ORG_COPY,
  USER_KYC_ORG_FIELDS,
  VERIFICATION_UI,
} from '../config/verificationUi';

/**
 * @typedef {{ name: string; uri: string }} PickedDoc
 * @typedef {Record<string, PickedDoc | null>} VerificationFiles
 */

const ALLOWED_EXTS = new Set(['jpg', 'jpeg', 'png', 'webp', 'pdf']);

function getExtension(name) {
  return (name || '').split('.').pop()?.toLowerCase() ?? '';
}

function emptyFilesFromFields(fields) {
  return fields.reduce((acc, { key }) => {
    acc[key] = null;
    return acc;
  }, {});
}

/**
 * @param {{
 *   visible: boolean;
 *   onClose: () => void;
 *   onSubmit: (files: VerificationFiles) => void;
 *   submitDisabled?: boolean;
 *   variant?: 'truck' | 'user';
 * }} props
 */
export function VerificationModal({
  visible,
  onClose,
  onSubmit,
  submitDisabled = false,
  variant = 'truck',
}) {
  const [shipperType, setShipperType] = useState(null);

  const showShipperChoice = variant === 'user' && !shipperType;

  const { fields, copy } = useMemo(() => {
    if (variant === 'truck') {
      return {
        fields: [...TRUCK_VERIFICATION_FIELDS],
        copy: TRUCK_VERIFICATION_COPY,
      };
    }
    if (shipperType === 'organization') {
      return {
        fields: [...USER_KYC_ORG_FIELDS],
        copy: USER_KYC_ORG_COPY,
      };
    }
    return {
      fields: [...USER_KYC_INDIVIDUAL_FIELDS],
      copy: USER_KYC_INDIVIDUAL_COPY,
    };
  }, [variant, shipperType]);

  const [selectedFiles, setSelectedFiles] = useState(() =>
    emptyFilesFromFields(fields)
  );

  useEffect(() => {
    if (visible) {
      setShipperType(null);
      setSelectedFiles(emptyFilesFromFields(fields));
    }
  }, [visible]);

  useEffect(() => {
    if (shipperType) {
      setSelectedFiles(emptyFilesFromFields(fields));
    }
  }, [shipperType, fields]);

  const pickDocument = useCallback(async (key) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const asset = result.assets?.[0];
      if (!asset?.uri) return;

      const ext = getExtension(asset.name);
      if (!ALLOWED_EXTS.has(ext)) {
        Alert.alert(
          'Unsupported file format',
          `"${asset.name}" is not allowed.\n\nPlease upload a JPG, PNG, WebP, or PDF file.`
        );
        return;
      }
      setSelectedFiles((prev) => ({
        ...prev,
        [key]: { name: asset.name ?? 'Document', uri: asset.uri },
      }));
    } catch (e) {
      console.warn('[VerificationModal] pick failed', e);
    }
  }, []);

  const handleSubmit = useCallback(() => {
    onSubmit(selectedFiles);
  }, [onSubmit, selectedFiles]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />

          {showShipperChoice ? (
            <>
              <Text style={styles.title}>Verification type</Text>
              <Text style={styles.subtitle}>
                Are you registering as an individual or an organization?
              </Text>

              <TouchableOpacity
                style={styles.typeBtn}
                onPress={() => setShipperType('individual')}
                activeOpacity={0.85}
              >
                <Text style={styles.typeBtnTitle}>Individual</Text>
                <Text style={styles.typeBtnDesc}>
                  Aadhaar, PAN, Driving License, or other personal ID
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.typeBtn}
                onPress={() => setShipperType('organization')}
                activeOpacity={0.85}
              >
                <Text style={styles.typeBtnTitle}>Organization</Text>
                <Text style={styles.typeBtnDesc}>
                  GST Certificate, Company PAN, Incorporation docs
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cancelLink}
                onPress={onClose}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelLinkText}>Cancel</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.title}>{copy.modalTitle}</Text>
              <Text style={styles.subtitle}>{copy.modalSubtitle}</Text>

              {variant === 'user' && shipperType && (
                <TouchableOpacity
                  style={styles.backLink}
                  onPress={() => setShipperType(null)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.backLinkText}>
                    ← Change verification type
                  </Text>
                </TouchableOpacity>
              )}

              <ScrollView
                style={styles.scroll}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {fields.map(({ key, label }) => (
                  <UploadRow
                    key={key}
                    label={label}
                    file={selectedFiles[key]}
                    onUpload={() => void pickDocument(key)}
                  />
                ))}
              </ScrollView>

              <TouchableOpacity
                style={[
                  styles.submitBtn,
                  submitDisabled && styles.submitBtnDisabled,
                ]}
                onPress={handleSubmit}
                disabled={submitDisabled}
                activeOpacity={0.85}
              >
                <Text style={styles.submitBtnText}>
                  {VERIFICATION_UI.submit}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cancelLink}
                onPress={onClose}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelLinkText}>Cancel</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

function UploadRow({ label, file, onUpload }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <TouchableOpacity
        style={styles.uploadBtn}
        onPress={onUpload}
        activeOpacity={0.85}
      >
        <Text style={styles.uploadBtnText}>{VERIFICATION_UI.uploadFile}</Text>
      </TouchableOpacity>
      {file?.name ? (
        <Text style={styles.fileName} numberOfLines={2}>
          {file.name}
        </Text>
      ) : (
        <Text style={styles.filePlaceholder}>No file selected</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 28,
    maxHeight: '88%',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#e5e7eb',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    color: '#6b7280',
    marginBottom: 18,
    lineHeight: 22,
  },
  typeBtn: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    backgroundColor: '#f9fafb',
  },
  typeBtnTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  typeBtnDesc: {
    fontSize: 13,
    color: '#6b7280',
    lineHeight: 18,
  },
  backLink: {
    marginBottom: 12,
  },
  backLinkText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
  },
  scroll: {
    maxHeight: 340,
  },
  row: {
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 10,
  },
  uploadBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#6b7280',
    backgroundColor: '#fff',
  },
  uploadBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  fileName: {
    marginTop: 8,
    fontSize: 13,
    color: '#111827',
  },
  filePlaceholder: {
    marginTop: 8,
    fontSize: 13,
    color: '#9ca3af',
    fontStyle: 'italic',
  },
  submitBtn: {
    marginTop: 8,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#111827',
    alignItems: 'center',
  },
  submitBtnDisabled: {
    opacity: 0.45,
  },
  submitBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelLink: {
    marginTop: 14,
    alignItems: 'center',
  },
  cancelLinkText: {
    fontSize: 15,
    color: '#6b7280',
    fontWeight: '500',
  },
});
