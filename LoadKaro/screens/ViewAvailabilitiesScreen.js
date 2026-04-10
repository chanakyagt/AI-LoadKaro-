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
import { RouteLocationFilters } from '../components/RouteLocationFilters';
import { VerificationBadge } from '../components/VerificationBadge';
import { useTranslation } from '../i18n/LanguageContext';
import { PAGE_SIZE } from '../constants/pagination';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

const AVAILABILITIES_TABLE = 'availabilities';

export default function ViewAvailabilitiesScreen() {
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

  const mergeTrucksAndOwners = useCallback(async (list) => {
    const truckIds = [
      ...new Set(list.map((a) => a.truck_id).filter((id) => id != null)),
    ];
    if (truckIds.length === 0) return list;

    const { data: trucksData, error: trErr } = await supabase
      .from('trucks')
      .select(
        `
        id,
        owner_id,
        category,
        capacity_tons,
        gps_available,
        verification_status,
        truck_variants (display_name)
      `
      )
      .in('id', truckIds);

    if (trErr) {
      console.warn('[ViewAvailabilities]', trErr);
      return list.map((a) => ({ ...a, trucks: a.trucks ?? null }));
    }

    const truckMap = new Map((trucksData ?? []).map((tr) => [String(tr.id), tr]));
    const ownerIds = [
      ...new Set(
        (trucksData ?? []).map((tr) => tr.owner_id).filter((id) => id != null)
      ),
    ];

    let userMap = new Map();
    if (ownerIds.length > 0) {
      const { data: usersData, error: uErr } = await supabase
        .from('users')
        .select('id, name, phone')
        .in('id', ownerIds);

      if (!uErr) {
        userMap = new Map((usersData ?? []).map((u) => [String(u.id), u]));
      } else {
        console.warn('[ViewAvailabilities] users', uErr);
      }
    }

    return list.map((a) => {
      const tr = a.truck_id != null ? truckMap.get(String(a.truck_id)) : null;
      if (!tr) return { ...a, trucks: a.trucks ?? null };
      const owner = tr.owner_id ? userMap.get(String(tr.owner_id)) : null;
      return {
        ...a,
        trucks: owner ? { ...tr, owner, users: owner } : { ...tr },
      };
    });
  }, []);

  const fetchData = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setData([]);
      setTotalCount(0);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const selectWithOwner = `
          *,
          trucks (
            category,
            capacity_tons,
            gps_available,
            verification_status,
            truck_variants (display_name),
            owner:users!trucks_owner_id_fkey (name, phone)
          ),
          origin:locations!availabilities_origin_location_id_fkey(city, state),
          destination:locations!availabilities_destination_location_id_fkey(city, state)
        `;

      const selectBasic = `
          *,
          trucks (
            category,
            capacity_tons,
            gps_available,
            verification_status,
            truck_variants (display_name)
          ),
          origin:locations!availabilities_origin_location_id_fkey(city, state),
          destination:locations!availabilities_destination_location_id_fkey(city, state)
        `;

      const buildBase = (selectStr) => {
        let q = supabase
          .from(AVAILABILITIES_TABLE)
          .select(selectStr, { count: 'exact' })
          .eq('status', 'available');
        if (activeOriginLocationId) {
          q = q.eq('origin_location_id', activeOriginLocationId);
        }
        if (activeDestinationLocationId) {
          q = q.eq('destination_location_id', activeDestinationLocationId);
        }
        return q.order('created_at', { ascending: false }).range(from, to);
      };

      let { data: result, error, count } = await buildBase(selectWithOwner);

      if (error) {
        const second = await buildBase(selectBasic);
        if (second.error) {
          Alert.alert(t('load_error'), second.error.message);
          setData([]);
          setTotalCount(0);
          return;
        }
        result = await mergeTrucksAndOwners(second.data ?? []);
        count = second.count;
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
    mergeTrucksAndOwners,
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
      Alert.alert(t('unavailable'), t('phone_not_available'));
      return;
    }
    Linking.openURL(`tel:${phoneNum}`);
  }, [t]);

  const handleInterest = useCallback(async (availabilityId, contactedParty) => {
    if (!isSupabaseConfigured) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) return;
      const { error } = await supabase.from('interests').insert({
        availability_id: availabilityId,
        interested_by: user.id,
        contacted_party: contactedParty,
      });
      if (error) {
        Alert.alert('Error', error.message);
        return;
      }
      Alert.alert(t('interest_sent'), t('owner_notified'));
    } catch (e) {
      Alert.alert(t('error'), e instanceof Error ? e.message : t('generic_error'));
    }
  }, []);

  const renderCard = useCallback(
    ({ item }) => {
      const rawTruck = item.trucks;
      const truck = Array.isArray(rawTruck)
        ? rawTruck[0] ?? {}
        : rawTruck ?? {};
      const variantRel = truck.truck_variants;
      const variant = Array.isArray(variantRel) ? variantRel[0] : variantRel;
      const truckName =
        variant?.display_name || formatLabel(truck.category) || '—';
      const ownerRel = truck.owner ?? truck.users;
      const owner = Array.isArray(ownerRel) ? ownerRel[0] : ownerRel;
      const ownerName = owner?.name;
      const ownerPhone = owner?.phone;
      const origin = item.origin ?? {};
      const destination = item.destination ?? {};
      const gpsLabel = truck.gps_available ? t('yes') : t('no');

      return (
        <View style={styles.card}>
          <Text style={styles.title}>
            {t('truck')}: {truckName}
          </Text>
          <Text style={styles.line}>
            {t('owner')}: {ownerName ? String(ownerName) : '—'}
          </Text>
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
            {t('origin')}: {String(origin.city ?? '—')},{' '}
            {String(origin.state ?? '—')}
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
          {item.expected_rate != null && (
            <Text style={styles.line}>
              {t('rate_prefix')}{String(item.expected_rate)}
            </Text>
          )}

          <View style={styles.contactSection}>
            <View style={styles.contactRow}>
              <TouchableOpacity
                style={styles.callBtn}
                onPress={() => handleCall(ownerPhone)}
                activeOpacity={0.85}
              >
                <Text style={styles.callBtnText}>{t('call_owner')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.interestBtn}
                onPress={() => void handleInterest(item.id, item.owner_id)}
                activeOpacity={0.85}
              >
                <Text style={styles.interestBtnText}>{t('show_interest')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      );
    },
    [formatDate, formatLabel, handleCall, handleInterest, t]
  );

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
      destinationCityOptions,
      goToPage,
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
      loading,
      data.length,
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
          <Text style={styles.emptyTitle}>{t('no_trucks_available')}</Text>
          <Text style={styles.emptyHint}>{t('try_filters_or_later')}</Text>
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
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
