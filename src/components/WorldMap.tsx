import { memo, useCallback, useMemo, useState } from 'react';
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
  Marker,
} from 'react-simple-maps';
import { motion } from 'framer-motion';
import { geoArea, geoCentroid } from 'd3-geo';
import { Minus, Plus } from 'lucide-react';

const geoUrl = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

// ISO numeric to ISO2 mapping - keys are numeric codes WITHOUT leading zeros
const baseMapping: Record<number, string> = {
  4: 'AF', 8: 'AL', 12: 'DZ', 16: 'AS', 20: 'AD', 24: 'AO', 28: 'AG',
  31: 'AZ', 32: 'AR', 36: 'AU', 40: 'AT', 44: 'BS', 48: 'BH', 50: 'BD',
  51: 'AM', 52: 'BB', 56: 'BE', 60: 'BM', 64: 'BT', 68: 'BO', 70: 'BA',
  72: 'BW', 76: 'BR', 84: 'BZ', 90: 'SB', 92: 'VG', 96: 'BN', 100: 'BG',
  104: 'MM', 108: 'BI', 112: 'BY', 116: 'KH', 120: 'CM', 124: 'CA', 132: 'CV',
  136: 'KY', 140: 'CF', 144: 'LK', 148: 'TD', 152: 'CL', 156: 'CN', 158: 'TW',
  170: 'CO', 174: 'KM', 175: 'YT', 178: 'CG', 180: 'CD', 184: 'CK', 188: 'CR',
  191: 'HR', 192: 'CU', 196: 'CY', 203: 'CZ', 204: 'BJ', 208: 'DK', 212: 'DM',
  214: 'DO', 218: 'EC', 222: 'SV', 226: 'GQ', 231: 'ET', 232: 'ER', 233: 'EE',
  234: 'FO', 238: 'FK', 242: 'FJ', 246: 'FI', 250: 'FR', 254: 'GF', 258: 'PF',
  260: 'TF', 262: 'DJ', 266: 'GA', 268: 'GE', 270: 'GM', 275: 'PS', 276: 'DE',
  288: 'GH', 292: 'GI', 296: 'KI', 300: 'GR', 304: 'GL', 308: 'GD', 312: 'GP',
  316: 'GU', 320: 'GT', 324: 'GN', 328: 'GY', 332: 'HT', 336: 'VA', 340: 'HN',
  344: 'HK', 348: 'HU', 352: 'IS', 356: 'IN', 360: 'ID', 364: 'IR', 368: 'IQ',
  372: 'IE', 376: 'IL', 380: 'IT', 384: 'CI', 388: 'JM', 392: 'JP', 398: 'KZ',
  400: 'JO', 404: 'KE', 408: 'KP', 410: 'KR', 414: 'KW', 417: 'KG', 418: 'LA',
  422: 'LB', 426: 'LS', 428: 'LV', 430: 'LR', 434: 'LY', 438: 'LI', 440: 'LT',
  442: 'LU', 446: 'MO', 450: 'MG', 454: 'MW', 458: 'MY', 462: 'MV', 466: 'ML',
  470: 'MT', 474: 'MQ', 478: 'MR', 480: 'MU', 484: 'MX', 492: 'MC', 496: 'MN',
  498: 'MD', 499: 'ME', 500: 'MS', 504: 'MA', 508: 'MZ', 512: 'OM', 516: 'NA',
  520: 'NR', 524: 'NP', 528: 'NL', 531: 'CW', 533: 'AW', 534: 'SX', 535: 'BQ',
  540: 'NC', 548: 'VU', 554: 'NZ', 558: 'NI', 562: 'NE', 566: 'NG', 570: 'NU',
  574: 'NF', 578: 'NO', 580: 'MP', 583: 'FM', 584: 'MH', 585: 'PW', 586: 'PK',
  591: 'PA', 598: 'PG', 600: 'PY', 604: 'PE', 608: 'PH', 612: 'PN', 616: 'PL',
  620: 'PT', 624: 'GW', 626: 'TL', 630: 'PR', 634: 'QA', 638: 'RE', 642: 'RO',
  643: 'RU', 646: 'RW', 652: 'BL', 654: 'SH', 659: 'KN', 660: 'AI', 662: 'LC',
  663: 'MF', 666: 'PM', 670: 'VC', 674: 'SM', 678: 'ST', 682: 'SA', 686: 'SN',
  688: 'RS', 690: 'SC', 694: 'SL', 702: 'SG', 703: 'SK', 704: 'VN', 705: 'SI',
  706: 'SO', 710: 'ZA', 716: 'ZW', 724: 'ES', 728: 'SS', 729: 'SD', 732: 'EH',
  740: 'SR', 744: 'SJ', 748: 'SZ', 752: 'SE', 756: 'CH', 760: 'SY', 762: 'TJ',
  764: 'TH', 768: 'TG', 772: 'TK', 776: 'TO', 780: 'TT', 784: 'AE', 788: 'TN',
  792: 'TR', 795: 'TM', 796: 'TC', 798: 'TV', 800: 'UG', 804: 'UA', 807: 'MK',
  818: 'EG', 826: 'GB', 831: 'GG', 832: 'JE', 833: 'IM', 834: 'TZ', 840: 'US',
  850: 'VI', 854: 'BF', 858: 'UY', 860: 'UZ', 862: 'VE', 876: 'WF', 882: 'WS',
  887: 'YE', 894: 'ZM', 10: 'AQ',
};

// Convert numeric ID (with or without leading zeros) to ISO2
function numericIdToIso2(id: string | number): string {
  // Parse to number to remove leading zeros, then look up
  const num = typeof id === 'string' ? parseInt(id, 10) : id;
  if (isNaN(num)) return '';
  return baseMapping[num] || '';
}

// Country name to ISO2 fallback mapping
const nameToIso2: Record<string, string> = {
  'Afghanistan': 'AF', 'Albania': 'AL', 'Algeria': 'DZ', 'Andorra': 'AD',
  'Angola': 'AO', 'Argentina': 'AR', 'Armenia': 'AM', 'Australia': 'AU',
  'Austria': 'AT', 'Azerbaijan': 'AZ', 'Bahamas': 'BS', 'Bahrain': 'BH',
  'Bangladesh': 'BD', 'Barbados': 'BB', 'Belarus': 'BY', 'Belgium': 'BE',
  'Belize': 'BZ', 'Benin': 'BJ', 'Bhutan': 'BT', 'Bolivia': 'BO',
  'Bosnia and Herzegovina': 'BA', 'Bosnia': 'BA', 'Botswana': 'BW',
  'Brazil': 'BR', 'Brunei': 'BN', 'Bulgaria': 'BG', 'Burkina Faso': 'BF',
  'Burundi': 'BI', 'Cambodia': 'KH', 'Cameroon': 'CM', 'Canada': 'CA',
  'Central African Republic': 'CF', 'Chad': 'TD', 'Chile': 'CL', 'China': 'CN',
  'Colombia': 'CO', 'Comoros': 'KM', 'Congo': 'CG', 'DR Congo': 'CD',
  'Democratic Republic of the Congo': 'CD', 'Costa Rica': 'CR', 'Croatia': 'HR',
  'Cuba': 'CU', 'Cyprus': 'CY', 'Czechia': 'CZ', 'Czech Republic': 'CZ',
  'Denmark': 'DK', 'Djibouti': 'DJ', 'Dominican Republic': 'DO', 'Ecuador': 'EC',
  'Egypt': 'EG', 'El Salvador': 'SV', 'Equatorial Guinea': 'GQ', 'Eritrea': 'ER',
  'Estonia': 'EE', 'Eswatini': 'SZ', 'Ethiopia': 'ET', 'Fiji': 'FJ',
  'Finland': 'FI', 'France': 'FR', 'Gabon': 'GA', 'Gambia': 'GM', 'Georgia': 'GE',
  'Germany': 'DE', 'Ghana': 'GH', 'Greece': 'GR', 'Greenland': 'GL',
  'Guatemala': 'GT', 'Guinea': 'GN', 'Guinea-Bissau': 'GW', 'Guyana': 'GY',
  'Haiti': 'HT', 'Honduras': 'HN', 'Hong Kong': 'HK', 'Hungary': 'HU',
  'Iceland': 'IS', 'India': 'IN', 'Indonesia': 'ID', 'Iran': 'IR', 'Iraq': 'IQ',
  'Ireland': 'IE', 'Israel': 'IL', 'Italy': 'IT', 'Ivory Coast': 'CI',
  "Côte d'Ivoire": 'CI', 'Jamaica': 'JM', 'Japan': 'JP', 'Jordan': 'JO',
  'Kazakhstan': 'KZ', 'Kenya': 'KE', 'Kuwait': 'KW', 'Kyrgyzstan': 'KG',
  'Laos': 'LA', 'Latvia': 'LV', 'Lebanon': 'LB', 'Lesotho': 'LS', 'Liberia': 'LR',
  'Libya': 'LY', 'Lithuania': 'LT', 'Luxembourg': 'LU', 'Madagascar': 'MG',
  'Malawi': 'MW', 'Malaysia': 'MY', 'Maldives': 'MV', 'Mali': 'ML', 'Malta': 'MT',
  'Mauritania': 'MR', 'Mauritius': 'MU', 'Mexico': 'MX', 'Moldova': 'MD',
  'Mongolia': 'MN', 'Montenegro': 'ME', 'Morocco': 'MA', 'Mozambique': 'MZ',
  'Myanmar': 'MM', 'Namibia': 'NA', 'Nepal': 'NP', 'Netherlands': 'NL',
  'New Zealand': 'NZ', 'Nicaragua': 'NI', 'Niger': 'NE', 'Nigeria': 'NG',
  'North Korea': 'KP', 'North Macedonia': 'MK', 'Macedonia': 'MK', 'Norway': 'NO',
  'Oman': 'OM', 'Pakistan': 'PK', 'Panama': 'PA', 'Papua New Guinea': 'PG',
  'Paraguay': 'PY', 'Peru': 'PE', 'Philippines': 'PH', 'Poland': 'PL',
  'Portugal': 'PT', 'Qatar': 'QA', 'Romania': 'RO', 'Russia': 'RU', 'Rwanda': 'RW',
  'Saudi Arabia': 'SA', 'Senegal': 'SN', 'Serbia': 'RS', 'Sierra Leone': 'SL',
  'Singapore': 'SG', 'Slovakia': 'SK', 'Slovenia': 'SI', 'Somalia': 'SO',
  'South Africa': 'ZA', 'South Korea': 'KR', 'Korea': 'KR', 'South Sudan': 'SS',
  'Spain': 'ES', 'Sri Lanka': 'LK', 'Sudan': 'SD', 'Suriname': 'SR',
  'Sweden': 'SE', 'Switzerland': 'CH', 'Syria': 'SY', 'Taiwan': 'TW',
  'Tajikistan': 'TJ', 'Tanzania': 'TZ', 'Thailand': 'TH', 'Togo': 'TG',
  'Trinidad and Tobago': 'TT', 'Tunisia': 'TN', 'Turkey': 'TR', 'Turkmenistan': 'TM',
  'Uganda': 'UG', 'Ukraine': 'UA', 'United Arab Emirates': 'AE', 'UAE': 'AE',
  'United Kingdom': 'GB', 'UK': 'GB', 'United States of America': 'US',
  'United States': 'US', 'USA': 'US', 'Uruguay': 'UY', 'Uzbekistan': 'UZ',
  'Venezuela': 'VE', 'Vietnam': 'VN', 'Yemen': 'YE', 'Zambia': 'ZM',
  'Zimbabwe': 'ZW', 'Kosovo': 'XK', 'Antarctica': 'AQ',
};

// ISO Alpha-3 to ISO2 mapping
const isoAlpha3ToIso2: Record<string, string> = {
  'AFG': 'AF', 'ALB': 'AL', 'DZA': 'DZ', 'AND': 'AD', 'AGO': 'AO', 'ARG': 'AR',
  'ARM': 'AM', 'AUS': 'AU', 'AUT': 'AT', 'AZE': 'AZ', 'BHS': 'BS', 'BHR': 'BH',
  'BGD': 'BD', 'BRB': 'BB', 'BLR': 'BY', 'BEL': 'BE', 'BLZ': 'BZ', 'BEN': 'BJ',
  'BTN': 'BT', 'BOL': 'BO', 'BIH': 'BA', 'BWA': 'BW', 'BRA': 'BR', 'BRN': 'BN',
  'BGR': 'BG', 'BFA': 'BF', 'BDI': 'BI', 'KHM': 'KH', 'CMR': 'CM', 'CAN': 'CA',
  'CAF': 'CF', 'TCD': 'TD', 'CHL': 'CL', 'CHN': 'CN', 'COL': 'CO', 'COM': 'KM',
  'COG': 'CG', 'COD': 'CD', 'CRI': 'CR', 'HRV': 'HR', 'CUB': 'CU', 'CYP': 'CY',
  'CZE': 'CZ', 'DNK': 'DK', 'DJI': 'DJ', 'DOM': 'DO', 'ECU': 'EC', 'EGY': 'EG',
  'SLV': 'SV', 'GNQ': 'GQ', 'ERI': 'ER', 'EST': 'EE', 'SWZ': 'SZ', 'ETH': 'ET',
  'FJI': 'FJ', 'FIN': 'FI', 'FRA': 'FR', 'GAB': 'GA', 'GMB': 'GM', 'GEO': 'GE',
  'DEU': 'DE', 'GHA': 'GH', 'GRC': 'GR', 'GRL': 'GL', 'GTM': 'GT', 'GIN': 'GN',
  'GNB': 'GW', 'GUY': 'GY', 'HTI': 'HT', 'HND': 'HN', 'HKG': 'HK', 'HUN': 'HU',
  'ISL': 'IS', 'IND': 'IN', 'IDN': 'ID', 'IRN': 'IR', 'IRQ': 'IQ', 'IRL': 'IE',
  'ISR': 'IL', 'ITA': 'IT', 'CIV': 'CI', 'JAM': 'JM', 'JPN': 'JP', 'JOR': 'JO',
  'KAZ': 'KZ', 'KEN': 'KE', 'KWT': 'KW', 'KGZ': 'KG', 'LAO': 'LA', 'LVA': 'LV',
  'LBN': 'LB', 'LSO': 'LS', 'LBR': 'LR', 'LBY': 'LY', 'LTU': 'LT', 'LUX': 'LU',
  'MDG': 'MG', 'MWI': 'MW', 'MYS': 'MY', 'MDV': 'MV', 'MLI': 'ML', 'MLT': 'MT',
  'MRT': 'MR', 'MUS': 'MU', 'MEX': 'MX', 'MDA': 'MD', 'MNG': 'MN', 'MNE': 'ME',
  'MAR': 'MA', 'MOZ': 'MZ', 'MMR': 'MM', 'NAM': 'NA', 'NPL': 'NP', 'NLD': 'NL',
  'NZL': 'NZ', 'NIC': 'NI', 'NER': 'NE', 'NGA': 'NG', 'PRK': 'KP', 'MKD': 'MK',
  'NOR': 'NO', 'OMN': 'OM', 'PAK': 'PK', 'PAN': 'PA', 'PNG': 'PG', 'PRY': 'PY',
  'PER': 'PE', 'PHL': 'PH', 'POL': 'PL', 'PRT': 'PT', 'QAT': 'QA', 'ROU': 'RO',
  'RUS': 'RU', 'RWA': 'RW', 'SAU': 'SA', 'SEN': 'SN', 'SRB': 'RS', 'SLE': 'SL',
  'SGP': 'SG', 'SVK': 'SK', 'SVN': 'SI', 'SOM': 'SO', 'ZAF': 'ZA', 'KOR': 'KR',
  'SSD': 'SS', 'ESP': 'ES', 'LKA': 'LK', 'SDN': 'SD', 'SUR': 'SR', 'SWE': 'SE',
  'CHE': 'CH', 'SYR': 'SY', 'TWN': 'TW', 'TJK': 'TJ', 'TZA': 'TZ', 'THA': 'TH',
  'TGO': 'TG', 'TTO': 'TT', 'TUN': 'TN', 'TUR': 'TR', 'TKM': 'TM', 'UGA': 'UG',
  'UKR': 'UA', 'ARE': 'AE', 'GBR': 'GB', 'USA': 'US', 'URY': 'UY', 'UZB': 'UZ',
  'VEN': 'VE', 'VNM': 'VN', 'YEM': 'YE', 'ZMB': 'ZM', 'ZWE': 'ZW', 'XKX': 'XK',
  'KOS': 'XK', 'ATA': 'AQ',
};

// Get ISO2 code from geography object - tries multiple methods
function getIso2FromGeo(geo: any): string {
  // Method 1: Try numeric ID (most reliable for world-atlas)
  const rawId = geo.id;
  if (rawId !== undefined && rawId !== null) {
    const iso2 = numericIdToIso2(rawId);
    if (iso2) return iso2;
  }
  
  // Method 2: Try ISO_A3 property
  const isoA3 = geo.properties?.ISO_A3;
  if (isoA3 && isoAlpha3ToIso2[isoA3]) {
    return isoAlpha3ToIso2[isoA3];
  }
  
  // Method 3: Try ISO_A2 property directly
  const isoA2 = geo.properties?.ISO_A2;
  if (isoA2 && isoA2 !== '-99' && isoA2.length === 2) {
    return isoA2;
  }
  
  // Method 4: Try country name
  const name = geo.properties?.name || geo.properties?.NAME || geo.properties?.ADMIN;
  if (name && nameToIso2[name]) {
    return nameToIso2[name];
  }
  
  return '';
}

type MarkerInfo = {
  iso2: string;
  coordinates: [number, number];
  url: string;
  count: number;
};

// Some countries have overseas territories that pull the centroid away (e.g., France).
// We compute the centroid of the largest polygon to get a “mainland-ish” point.
function getLargestPolygonCentroid(geo: any): [number, number] {
  try {
    const g = geo?.geometry;
    if (!g) return geoCentroid(geo) as unknown as [number, number];
    if (g.type === 'Polygon') return geoCentroid(geo) as unknown as [number, number];

    if (g.type === 'MultiPolygon' && Array.isArray(g.coordinates)) {
      let bestPoly: any = null;
      let bestArea = -1;
      for (const polyCoords of g.coordinates) {
        const polyFeature = { type: 'Feature', properties: geo.properties, geometry: { type: 'Polygon', coordinates: polyCoords } };
        const a = geoArea(polyFeature as any);
        if (a > bestArea) {
          bestArea = a;
          bestPoly = polyFeature;
        }
      }
      if (bestPoly) return geoCentroid(bestPoly as any) as unknown as [number, number];
    }
    return geoCentroid(geo) as unknown as [number, number];
  } catch {
    return geoCentroid(geo) as unknown as [number, number];
  }
}

interface WorldMapProps {
  visitedIsoCodes: string[];
  selectedIso: string | null;
  onSelectCountry: (iso2: string | null) => void;
  photoPreviews?: Record<string, string>;
  photoCounts?: Record<string, number>;
}

// Custom comparison - re-render when visitedIsoCodes content changes
function arePropsEqual(prevProps: WorldMapProps, nextProps: WorldMapProps) {
  if (prevProps.selectedIso !== nextProps.selectedIso) return false;
  if (prevProps.visitedIsoCodes.length !== nextProps.visitedIsoCodes.length) return false;
  const prevSet = new Set(prevProps.visitedIsoCodes);
  const nextSet = new Set(nextProps.visitedIsoCodes);
  if (prevSet.size !== nextSet.size) return false;
  for (const iso of nextSet) {
    if (!prevSet.has(iso)) return false;
  }
  return true;
}

export const WorldMap = memo(function WorldMap({
  visitedIsoCodes,
  selectedIso,
  onSelectCountry,
  photoPreviews,
  photoCounts,
}: WorldMapProps) {
  const [zoom, setZoom] = useState(1);
  // Allow a tiny zoom-out so pins can become slightly larger than the baseline if desired
  const MIN_ZOOM = 0.8;
  const MAX_ZOOM = 8;
  const ZOOM_STEP = 0.5;

  const visitedSet = useMemo(
    () =>
      new Set(
        (visitedIsoCodes || [])
          .map((c) => (c || '').trim().toUpperCase())
          .filter(Boolean)
      ),
    [visitedIsoCodes]
  );

  const normalizedPreviews = useMemo(() => {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(photoPreviews || {})) {
      const iso = (k || '').trim().toUpperCase();
      if (iso && v) out[iso] = v;
    }
    return out;
  }, [photoPreviews]);

  const normalizedCounts = useMemo(() => {
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(photoCounts || {})) {
      const iso = (k || '').trim().toUpperCase();
      if (iso && typeof v === 'number') out[iso] = v;
    }
    return out;
  }, [photoCounts]);

  const handleCountryClick = useCallback(
    (geo: any) => {
      const iso2 = getIso2FromGeo(geo);
      if (visitedSet.has(iso2)) {
        onSelectCountry(iso2);
      } else {
        onSelectCountry(null);
      }
    },
    [visitedSet, onSelectCountry]
  );

  const getCountryClass = useCallback(
    (geo: any) => {
      const iso2 = getIso2FromGeo(geo);
      const isVisited = visitedSet.has(iso2);
      const isSelected = selectedIso === iso2;

      if (isSelected) return 'map-country visited selected';
      if (isVisited) return 'map-country visited';
      return 'map-country';
    },
    [visitedSet, selectedIso]
  );

  // Scale pins inversely with zoom so they don't grow too large when zooming in.
  // At zoom=1 pins look perfect; at zoom>1 they shrink, at zoom<1 they grow a bit.
  const pinScale = useMemo(() => {
    const raw = 1 / (zoom || 1);
    // Clamp so pins remain usable
    return Math.min(1.4, Math.max(0.45, raw));
  }, [zoom]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8 }}
      className="relative w-full h-full map-gradient rounded-2xl overflow-hidden shadow-2xl"
    >
      {/* Zoom controls */}
      <div className="absolute top-4 right-4 z-20 flex flex-col bg-background/80 backdrop-blur-xl border border-border rounded-xl overflow-hidden shadow-lg pointer-events-auto">
        <button
          onClick={() => setZoom((z) => Math.min(MAX_ZOOM, Number((z + ZOOM_STEP).toFixed(2))))}
          disabled={zoom >= MAX_ZOOM}
          className="p-2 hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          title="Увеличить"
          aria-label="Увеличить"
        >
          <Plus className="w-5 h-5" />
        </button>
        <div className="h-px bg-border" />
        <button
          onClick={() => setZoom((z) => Math.max(MIN_ZOOM, Number((z - ZOOM_STEP).toFixed(2))))}
          disabled={zoom <= MIN_ZOOM}
          className="p-2 hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          title="Уменьшить"
          aria-label="Уменьшить"
        >
          <Minus className="w-5 h-5" />
        </button>
      </div>

      <ComposableMap
        projection="geoMercator"
        projectionConfig={{
          scale: 140,
          center: [0, 30],
        }}
        className="w-full h-full"
      >
        <ZoomableGroup
          center={[0, 20]}
          zoom={zoom}
          minZoom={MIN_ZOOM}
          maxZoom={MAX_ZOOM}
          onMoveEnd={(pos) => {
            if (typeof pos?.zoom === 'number') setZoom(pos.zoom);
          }}
        >
          <Geographies geography={geoUrl}>
            {({ geographies }) => {
              const markers: MarkerInfo[] = [];

              const geoNodes = geographies.map((geo) => {
                const iso2 = getIso2FromGeo(geo);
                const isVisited = visitedSet.has(iso2);

                const previewUrl = normalizedPreviews[iso2];
                const count = normalizedCounts[iso2] || 0;
                if (previewUrl) {
                  markers.push({
                    iso2,
                    url: previewUrl,
                    count,
                    coordinates: getLargestPolygonCentroid(geo),
                  });
                }

                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    onClick={() => handleCountryClick(geo)}
                    className={getCountryClass(geo)}
                    tabIndex={isVisited ? 0 : -1}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && isVisited) {
                        handleCountryClick(geo);
                      }
                    }}
                    style={{
                      default: { outline: 'none' },
                      hover: { outline: 'none' },
                      pressed: { outline: 'none' },
                    }}
                  />
                );
              });

              // Render pins AFTER all countries so they always sit on top.
              const markerNodes = markers.map((m) => (
                <Marker key={`pin-${m.iso2}`} coordinates={m.coordinates}>
                  <g style={{ pointerEvents: 'none' }} transform={`scale(${pinScale})`}>
                    <defs>
                      <clipPath id={`clip-${m.iso2}`}>
                        <circle cx="0" cy="0" r="11" />
                      </clipPath>
                    </defs>
                    <circle cx="0" cy="0" r="13.5" fill="rgba(0,0,0,0.28)" />
                    <circle cx="0" cy="0" r="13" fill="white" opacity="0.92" />
                    <image
                      href={m.url}
                      x={-11}
                      y={-11}
                      width={22}
                      height={22}
                      preserveAspectRatio="xMidYMid slice"
                      clipPath={`url(#clip-${m.iso2})`}
                    />
                    {m.count > 1 && (
                      <g>
                        <circle cx="12" cy="-12" r="8" fill="hsl(var(--primary))" />
                        <text
                          x="12"
                          y="-9"
                          textAnchor="middle"
                          fontSize="9"
                          fontWeight="800"
                          fill="white"
                        >
                          {m.count}
                        </text>
                      </g>
                    )}
                  </g>
                </Marker>
              ));

              return (
                <>
                  {geoNodes}
                  {markerNodes}
                </>
              );
            }}
          </Geographies>
        </ZoomableGroup>
      </ComposableMap>
    </motion.div>
  );
}, arePropsEqual);
