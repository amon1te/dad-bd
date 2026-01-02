import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, ImageOff } from 'lucide-react';

interface PhotoGalleryProps {
  photos: string[];
  countryName: string;
}

export function PhotoGallery({ photos, countryName }: PhotoGalleryProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [imageError, setImageError] = useState<Set<number>>(new Set());

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev === 0 ? photos.length - 1 : prev - 1));
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev === photos.length - 1 ? 0 : prev + 1));
  };

  const handleImageError = (index: number) => {
    setImageError((prev) => new Set([...prev, index]));
  };

  if (photos.length === 0) {
    return (
      <div className="relative aspect-video bg-secondary rounded-xl flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <ImageOff className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>No photos available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="relative aspect-video overflow-hidden rounded-xl bg-secondary">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0"
          >
            {imageError.has(currentIndex) ? (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-accent/20">
                <div className="text-center text-foreground/70">
                  <ImageOff className="w-16 h-16 mx-auto mb-3 opacity-50" />
                  <p className="font-display text-lg">{countryName}</p>
                  <p className="text-sm text-muted-foreground mt-1">Photo {currentIndex + 1}</p>
                </div>
              </div>
            ) : (
              <img
                src={photos[currentIndex]}
                alt={`${countryName} - Photo ${currentIndex + 1}`}
                onError={() => handleImageError(currentIndex)}
                className="w-full h-full object-cover"
              />
            )}
          </motion.div>
        </AnimatePresence>

        {/* Navigation Arrows */}
        {photos.length > 1 && (
          <>
            <button
              onClick={goToPrevious}
              className="gallery-nav-btn left-3"
              aria-label="Previous photo"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={goToNext}
              className="gallery-nav-btn right-3"
              aria-label="Next photo"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </>
        )}

        {/* Dots Indicator */}
        {photos.length > 1 && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2">
            {photos.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentIndex(index)}
                className={`w-2 h-2 rounded-full transition-all ${
                  index === currentIndex
                    ? 'bg-primary w-6'
                    : 'bg-background/50 hover:bg-background/80'
                }`}
                aria-label={`Go to photo ${index + 1}`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Photo Counter */}
      <div className="absolute top-3 right-3 px-3 py-1 rounded-full bg-background/80 backdrop-blur-sm text-sm font-medium">
        {currentIndex + 1} / {photos.length}
      </div>
    </div>
  );
}
