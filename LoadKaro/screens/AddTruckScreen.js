import { useNavigation } from '@react-navigation/native';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { LabeledInput } from '../components/LabeledInput';
import { PrimaryButton } from '../components/PrimaryButton';
import { SelectField } from '../components/SelectField';
import { FIELD_CONFIG } from '../config/truckFieldConfig';
import { useTranslation } from '../i18n/LanguageContext';
import {
  CATEGORY_LABELS,
  PERMIT_TYPE_LABELS,
  PERMIT_TYPES,
  TRUCK_CATEGORIES,
} from '../constants/truckEnums';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

export default function AddTruckScreen() {
  const navigation = useNavigation();
  const { t } = useTranslation();
  const [variants, setVariants] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [category, setCategory] = useState('');
  const [variantId, setVariantId] = useState('');
  const [capacityTons, setCapacityTons] = useState('');
  const [permitType, setPermitType] = useState('');
  const [axleCount, setAxleCount] = useState('');
  const [wheelCount, setWheelCount] = useState('');
  const [gpsAvailable, setGpsAvailable] = useState(false);
  const [missingFields, setMissingFields] = useState([]);

  const fetchVariants = useCallback(async (selectedCategory) => {
    if (!selectedCategory) {
      setVariants([]);
      return;
    }
    if (!isSupabaseConfigured) {
      setVariants([]);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from('truck_variants')
      .select('*')
      .eq('category', selectedCategory)
      .eq('is_active', true);
    if (error) {
      console.warn('[AddTruck] variants', error);
      Alert.alert(t('load_error'), error.message);
      setVariants([]);
    } else {
      setVariants(data ?? []);
    }
    setLoading(false);
  }, []);

  const categoryOptions = useMemo(
    () =>
      TRUCK_CATEGORIES.map((c) => ({
        value: c,
        label: CATEGORY_LABELS[c] ?? c,
      })),
    []
  );

  const variantOptions = useMemo(
    () =>
      (variants ?? []).map((v) => ({
        value: String(v.id),
        label: String(v.display_name ?? v.id),
      })),
    [variants]
  );

  const permitOptions = useMemo(
    () =>
      PERMIT_TYPES.map((p) => ({
        value: p,
        label: PERMIT_TYPE_LABELS[p] ?? p,
      })),
    []
  );

  const onSubmit = async () => {
    if (!isSupabaseConfigured) {
      Alert.alert(t('save_error'));
      return;
    }
    const cap = parseFloat(String(capacityTons).replace(',', '.'));
    const ax = parseInt(axleCount, 10);
    const wh = parseInt(wheelCount, 10);

    const formData = {
      category,
      variant_id: variantId,
      capacity_tons: capacityTons,
      permit_type: permitType,
      axle_count: axleCount,
      wheel_count: wheelCount,
      gps_available: gpsAvailable,
    };
    const errors = [];
    Object.keys(FIELD_CONFIG).forEach((key) => {
      if (FIELD_CONFIG[key].required && !formData[key]) {
        errors.push(key);
      }
    });
    if (errors.length > 0) {
      setMissingFields(errors);
      console.log('Missing fields:', errors);
      return;
    }
    if (Number.isNaN(cap)) {
      setMissingFields(['capacity_tons']);
      return;
    }
    setMissingFields([]);

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

      const { error } = await supabase.from('trucks').insert({
        owner_id: user.id,
        category,
        variant_id: variantId,
        capacity_tons: cap,
        permit_type: permitType || null,
        axle_count: Number.isNaN(ax) ? null : ax,
        wheel_count: Number.isNaN(wh) ? null : wh,
        gps_available: gpsAvailable,
      });

      if (error) {
        Alert.alert(t('save_error'), error.message);
        return;
      }
      setCategory('');
      setVariantId('');
      setCapacityTons('');
      setPermitType('');
      setAxleCount('');
      setWheelCount('');
      setGpsAvailable(false);
      setMissingFields([]);
      Alert.alert(t('add_truck'), t('truck_added'));
      navigation.replace('ManageTrucksScreen');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#111827" />
        <Text style={styles.muted}>{t('loading')}</Text>
      </View>
    );
  }

  const withRequired = (fieldKey) => {
    const required = FIELD_CONFIG[fieldKey]?.required;
    return required
      ? `${t(fieldKey)} ${t('required_marker')}`
      : t(fieldKey);
  };

  const renderFieldError = (fieldKey) =>
    missingFields.includes(fieldKey) ? (
      <Text style={styles.fieldError}>{t('required_field_error')}</Text>
    ) : null;

  return (
    <ScrollView
      contentContainerStyle={styles.scroll}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.requiredNote}>
        {t('required_marker')} {t('required_note')}
      </Text>
      <SelectField
        label={withRequired('category')}
        value={category}
        options={categoryOptions}
        onChange={(v) => {
          setCategory(v);
          setVariantId('');
          setMissingFields((prev) =>
            prev.filter((k) => k !== 'variant_id')
          );
          void fetchVariants(v);
          setMissingFields((prev) => prev.filter((k) => k !== 'category'));
        }}
        placeholder={t('select_placeholder')}
      />
      {renderFieldError('category')}
      <SelectField
        label={withRequired('variant_id')}
        value={variantId}
        options={variantOptions}
        onChange={(v) => {
          setVariantId(v);
          setMissingFields((prev) => prev.filter((k) => k !== 'variant_id'));
        }}
        placeholder={t('select_placeholder')}
      />
      {renderFieldError('variant_id')}
      <LabeledInput
        label={withRequired('capacity_tons')}
        value={capacityTons}
        onChangeText={(v) => {
          setCapacityTons(v);
          setMissingFields((prev) =>
            prev.filter((k) => k !== 'capacity_tons')
          );
        }}
        keyboardType="decimal-pad"
      />
      {renderFieldError('capacity_tons')}
      <SelectField
        label={withRequired('permit_type')}
        value={permitType}
        options={permitOptions}
        onChange={setPermitType}
        placeholder={t('select_placeholder')}
      />
      <LabeledInput
        label={withRequired('axle_count')}
        value={axleCount}
        onChangeText={setAxleCount}
        keyboardType="number-pad"
      />
      <LabeledInput
        label={withRequired('wheel_count')}
        value={wheelCount}
        onChangeText={setWheelCount}
        keyboardType="number-pad"
      />
      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>{withRequired('gps_available')}</Text>
        <Switch value={gpsAvailable} onValueChange={setGpsAvailable} />
      </View>

      <PrimaryButton
        title={t('submit')}
        onPress={() => void onSubmit()}
        disabled={saving}
      />
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
  muted: { color: '#9ca3af', fontSize: 16 },
  requiredNote: {
    marginBottom: 16,
    color: '#6b7280',
    fontSize: 14,
    fontWeight: '600',
  },
  fieldError: {
    color: '#dc2626',
    fontSize: 12,
    marginTop: -8,
    marginBottom: 10,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    paddingVertical: 8,
  },
  switchLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
});
