import { useState, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Menu, X, Users } from 'lucide-react';
import { useTripsData } from '@/hooks/useTripsData';
import { useConfetti } from '@/hooks/useConfetti';
import { BirthdayHeader } from '@/components/BirthdayHeader';
import { TravelStats } from '@/components/TravelStats';
import { WorldMap } from '@/components/WorldMap';
import { CountryList } from '@/components/CountryList';
import { CountryPanel } from '@/components/CountryPanel';
import { FamilyManager } from '@/components/FamilyManager';
import { usePhotoPreviews } from '@/hooks/usePhotoPreviews';
import { ruContinentName } from '@/lib/i18nRu';

const Index = () => {
  const {
    data,
    loading,
    visitedIsoCodes,
    getTripByIso,
    getVisitedCountries,
    getContinents,
    getTravelStats,
    addCountry,
    removeCountry,
    updateTrip,
  } = useTripsData();

  const { photoPreviews, photoCounts, registerPhoto } = usePhotoPreviews();

  const [selectedIso, setSelectedIso] = useState<string | null>(null);
  const [showSidebar, setShowSidebar] = useState(false);
  const [showFamilyManager, setShowFamilyManager] = useState(false);

  // Fire confetti on first load
  useConfetti(!loading);

  const visitedCountries = useMemo(() => getVisitedCountries(), [data]);
  const continents = useMemo(() => getContinents(), [data]);
  const stats = useMemo(() => getTravelStats(), [data]);
  const selectedTrip = selectedIso ? getTripByIso(selectedIso) : null;

  const handleSelectCountry = useCallback((iso2: string | null) => {
    setSelectedIso(iso2);
    if (iso2) setShowSidebar(false); // Close sidebar on mobile when selecting
  }, []);

  const handleClosePanel = useCallback(() => {
    setSelectedIso(null);
  }, []);

  const handleNavigate = useCallback(
    (direction: 'prev' | 'next') => {
      if (!selectedIso) return;
      const currentIndex = visitedCountries.findIndex(
        (c) => c.iso2 === selectedIso
      );
      if (currentIndex === -1) return;

      const newIndex =
        direction === 'prev'
          ? Math.max(0, currentIndex - 1)
          : Math.min(visitedCountries.length - 1, currentIndex + 1);

      setSelectedIso(visitedCountries[newIndex].iso2);
    },
    [selectedIso, visitedCountries]
  );

  const currentIndex = selectedIso
    ? visitedCountries.findIndex((c) => c.iso2 === selectedIso)
    : -1;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Загружаем воспоминания о путешествиях…</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <BirthdayHeader
        title="С 50-летием, Папа! 🎉"
        subtitle="Карта мест, которые мы посетили, и воспоминаний, которые мы создали вместе."
      />

      {/* Stats */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="px-4 pb-8"
      >
        <TravelStats
          countriesVisited={stats.countriesVisited}
          worldPercentage={stats.worldPercentage}
          mostVisitedContinent={ruContinentName(stats.mostVisitedContinent)}
        />
      </motion.section>

      {/* Main Content */}
      <main className="px-4 pb-8">
        <div className="max-w-[1800px] mx-auto">
          {/* Mobile Sidebar Toggle */}
          <div className="lg:hidden mb-4">
            <button
              onClick={() => setShowSidebar(!showSidebar)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-secondary text-secondary-foreground"
            >
              {showSidebar ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              <span>{showSidebar ? 'Скрыть' : 'Показать'} список стран</span>
            </button>
          </div>

          {/* Keep the sidebar and map the same height on desktop so the list scrolls inside its container */}
          <div className="flex flex-col lg:flex-row gap-6 lg:items-stretch lg:h-[650px]">
            {/* Sidebar - Desktop always visible, Mobile toggleable */}
            <motion.aside
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className={`lg:w-80 xl:w-96 flex-shrink-0 ${
                showSidebar ? 'block' : 'hidden lg:block'
              } h-[500px] lg:h-full`}
            >
              <CountryList
                countries={visitedCountries}
                selectedIso={selectedIso}
                onSelectCountry={handleSelectCountry}
                continents={continents}
                onAddCountry={addCountry}
                onRemoveCountry={removeCountry}
              />
            </motion.aside>

            {/* Map */}
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              className="flex-1 min-h-[400px] lg:h-full"
            >
              <WorldMap
                visitedIsoCodes={visitedIsoCodes}
                selectedIso={selectedIso}
                onSelectCountry={handleSelectCountry}
                photoPreviews={photoPreviews}
                photoCounts={photoCounts}
              />
            </motion.div>
          </div>
        </div>
      </main>

      {/* Country Panel */}
      <CountryPanel
        trip={selectedTrip}
        isOpen={!!selectedTrip}
        onClose={handleClosePanel}
        onNavigate={handleNavigate}
        hasPrev={currentIndex > 0}
        hasNext={currentIndex < visitedCountries.length - 1}
        onUpdateTrip={updateTrip}
        onPhotoUploaded={registerPhoto}
      />

      {/* Footer */}
      <footer className="py-6 text-center text-sm text-muted-foreground border-t border-border">
        <p>
          Создано в честь юбилея Папы, с любовью от Shaki ❤️
          <br />
          <br />
          03.01.2026
        </p>
      </footer>

      {/* Family Manager Button (fixed position) */}
      <button
        onClick={() => setShowFamilyManager(true)}
        className="fixed bottom-6 right-6 flex items-center gap-2 px-4 py-3 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-all hover:scale-105 z-30"
        title="Семья"
      >
        <Users className="w-5 h-5" />
        <span className="hidden sm:inline font-medium">Семья</span>
      </button>

      {/* Family Manager Modal */}
      <FamilyManager 
        isOpen={showFamilyManager} 
        onClose={() => setShowFamilyManager(false)} 
      />
    </div>
  );
};

export default Index;
