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
import { LabeledInput } from '../components/LabeledInput';
import { PrimaryButton } from '../components/PrimaryButton';
import { SelectField } from '../components/SelectField';
import { useTranslation } from '../i18n/LanguageContext';
import { CATEGORY_LABELS, TRUCK_CATEGORIES } from '../constants/truckEnums';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

const FIELD_CONFIG = {
  origin_state: { required: true },
  origin_city: { required: true },
  destination_state: { required: true },
  destination_city: { required: true },
  loading_date: { required: true },
  truck_category_required: { required: true },
};

const PAYMENT_TYPES = ['advance', 'partial_advance', 'after_delivery'];

export default function UploadLoadScreen() {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [states, setStates] = useState([]);
  const [originCities, setOriginCities] = useState([]);
  const [destinationCities, setDestinationCities] = useState([]);

  const [originState, setOriginState] = useState('');
  const [originCityId, setOriginCityId] = useState('');
  const [destinationState, setDestinationState] = useState('');
  const [destinationCityId, setDestinationCityId] = useState('');

  const [selectedLoadingDate, setSelectedLoadingDate] = useState(null);
  const [showLoadingPicker, setShowLoadingPicker] = useState(false);

  const [truckCategoryRequired, setTruckCategoryRequired] = useState('');
  const [capacityRequired, setCapacityRequired] = useState('');
  const [paymentType, setPaymentType] = useState('');
  const [advancePercentage, setAdvancePercentage] = useState('');
  const [rateOptional, setRateOptional] = useState('');

  const { t } = useTranslation();

  const toDbDate = useCallback((date) => {
    if (!date) return '';
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${year}-${month}-${day}`;
  }, []);

  const formatDate = useCallback((date) => {
    if (!date) return '';
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = String(d.getFullYear()).slice(-2);
    return `${day}/${month}/${year}`;
  }, []);

  const withRequired = useCallback(
    (labelKey, fieldKey) =>
      `${t(labelKey)}${FIELD_CONFIG[fieldKey]?.required ? ` ${t('required_marker')}` : ''}`,
    [t]
  );

  const fetchStates = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.from('locations').select('state');
    if (error) {
      Alert.alert(t('load_error'), error.message);
      setStates([]);
      setLoading(false);
      return;
    }
    const uniqueStates = Array.from(
      new Set((data ?? []).map((s) => String(s.state || '').trim()).filter(Boolean))
    );
    setStates(uniqueStates);
    setLoading(false);
  }, [t]);

  useEffect(() => {
    void fetchStates();
  }, [fetchStates]);

  const fetchCities = useCallback(
    async (selectedState, kind) => {
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
    },
    [t]
  );

  const stateOptions = useMemo(
    () => states.map((s) => ({ value: s, label: s })),
    [states]
  );
  const originCityOptions = useMemo(
    () =>
      originCities.map((c) => ({ value: String(c.id), label: String(c.city ?? c.id) })),
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

  const categoryOptions = useMemo(
    () =>
      TRUCK_CATEGORIES.map((c) => ({
        value: c,
        label: CATEGORY_LABELS[c] ?? c,
      })),
    []
  );

  const paymentLabels = useMemo(
    () => ({
      advance: t('full_advance'),
      partial_advance: t('partial_advance'),
      after_delivery: t('after_delivery'),
    }),
    [t]
  );

  const paymentOptions = useMemo(
    () =>
      PAYMENT_TYPES.map((p) => ({
        value: p,
        label: paymentLabels[p],
      })),
    [paymentLabels]
  );

  const onSubmit = async () => {
    const loadingDate = toDbDate(selectedLoadingDate);
    const formData = {
      origin_state: originState,
      origin_city: originCityId,
      destination_state: destinationState,
      destination_city: destinationCityId,
      loading_date: loadingDate,
      truck_category_required: truckCategoryRequired,
    };

    if (!paymentType) {
      Alert.alert(t('field_required'), t('payment_type'));
      return;
    }
    if (!PAYMENT_TYPES.includes(paymentType)) {
      Alert.alert(t('save_error'), t('payment_type'));
      return;
    }

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

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (selectedLoadingDate && new Date(selectedLoadingDate) < today) {
      Alert.alert(t('error_invalid_date'), t('error_invalid_date'));
      return;
    }

    const cap = parseFloat(String(capacityRequired).replace(',', '.'));
    if (!capacityRequired || Number.isNaN(cap)) {
      Alert.alert(t('field_required'), `${t('capacity_required')} ${t('field_required')}`);
      return;
    }

    if (paymentType === 'partial_advance' && !advancePercentage?.trim()) {
      Alert.alert(t('field_required'), t('advance_percentage'));
      return;
    }

    let finalAdvancePercentage = null;
    if (paymentType === 'advance') {
      finalAdvancePercentage = 100;
    } else if (paymentType === 'partial_advance') {
      const parsed = parseFloat(String(advancePercentage).replace(',', '.'));
      if (Number.isNaN(parsed)) {
        Alert.alert(t('field_required'), t('advance_percentage'));
        return;
      }
      finalAdvancePercentage = parsed;
    } else if (paymentType === 'after_delivery') {
      finalAdvancePercentage = null;
    }

    const rate = rateOptional ? parseFloat(String(rateOptional).replace(',', '.')) : null;

    if (!isSupabaseConfigured) {
      Alert.alert(t('save_error'));
      return;
    }

    setSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user?.id) {
        Alert.alert(t('save_error'));
        return;
      }

      const { error } = await supabase.from('loads').insert({
        posted_by: user.id,
        origin_location_id: originCityId,
        destination_location_id: destinationCityId,
        loading_date: loadingDate,
        truck_category_required: truckCategoryRequired,
        capacity_required: cap,
        payment_type: paymentType,
        advance_percentage: finalAdvancePercentage,
        rate_optional: rate,
      });

      if (error) {
        Alert.alert(t('save_error'), error.message);
        return;
      }

      Alert.alert(t('success_load_created'));
      navigation.replace('ViewLoadsScreen');
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

      <Text style={styles.dateLabel}>{withRequired('loading_date', 'loading_date')}</Text>
      <TouchableOpacity
        style={styles.dateBtn}
        onPress={() => setShowLoadingPicker((v) => !v)}
        activeOpacity={0.85}
      >
        <Text style={styles.dateText}>
          {selectedLoadingDate ? formatDate(selectedLoadingDate) : t('select_date')}
        </Text>
      </TouchableOpacity>
      {showLoadingPicker && (
        <DateTimePicker
          value={selectedLoadingDate ?? new Date()}
          mode="date"
          display="default"
          minimumDate={new Date()}
          onChange={(_event, date) => {
            setShowLoadingPicker(false);
            if (date) setSelectedLoadingDate(date);
          }}
        />
      )}

      <SelectField
        label={withRequired('truck_category_required', 'truck_category_required')}
        value={truckCategoryRequired}
        options={categoryOptions}
        onChange={setTruckCategoryRequired}
        placeholder={t('select_placeholder')}
      />

      <LabeledInput
        label={`${t('capacity_required')} ${t('required_marker')}`}
        value={capacityRequired}
        onChangeText={setCapacityRequired}
        keyboardType="decimal-pad"
      />

      <SelectField
        label={`${t('payment_type')} ${t('required_marker')}`}
        value={paymentType}
        options={paymentOptions}
        onChange={(value) => {
          setPaymentType(value);
          if (value !== 'partial_advance') {
            setAdvancePercentage('');
          }
        }}
        placeholder={t('select_placeholder')}
      />

      {paymentType === 'partial_advance' && (
        <LabeledInput
          label={t('advance_percentage')}
          value={advancePercentage}
          onChangeText={setAdvancePercentage}
          keyboardType="decimal-pad"
        />
      )}
      <LabeledInput
        label={t('rate_optional')}
        value={rateOptional}
        onChangeText={setRateOptional}
        keyboardType="decimal-pad"
      />

      <PrimaryButton title={t('submit')} onPress={() => void onSubmit()} disabled={saving} />
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

