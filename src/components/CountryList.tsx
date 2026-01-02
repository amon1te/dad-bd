import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, Trash2, X } from 'lucide-react';
import { TripData } from '@/types/trips';
import { ALL_COUNTRIES } from '@/hooks/useTripsData';
import { ruCountryName, ruContinentName } from '@/lib/i18nRu';

interface CountryListProps {
  countries: TripData[];
  selectedIso: string | null;
  onSelectCountry: (iso2: string) => void;
  continents: string[];
  onAddCountry: (iso2: string) => void;
  onRemoveCountry: (iso2: string) => void;
}

export function CountryList({
  countries,
  selectedIso,
  onSelectCountry,
  continents,
  onAddCountry,
  onRemoveCountry,
}: CountryListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedContinent, setSelectedContinent] = useState<string | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [addQuery, setAddQuery] = useState('');

  const filteredCountries = useMemo(() => {
    return countries.filter((country) => {
      const displayName = ruCountryName(country.iso2, country.countryName);
      const matchesSearch = displayName.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesContinent =
        !selectedContinent || country.continent === selectedContinent;
      return matchesSearch && matchesContinent;
    });
  }, [countries, searchQuery, selectedContinent]);

  const addOptions = useMemo(() => {
    const visited = new Set(countries.map((c) => c.iso2.toUpperCase()));
    return ALL_COUNTRIES.filter((c) => !visited.has(c.iso2))
      .filter((c) => ruCountryName(c.iso2, c.name).toLowerCase().includes(addQuery.toLowerCase()))
      .slice(0, 50);
  }, [countries, addQuery]);

  return (
    <div className="flex flex-col h-full bg-sidebar p-4 rounded-2xl border border-sidebar-border">
      <div className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-display font-semibold text-sidebar-foreground">
            Посещённые страны
          </h2>
          <button
            onClick={() => setIsAddOpen(true)}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Добавить
          </button>
        </div>
        
        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Поиск стран…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input pl-10"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Continent Filter */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedContinent(null)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              !selectedContinent
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
            }`}
          >
            Все
          </button>
          {continents.map((continent) => (
            <button
              key={continent}
              onClick={() => setSelectedContinent(continent)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                selectedContinent === continent
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
              }`}
            >
              {ruContinentName(continent)}
            </button>
          ))}
        </div>
      </div>

      {/* Country List */}
      <div className="flex-1 overflow-y-auto space-y-1">
        <AnimatePresence mode="popLayout">
          {filteredCountries.map((country, index) => (
            <motion.button
              key={country.iso2}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ delay: index * 0.03 }}
              onClick={() => onSelectCountry(country.iso2)}
              className={`country-list-item w-full text-left ${
                selectedIso === country.iso2 ? 'active' : ''
              }`}
            >
              <span className="text-2xl">
                {getFlagEmoji(country.iso2)}
              </span>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{ruCountryName(country.iso2, country.countryName)}</div>
                {((country.year || '').trim() || (country.cities?.length ?? 0) > 0) && (
                  <div className="text-xs text-muted-foreground">
                    {((country.year || '').trim() && (
                      <span>{country.year}</span>
                    )) || null}
                    {((country.year || '').trim() && (country.cities?.length ?? 0) > 0) ? (
                      <span> • </span>
                    ) : null}
                    {(country.cities?.length ?? 0) > 0 ? (
                      <>
                        {country.cities.slice(0, 2).join(', ')}
                        {country.cities.length > 2 && ` +${country.cities.length - 2}`}
                      </>
                    ) : null}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="badge-continent">{ruContinentName(country.continent)}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveCountry(country.iso2);
                  }}
                  className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                  title="Удалить"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </motion.button>
          ))}
        </AnimatePresence>

        {filteredCountries.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <p>Ничего не найдено</p>
          </div>
        )}
      </div>

      {/* Add Country Modal */}
      <AnimatePresence>
        {isAddOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-50"
              onClick={() => setIsAddOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.98 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(520px,calc(100vw-2rem))] bg-background border border-border rounded-2xl shadow-2xl z-50 overflow-hidden"
            >
              <div className="p-4 border-b border-border flex items-center justify-between">
                <div>
                  <div className="font-semibold">Добавить страну</div>
                  <div className="text-xs text-muted-foreground">Выберите страну, чтобы отметить её как посещённую</div>
                </div>
                <button
                  onClick={() => setIsAddOpen(false)}
                  className="p-2 rounded-lg hover:bg-secondary transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-4 space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    value={addQuery}
                    onChange={(e) => setAddQuery(e.target.value)}
                    placeholder="Введите название страны…"
                    className="search-input pl-10"
                    autoFocus
                  />
                </div>

                <div className="max-h-[50vh] overflow-y-auto space-y-1">
                  {addOptions.map((c) => (
                    <button
                      key={c.iso2}
                      onClick={() => {
                        onAddCountry(c.iso2);
                        setIsAddOpen(false);
                        setAddQuery('');
                      }}
                      className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-secondary transition-colors text-left"
                    >
                      <span className="text-2xl">{getFlagEmoji(c.iso2)}</span>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{ruCountryName(c.iso2, c.name)}</div>
                        <div className="text-xs text-muted-foreground">{ruContinentName(c.continent)}</div>
                      </div>
                    </button>
                  ))}
                  {addOptions.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <p>Нет совпадений</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// Convert ISO2 to flag emoji
function getFlagEmoji(iso2: string): string {
  const codePoints = iso2
    .toUpperCase()
    .split('')
    .map((char) => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}
