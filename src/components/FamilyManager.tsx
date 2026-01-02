import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Trash2, User, Loader2, AlertCircle } from 'lucide-react';
import { 
  getFamilyMembers, 
  deleteFamilyMember,
  createFamilyMember,
  FamilyMember,
} from '@/lib/faceRecognition';
import { getAllPhotos } from '@/lib/storage';

interface FamilyManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FamilyManager = ({ isOpen, onClose }: FamilyManagerProps) => {
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [appearances, setAppearances] = useState<Record<string, number>>({});
  const [avatars, setAvatars] = useState<Record<string, string>>({});

  // Load models and members
  useEffect(() => {
    if (isOpen) {
      getFamilyMembers()
        .then(setMembers)
        .finally(() => setLoading(false));

      // Count appearances across all photos (tagged people)
      getAllPhotos()
        .then((photos) => {
          const counts: Record<string, number> = {};
          const thumbs: Record<string, string[]> = {};
          for (const p of photos) {
            // Count by photo (one appearance per photo), using BOTH sources:
            // - detectedFaces.assignedMemberId (face-linked tags)
            // - faceTags.memberId (manual tags / legacy)
            const idsInPhoto = new Set<string>();

            const detected = (p as any).detectedFaces || [];
            for (const f of detected) {
              const id = f?.assignedMemberId;
              if (id) idsInPhoto.add(id);
            }

            const faceTags = (p as any).faceTags || [];
            for (const t of faceTags) {
              const id = t?.memberId;
              if (id) idsInPhoto.add(id);
            }

            for (const id of idsInPhoto) {
              counts[id] = (counts[id] || 0) + 1;
            }

            // Collect face thumbnails for profile pictures
            const detectedForAvatars = (p as any).detectedFaces || [];
            for (const f of detectedForAvatars) {
              const id = f?.assignedMemberId;
              const thumb = f?.thumbnail;
              if (!id || !thumb) continue;
              if (!thumbs[id]) thumbs[id] = [];
              thumbs[id].push(thumb);
            }
          }
          setAppearances(counts);

          // Pick random avatar each time Family modal opens
          const nextAvatars: Record<string, string> = {};
          for (const [id, list] of Object.entries(thumbs)) {
            if (!list || list.length === 0) continue;
            nextAvatars[id] = list[Math.floor(Math.random() * list.length)];
          }
          setAvatars(nextAvatars);
        })
        .catch(() => setAppearances({}));
    }
  }, [isOpen]);

  const handleDeleteMember = async (memberId: string) => {
    if (!confirm('Удалить этого человека из семьи? Его лицо больше не будет распознаваться.')) return;
    
    try {
      await deleteFamilyMember(memberId);
      setMembers(prev => prev.filter(m => m.id !== memberId));
    } catch (err) {
      setError('Не удалось удалить человека');
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-background rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div>
              <h2 className="text-lg font-display font-bold">Семья</h2>
              <p className="text-sm text-muted-foreground">
                Добавьте имена здесь, а затем отмечайте людей на фотографиях.
              </p>
            </div>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-secondary transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Error message */}
            {error && (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-destructive/10 text-destructive">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            {/* Add new person (name only) */}
            <div className="p-4 rounded-xl border border-border bg-secondary/30 space-y-3">
              <div className="text-sm font-semibold">Добавить человека</div>
              <div className="flex gap-2">
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Имя…"
                  className="flex-1 px-3 py-2 rounded-xl bg-background border border-border text-sm"
                />
                <button
                  onClick={async () => {
                    if (!newName.trim()) return;
                    setCreating(true);
                    try {
                      const m = await createFamilyMember(newName.trim());
                      setMembers((prev) => [...prev, m].sort((a, b) => a.name.localeCompare(b.name)));
                      setNewName('');
                    } catch (e: any) {
                      setError(e?.message || 'Не удалось создать человека');
                    } finally {
                      setCreating(false);
                    }
                  }}
                  disabled={!newName.trim() || creating}
                  className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
                >
                  {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Family members list */}
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : members.length > 0 ? (
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-muted-foreground">
                  В семье: {members.length}
                </h3>
                {members.map(member => {
                  const count = appearances[member.id] || 0;
                  return (
                    <div 
                      key={member.id}
                      className="flex items-center gap-3 p-3 rounded-xl bg-secondary/50 hover:bg-secondary/70 transition-colors"
                    >
                      {count > 0 && avatars[member.id] ? (
                        <img
                          src={avatars[member.id]}
                          alt={member.name}
                          className="w-12 h-12 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="w-6 h-6 text-primary" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{member.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Появлений на фото: {count}
                        </p>
                      </div>
                      <button
                        onClick={() => handleDeleteMember(member.id)}
                        className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                        title="Удалить"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-6">
                <div className="w-14 h-14 rounded-full bg-secondary flex items-center justify-center mx-auto mb-3">
                  <User className="w-7 h-7 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground">Пока никого нет</p>
                <p className="text-sm text-muted-foreground/70">Добавьте человека выше, а затем отмечайте его на фотографиях.</p>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
