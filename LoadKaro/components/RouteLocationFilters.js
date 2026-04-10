import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PrimaryButton } from './PrimaryButton';
import { SelectField } from './SelectField';

/**
 * Origin / destination state → city dropdowns + apply / clear.
 *
 * @param {{
 *   originState: string;
 *   setOriginState: (v: string) => void;
 *   originCityId: string;
 *   setOriginCityId: (v: string) => void;
 *   destinationState: string;
 *   setDestinationState: (v: string) => void;
 *   destinationCityId: string;
 *   setDestinationCityId: (v: string) => void;
 *   stateOptions: readonly { value: string; label: string }[];
 *   originCityOptions: readonly { value: string; label: string }[];
 *   destinationCityOptions: readonly { value: string; label: string }[];
 *   onApply: () => void;
 *   onClear: () => void;
 *   t: (key: string) => string;
 *   selectPlaceholder: string;
 *   destinationOptionalHint?: string | null;
 * }} props
 */
export function RouteLocationFilters({
  originState,
  setOriginState,
  originCityId,
  setOriginCityId,
  destinationState,
  setDestinationState,
  destinationCityId,
  setDestinationCityId,
  stateOptions,
  originCityOptions,
  destinationCityOptions,
  onApply,
  onClear,
  t,
  selectPlaceholder,
  destinationOptionalHint,
}) {
  return (
    <View style={styles.wrap}>
      <SelectField
        label={t('origin_state')}
        value={originState}
        options={stateOptions}
        onChange={setOriginState}
        placeholder={selectPlaceholder}
      />
      <SelectField
        label={t('origin_city')}
        value={originCityId}
        options={originCityOptions}
        onChange={setOriginCityId}
        placeholder={selectPlaceholder}
      />
      <SelectField
        label={t('destination_state')}
        value={destinationState}
        options={stateOptions}
        onChange={setDestinationState}
        placeholder={selectPlaceholder}
      />
      <SelectField
        label={t('destination_city')}
        value={destinationCityId}
        options={destinationCityOptions}
        onChange={setDestinationCityId}
        placeholder={selectPlaceholder}
      />
      {destinationOptionalHint ? (
        <Text style={styles.hint}>{destinationOptionalHint}</Text>
      ) : null}
      <PrimaryButton title={t('apply_filter')} onPress={onApply} />
      <View style={styles.gap} />
      <PrimaryButton
        title={t('clear_filter')}
        onPress={onClear}
        variant="danger"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
    marginBottom: 8,
  },
  gap: { height: 10 },
  hint: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 12,
    marginTop: -8,
  },
});
