import { useMemo, useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight, Plus, Trash2, Pencil, Check, Loader2, MoreHorizontal, Users } from 'lucide-react';
import { TripData } from '@/types/trips';
import { savePhoto, getPhotosForCountry, deletePhoto, updatePhotoCaption, updatePhotoFaceTags, updatePhotoDetectedFaces, StoredPhoto, FaceTag, DetectedFaceData } from '@/lib/storage';
import { processImageForFaces, loadModels, getFamilyMembers, FamilyMember } from '@/lib/faceRecognition';
import { ruCountryName, ruContinentName } from '@/lib/i18nRu';
import { createPortal } from 'react-dom';

interface CountryPanelProps {
  trip: TripData | null | undefined;
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (direction: 'prev' | 'next') => void;
  hasPrev: boolean;
  hasNext: boolean;
  onUpdateTrip?: (iso2: string, updates: Partial<TripData>) => void;
  onPhotoUploaded?: (photo: StoredPhoto) => void;
}

const getFlagEmoji = (iso2: string): string => {
  const codePoints = iso2.toUpperCase().split('').map((char) => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
};

const formatDate = (timestamp: number): string => {
  return new Date(timestamp).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

// Face Tags Display Component (shows currently tagged names)
const FaceTagsDisplay = ({ tags }: { tags: FaceTag[] }) => {
  if (tags.length === 0) return null;

  const uniqueNames = [...new Set(tags.map((t) => t.memberName))];
  if (uniqueNames.length === 0) return null;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
        <Users className="w-3.5 h-3.5" />
        {uniqueNames.join(', ')}
      </div>
    </div>
  );
};

function peopleCount(photo: StoredPhoto): number {
  // Stable-ish count for collage label:
  // - prefer detected face count
  // - but if the user manually tags someone the detector missed, show the larger number
  const detected = photo.detectedFaces?.length ?? 0;
  const taggedUnique = new Set((photo.faceTags || []).map((t) => t.memberId)).size;
  return Math.max(detected, taggedUnique);
}

function tileHeightClass(photo: StoredPhoto): string {
  // Original collage feel: different tile heights.
  // Base on detected faces ONLY so the layout doesn't change when you tag/un-tag.
  const detected = photo.detectedFaces?.length ?? 0;
  if (detected >= 5) return 'h-72';
  if (detected >= 3) return 'h-64';
  if (detected >= 2) return 'h-56';
  return 'h-44';
}

async function convertToJpegIfNeeded(file: File): Promise<File> {
  // Chrome/Firefox don't render HEIC/HEIF. Also, some setups can be flaky with .webp.
  // Convert to JPEG to make uploads and downstream processing consistent across browsers.
  const name = (file.name || '').toLowerCase();
  const type = (file.type || '').toLowerCase();
  const isWebp = type === 'image/webp' || name.endsWith('.webp');
  const isHeic = type === 'image/heic' || type === 'image/heif' || name.endsWith('.heic') || name.endsWith('.heif');

  if (!isWebp && !isHeic) return file;

  // HEIC/HEIF: use a dedicated converter (no browser decode required)
  if (isHeic) {
    try {
      const { default: heic2any } = await import('heic2any');
      const inputBlob = new Blob([await file.arrayBuffer()], { type: type || 'image/heic' });
      const out = await heic2any({ blob: inputBlob, toType: 'image/jpeg', quality: 0.92 });
      const outBlob = Array.isArray(out) ? out[0] : out;
      if (!outBlob) return file;
      const newName = file.name.replace(/\.(heic|heif)$/i, '.jpg') || 'photo.jpg';
      return new File([outBlob as BlobPart], newName, { type: 'image/jpeg' });
    } catch (e) {
      console.warn('HEIC/HEIF conversion failed, uploading original file:', e);
      return file;
    }
  }

  const img = new Image();
  img.crossOrigin = 'anonymous';
  const url = URL.createObjectURL(file);

  try {
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Не удалось декодировать изображение'));
      img.src = url;
    });

    // Downscale huge images for performance (keeps quality good for faces)
    const maxDim = 2200;
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, w, h);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('Не удалось преобразовать изображение в JPEG'))),
        'image/jpeg',
        0.92
      );
    });

    const newName = file.name.replace(/\.(webp)$/i, '.jpg');
    return new File([blob], newName, { type: 'image/jpeg' });
  } catch {
    // If conversion fails, fall back to original file (still may work)
    return file;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export const CountryPanel = ({ trip, isOpen, onClose, onNavigate, hasPrev, hasNext, onUpdateTrip, onPhotoUploaded }: CountryPanelProps) => {
  const [photos, setPhotos] = useState<StoredPhoto[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoadingPhotos, setIsLoadingPhotos] = useState(false);
  const [processingFaces, setProcessingFaces] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activePhotoId, setActivePhotoId] = useState<string | null>(null);
  const [activeCaption, setActiveCaption] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [taggerOpen, setTaggerOpen] = useState(false);
  const [taggerFaces, setTaggerFaces] = useState<Array<{ faceId: string; thumb: string; box: FaceTag['box']; matchedId?: string; confidence?: number; selectedId: string; newName?: string }>>([]);
  const [taggerLoading, setTaggerLoading] = useState(false);
  const [manualAddId, setManualAddId] = useState('');

  const familyOptions = useMemo(
    () => (getFamilyMembers ? null : null),
    []
  );

  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);

  useEffect(() => {
    // Load family members list for manual tagging dropdown
    getFamilyMembers()
      .then(setFamilyMembers)
      .catch(() => setFamilyMembers([]));
  }, []);

  // Load photos when trip changes
  useEffect(() => {
    if (trip?.iso2) {
      setIsLoadingPhotos(true);
      getPhotosForCountry(trip.iso2)
        .then(loadedPhotos => {
          // Sort by newest first for feed feel
          setPhotos(loadedPhotos.sort((a, b) => b.createdAt - a.createdAt));
        })
        .finally(() => setIsLoadingPhotos(false));
    }
  }, [trip?.iso2]);

  const activePhoto = useMemo(() => {
    if (!activePhotoId) return null;
    return photos.find((p) => p.id === activePhotoId) || null;
  }, [activePhotoId, photos]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!trip || !e.target.files?.length) return;
    
    setIsUploading(true);
    try {
      const files = Array.from(e.target.files);

      // Load face recognition models in background (we'll still upload even if it fails)
      loadModels().catch(() => {});

      for (const file of files) {
        if (file.type.startsWith('image/')) {
          const uploadFile = await convertToJpegIfNeeded(file);

          // Process faces from LOCAL file (reliable, no CORS)
          let faceTags: FaceTag[] = [];
          let detectedFacesData: DetectedFaceData[] = [];

          try {
            setProcessingFaces(true);
            const members = await getFamilyMembers();
            const { detectFaces, matchFaces, extractFaceThumbnail } = await import('@/lib/faceRecognition');

            // Load image from local file
            const img = new Image();
            img.crossOrigin = 'anonymous';
            const url = URL.createObjectURL(uploadFile);
            await new Promise<void>((resolve, reject) => {
              img.onload = () => resolve();
              img.onerror = () => reject(new Error('Failed to load image'));
              img.src = url;
            });

            const faces = await detectFaces(img);

            // Create stored detected face thumbnails + boxes (used later for manual tagging)
            detectedFacesData = faces.map((f, idx) => ({
              id: `${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 7)}`,
              thumbnail: extractFaceThumbnail(img, f.box),
              box: f.box,
              descriptorString: JSON.stringify(Array.from(f.descriptor)),
            }));

            // If we have family members, attempt auto-match for suggestions/tags
            if (members.length > 0 && faces.length > 0) {
              const matched = await matchFaces(faces);

              faceTags = matched
                .filter((f) => f.matchedMember)
                .map((f) => ({
                  memberId: f.matchedMember!.id,
                  memberName: f.matchedMember!.name,
                  box: f.box,
                  confidence: f.confidence,
                }));

              // Store suggestions per detected face (so the “Who is this?” UI can preselect)
              detectedFacesData = matched.map((f, idx) => ({
                id: `${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 7)}`,
                thumbnail: extractFaceThumbnail(img, f.box),
                box: f.box,
                descriptorString: JSON.stringify(Array.from(f.descriptor)),
                suggestedMemberId: f.matchedMember?.id,
                suggestedMemberName: f.matchedMember?.name,
                confidence: f.confidence,
                // IMPORTANT: make the post-upload view correct immediately.
                // This mirrors what clicking "Auto tag" used to do.
                assignedMemberId: f.matchedMember?.id,
                assignedMemberName: f.matchedMember?.name,
              }));
            }

            URL.revokeObjectURL(url);
          } catch (err) {
            console.error('Face detection failed:', err);
          } finally {
            setProcessingFaces(false);
          }

          const photo = await savePhoto(trip.iso2, uploadFile, '', faceTags, detectedFacesData);
          setPhotos(prev => [photo, ...prev]); // Add to top
          onPhotoUploaded?.(photo); // update map previews in real time
        }
      }
    } catch (error) {
      console.error('Failed to upload photo:', error);
      const msg = error instanceof Error ? error.message : String(error);
      alert(`Не удалось загрузить фото. ${msg ? `(${msg})` : ''}`);
    }
    setIsUploading(false);
    setProcessingFaces(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDeletePhoto = async (photoId: string) => {
    try {
      await deletePhoto(photoId);
      setPhotos(prev => prev.filter(p => p.id !== photoId));
      setActivePhotoId((cur) => (cur === photoId ? null : cur));
    } catch (error) {
      console.error('Failed to delete photo:', error);
      alert('Не удалось удалить фото. Пожалуйста, попробуйте ещё раз.');
    }
  };

  const handleUpdateCaption = async (photoId: string, caption: string) => {
    try {
      await updatePhotoCaption(photoId, caption);
      setPhotos(prev => prev.map(p => p.id === photoId ? { ...p, caption } : p));
    } catch (error) {
      console.error('Failed to update caption:', error);
      alert('Не удалось сохранить подпись. Пожалуйста, попробуйте ещё раз.');
    }
  };

  const handleUpdateFaceTags = async (photoId: string, faceTags: FaceTag[]) => {
    try {
      await updatePhotoFaceTags(photoId, faceTags);
      setPhotos(prev => prev.map(p => p.id === photoId ? { ...p, faceTags } : p));
    } catch (error) {
      console.error('Failed to update face tags:', error);
      alert('Не удалось сохранить отметки людей. Пожалуйста, попробуйте ещё раз.');
    }
  };

  const openPhoto = (photo: StoredPhoto) => {
    setActivePhotoId(photo.id);
    setActiveCaption(photo.caption || '');
    setIsEditing(false);
    setShowMenu(false);
  };

  const closePhoto = () => {
    setActivePhotoId(null);
    setActiveCaption('');
    setIsEditing(false);
    setShowMenu(false);
    setTaggerOpen(false);
    setTaggerFaces([]);
    setManualAddId('');
  };

  const saveActiveCaption = async () => {
    if (!activePhoto) return;
    await handleUpdateCaption(activePhoto.id, activeCaption);
    setIsEditing(false);
  };

  // (removed) scan faces: redundant with Auto tag

  const openTagger = async () => {
    if (!activePhoto) return;
    setTaggerOpen(true);
    setTaggerLoading(true);
    setTaggerFaces([]);

    try {
      const members = await getFamilyMembers();
      setFamilyMembers(members);

      // Prefer stored detections from upload (reliable; no CORS).
      const stored = activePhoto.detectedFaces || [];
      if (stored.length > 0) {
        // If older photos have detections but no AI suggestions yet, compute suggestions from stored descriptors.
        const needsSuggestions = members.length > 0 && stored.some((f) => f.descriptorString && !f.suggestedMemberId);
        if (needsSuggestions) {
          try {
            const { matchFaces } = await import('@/lib/faceRecognition');
            const indexed = stored
              .map((df, idx) => ({ df, idx }))
              .filter((x) => !!x.df.descriptorString);

            const facesForMatch = indexed.map(({ df }) => ({
              box: df.box as any,
              descriptor: new Float32Array(JSON.parse(df.descriptorString || '[]')),
            }));

            const matched = await matchFaces(facesForMatch as any);

            const updatedStored = stored.map((df) => ({ ...df }));
            for (let j = 0; j < indexed.length; j++) {
              const { idx: originalIdx } = indexed[j];
              const pick = matched[j];
              if (!pick?.matchedMember) continue;
              if (updatedStored[originalIdx]?.suggestedMemberId) continue;
              updatedStored[originalIdx] = {
                ...updatedStored[originalIdx],
                suggestedMemberId: pick.matchedMember.id,
                suggestedMemberName: pick.matchedMember.name,
                confidence: pick.confidence,
              };
            }

            await updatePhotoDetectedFaces(activePhoto.id, updatedStored);
            setPhotos((prev) =>
              prev.map((p) => (p.id === activePhoto.id ? { ...p, detectedFaces: updatedStored } : p))
            );
          } catch (e) {
            console.warn('Failed to compute suggestions from stored descriptors:', e);
          }
        }

        const items = stored.map((f) => ({
          faceId: f.id,
          thumb: f.thumbnail,
          box: f.box,
          matchedId: f.suggestedMemberId,
          confidence: f.confidence,
          selectedId: f.assignedMemberId || f.suggestedMemberId || '',
          newName: '',
        }));
        setTaggerFaces(items);
        return;
      }

      // Fallback: detect from remote URL.
      // Even if an <img> can display it, face-api needs pixel access (canvas),
      // which is blocked by the browser unless Firebase Storage CORS allows it.
      await loadModels();
      const { detectFaces, matchFaces, extractFaceThumbnail } = await import('@/lib/faceRecognition');

      // Best effort: download -> blob -> object URL so the canvas becomes same-origin.
      const blob = await fetch(activePhoto.url, { mode: 'cors' }).then((r) => {
        if (!r.ok) throw new Error(`Не удалось скачать изображение (${r.status})`);
        return r.blob();
      });
      const objectUrl = URL.createObjectURL(blob);

      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Не удалось декодировать изображение для распознавания'));
        img.src = objectUrl;
      });

      const faces = await detectFaces(img);
      const matched = members.length > 0 && faces.length > 0 ? await matchFaces(faces) : [];

      // Persist detections so Auto tag works for this photo forever (and across devices)
      const detectedFacesData: DetectedFaceData[] = (members.length > 0 ? matched : faces).map((f: any, idx: number) => ({
        id: `${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 7)}`,
        thumbnail: extractFaceThumbnail(img, f.box as any),
        box: f.box,
        descriptorString: JSON.stringify(Array.from(f.descriptor || [])),
        suggestedMemberId: f.matchedMember?.id,
        suggestedMemberName: f.matchedMember?.name,
        confidence: f.confidence,
      }));

      if (detectedFacesData.length > 0) {
        await updatePhotoDetectedFaces(activePhoto.id, detectedFacesData);
        setPhotos((prev) =>
          prev.map((p) => (p.id === activePhoto.id ? { ...p, detectedFaces: detectedFacesData } : p))
        );
      }

      const items = detectedFacesData.map((f) => ({
        faceId: f.id,
        thumb: f.thumbnail,
        box: f.box,
        matchedId: f.suggestedMemberId,
        confidence: f.confidence,
        selectedId: f.assignedMemberId || f.suggestedMemberId || '',
        newName: '',
      }));
      setTaggerFaces(items);
      URL.revokeObjectURL(objectUrl);
    } catch (e) {
      console.error(e);
      const msg = String((e as any)?.message || e || '');
      const lower = msg.toLowerCase();
      const looksLikeCors =
        lower.includes('cors') ||
        lower.includes('failed to fetch') ||
        lower.includes('networkerror') ||
        lower.includes('failed to download image') ||
        lower.includes('tainted');

      alert(
        looksLikeCors
          ? 'Не удалось распознать лица для отметки.\n\nЭто часто происходит со старыми фото: браузер блокирует доступ к пикселям изображений из Firebase Storage без CORS.\n\nРешение: включите CORS для Firebase Storage (localhost + ваш домен), затем обновите страницу.'
          : `Не удалось распознать лица для отметки.\n\n${msg}`
      );
      setTaggerOpen(false);
    } finally {
      setTaggerLoading(false);
    }
  };

  // Auto-apply AI suggestions (so UI updates immediately and the model learns from saved assignments)
  const autoApplySuggestions = async () => {
    if (!activePhoto) return;
    const faces = activePhoto.detectedFaces || [];
    if (faces.length === 0) {
      // Fall back to opening the picker
      await openTagger();
      return;
    }

    const members = await getFamilyMembers();
    setFamilyMembers(members);
    const idToName = new Map(members.map((m) => [m.id, m.name]));

    // Assign any suggestedMemberId that isn't already assigned
    const updatedDetected = faces.map((df) => {
      if (df.assignedMemberId) return df;
      if (!df.suggestedMemberId) return df;
      return {
        ...df,
        assignedMemberId: df.suggestedMemberId,
        assignedMemberName: df.suggestedMemberName || idToName.get(df.suggestedMemberId) || 'Неизвестно',
      };
    });

    // Update faceTags based on assigned detected faces (ensures thumbnails + correct unknown count)
    const nextById = new Map<string, FaceTag>();
    for (const t of activePhoto.faceTags || []) nextById.set(t.memberId, t);
    for (const df of updatedDetected) {
      if (!df.assignedMemberId) continue;
      nextById.set(df.assignedMemberId, {
        memberId: df.assignedMemberId,
        memberName: df.assignedMemberName || 'Неизвестно',
        box: df.box,
      });
    }
    const nextTags = Array.from(nextById.values());

    await updatePhotoDetectedFaces(activePhoto.id, updatedDetected);
    await handleUpdateFaceTags(activePhoto.id, nextTags);
    setPhotos((prev) =>
      prev.map((p) => (p.id === activePhoto.id ? { ...p, detectedFaces: updatedDetected, faceTags: nextTags } : p))
    );
  };

  const saveTagger = async () => {
    if (!activePhoto) return;
    const idToName = new Map(familyMembers.map((m) => [m.id, m.name]));

    // Create new people (name-only) if requested
    const newOnes = taggerFaces.filter((f) => f.selectedId === 'new' && (f.newName || '').trim());
    for (const f of newOnes) {
      const { createFamilyMember } = await import('@/lib/faceRecognition');
      const created = await createFamilyMember((f.newName || '').trim());
      setFamilyMembers((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      idToName.set(created.id, created.name);
      // update face selection locally
      setTaggerFaces((prev) => prev.map((x) => (x.faceId === f.faceId ? { ...x, selectedId: created.id } : x)));
    }

    const fromFaces: FaceTag[] = taggerFaces
      .filter((f) => f.selectedId && f.selectedId !== 'new')
      .map((f) => ({
        memberId: f.selectedId,
        memberName: idToName.get(f.selectedId) || 'Неизвестно',
        box: f.box || { x: 0, y: 0, width: 0, height: 0 },
        confidence: f.matchedId === f.selectedId ? f.confidence : undefined,
      }));

    // Preserve any manually added tags that are not covered by detected faces
    const existing = activePhoto.faceTags || [];
    const nextById = new Map<string, FaceTag>();
    for (const t of existing) nextById.set(t.memberId, t);
    for (const t of fromFaces) nextById.set(t.memberId, t);

    const next = Array.from(nextById.values());
    await handleUpdateFaceTags(activePhoto.id, next);

    // Persist assignments into detectedFaces too (this is what recognition will learn from)
    const faces = (activePhoto.detectedFaces || []).map((df) => {
      const chosen = taggerFaces.find((t) => t.faceId === df.id);
      if (!chosen || !chosen.selectedId || chosen.selectedId === 'new') return df;
      return {
        ...df,
        assignedMemberId: chosen.selectedId,
        assignedMemberName: idToName.get(chosen.selectedId) || df.assignedMemberName,
      };
    });
    if (faces.length > 0) {
      await updatePhotoDetectedFaces(activePhoto.id, faces);
      setPhotos((prev) => prev.map((p) => (p.id === activePhoto.id ? { ...p, detectedFaces: faces } : p)));
    }

    setTaggerOpen(false);
    setTaggerFaces([]);
  };

  const removePerson = async (memberId: string) => {
    if (!activePhoto) return;
    const next = (activePhoto.faceTags || []).filter((t) => t.memberId !== memberId);
    await handleUpdateFaceTags(activePhoto.id, next);

    // Also clear assignment from detectedFaces so counts/avatars stay consistent
    const dfs = (activePhoto.detectedFaces || []).map((df) => {
      if (df.assignedMemberId !== memberId) return df;
      const { assignedMemberId, assignedMemberName, ...rest } = df as any;
      return rest;
    });
    if (dfs.length > 0) {
      await updatePhotoDetectedFaces(activePhoto.id, dfs);
      setPhotos((prev) => prev.map((p) => (p.id === activePhoto.id ? { ...p, detectedFaces: dfs } : p)));
    }
  };

  const addPersonManual = async () => {
    if (!activePhoto) return;
    const member = familyMembers.find((m) => m.id === manualAddId);
    if (!member) return;
    const existing = activePhoto.faceTags || [];
    if (existing.some((t) => t.memberId === member.id)) return;

    // Prefer assigning the first unassigned detected face (so avatar comes from the real photo)
    const dfs = activePhoto.detectedFaces || [];
    const unassigned = dfs.find((df) => !df.assignedMemberId);
    const nextTags = [
      ...existing,
      {
        memberId: member.id,
        memberName: member.name,
        box: unassigned?.box || { x: 0, y: 0, width: 0, height: 0 },
      },
    ];
    await handleUpdateFaceTags(activePhoto.id, nextTags);

    if (unassigned) {
      const nextDetected = dfs.map((df) =>
        df.id === unassigned.id
          ? { ...df, assignedMemberId: member.id, assignedMemberName: member.name }
          : df
      );
      await updatePhotoDetectedFaces(activePhoto.id, nextDetected);
      setPhotos((prev) => prev.map((p) => (p.id === activePhoto.id ? { ...p, detectedFaces: nextDetected } : p)));
    }

    setManualAddId('');
  };

  if (!trip) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-40"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 h-full w-full max-w-[920px] bg-background border-l border-border shadow-2xl z-50 flex flex-col"
          >
            {/* Header */}
            <div className="sticky top-0 bg-background/80 backdrop-blur-xl border-b border-border p-4 flex items-center justify-between z-10">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{getFlagEmoji(trip.iso2)}</span>
                <div>
                  <h2 className="text-xl font-display font-bold">{ruCountryName(trip.iso2, trip.countryName)}</h2>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{ruContinentName(trip.continent)}</span>
                  </div>
                </div>
              </div>
              <button onClick={onClose} className="p-2 rounded-lg hover:bg-secondary transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Collage */}
            <div className="flex-1 overflow-y-auto">
              <div className="p-4 space-y-4">
                {/* Add Photo Button */}
                <label className="flex items-center justify-center gap-2 p-4 rounded-2xl border-2 border-dashed border-border hover:border-primary/50 hover:bg-secondary/30 transition-all cursor-pointer group">
                  {isUploading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin text-primary" />
                      <span className="text-sm font-medium">
                        {processingFaces ? 'Распознаём лица…' : 'Загрузка…'}
                      </span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                      <span className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                        Добавить новое воспоминание
                      </span>
                    </>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handleFileSelect}
                    disabled={isUploading}
                  />
                </label>

                {/* Loading State */}
                {isLoadingPhotos && (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                  </div>
                )}

                {/* Empty State */}
                {!isLoadingPhotos && photos.length === 0 && (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mx-auto mb-4">
                      <span className="text-3xl">📷</span>
                    </div>
                    <p className="text-muted-foreground">Пока нет воспоминаний</p>
                    <p className="text-sm text-muted-foreground/70">Добавьте фотографии, чтобы сохранить эти моменты!</p>
                  </div>
                )}

                {/* Collage (original columns masonry style) */}
                {photos.length > 0 && (
                  <div className="w-full columns-2 md:columns-3 [column-gap:0.75rem] [column-fill:balance]">
                    {photos.map((photo) => (
                      <button
                        key={photo.id}
                        onClick={() => openPhoto(photo)}
                        className={`relative w-full mb-3 break-inside-avoid overflow-hidden rounded-2xl bg-secondary border border-border hover:border-primary/40 transition-colors ${tileHeightClass(photo)}`}
                        title={photo.caption ? photo.caption : 'Открыть фото'}
                      >
                        <img
                          src={photo.url}
                          alt={photo.name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                          onError={(e) => {
                            // Older HEIC uploads won't render in Chrome; show a placeholder instead of broken icon.
                            const imgEl = e.currentTarget;
                            if (!imgEl.dataset.fallback) {
                              imgEl.dataset.fallback = '1';
                              imgEl.src = '/placeholder.svg';
                            }
                          }}
                        />
                        <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/60 to-transparent">
                          <div className="flex items-center justify-between">
                            <div className="text-xs text-white/90 truncate pr-2">
                              {photo.caption ? photo.caption : 'Добавить подпись'}
                            </div>
                            <div className="text-[10px] text-white/80 whitespace-nowrap">
                              {peopleCount(photo) > 0 ? `${peopleCount(photo)} ppl` : ''}
                            </div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Navigation Footer */}
            <div className="sticky bottom-0 bg-background/80 backdrop-blur-xl border-t border-border p-4 flex justify-between">
              <button
                onClick={() => onNavigate('prev')}
                disabled={!hasPrev}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary text-secondary-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-colors hover:bg-secondary/80"
              >
                <ChevronLeft className="w-4 h-4" />
                Предыдущая
              </button>
              <button
                onClick={() => onNavigate('next')}
                disabled={!hasNext}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary text-secondary-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-colors hover:bg-secondary/80"
              >
                Следующая
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </motion.div>

          {/* Photo Detail Modal (Portal so it's centered correctly even when panel is transformed) */}
          {activePhoto &&
            createPortal(
              <AnimatePresence>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 bg-black/60 z-[60]"
                  onClick={closePhoto}
                />
                {/* Center wrapper: avoids Tailwind translate transforms being overridden by Framer Motion */}
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 pointer-events-none">
                  <motion.div
                    initial={{ opacity: 0, y: 20, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 20, scale: 0.98 }}
                    className="pointer-events-auto w-[min(1020px,calc(100vw-2rem))] max-h-[calc(100vh-2rem)] bg-background border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col"
                  >
                  <div className="flex items-center justify-between p-4 border-b border-border">
                    <div>
                      <div className="font-semibold">{ruCountryName(trip.iso2, trip.countryName)}</div>
                      <div className="text-xs text-muted-foreground">{formatDate(activePhoto.createdAt)}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <button
                          onClick={() => setShowMenu((v) => !v)}
                          className="p-2 rounded-lg hover:bg-secondary transition-colors"
                        >
                          <MoreHorizontal className="w-5 h-5 text-muted-foreground" />
                        </button>
                        {showMenu && (
                          <>
                            <div className="fixed inset-0 z-[75]" onClick={() => setShowMenu(false)} />
                            <div className="absolute right-0 top-full mt-1 bg-popover border border-border rounded-lg shadow-lg z-[80] py-1 min-w-[160px]">
                              <button
                                onClick={() => {
                                  setIsEditing(true);
                                  setShowMenu(false);
                                }}
                                className="w-full px-4 py-2 text-left text-sm hover:bg-secondary flex items-center gap-2"
                              >
                                <Pencil className="w-4 h-4" />
                                Редактировать подпись
                              </button>
                              <button
                                onClick={() => {
                                  setActiveCaption('');
                                  saveActiveCaption();
                                  setShowMenu(false);
                                }}
                                className="w-full px-4 py-2 text-left text-sm hover:bg-secondary flex items-center gap-2"
                              >
                                <Trash2 className="w-4 h-4" />
                                Удалить заметку
                              </button>
                              <button
                                onClick={() => {
                                  openTagger();
                                  setShowMenu(false);
                                }}
                                className="w-full px-4 py-2 text-left text-sm hover:bg-secondary flex items-center gap-2"
                              >
                                <Users className="w-4 h-4" />
                                Отметить людей
                              </button>
                              <button
                                onClick={() => {
                                  if (confirm('Удалить это воспоминание?')) {
                                    handleDeletePhoto(activePhoto.id);
                                    closePhoto();
                                  }
                                }}
                                className="w-full px-4 py-2 text-left text-sm text-destructive hover:bg-destructive/10 flex items-center gap-2"
                              >
                                <Trash2 className="w-4 h-4" />
                                Удалить
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                      <button onClick={closePhoto} className="p-2 rounded-lg hover:bg-secondary transition-colors">
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 overflow-hidden">
                    <div className="bg-black/10">
                      <img
                        src={activePhoto.url}
                        alt={activePhoto.name}
                        className="w-full h-[min(70vh,720px)] object-contain bg-black/5"
                        onError={(e) => {
                          const imgEl = e.currentTarget;
                          if (!imgEl.dataset.fallback) {
                            imgEl.dataset.fallback = '1';
                            imgEl.src = '/placeholder.svg';
                          }
                        }}
                      />
                    </div>
                    <div className="p-4 space-y-3 overflow-y-auto max-h-[min(70vh,720px)]">
                      {/* People */} 
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="text-sm font-semibold">Люди</div>
                          <button
                            onClick={openTagger}
                            className="text-xs text-primary hover:underline"
                          >
                            Отметить людей
                          </button>
                        </div>

                        {(() => {
                          const detected = activePhoto.detectedFaces || [];
                          const taggedFromDetected = new Map<string, { name: string; thumb?: string }>();
                          for (const df of detected) {
                            if (!df.assignedMemberId) continue;
                            if (!taggedFromDetected.has(df.assignedMemberId)) {
                              taggedFromDetected.set(df.assignedMemberId, {
                                name: df.assignedMemberName || 'Неизвестно',
                                thumb: df.thumbnail,
                              });
                            }
                          }

                          const legacyTags = new Map<string, { name: string; thumb?: string }>();
                          for (const t of activePhoto.faceTags || []) {
                            if (!t.memberId) continue;
                            if (!legacyTags.has(t.memberId)) legacyTags.set(t.memberId, { name: t.memberName });
                          }

                          // Merge: detected-assigned preferred for thumbnails, fallback to legacy faceTags
                          const allTaggedIds = new Set<string>([...taggedFromDetected.keys(), ...legacyTags.keys()]);
                          const taggedList = Array.from(allTaggedIds).map((id) => ({
                            id,
                            name: taggedFromDetected.get(id)?.name || legacyTags.get(id)?.name || 'Неизвестно',
                            thumb: taggedFromDetected.get(id)?.thumb,
                          }));

                          const unknownFaces = detected.filter((df) => !df.assignedMemberId);

                          return (
                            <div className="space-y-2">
                              <div className="text-xs text-muted-foreground">
                                {detected.length > 0 ? `${detected.length} лиц обнаружено` : 'Лица не найдены'}
                                {' • '}
                                {`отмечено: ${taggedFromDetected.size}`}
                                {' • '}
                                {`неизвестно: ${unknownFaces.length}`}
                              </div>

                              {/* Tagged people (Family-like rows) */}
                              <div className="space-y-2">
                                {taggedList.map((p) => (
                                  <div
                                    key={p.id}
                                    className="flex items-center gap-3 p-3 rounded-xl bg-secondary/50 hover:bg-secondary/70 transition-colors"
                                  >
                                  {p.thumb ? (
                                    <img src={p.thumb} alt={p.name} className="w-10 h-10 rounded-full object-cover" />
                                  ) : (
                                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-bold">
                                      {(p.name || '?').trim().slice(0, 1).toUpperCase()}
                                    </div>
                                  )}
                                    <div className="flex-1 min-w-0">
                                      <div className="font-medium truncate">{p.name}</div>
                                      <div className="text-xs text-muted-foreground">Отмечен(а) на этом фото</div>
                                    </div>
                                    <button
                                      onClick={() => removePerson(p.id)}
                                      className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                                      title="Убрать с фото"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                ))}

                                {taggedList.length === 0 && (
                                  <div className="text-sm text-muted-foreground">Пока никто не отмечен.</div>
                                )}
                              </div>
                              {taggedList.length > 0 && taggedList.some((x) => !x.thumb) && (
                                <div className="text-xs text-muted-foreground">
                                  У некоторых отметок нет миниатюр лица. Нажмите <span className="font-medium">«Отметить людей»</span>, чтобы создать миниатюры для этого фото.
                                </div>
                              )}

                              {/* Unknown faces preview */}
                              {unknownFaces.length > 0 && (
                                <div className="p-3 rounded-xl border border-border bg-background/60">
                                  <div className="text-sm font-semibold mb-2">Неизвестные</div>
                                  <div className="flex flex-wrap gap-2">
                                    {unknownFaces.slice(0, 8).map((df) => (
                                      <img
                                        key={df.id}
                                        src={df.thumbnail}
                                        alt="Неизвестное лицо"
                                        className="w-10 h-10 rounded-full object-cover border border-border"
                                      />
                                    ))}
                                    {unknownFaces.length > 8 && (
                                      <div className="text-xs text-muted-foreground self-center">
                                        +{unknownFaces.length - 8} ещё
                                      </div>
                                    )}
                                  </div>
                                  <div className="text-xs text-muted-foreground mt-2">
                                    Нажмите <span className="font-medium">«Отметить людей»</span>, чтобы подписать эти лица.
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })()}

                        <div className="flex gap-2">
                          <select
                            value={manualAddId}
                            onChange={(e) => setManualAddId(e.target.value)}
                            className="flex-1 px-3 py-2 rounded-xl bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                          >
                            <option value="">Добавить вручную…</option>
                            {familyMembers.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.name}
                              </option>
                            ))}
                          </select>
                          <button
                            onClick={addPersonManual}
                            disabled={!manualAddId}
                            className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
                          >
                            Добавить
                          </button>
                        </div>
                      </div>

                      {isEditing ? (
                        <div className="space-y-2">
                          <textarea
                            value={activeCaption}
                            onChange={(e) => setActiveCaption(e.target.value)}
                            placeholder="Напишите подпись…"
                            className="w-full p-3 rounded-xl bg-secondary border border-border resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                            rows={5}
                            autoFocus
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={saveActiveCaption}
                              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
                            >
                              <Check className="w-4 h-4" />
                              Сохранить
                            </button>
                            <button
                              onClick={() => {
                                setActiveCaption(activePhoto.caption || '');
                                setIsEditing(false);
                              }}
                              className="px-4 py-2 rounded-lg bg-secondary text-secondary-foreground text-sm hover:bg-secondary/80 transition-colors"
                            >
                              Отмена
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setIsEditing(true)}
                          className="w-full text-left p-3 rounded-xl bg-secondary/50 hover:bg-secondary transition-colors"
                        >
                          <div className="text-sm">
                            {activePhoto.caption ? activePhoto.caption : <span className="text-muted-foreground">+ Добавить подпись…</span>}
                          </div>
                        </button>
                      )}

                      {/* Face tagger (FamilyManager-style: N faces detected, who is this?) */}
                      {taggerOpen && (
                        <div className="mt-2 p-3 rounded-xl border border-border bg-secondary/30 space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="text-sm font-semibold">
                              {taggerLoading ? 'Распознаём лица…' : `${taggerFaces.length} лиц обнаружено — кто это?`}
                            </div>
                            <button
                              onClick={() => {
                                setTaggerOpen(false);
                                setTaggerFaces([]);
                              }}
                              className="text-xs text-muted-foreground hover:text-foreground"
                            >
                              Закрыть
                            </button>
                          </div>

                          {taggerLoading ? (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Распознаём лица…
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {taggerFaces.map((f, idx) => (
                                <div key={idx} className="flex items-center gap-3">
                                  <img src={f.thumb} className="w-10 h-10 rounded-full object-cover border border-border" />
                                  <select
                                    value={f.selectedId}
                                    onChange={(e) => {
                                      const v = e.target.value;
                                      setTaggerFaces((prev) => prev.map((x, i) => (i === idx ? { ...x, selectedId: v } : x)));
                                    }}
                                    className="flex-1 px-3 py-2 rounded-xl bg-background border border-border text-sm"
                                  >
                                    <option value="">Выберите человека… (или пропустить)</option>
                                    <option value="new">➕ Добавить нового</option>
                                    {familyMembers.map((m) => (
                                      <option key={m.id} value={m.id}>
                                        {m.name}
                                      </option>
                                    ))}
                                  </select>
                                  {f.selectedId === 'new' && (
                                    <input
                                      value={f.newName || ''}
                                      onChange={(e) => {
                                        const name = e.target.value;
                                        setTaggerFaces((prev) =>
                                          prev.map((x, i) => (i === idx ? { ...x, newName: name } : x))
                                        );
                                      }}
                                      placeholder="Имя…"
                                      className="w-32 px-2 py-2 rounded-xl bg-background border border-border text-sm"
                                    />
                                  )}
                                  {f.matchedId && (
                                    <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                                      AI {Math.round((f.confidence || 0) * 100)}%
                                    </span>
                                  )}
                                </div>
                              ))}
                              {taggerFaces.length === 0 && (
                                <div className="text-xs text-muted-foreground">Лица не найдены.</div>
                              )}
                            </div>
                          )}

                          <div className="flex gap-2">
                            <button
                              onClick={saveTagger}
                              className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium"
                              disabled={taggerLoading}
                            >
                              Сохранить
                            </button>
                            <button
                              onClick={openTagger}
                              className="px-4 py-2 rounded-xl bg-secondary text-secondary-foreground text-sm"
                              disabled={taggerLoading}
                            >
                              Пересканировать
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  </motion.div>
                </div>
              </AnimatePresence>,
              document.body
            )}
        </>
      )}
    </AnimatePresence>
  );
};
