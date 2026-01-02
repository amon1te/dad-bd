import { db, storage } from './firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  deleteDoc, 
  query, 
  where,
  updateDoc 
} from 'firebase/firestore';
import { 
  ref, 
  uploadBytes, 
  getDownloadURL, 
  deleteObject 
} from 'firebase/storage';
import { TripsJson, TripData } from '@/types/trips';

// Collection names
const TRIPS_COLLECTION = 'trips';
const PHOTOS_COLLECTION = 'photos';
const CONFIG_DOC = 'config';

// Firestore does not allow `undefined` values anywhere in objects/arrays.
// This removes undefined recursively (and preserves null).
function sanitizeForFirestore<T>(value: T): T {
  if (Array.isArray(value)) {
    return value
      .map((v) => sanitizeForFirestore(v))
      .filter((v) => v !== undefined) as any;
  }
  if (value && typeof value === 'object') {
    const out: any = {};
    for (const [k, v] of Object.entries(value as any)) {
      const next = sanitizeForFirestore(v);
      if (next !== undefined) out[k] = next;
    }
    return out;
  }
  return value;
}

// ============ TRIPS DATA ============

export async function getTripsData(): Promise<TripsJson | null> {
  try {
    const docRef = doc(db, TRIPS_COLLECTION, CONFIG_DOC);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return docSnap.data() as TripsJson;
    }
    return null;
  } catch (error) {
    console.error('Error getting trips data:', error);
    return null;
  }
}

export async function saveTripsData(data: TripsJson): Promise<void> {
  try {
    const docRef = doc(db, TRIPS_COLLECTION, CONFIG_DOC);
    await setDoc(docRef, sanitizeForFirestore(data));
  } catch (error) {
    console.error('Error saving trips data:', error);
    throw error;
  }
}

export async function updateTripNotes(iso2: string, notes: string): Promise<void> {
  try {
    const data = await getTripsData();
    if (!data) return;
    
    const updatedVisited = data.visited.map(trip => 
      trip.iso2 === iso2 ? { ...trip, notes } : trip
    );
    
    await saveTripsData({ ...data, visited: updatedVisited });
  } catch (error) {
    console.error('Error updating trip notes:', error);
    throw error;
  }
}

// ============ PHOTOS ============

export interface FaceTag {
  memberId: string;
  memberName: string;
  box: { x: number; y: number; width: number; height: number };
  confidence?: number;
}

export interface DetectedFaceData {
  id: string;
  // small thumbnail (data URL) generated on upload from the local file; avoids CORS issues later
  thumbnail: string;
  box: { x: number; y: number; width: number; height: number };
  // 128-d descriptor stored as JSON string (Firestore-safe)
  descriptorString: string;
  // final assignment (what the user picked)
  assignedMemberId?: string;
  assignedMemberName?: string;
  // optional auto-suggestion (if we had known family members at upload time)
  suggestedMemberId?: string;
  suggestedMemberName?: string;
  confidence?: number;
}

export interface StoredPhoto {
  id: string;
  countryIso: string;
  url: string;
  name: string;
  caption: string;
  faceTags: FaceTag[];
  detectedFaces?: DetectedFaceData[];
  createdAt: number;
}

export async function savePhoto(
  countryIso: string, 
  file: File, 
  caption: string = '',
  faceTags: FaceTag[] = [],
  detectedFaces: DetectedFaceData[] = []
): Promise<StoredPhoto> {
  const id = `${countryIso}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    // Upload to Firebase Storage
    const storageRef = ref(storage, `photos/${id}`);
    await uploadBytes(storageRef, file);
    const url = await getDownloadURL(storageRef);
    
    // Save metadata to Firestore
    const photo: StoredPhoto = {
      id,
      countryIso,
      url,
      name: file.name,
      caption,
      faceTags,
      detectedFaces,
      createdAt: Date.now(),
    };
    
    await setDoc(doc(db, PHOTOS_COLLECTION, id), sanitizeForFirestore(photo));
    
    return photo;
  } catch (error) {
    console.error('Error saving photo:', error);
    throw error;
  }
}

export async function updatePhotoCaption(photoId: string, caption: string): Promise<void> {
  try {
    const photoRef = doc(db, PHOTOS_COLLECTION, photoId);
    await updateDoc(photoRef, sanitizeForFirestore({ caption }));
  } catch (error) {
    console.error('Error updating photo caption:', error);
    throw error;
  }
}

export async function updatePhotoFaceTags(photoId: string, faceTags: FaceTag[]): Promise<void> {
  try {
    const photoRef = doc(db, PHOTOS_COLLECTION, photoId);
    await updateDoc(photoRef, sanitizeForFirestore({ faceTags }));
  } catch (error) {
    console.error('Error updating photo face tags:', error);
    throw error;
  }
}

export async function updatePhotoDetectedFaces(photoId: string, detectedFaces: DetectedFaceData[]): Promise<void> {
  try {
    const photoRef = doc(db, PHOTOS_COLLECTION, photoId);
    await updateDoc(photoRef, sanitizeForFirestore({ detectedFaces }));
  } catch (error) {
    console.error('Error updating photo detected faces:', error);
    throw error;
  }
}

export async function getPhotosForCountry(countryIso: string): Promise<StoredPhoto[]> {
  try {
    const q = query(
      collection(db, PHOTOS_COLLECTION), 
      where('countryIso', '==', countryIso)
    );
    const querySnapshot = await getDocs(q);
    
    const photos: StoredPhoto[] = [];
    querySnapshot.forEach((doc) => {
      photos.push(doc.data() as StoredPhoto);
    });
    
    return photos.sort((a, b) => a.createdAt - b.createdAt);
  } catch (error) {
    console.error('Error getting photos:', error);
    return [];
  }
}

export async function deletePhoto(photoId: string): Promise<void> {
  try {
    // Delete from Storage
    const storageRef = ref(storage, `photos/${photoId}`);
    await deleteObject(storageRef);
    
    // Delete from Firestore
    await deleteDoc(doc(db, PHOTOS_COLLECTION, photoId));
  } catch (error) {
    console.error('Error deleting photo:', error);
    throw error;
  }
}

export async function getAllPhotos(): Promise<StoredPhoto[]> {
  try {
    const querySnapshot = await getDocs(collection(db, PHOTOS_COLLECTION));
    const photos: StoredPhoto[] = [];
    querySnapshot.forEach((doc) => {
      photos.push(doc.data() as StoredPhoto);
    });
    return photos;
  } catch (error) {
    console.error('Error getting all photos:', error);
    return [];
  }
}

// ============ EXPORT/IMPORT ============

export async function exportAllData(): Promise<string> {
  const tripsData = await getTripsData();
  const photos = await getAllPhotos();
  
  return JSON.stringify({
    version: 1,
    exportedAt: new Date().toISOString(),
    trips: tripsData,
    photos: photos, // Note: only URLs, not actual image data
  }, null, 2);
}

// For Firebase, we don't need the old IndexedDB init
export async function initDB(): Promise<void> {
  // Firebase is initialized on import, nothing to do here
}
