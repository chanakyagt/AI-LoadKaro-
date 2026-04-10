import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

const DOC_KEY_LABELS = {
  aadhar: 'Aadhaar card',
  pan: 'PAN card',
  driving_license: 'Driving License',
  other_kyc: 'Other KYC document',
  gst_certificate: 'GST Certificate',
  company_pan: 'Company PAN card',
  incorporation_certificate: 'Certificate of Incorporation',
  trade_license: 'Trade License / MSME',
  registration_certificate: 'Registration Certificate (RC)',
  insurance: 'Insurance',
  driver_license: "Driver's License",
  fitness_certificate: 'Fitness Certificate',
};

function docLabel(key) {
  return DOC_KEY_LABELS[key] ?? key.replace(/_/g, ' ');
}

function formatDate(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function formatBytes(b) {
  if (b == null) return '';
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Shows the latest uploaded verification documents for a user or truck.
 * No history is shown to the end user; history is admin-only.
 */
export function MyDocumentsModal({
  visible,
  onClose,
  entityType,
  entityId,
  onChangeDocuments,
}) {
  const [latestSubmission, setLatestSubmission] = useState(null);
  const [loading, setLoading] = useState(false);
  const [docs, setDocs] = useState([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [openingDoc, setOpeningDoc] = useState(null);

  const fetchLatest = useCallback(async () => {
    if (!isSupabaseConfigured || !entityId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('verification_submissions')
        .select('*')
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.warn('[MyDocumentsModal] submission:', error.message);
        setLatestSubmission(null);
        return;
      }
      setLatestSubmission(data);
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId]);

  useEffect(() => {
    if (visible) {
      setDocs([]);
      setLatestSubmission(null);
      void fetchLatest();
    }
  }, [visible, fetchLatest]);

  useEffect(() => {
    if (!latestSubmission?.id) return;
    setDocsLoading(true);
    (async () => {
      try {
        const { data, error } = await supabase
          .from('verification_documents')
          .select('*')
          .eq('submission_id', latestSubmission.id)
          .order('created_at', { ascending: true });

        if (error) {
          console.warn('[MyDocumentsModal] docs:', error.message);
          return;
        }
        setDocs(data ?? []);
      } finally {
        setDocsLoading(false);
      }
    })();
  }, [latestSubmission?.id]);

  const viewDocument = useCallback(async (doc) => {
    setOpeningDoc(doc.id);
    try {
      const { data, error } = await supabase.storage
        .from(doc.bucket)
        .createSignedUrl(doc.path, 300);

      if (error || !data?.signedUrl) {
        Alert.alert('Error', error?.message ?? 'Could not generate download link.');
        return;
      }
      await Linking.openURL(data.signedUrl);
    } catch (e) {
      Alert.alert('Error', e?.message ?? 'Could not open document.');
    } finally {
      setOpeningDoc(null);
    }
  }, []);

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
          <Text style={styles.title}>My documents</Text>

          <ScrollView
            style={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {loading ? (
              <ActivityIndicator
                size="large"
                color="#111827"
                style={{ marginVertical: 32 }}
              />
            ) : !latestSubmission ? (
              <Text style={styles.emptyText}>
                No documents submitted yet.
              </Text>
            ) : (
              <>
                <Text style={styles.submissionDate}>
                  Submitted {formatDate(latestSubmission.created_at)}
                  {'  ·  '}
                  <Text style={styles.statusChip}>
                    {latestSubmission.review_decision ?? latestSubmission.status}
                  </Text>
                </Text>

                {docsLoading ? (
                  <ActivityIndicator
                    size="small"
                    color="#6b7280"
                    style={{ marginVertical: 12 }}
                  />
                ) : docs.length === 0 ? (
                  <Text style={styles.emptyText}>
                    No documents in this submission.
                  </Text>
                ) : (
                  docs.map((doc) => (
                    <View key={doc.id} style={styles.docRow}>
                      <View style={styles.docInfo}>
                        <Text style={styles.docLabel}>
                          {docLabel(doc.doc_key)}
                        </Text>
                        <Text style={styles.docMeta} numberOfLines={1}>
                          {doc.original_filename ?? '—'}
                          {doc.size_bytes
                            ? ` · ${formatBytes(doc.size_bytes)}`
                            : ''}
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={styles.viewBtn}
                        onPress={() => void viewDocument(doc)}
                        disabled={openingDoc === doc.id}
                        activeOpacity={0.85}
                      >
                        <Text style={styles.viewBtnText}>
                          {openingDoc === doc.id ? '…' : 'View'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ))
                )}

                {onChangeDocuments && (
                  <TouchableOpacity
                    style={styles.changeBtn}
                    onPress={() => {
                      onClose();
                      setTimeout(() => onChangeDocuments(), 350);
                    }}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.changeBtnText}>
                      Change documents
                    </Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          </ScrollView>

          <TouchableOpacity
            style={styles.closeLink}
            onPress={onClose}
            activeOpacity={0.7}
          >
            <Text style={styles.closeLinkText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
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
    maxHeight: '90%',
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
    marginBottom: 16,
  },
  scroll: {
    maxHeight: 500,
  },
  submissionDate: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 12,
  },
  statusChip: {
    fontWeight: '600',
    color: '#374151',
  },
  docRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  docInfo: {
    flex: 1,
    marginRight: 12,
  },
  docLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  docMeta: {
    fontSize: 12,
    color: '#9ca3af',
  },
  viewBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#111827',
    backgroundColor: '#fff',
  },
  viewBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
  },
  changeBtn: {
    marginTop: 16,
    marginBottom: 8,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#111827',
    alignItems: 'center',
  },
  changeBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  emptyText: {
    textAlign: 'center',
    color: '#9ca3af',
    fontSize: 14,
    marginVertical: 20,
    fontStyle: 'italic',
  },
  closeLink: {
    marginTop: 14,
    alignItems: 'center',
  },
  closeLinkText: {
    fontSize: 15,
    color: '#6b7280',
    fontWeight: '500',
  },
});
