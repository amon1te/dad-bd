const regionNames =
  typeof Intl !== 'undefined' && typeof (Intl as any).DisplayNames === 'function'
    ? new (Intl as any).DisplayNames(['ru'], { type: 'region' })
    : null;

export function ruCountryName(iso2: string, fallback?: string): string {
  const code = (iso2 || '').trim().toUpperCase();
  const name = code && regionNames ? regionNames.of(code) : undefined;
  // Some environments return the code itself; guard against that.
  if (name && name !== code) return name;
  return fallback || code;
}

const continentMap: Record<string, string> = {
  Africa: 'Африка',
  Europe: 'Европа',
  Asia: 'Азия',
  Oceania: 'Океания',
  'North America': 'Северная Америка',
  'South America': 'Южная Америка',
  Antarctica: 'Антарктида',
};

export function ruContinentName(continent: string, fallback?: string): string {
  const key = (continent || '').trim();
  return continentMap[key] || fallback || key;
}


