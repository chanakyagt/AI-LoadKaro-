import { useFocusEffect, useNavigation } from '@react-navigation/native';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MyDocumentsModal } from '../components/MyDocumentsModal';
import { TruckCard } from '../components/TruckCard';
import { VerificationModal } from '../components/VerificationModal';
import { useTranslation } from '../i18n/LanguageContext';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { submitVerificationDocs } from '../lib/verificationUpload';

export default function ManageTrucksScreen() {
  const navigation = useNavigation();
  const { t } = useTranslation();
  const [trucks, setTrucks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [verificationOverrides, setVerificationOverrides] = useState({});
  const [verifyModalVisible, setVerifyModalVisible] = useState(false);
  const [truckForVerify, setTruckForVerify] = useState(null);
  const [docsModalTruck, setDocsModalTruck] = useState(null);

  const trucksWithOverrides = useMemo(
    () =>
      trucks.map((t) => ({
        ...t,
        verification_status:
          verificationOverrides[t.id] ?? t.verification_status,
      })),
    [trucks, verificationOverrides]
  );

  const fetchTrucks = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setTrucks([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser();
      if (userErr || !user?.id) {
        Alert.alert(t('load_error'));
        setTrucks([]);
        return;
      }

      const { data, error } = await supabase
        .from('trucks')
        .select(
          `
          *,
          truck_variants(display_name)
        `
        )
        .eq('owner_id', user.id);

      if (error) {
        console.warn('[ManageTrucks]', error);
        Alert.alert(t('load_error'), error.message);
        setTrucks([]);
        return;
      }
      setTrucks(data ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void fetchTrucks();
    }, [fetchTrucks])
  );

  const onEditTruck = useCallback(
    (truck) => {
      const status = String(truck?.verification_status ?? '').toLowerCase();
      if (status === 'pending') {
        Alert.alert(t('edit_not_allowed_title'), t('cannot_edit_pending'));
        return;
      }
      if (status === 'verified') {
        Alert.alert(t('edit_not_allowed_title'), t('cannot_edit_verified'));
        return;
      }
      navigation.navigate('EditTruckScreen', { truck });
    },
    [navigation]
  );

  const deleteTruck = useCallback(
    async (truckId) => {
      if (!isSupabaseConfigured) {
        Alert.alert(t('delete_error'));
        return;
      }
      const { error } = await supabase.from('trucks').delete().eq('id', truckId);
      if (error) {
        Alert.alert(t('delete_error'), error.message);
        return;
      }
      Alert.alert(t('manage_trucks'), t('truck_deleted'));
      void fetchTrucks();
    },
    [fetchTrucks]
  );

  const onDeleteTruck = useCallback(
    (truckId) => {
      Alert.alert(t('confirm_delete_title'), t('confirm_delete_message'), [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('confirm'),
          style: 'destructive',
          onPress: () => {
            void deleteTruck(truckId);
          },
        },
      ]);
    },
    [deleteTruck]
  );

  const onTruckVerificationSubmit = useCallback(async (files) => {
    if (!truckForVerify?.id) {
      return;
    }
    const truckId = truckForVerify.id;
    setVerifyModalVisible(false);
    setTruckForVerify(null);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) {
      Alert.alert(t('error'), t('not_signed_in'));
      return;
    }

    const result = await submitVerificationDocs({
      variant: 'truck',
      entityId: truckId,
      userId: user.id,
      files,
    });

    if (!result.ok) {
      Alert.alert(t('upload_failed'), result.error ?? t('please_try_again'));
      return;
    }

    setVerificationOverrides((prev) => ({ ...prev, [truckId]: 'pending' }));
    Alert.alert(t('submitted'), t('docs_submitted_pending'));
  }, [truckForVerify]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#111827" />
        <Text style={styles.muted}>{t('loading')}</Text>
      </View>
    );
  }

  return (
    <>
      <FlatList
        contentContainerStyle={styles.list}
        data={trucksWithOverrides}
        keyExtractor={(item) => String(item.id)}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>No trucks added yet</Text>
            <Text style={styles.emptyHint}>Add your first truck to get started.</Text>
          </View>
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await fetchTrucks();
              setRefreshing(false);
            }}
            colors={['#111827']}
            tintColor="#111827"
          />
        }
        renderItem={({ item }) => {
          const rel = item.truck_variants;
          const variantName = Array.isArray(rel)
            ? rel[0]?.display_name
            : rel?.display_name;
          return (
            <TruckCard
              truck={item}
              variantDisplayName={variantName}
              onEditPress={() => onEditTruck(item)}
              onDeletePress={() => onDeleteTruck(item.id)}
              isEditDisabled={
                String(item.verification_status ?? '').toLowerCase() !==
                'unverified'
              }
              onVerifyPress={() => {
                setTruckForVerify(item);
                setVerifyModalVisible(true);
              }}
              onViewDocsPress={() => setDocsModalTruck(item)}
            />
          );
        }}
      />
      <VerificationModal
        variant="truck"
        visible={verifyModalVisible}
        onClose={() => {
          setVerifyModalVisible(false);
          setTruckForVerify(null);
        }}
        onSubmit={(files) => {
          void onTruckVerificationSubmit(files);
        }}
      />

      <MyDocumentsModal
        visible={!!docsModalTruck}
        onClose={() => setDocsModalTruck(null)}
        entityType="truck"
        entityId={docsModalTruck?.id ?? ''}
        onChangeDocuments={() => {
          const truck = docsModalTruck;
          setDocsModalTruck(null);
          if (truck) {
            setTruckForVerify(truck);
            setVerifyModalVisible(true);
          }
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  list: {
    padding: 20,
    paddingBottom: 40,
    backgroundColor: '#f9fafb',
    flexGrow: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  muted: {
    marginTop: 12,
    color: '#6b7280',
    fontSize: 15,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 6,
  },
  emptyHint: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
  },
});
