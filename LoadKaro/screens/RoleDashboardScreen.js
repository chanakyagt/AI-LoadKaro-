import { useNavigation } from '@react-navigation/native';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { MyDocumentsModal } from '../components/MyDocumentsModal';
import { PrimaryButton } from '../components/PrimaryButton';
import { VerificationBadge } from '../components/VerificationBadge';
import { VerificationModal } from '../components/VerificationModal';
import {
  getDashboardButtonKeys,
} from '../config/dashboardButtons';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { submitVerificationDocs } from '../lib/verificationUpload';
import { useTranslation } from '../i18n/LanguageContext';
import { useAuthStore } from '../store/authStore';

/** Shared dashboard for all ROLE_ROUTES screens. Profile from store or route.params. */
export default function RoleDashboardScreen({ route }) {
  const navigation = useNavigation();
  const { t } = useTranslation();
  const profileFromStore = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const setUser = useAuthStore((s) => s.setUser);
  const [loggingOut, setLoggingOut] = useState(false);
  const [localVerification, setLocalVerification] = useState(null);
  const [verifyModalVisible, setVerifyModalVisible] = useState(false);
  const [docsModalVisible, setDocsModalVisible] = useState(false);

  const profile = route.params?.profile ?? profileFromStore;

  useEffect(() => {
    setLocalVerification(null);
  }, [profile?.id]);

  const name = profile?.name ?? '—';
  const phone = profile?.phone ?? '—';
  const roleRaw = profile?.role ?? '—';
  const verification =
    localVerification ?? profile?.verification_status ?? '—';
  const verificationLower = String(verification).toLowerCase();
  const showUserVerify = verificationLower === 'unverified';
  const showViewDocs =
    verificationLower === 'pending' || verificationLower === 'rejected';

  const buttonKeys = useMemo(
    () => getDashboardButtonKeys(profile?.role),
    [profile?.role]
  );

  const onActionPress = (btnKey) => {
    if (btnKey === 'upload_loads') {
      navigation.navigate('UploadLoadScreen');
      return;
    }
    if (btnKey === 'view_previous_loads') {
      navigation.navigate('ViewLoadsScreen', { variant: 'posted' });
      return;
    }
    if (btnKey === 'view_loads') {
      navigation.navigate('ViewLoadsScreen', { variant: 'market' });
      return;
    }
    if (btnKey === 'view_availabilities') {
      navigation.navigate('ViewAvailabilitiesScreen');
      return;
    }
    if (btnKey === 'add_trucks') {
      navigation.navigate('AddTruckScreen');
      return;
    }
    if (btnKey === 'manage_trucks') {
      navigation.navigate('ManageTrucksScreen');
      return;
    }
    if (btnKey === 'add_availabilities') {
      navigation.navigate('CreateAvailabilityScreen');
      return;
    }
    if (btnKey === 'manage_availabilities') {
      navigation.navigate('ManageAvailabilitiesScreen');
      return;
    }
    if (btnKey === 'find_return_load') {
      navigation.navigate('CreateAvailabilityScreen');
      return;
    }
    if (btnKey === 'profile') {
      navigation.navigate('ProfileScreen');
      return;
    }
  };

  const onUserVerificationSubmit = async (files) => {
    setVerifyModalVisible(false);

    if (!profile?.id) {
      Alert.alert(t('error'), t('user_profile_not_loaded'));
      return;
    }

    const result = await submitVerificationDocs({
      variant: 'user',
      entityId: profile.id,
      userId: profile.id,
      files,
    });

    if (!result.ok) {
      Alert.alert(t('upload_failed'), result.error ?? t('please_try_again'));
      return;
    }

    setLocalVerification('pending');
    setUser({ ...profile, verification_status: 'pending' });
    Alert.alert(t('submitted'), t('docs_submitted_pending'));
  };

  const onLogout = async () => {
    setLoggingOut(true);
    try {
      await signOut();
    } catch (e) {
      Alert.alert(
        t('error_title'),
        e instanceof Error ? e.message : t('error_generic')
      );
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <>
    <ScrollView
      contentContainerStyle={styles.scroll}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.userBlock}>
        <Text style={styles.hiLine}>
          {t('hi')} {String(name)}
        </Text>
        <Text style={styles.infoLine}>
          {t('phone_label')} {String(phone)}
        </Text>
        <Text style={styles.infoLine}>
          {t('role_label')} {String(roleRaw)}
        </Text>
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>{t('status_label')}</Text>
          <VerificationBadge status={verification} compact />
          {showUserVerify ? (
            <TouchableOpacity
              style={styles.verifyBtn}
              onPress={() => setVerifyModalVisible(true)}
              activeOpacity={0.85}
            >
              <Text style={styles.verifyBtnText}>
                {t('verify')}
              </Text>
            </TouchableOpacity>
          ) : null}
          {showViewDocs ? (
            <TouchableOpacity
              style={styles.verifyBtn}
              onPress={() => setDocsModalVisible(true)}
              activeOpacity={0.85}
            >
              <Text style={styles.verifyBtnText}>{t('view_documents')}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <View style={styles.actions}>
        {buttonKeys.map((btnKey) => (
          <TouchableOpacity
            key={btnKey}
            style={styles.actionBtn}
            onPress={() => onActionPress(btnKey)}
            activeOpacity={0.85}
          >
            <Text style={styles.actionBtnText}>
              {t(btnKey)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.gap} />
      <PrimaryButton
        title={t('log_out')}
        onPress={onLogout}
        disabled={loggingOut}
        variant="danger"
      />
    </ScrollView>

    <VerificationModal
      variant="user"
      visible={verifyModalVisible}
      onClose={() => setVerifyModalVisible(false)}
      onSubmit={(files) => {
        void onUserVerificationSubmit(files);
      }}
    />

    <MyDocumentsModal
      visible={docsModalVisible}
      onClose={() => setDocsModalVisible(false)}
      entityType="user"
      entityId={profile?.id ?? ''}
      onChangeDocuments={() => setVerifyModalVisible(true)}
    />
    </>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
    padding: 20,
    paddingBottom: 40,
    backgroundColor: '#ffffff',
  },
  userBlock: {
    marginBottom: 24,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  hiLine: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  infoLine: {
    fontSize: 16,
    color: '#374151',
    marginBottom: 8,
    lineHeight: 22,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  statusLabel: {
    fontSize: 16,
    color: '#374151',
    fontWeight: '600',
  },
  verifyBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#6b7280',
    backgroundColor: '#fff',
  },
  verifyBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  actions: {
    gap: 12,
  },
  actionBtn: {
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 12,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#111827',
  },
  actionBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    textAlign: 'center',
  },
  gap: { height: 24 },
});
