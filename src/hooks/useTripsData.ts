import { useCallback, useEffect, useMemo, useState } from 'react';
import { TripsJson, TripData } from '@/types/trips';
import { getTripsData, saveTripsData } from '@/lib/storage';

const TOTAL_COUNTRIES_IN_WORLD = 195;

// Country list for the Add Country UI
export const ALL_COUNTRIES: { name: string; iso2: string; continent: string }[] = [
  { name: 'Afghanistan', iso2: 'AF', continent: 'Asia' },
  { name: 'Albania', iso2: 'AL', continent: 'Europe' },
  { name: 'Algeria', iso2: 'DZ', continent: 'Africa' },
  { name: 'Andorra', iso2: 'AD', continent: 'Europe' },
  { name: 'Angola', iso2: 'AO', continent: 'Africa' },
  { name: 'Argentina', iso2: 'AR', continent: 'South America' },
  { name: 'Armenia', iso2: 'AM', continent: 'Asia' },
  { name: 'Australia', iso2: 'AU', continent: 'Oceania' },
  { name: 'Austria', iso2: 'AT', continent: 'Europe' },
  { name: 'Azerbaijan', iso2: 'AZ', continent: 'Asia' },
  { name: 'Belgium', iso2: 'BE', continent: 'Europe' },
  { name: 'Brazil', iso2: 'BR', continent: 'South America' },
  { name: 'Canada', iso2: 'CA', continent: 'North America' },
  { name: 'China', iso2: 'CN', continent: 'Asia' },
  { name: 'Colombia', iso2: 'CO', continent: 'South America' },
  { name: 'Czechia', iso2: 'CZ', continent: 'Europe' },
  { name: 'Denmark', iso2: 'DK', continent: 'Europe' },
  { name: 'Ecuador', iso2: 'EC', continent: 'South America' },
  { name: 'Estonia', iso2: 'EE', continent: 'Europe' },
  { name: 'Ethiopia', iso2: 'ET', continent: 'Africa' },
  { name: 'Finland', iso2: 'FI', continent: 'Europe' },
  { name: 'France', iso2: 'FR', continent: 'Europe' },
  { name: 'Georgia', iso2: 'GE', continent: 'Asia' },
  { name: 'Germany', iso2: 'DE', continent: 'Europe' },
  { name: 'Hong Kong', iso2: 'HK', continent: 'Asia' },
  { name: 'Hungary', iso2: 'HU', continent: 'Europe' },
  { name: 'India', iso2: 'IN', continent: 'Asia' },
  { name: 'Indonesia', iso2: 'ID', continent: 'Asia' },
  { name: 'Israel', iso2: 'IL', continent: 'Asia' },
  { name: 'Italy', iso2: 'IT', continent: 'Europe' },
  { name: 'Jordan', iso2: 'JO', continent: 'Asia' },
  { name: 'Kazakhstan', iso2: 'KZ', continent: 'Asia' },
  { name: 'Kyrgyzstan', iso2: 'KG', continent: 'Asia' },
  { name: 'Malaysia', iso2: 'MY', continent: 'Asia' },
  { name: 'Mexico', iso2: 'MX', continent: 'North America' },
  { name: 'Nigeria', iso2: 'NG', continent: 'Africa' },
  { name: 'Norway', iso2: 'NO', continent: 'Europe' },
  { name: 'Paraguay', iso2: 'PY', continent: 'South America' },
  { name: 'Poland', iso2: 'PL', continent: 'Europe' },
  { name: 'Portugal', iso2: 'PT', continent: 'Europe' },
  { name: 'Romania', iso2: 'RO', continent: 'Europe' },
  { name: 'Russia', iso2: 'RU', continent: 'Europe' },
  { name: 'Singapore', iso2: 'SG', continent: 'Asia' },
  { name: 'South Africa', iso2: 'ZA', continent: 'Africa' },
  { name: 'Spain', iso2: 'ES', continent: 'Europe' },
  { name: 'Sweden', iso2: 'SE', continent: 'Europe' },
  { name: 'Thailand', iso2: 'TH', continent: 'Asia' },
  { name: 'Turkey', iso2: 'TR', continent: 'Europe' },
  { name: 'Turkmenistan', iso2: 'TM', continent: 'Asia' },
  { name: 'Ukraine', iso2: 'UA', continent: 'Europe' },
  { name: 'United Arab Emirates', iso2: 'AE', continent: 'Asia' },
  { name: 'United Kingdom', iso2: 'GB', continent: 'Europe' },
  { name: 'United States', iso2: 'US', continent: 'North America' },
  { name: 'Uruguay', iso2: 'UY', continent: 'South America' },
  { name: 'Uzbekistan', iso2: 'UZ', continent: 'Asia' },
];

function normalizeIso2(v: string): string {
  return (v || '').trim().toUpperCase();
}

export function useTripsData() {
  const [data, setData] = useState<TripsJson | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        // 1) Try Firebase
        const cloud = await getTripsData();
        if (!cancelled && cloud) {
          setData(cloud);
          setLoading(false);
          return;
        }

        // 2) Fallback to bundled JSON and seed Firebase
        const res = await fetch('/data/trips.json');
        if (!res.ok) throw new Error('Не удалось загрузить данные о поездках');
        const json: TripsJson = await res.json();
        await saveTripsData(json);
        if (!cancelled) setData(json);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Неизвестная ошибка');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Persist changes to Firebase when `data` changes (after initial load)
  useEffect(() => {
    if (!data || loading) return;
    saveTripsData(data).catch(() => {
      // best-effort persistence; surface errors via UI later if needed
    });
  }, [data, loading]);

  const homeCountry = useMemo(() => normalizeIso2(data?.homeCountry || ''), [data?.homeCountry]);

  // IMPORTANT: ensure home country is always considered visited for the map (sustainable fix)
  const visitedIsoCodes = useMemo(() => {
    const visited = (data?.visited || []).map((t) => normalizeIso2(t.iso2)).filter(Boolean);
    const out = new Set<string>(visited);
    if (homeCountry) out.add(homeCountry);
    return Array.from(out);
  }, [data?.visited, homeCountry]);

  const getTripByIso = useCallback(
    (iso2: string): TripData | undefined => {
      const n = normalizeIso2(iso2);
      return data?.visited.find((trip) => normalizeIso2(trip.iso2) === n);
    },
    [data?.visited]
  );

  const getVisitedCountries = useCallback((): TripData[] => data?.visited || [], [data?.visited]);

  const getContinents = useCallback((): string[] => {
    const continents = new Set((data?.visited || []).map((t) => t.continent));
    return Array.from(continents).sort();
  }, [data?.visited]);

  const getTravelStats = useCallback(() => {
    const visited = data?.visited || [];
    const continentCounts: Record<string, number> = {};
    visited.forEach((trip) => {
      continentCounts[trip.continent] = (continentCounts[trip.continent] || 0) + 1;
    });
    const mostVisitedContinent =
      Object.entries(continentCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';
    const worldPercentage = Math.round((visited.length / TOTAL_COUNTRIES_IN_WORLD) * 100);
    return { countriesVisited: visited.length, worldPercentage, mostVisitedContinent, continentCounts };
  }, [data?.visited]);

  const addCountry = useCallback(
    (iso2: string) => {
      if (!data) return;
      const n = normalizeIso2(iso2);
      if (!n) return;
      if (data.visited.some((t) => normalizeIso2(t.iso2) === n)) return;

      const info = ALL_COUNTRIES.find((c) => c.iso2 === n);
      if (!info) return;

      const newTrip: TripData = {
        countryName: info.name,
        iso2: info.iso2,
        continent: info.continent,
        year: '',
        cities: [],
        notes: '',
        photos: [],
      };

      setData({
        ...data,
        visited: [...data.visited, newTrip].sort((a, b) => a.countryName.localeCompare(b.countryName)),
      });
    },
    [data]
  );

  const removeCountry = useCallback(
    (iso2: string) => {
      if (!data) return;
      const n = normalizeIso2(iso2);
      setData({ ...data, visited: data.visited.filter((t) => normalizeIso2(t.iso2) !== n) });
    },
    [data]
  );

  const updateTrip = useCallback(
    (iso2: string, updates: Partial<TripData>) => {
      if (!data) return;
      const n = normalizeIso2(iso2);
      setData({
        ...data,
        visited: data.visited.map((t) => (normalizeIso2(t.iso2) === n ? { ...t, ...updates } : t)),
      });
    },
    [data]
  );

  return {
    data,
    loading,
    error,
    visitedIsoCodes,
    homeCountry: homeCountry || null, // kept for compatibility, but not treated specially in UI
    getTripByIso,
    getVisitedCountries,
    getContinents,
    getTravelStats,
    addCountry,
    removeCountry,
    updateTrip,
  };
}
