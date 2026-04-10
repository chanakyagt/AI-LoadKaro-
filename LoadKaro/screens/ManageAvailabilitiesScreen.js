import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { VerificationBadge } from '../components/VerificationBadge';
import { useTranslation } from '../i18n/LanguageContext';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

export default function ManageAvailabilitiesScreen() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const { t } = useTranslation();

  const formatDate = useCallback((date) => {
    if (!date) return '—';
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = String(d.getFullYear()).slice(-2);
    return `${day}/${month}/${year}`;
  }, []);

  const formatLabel = useCallback((value) => {
    if (!value) return '';
    return String(value)
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }, []);

  const fetchAvailabilities = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user?.id) {
        setRows([]);
        return;
      }

      const { data, error } = await supabase
        .from('availabilities')
        .select(
          `
          *,
          trucks (
            id,
            category,
            capacity_tons,
            gps_available,
            verification_status,
            truck_variants (display_name)
          ),
          origin:locations!availabilities_origin_location_id_fkey (city, state),
          destination:locations!availabilities_destination_location_id_fkey (city, state)
        `
        )
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        Alert.alert(t('load_error'), error.message);
        setRows([]);
        return;
      }

      setRows(data ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  const updateStatus = useCallback(
    async (id, status) => {
      const { error } = await supabase
        .from('availabilities')
        .update({ status })
        .eq('id', id);

      if (error) {
        Alert.alert(t('error') ?? 'Error', error.message);
        return;
      }
      void fetchAvailabilities();
    },
    [fetchAvailabilities, t]
  );

  const guardClosedOrCancelled = useCallback(
    (item) => {
      const status = String(item?.status ?? '').toLowerCase();
      if (status === 'closed') {
        Alert.alert(t('confirm_action_title'), t('already_closed'));
        return true;
      }
      if (status === 'cancelled') {
        Alert.alert(t('confirm_action_title'), t('already_cancelled'));
        return true;
      }
      return false;
    },
    [t]
  );

  const handleClose = useCallback(
    (item) => {
      if (guardClosedOrCancelled(item)) return;
      Alert.alert(t('confirm_action_title'), t('confirm_close_message'), [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('confirm'),
          onPress: () => {
            void updateStatus(item.id, 'closed');
          },
        },
      ]);
    },
    [guardClosedOrCancelled, t, updateStatus]
  );

  const handleCancel = useCallback(
    (item) => {
      if (guardClosedOrCancelled(item)) return;
      Alert.alert(t('confirm_action_title'), t('confirm_cancel_message'), [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('confirm'),
          onPress: () => {
            void updateStatus(item.id, 'cancelled');
          },
        },
      ]);
    },
    [guardClosedOrCancelled, t, updateStatus]
  );

  useFocusEffect(
    useCallback(() => {
      void fetchAvailabilities();
    }, [fetchAvailabilities])
  );

  const renderCard = useCallback(
    ({ item }) => {
      const truck = item.trucks ?? {};
      const truckVariant = Array.isArray(truck.truck_variants)
        ? truck.truck_variants[0]
        : truck.truck_variants;
      const truckName =
        truckVariant?.display_name || formatLabel(truck.category) || '—';
      const origin = item.origin ?? {};
      const destination = item.destination ?? {};
      const gpsLabel = truck.gps_available ? t('yes') : t('no');
      const statusKey = `status_${String(item.status ?? '').toLowerCase()}`;
      const statusLabel = t(statusKey);
      const isActive = String(item.status ?? '').toLowerCase() === 'available';

      return (
        <View style={styles.card}>
          <Text style={styles.line}>
            {t('truck')}: {truckName}
          </Text>
          <Text style={styles.line}>{t('category')}: {formatLabel(truck.category) || '—'}</Text>
          <Text style={styles.line}>
            {t('capacity')}: {String(truck.capacity_tons ?? '—')}
          </Text>
          <Text style={styles.line}>
            {t('gps')}: {gpsLabel}
          </Text>
          <View style={styles.row}>
            <Text style={styles.line}>{t('verification_status')}:</Text>
            <VerificationBadge status={truck.verification_status} />
          </View>

          <Text style={styles.line}>
            {t('origin')}: {String(origin.city ?? '—')}, {String(origin.state ?? '—')}
          </Text>
          <Text style={styles.line}>
            {t('destination')}: {String(destination.city ?? '—')},{' '}
            {String(destination.state ?? '—')}
          </Text>
          <Text style={styles.line}>
            {t('available_from')}: {formatDate(item.available_from)}
          </Text>
          <Text style={styles.line}>
            {t('available_till')}: {formatDate(item.available_till)}
          </Text>
          <Text style={styles.line}>
            {t('status')}: {statusLabel}
          </Text>

          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[styles.actionBtn, !isActive && styles.actionBtnDisabled]}
              onPress={() => handleClose(item)}
              disabled={!isActive}
              activeOpacity={0.85}
            >
              <Text style={styles.actionText}>{t('close_availability')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, styles.cancelBtn, !isActive && styles.actionBtnDisabled]}
              onPress={() => handleCancel(item)}
              disabled={!isActive}
              activeOpacity={0.85}
            >
              <Text style={styles.actionText}>{t('cancel_availability')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    },
    [formatDate, formatLabel, handleCancel, handleClose, t]
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#111827" />
      </View>
    );
  }

  return (
    <FlatList
      contentContainerStyle={styles.list}
      data={rows}
      keyExtractor={(item) => String(item.id)}
      ListEmptyComponent={
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>No availabilities yet</Text>
          <Text style={styles.emptyHint}>Create an availability to list your truck.</Text>
        </View>
      }
      renderItem={renderCard}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await fetchAvailabilities();
            setRefreshing(false);
          }}
          colors={['#111827']}
          tintColor="#111827"
        />
      }
    />
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
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  actionBtn: {
    flex: 1,
    backgroundColor: '#111827',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtn: {
    backgroundColor: '#b91c1c',
  },
  actionBtnDisabled: {
    opacity: 0.45,
  },
  actionText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  line: {
    fontSize: 15,
    color: '#374151',
    marginBottom: 4,
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
