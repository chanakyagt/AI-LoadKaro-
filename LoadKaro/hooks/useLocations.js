import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert } from 'react-native';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

/**
 * Shared hook for state/city location data — replaces 6+ duplicate patterns.
 * @param {{ onError?: (msg: string) => void }} opts
 */
export function useLocations(opts = {}) {
  const [states, setStates] = useState([]);
  const [originCities, setOriginCities] = useState([]);
  const [destinationCities, setDestinationCities] = useState([]);

  const fetchStates = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    const { data, error } = await supabase
      .from('locations')
      .select('state')
      .order('state');
    if (error) {
      (opts.onError ?? Alert.alert)('Error', error.message);
      return;
    }
    const unique = Array.from(
      new Set((data ?? []).map((s) => String(s.state || '').trim()).filter(Boolean))
    );
    setStates(unique);
  }, [opts.onError]);

  useEffect(() => {
    void fetchStates();
  }, [fetchStates]);

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
      (opts.onError ?? Alert.alert)('Error', error.message);
      if (kind === 'origin') setOriginCities([]);
      if (kind === 'destination') setDestinationCities([]);
      return;
    }
    if (kind === 'origin') setOriginCities(data ?? []);
    if (kind === 'destination') setDestinationCities(data ?? []);
  }, [opts.onError]);

  const stateOptions = useMemo(
    () => states.map((s) => ({ value: s, label: s })),
    [states]
  );

  const originCityOptions = useMemo(
    () => originCities.map((c) => ({ value: String(c.id), label: String(c.city ?? c.id) })),
    [originCities]
  );

  const destinationCityOptions = useMemo(
    () => destinationCities.map((c) => ({ value: String(c.id), label: String(c.city ?? c.id) })),
    [destinationCities]
  );

  return {
    states,
    stateOptions,
    originCities,
    originCityOptions,
    destinationCities,
    destinationCityOptions,
    fetchCities,
    fetchStates,
  };
}
