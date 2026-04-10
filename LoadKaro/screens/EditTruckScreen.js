import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { useTranslation } from '../i18n/LanguageContext';
import {
  CATEGORY_LABELS,
  PERMIT_TYPE_LABELS,
  PERMIT_TYPES,
  TRUCK_CATEGORIES,
} from '../constants/truckEnums';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

export default function EditTruckScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { t } = useTranslation();
  const truck = route.params?.truck;

  const [variants, setVariants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [category, setCategory] = useState('');
  const [variantId, setVariantId] = useState('');
  const [capacityTons, setCapacityTons] = useState('');
  const [permitType, setPermitType] = useState('');
  const [axleCount, setAxleCount] = useState('');
  const [wheelCount, setWheelCount] = useState('');
  const [gpsAvailable, setGpsAvailable] = useState(false);

  const loadVariants = useCallback(async (cat) => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    setLoading(true);
    let q = supabase.from('truck_variants').select('*').eq('is_active', true);
    if (cat) q = q.eq('category', cat);
    const { data, error } = await q;
    if (error) {
      Alert.alert(t('load_error'), error.message);
      setVariants([]);
    } else {
      setVariants(data ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadVariants(truck?.category ?? '');
  }, [loadVariants, truck?.category]);

  useEffect(() => {
    if (!truck) return;
    setCategory(String(truck.category ?? ''));
    setVariantId(
      truck.variant_id != null ? String(truck.variant_id) : ''
    );
    setCapacityTons(
      truck.capacity_tons != null ? String(truck.capacity_tons) : ''
    );
    setPermitType(String(truck.permit_type ?? ''));
    setAxleCount(
      truck.axle_count != null ? String(truck.axle_count) : ''
    );
    setWheelCount(
      truck.wheel_count != null ? String(truck.wheel_count) : ''
    );
    setGpsAvailable(Boolean(truck.gps_available));
  }, [truck]);

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

  const permitOptions = useMemo(() => {
    const base = PERMIT_TYPES.map((p) => ({
      value: p,
      label: PERMIT_TYPE_LABELS[p] ?? p,
    }));
    const raw =
      truck?.permit_type != null ? String(truck.permit_type).trim() : '';
    if (raw && !base.some((o) => o.value === raw)) {
      return [
        { value: raw, label: `${raw} (choose a valid permit type)` },
        ...base,
      ];
    }
    return base;
  }, [truck?.permit_type]);

  const onSave = async () => {
    if (!truck?.id || !isSupabaseConfigured) {
      Alert.alert(t('save_error'));
      return;
    }
    const cap = parseFloat(String(capacityTons).replace(',', '.'));
    const ax = parseInt(axleCount, 10);
    const wh = parseInt(wheelCount, 10);
    if (!category || !variantId || Number.isNaN(cap)) {
      Alert.alert(t('save_error'));
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('trucks')
        .update({
          category,
          variant_id: variantId,
          capacity_tons: cap,
          permit_type: permitType || null,
          axle_count: Number.isNaN(ax) ? null : ax,
          wheel_count: Number.isNaN(wh) ? null : wh,
          gps_available: gpsAvailable,
        })
        .eq('id', truck.id);

      if (error) {
        Alert.alert(t('save_error'), error.message);
        return;
      }
      Alert.alert(t('edit_truck'), t('truck_updated'));
      navigation.goBack();
    } finally {
      setSaving(false);
    }
  };

  if (!truck) {
    return (
      <View style={styles.centered}>
        <Text style={styles.muted}>{t('load_error')}</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#111827" />
        <Text style={styles.muted}>{t('loading')}</Text>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.scroll}
      keyboardShouldPersistTaps="handled"
    >
      <SelectField
        label={t('category')}
        value={category}
        options={categoryOptions}
        onChange={(val) => {
          setCategory(val);
          setVariantId('');
          void loadVariants(val);
        }}
        placeholder={t('select_placeholder')}
      />
      <SelectField
        label={t('variant')}
        value={variantId}
        options={variantOptions}
        onChange={setVariantId}
        placeholder={t('select_placeholder')}
      />
      <LabeledInput
        label={t('capacity')}
        value={capacityTons}
        onChangeText={setCapacityTons}
        keyboardType="decimal-pad"
      />
      <SelectField
        label={t('permit_type')}
        value={permitType}
        options={permitOptions}
        onChange={setPermitType}
        placeholder={t('select_placeholder')}
      />
      <LabeledInput
        label={t('axle_count')}
        value={axleCount}
        onChangeText={setAxleCount}
        keyboardType="number-pad"
      />
      <LabeledInput
        label={t('wheel_count')}
        value={wheelCount}
        onChangeText={setWheelCount}
        keyboardType="number-pad"
      />
      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>{t('gps_available')}</Text>
        <Switch value={gpsAvailable} onValueChange={setGpsAvailable} />
      </View>

      <PrimaryButton
        title={t('save')}
        onPress={() => void onSave()}
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
