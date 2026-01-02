import { useCallback, useEffect, useMemo, useState } from 'react';
import { getAllPhotos, StoredPhoto } from '@/lib/storage';

type PreviewEntry = { url: string; createdAt: number; count: number };

function normalizeIso2(v: string): string {
  return (v || '').trim().toUpperCase();
}

export function usePhotoPreviews() {
  const [byIso, setByIso] = useState<Record<string, PreviewEntry>>({});
  const [loading, setLoading] = useState(true);

  const rebuildFromPhotos = useCallback((photos: StoredPhoto[]) => {
    const next: Record<string, PreviewEntry> = {};
    for (const p of photos) {
      const iso = normalizeIso2(p.countryIso);
      if (!iso) continue;
      const current = next[iso];
      const entry: PreviewEntry = current
        ? { ...current, count: current.count + 1 }
        : { url: p.url, createdAt: p.createdAt, count: 1 };

      // Keep the latest photo as the preview image
      if (!current || p.createdAt > current.createdAt) {
        entry.url = p.url;
        entry.createdAt = p.createdAt;
      }
      next[iso] = entry;
    }
    setByIso(next);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const photos = await getAllPhotos();
      rebuildFromPhotos(photos);
    } finally {
      setLoading(false);
    }
  }, [rebuildFromPhotos]);

  useEffect(() => {
    refresh().catch(() => {
      setLoading(false);
    });
  }, [refresh]);

  const registerPhoto = useCallback((photo: StoredPhoto) => {
    const iso = normalizeIso2(photo.countryIso);
    if (!iso) return;

    setByIso((prev) => {
      const current = prev[iso];
      const nextEntry: PreviewEntry = current
        ? {
            url: current.url,
            createdAt: current.createdAt,
            count: current.count + 1,
          }
        : { url: photo.url, createdAt: photo.createdAt, count: 1 };

      if (!current || photo.createdAt >= current.createdAt) {
        nextEntry.url = photo.url;
        nextEntry.createdAt = photo.createdAt;
      }
      return { ...prev, [iso]: nextEntry };
    });
  }, []);

  const photoPreviews = useMemo(() => {
    const out: Record<string, string> = {};
    for (const [iso, entry] of Object.entries(byIso)) out[iso] = entry.url;
    return out;
  }, [byIso]);

  const photoCounts = useMemo(() => {
    const out: Record<string, number> = {};
    for (const [iso, entry] of Object.entries(byIso)) out[iso] = entry.count;
    return out;
  }, [byIso]);

  return { photoPreviews, photoCounts, registerPhoto, refresh, loading };
}


