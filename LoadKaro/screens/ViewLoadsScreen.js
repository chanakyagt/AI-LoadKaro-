import { useRoute } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { PaginationBar } from '../components/PaginationBar';
import { VerificationBadge } from '../components/VerificationBadge';
import { RouteLocationFilters } from '../components/RouteLocationFilters';
import { useTranslation } from '../i18n/LanguageContext';
import { PAGE_SIZE } from '../constants/pagination';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

const LOADS_TABLE = 'loads';
const VARIANT_POSTED = 'posted';
const VARIANT_MARKET = 'market';

export default function ViewLoadsScreen() {
  const route = useRoute();
  const variant = route.params?.variant ?? VARIANT_POSTED;

  const [page, setPage] = useState(1);
  const [data, setData] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [pendingOriginState, setPendingOriginState] = useState('');
  const [pendingOriginCityId, setPendingOriginCityId] = useState('');
  const [pendingDestinationState, setPendingDestinationState] = useState('');
  const [pendingDestinationCityId, setPendingDestinationCityId] = useState('');

  const [activeOriginLocationId, setActiveOriginLocationId] = useState(null);
  const [activeDestinationLocationId, setActiveDestinationLocationId] =
    useState(null);

  const [states, setStates] = useState([]);
  const [originCities, setOriginCities] = useState([]);
  const [destinationCities, setDestinationCities] = useState([]);

  useEffect(() => {
    setPage(1);
    setPendingOriginState('');
    setPendingOriginCityId('');
    setPendingDestinationState('');
    setPendingDestinationCityId('');
    setActiveOriginLocationId(null);
    setActiveDestinationLocationId(null);
  }, [variant]);

  const { t } = useTranslation();

  const formatLabel = useCallback((value) => {
    if (!value) return '';
    return String(value)
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }, []);

  const formatDate = useCallback((date) => {
    if (!date) return '—';
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = String(d.getFullYear()).slice(-2);
    return `${day}/${month}/${year}`;
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let cancelled = false;
    (async () => {
      const { data: statesData, error } = await supabase
        .from('locations')
        .select('state')
        .order('state');
      if (cancelled) return;
      if (error) {
        Alert.alert(t('load_error'), error.message);
        return;
      }
      const uniqueStates = Array.from(
        new Set(
          (statesData ?? [])
            .map((s) => String(s.state || '').trim())
            .filter(Boolean)
        )
      );
      setStates(uniqueStates);
    })();
    return () => {
      cancelled = true;
    };
  }, [t]);

  const fetchCities = useCallback(
    async (selectedState, kind) => {
      if (!selectedState || !isSupabaseConfigured) {
        if (kind === 'origin') setOriginCities([]);
        if (kind === 'destination') setDestinationCities([]);
        return;
      }
      const { data: rows, error } = await supabase
        .from('locations')
        .select('id, city')
        .eq('state', selectedState);
      if (error) {
        Alert.alert(t('load_error'), error.message);
        if (kind === 'origin') setOriginCities([]);
        if (kind === 'destination') setDestinationCities([]);
        return;
      }
      if (kind === 'origin') setOriginCities(rows ?? []);
      if (kind === 'destination') setDestinationCities(rows ?? []);
    },
    [t]
  );

  useEffect(() => {
    setPendingOriginCityId('');
    void fetchCities(pendingOriginState, 'origin');
  }, [pendingOriginState, fetchCities]);

  useEffect(() => {
    setPendingDestinationCityId('');
    void fetchCities(pendingDestinationState, 'destination');
  }, [pendingDestinationState, fetchCities]);

  const fetchData = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setData([]);
      setTotalCount(0);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (variant === VARIANT_POSTED && !user?.id) {
        setData([]);
        setTotalCount(0);
        return;
      }

      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = supabase
        .from(LOADS_TABLE)
        .select(
          `
          *,
          users!loads_posted_by_fkey(name, phone, verification_status),
          origin:locations!loads_origin_location_id_fkey(city, state),
          destination:locations!loads_destination_location_id_fkey(city, state)
        `,
          { count: 'exact' }
        );

      if (variant === VARIANT_POSTED) {
        query = query.eq('posted_by', user.id);
      }

      if (activeOriginLocationId) {
        query = query.eq('origin_location_id', activeOriginLocationId);
      }
      if (activeDestinationLocationId) {
        query = query.eq('destination_location_id', activeDestinationLocationId);
      }

      const { data: result, error, count } = await query
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) {
        Alert.alert(t('load_error'), error.message);
        setData([]);
        setTotalCount(0);
        return;
      }

      setData(result ?? []);
      setTotalCount(count ?? 0);
    } finally {
      setLoading(false);
    }
  }, [
    page,
    activeOriginLocationId,
    activeDestinationLocationId,
    variant,
    t,
  ]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const applyFilter = useCallback(() => {
    setActiveOriginLocationId(
      pendingOriginCityId ? String(pendingOriginCityId) : null
    );
    setActiveDestinationLocationId(
      pendingDestinationCityId ? String(pendingDestinationCityId) : null
    );
    setPage(1);
  }, [pendingOriginCityId, pendingDestinationCityId]);

  const clearFilter = useCallback(() => {
    setPendingOriginState('');
    setPendingOriginCityId('');
    setPendingDestinationState('');
    setPendingDestinationCityId('');
    setActiveOriginLocationId(null);
    setActiveDestinationLocationId(null);
    setPage(1);
  }, []);

  const goToPage = useCallback(
    (newPage) => {
      const tp = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
      if (newPage < 1) return;
      if (newPage > tp) return;
      setPage(newPage);
    },
    [totalCount]
  );

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const stateOptions = useMemo(
    () => states.map((s) => ({ value: s, label: s })),
    [states]
  );

  const originCityOptions = useMemo(
    () =>
      originCities.map((c) => ({
        value: String(c.id),
        label: String(c.city ?? c.id),
      })),
    [originCities]
  );

  const destinationCityOptions = useMemo(
    () =>
      destinationCities.map((c) => ({
        value: String(c.id),
        label: String(c.city ?? c.id),
      })),
    [destinationCities]
  );

  const handleCall = useCallback((phoneNum) => {
    if (!phoneNum) {
      Alert.alert(t('unavailable'), t('phone_unavailable'));
      return;
    }
    Linking.openURL(`tel:${phoneNum}`);
  }, [t]);

  const handleInterest = useCallback(async (loadId, contactedParty) => {
    if (!isSupabaseConfigured) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) return;
      const { error } = await supabase.from('interests').insert({
        load_id: loadId,
        interested_by: user.id,
        contacted_party: contactedParty,
      });
      if (error) {
        Alert.alert('Error', error.message);
        return;
      }
      Alert.alert(t('interest_sent'), t('shipper_notified'));
    } catch (e) {
      Alert.alert(t('error'), e instanceof Error ? e.message : t('generic_error'));
    }
  }, []);

  const renderCard = useCallback(
    ({ item }) => {
      const origin = item.origin ?? {};
      const destination = item.destination ?? {};
      const poster = item.users ?? {};
      const isMarket = variant === VARIANT_MARKET;
      return (
        <View style={styles.card}>
          <Text style={styles.title}>
            {String(origin.city ?? '—')}, {String(origin.state ?? '—')} →{' '}
            {String(destination.city ?? '—')}, {String(destination.state ?? '—')}
          </Text>
          <Text style={styles.line}>
            {t('loading_date')}: {formatDate(item.loading_date)}
          </Text>
          <Text style={styles.line}>
            {t('truck_category_required')}:{' '}
            {formatLabel(item.truck_category_required) || '—'}
          </Text>
          <Text style={styles.line}>
            {t('capacity_required')}: {String(item.capacity_required ?? '—')}
          </Text>
          <Text style={styles.line}>
            {t('payment_type')}: {String(item.payment_type ?? '—')}
          </Text>
          {item.rate_optional != null && (
            <Text style={styles.line}>
              {t('rate_prefix')}{String(item.rate_optional)}
            </Text>
          )}
          <Text style={styles.line}>
            {t('status')}: {String(item.status ?? '—')}
          </Text>

          {isMarket && (
            <View style={styles.contactSection}>
              <View style={styles.posterRow}>
                <Text style={styles.posterName}>
                  {t('posted_by')} {poster.name ?? t('dash')}
                </Text>
                <VerificationBadge status={poster.verification_status} compact />
              </View>
              <View style={styles.contactRow}>
                <TouchableOpacity
                  style={styles.callBtn}
                  onPress={() => handleCall(poster.phone)}
                  activeOpacity={0.85}
                >
                <Text style={styles.callBtnText}>{t('call_shipper')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.interestBtn}
                onPress={() => void handleInterest(item.id, item.posted_by)}
                activeOpacity={0.85}
              >
                <Text style={styles.interestBtnText}>{t('show_interest')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      );
    },
    [formatDate, formatLabel, handleCall, handleInterest, t, variant]
  );

  const destinationHint =
    variant === VARIANT_MARKET ? t('destination_optional') : null;

  const listHeader = useMemo(
    () => (
      <View>
        {loading && data.length > 0 ? (
          <View style={styles.inlineLoading}>
            <ActivityIndicator size="small" color="#111827" />
          </View>
        ) : null}
        <RouteLocationFilters
          originState={pendingOriginState}
          setOriginState={setPendingOriginState}
          originCityId={pendingOriginCityId}
          setOriginCityId={setPendingOriginCityId}
          destinationState={pendingDestinationState}
          setDestinationState={setPendingDestinationState}
          destinationCityId={pendingDestinationCityId}
          setDestinationCityId={setPendingDestinationCityId}
          stateOptions={stateOptions}
          originCityOptions={originCityOptions}
          destinationCityOptions={destinationCityOptions}
          onApply={applyFilter}
          onClear={clearFilter}
          t={t}
          selectPlaceholder={t('select_placeholder')}
          destinationOptionalHint={destinationHint}
        />
        <PaginationBar
          page={page}
          totalPages={totalPages}
          totalCount={totalCount}
          onPrev={() => goToPage(page - 1)}
          onNext={() => goToPage(page + 1)}
          t={t}
        />
      </View>
    ),
    [
      applyFilter,
      clearFilter,
      data.length,
      destinationHint,
      destinationCityOptions,
      goToPage,
      loading,
      originCityOptions,
      page,
      pendingDestinationCityId,
      pendingDestinationState,
      pendingOriginCityId,
      pendingOriginState,
      stateOptions,
      t,
      totalCount,
      totalPages,
    ]
  );

  if (loading && data.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#111827" />
      </View>
    );
  }

  return (
    <FlatList
      contentContainerStyle={styles.list}
      data={data}
      keyExtractor={(item) => String(item.id)}
      ListHeaderComponent={listHeader}
      ListEmptyComponent={
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>
            {variant === VARIANT_POSTED ? t('no_loads_posted_yet') : t('no_loads_found')}
          </Text>
          <Text style={styles.emptyHint}>
            {variant === VARIANT_POSTED
              ? t('post_first_load')
              : t('try_changing_filters')}
          </Text>
        </View>
      }
      renderItem={renderCard}
      extraData={`${page}-${totalCount}-${loading}`}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await fetchData();
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
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
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
  inlineLoading: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  contactSection: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  posterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  posterName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  contactRow: {
    flexDirection: 'row',
    gap: 10,
  },
  callBtn: {
    flex: 1,
    backgroundColor: '#111827',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  callBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  interestBtn: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#111827',
  },
  interestBtnText: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '600',
  },
});
