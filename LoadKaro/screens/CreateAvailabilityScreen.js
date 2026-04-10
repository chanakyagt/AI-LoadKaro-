import { useNavigation } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import DateTimePicker from '@react-native-community/datetimepicker';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { PrimaryButton } from '../components/PrimaryButton';
import { SelectField } from '../components/SelectField';
import { useTranslation } from '../i18n/LanguageContext';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

const FIELD_CONFIG = {
  truck_id: { required: true },
  origin_state: { required: true },
  origin_city: { required: true },
  destination_state: { required: true },
  destination_city: { required: true },
  available_from: { required: true },
  available_till: { required: true },
};

export default function CreateAvailabilityScreen() {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [trucks, setTrucks] = useState([]);
  const [states, setStates] = useState([]);
  const [originCities, setOriginCities] = useState([]);
  const [destinationCities, setDestinationCities] = useState([]);

  const [selectedTruckId, setSelectedTruckId] = useState('');
  const [originState, setOriginState] = useState('');
  const [originCityId, setOriginCityId] = useState('');
  const [destinationState, setDestinationState] = useState('');
  const [destinationCityId, setDestinationCityId] = useState('');
  const [selectedFromDate, setSelectedFromDate] = useState(null);
  const [selectedTillDate, setSelectedTillDate] = useState(null);
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showTillPicker, setShowTillPicker] = useState(false);

  const { t } = useTranslation();

  const formatDate = useCallback((date) => {
    if (!date) return '';
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = String(d.getFullYear()).slice(-2);
    return `${day}/${month}/${year}`;
  }, []);

  const toDbDate = useCallback((date) => {
    if (!date) return '';
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${year}-${month}-${day}`;
  }, []);

  const withRequired = useCallback(
    (labelKey, fieldKey) =>
      `${t(labelKey)}${FIELD_CONFIG[fieldKey]?.required ? ` ${t('required_marker')}` : ''}`,
    [t]
  );

  const formatLabel = useCallback((value) => {
    if (!value) return '';
    return String(value)
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }, []);

  const fetchBootstrapData = useCallback(async () => {
    if (!isSupabaseConfigured) {
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
        return;
      }

      const [{ data: trucksData, error: trucksErr }, { data: statesData, error: statesErr }] =
        await Promise.all([
          supabase
            .from('trucks')
            .select(
              `
              id,
              category,
              truck_variants(display_name)
            `
            )
            .eq('owner_id', user.id),
          supabase.from('locations').select('state').order('state'),
        ]);

      if (trucksErr) {
        Alert.alert(t('load_error'), trucksErr.message);
      } else {
        setTrucks(trucksData ?? []);
      }

      if (statesErr) {
        Alert.alert(t('load_error'), statesErr.message);
      } else {
        const uniqueStates = Array.from(
          new Set((statesData ?? []).map((s) => String(s.state || '').trim()).filter(Boolean))
        );
        setStates(uniqueStates);
      }
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void fetchBootstrapData();
  }, [fetchBootstrapData]);

  const fetchCities = useCallback(async (selectedState, kind) => {
    if (!selectedState || !isSupabaseConfigured) {
      if (kind === 'origin') setOriginCities([]);
      if (kind === 'destination') setDestinationCities([]);
      return;
    }
    const { data, error } = await supabase
      .from('locations')
      .select('id, city')
      .eq('state', selectedState);

    if (error) {
      Alert.alert(t('load_error'), error.message);
      if (kind === 'origin') setOriginCities([]);
      if (kind === 'destination') setDestinationCities([]);
      return;
    }

    if (kind === 'origin') setOriginCities(data ?? []);
    if (kind === 'destination') setDestinationCities(data ?? []);
  }, [t]);

  const truckOptions = useMemo(
    () =>
      trucks.map((t) => ({
        value: String(t.id),
        label:
          t.truck_variants?.display_name || formatLabel(t.category) || String(t.id),
      })),
    [formatLabel, trucks]
  );

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

  const onCreate = async () => {
    const availableFrom = toDbDate(selectedFromDate);
    const availableTill = toDbDate(selectedTillDate);
    if (!isSupabaseConfigured) {
      Alert.alert(t('save_error'));
      return;
    }
    const formData = {
      truck_id: selectedTruckId,
      origin_state: originState,
      origin_city: originCityId,
      destination_state: destinationState,
      destination_city: destinationCityId,
      available_from: availableFrom,
      available_till: availableTill,
    };
    const errors = [];
    Object.keys(FIELD_CONFIG).forEach((key) => {
      if (FIELD_CONFIG[key].required && !formData[key]) {
        errors.push(key);
      }
    });
    if (errors.length > 0) {
      Alert.alert(t('field_required'), `${t(errors[0])} ${t('field_required')}`);
      return;
    }
    if (availableTill < availableFrom) {
      Alert.alert(t('save_error'), t('date_range_error'));
      return;
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (selectedFromDate && new Date(selectedFromDate) < today) {
      Alert.alert(t('error_invalid_date_title'), t('error_past_date'));
      return;
    }
    if (selectedTillDate && new Date(selectedTillDate) < today) {
      Alert.alert(t('error_invalid_date_title'), t('error_past_date'));
      return;
    }

    setSaving(true);
    try {
      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser();
      if (userErr || !user?.id) {
        Alert.alert(t('save_error'));
        return;
      }

      const { data: existing, error: overlapErr } = await supabase
        .from('availabilities')
        .select('*')
        .eq('truck_id', selectedTruckId)
        .or(`and(available_from.lte.${availableTill},available_till.gte.${availableFrom})`);

      if (overlapErr) {
        Alert.alert(t('save_error'), overlapErr.message);
        return;
      }

      if ((existing ?? []).length > 0) {
        Alert.alert(t('error_overlap_title'), t('error_overlap_message'), [
          { text: t('confirm') },
        ]);
        return;
      }

      console.log('INSERT OWNER:', user.id);
      const { error } = await supabase.from('availabilities').insert({
        owner_id: user.id,
        truck_id: selectedTruckId,
        origin_location_id: originCityId,
        destination_location_id: destinationCityId,
        available_from: availableFrom,
        available_till: availableTill,
        status: 'available',
      });

      if (error) {
        Alert.alert(t('save_error'), error.message);
        return;
      }

      Alert.alert(t('availability_create'), t('created_success'));
      navigation.goBack();
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#111827" />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
      <SelectField
        label={withRequired('select_truck', 'truck_id')}
        value={selectedTruckId}
        options={truckOptions}
        onChange={setSelectedTruckId}
        placeholder={t('select_placeholder')}
      />

      <SelectField
        label={withRequired('origin_state', 'origin_state')}
        value={originState}
        options={stateOptions}
        onChange={(value) => {
          setOriginState(value);
          setOriginCityId('');
          void fetchCities(value, 'origin');
        }}
        placeholder={t('select_placeholder')}
      />
      <SelectField
        label={withRequired('origin_city', 'origin_city')}
        value={originCityId}
        options={originCityOptions}
        onChange={setOriginCityId}
        placeholder={t('select_placeholder')}
      />

      <SelectField
        label={withRequired('destination_state', 'destination_state')}
        value={destinationState}
        options={stateOptions}
        onChange={(value) => {
          setDestinationState(value);
          setDestinationCityId('');
          void fetchCities(value, 'destination');
        }}
        placeholder={t('select_placeholder')}
      />
      <SelectField
        label={withRequired('destination_city', 'destination_city')}
        value={destinationCityId}
        options={destinationCityOptions}
        onChange={setDestinationCityId}
        placeholder={t('select_placeholder')}
      />

      <Text style={styles.dateLabel}>{withRequired('available_from', 'available_from')}</Text>
      <TouchableOpacity
        style={styles.dateBtn}
        onPress={() => setShowFromPicker((v) => !v)}
        activeOpacity={0.85}
      >
        <Text style={styles.dateText}>
          {selectedFromDate ? formatDate(selectedFromDate) : t('select_date')}
        </Text>
      </TouchableOpacity>
      {showFromPicker && (
        <DateTimePicker
          value={selectedFromDate ?? new Date()}
          mode="date"
          display="default"
          minimumDate={new Date()}
          onChange={(_event, date) => {
            setShowFromPicker(false);
            if (date) setSelectedFromDate(date);
          }}
        />
      )}

      <Text style={styles.dateLabel}>{withRequired('available_till', 'available_till')}</Text>
      <TouchableOpacity
        style={styles.dateBtn}
        onPress={() => setShowTillPicker((v) => !v)}
        activeOpacity={0.85}
      >
        <Text style={styles.dateText}>
          {selectedTillDate ? formatDate(selectedTillDate) : t('select_date')}
        </Text>
      </TouchableOpacity>
      {showTillPicker && (
        <DateTimePicker
          value={selectedTillDate ?? new Date()}
          mode="date"
          display="default"
          minimumDate={new Date()}
          onChange={(_event, date) => {
            setShowTillPicker(false);
            if (date) setSelectedTillDate(date);
          }}
        />
      )}

      <PrimaryButton title={t('create')} onPress={() => void onCreate()} disabled={saving} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    padding: 20,
    paddingBottom: 40,
    backgroundColor: '#ffffff',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  dateLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
  dateBtn: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 16,
    backgroundColor: '#fff',
  },
  dateText: {
    fontSize: 16,
    color: '#111827',
  },
});
