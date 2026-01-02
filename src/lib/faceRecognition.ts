import * as faceapi from 'face-api.js';
import { db } from './firebase';
import { collection, doc, setDoc, getDoc, getDocs, deleteDoc } from 'firebase/firestore';
import { getAllPhotos } from './storage';

const FAMILY_COLLECTION = 'familyMembers';

export interface FamilyMember {
  id: string;
  name: string;
  // Stored as JSON strings because Firestore doesn't support nested arrays
  descriptorStrings: string[]; // Each string is JSON of a 128-number array
  photoUrls: string[]; // Reference photos (with/without glasses, different angles)
  createdAt: number;
  // Legacy support (old format)
  descriptor?: number[];
  descriptors?: number[][];
  photoUrl?: string;
}

export interface DetectedFace {
  descriptor: Float32Array;
  box: { x: number; y: number; width: number; height: number };
  matchedMember?: FamilyMember;
  confidence?: number;
}

let modelsLoaded = false;

// Load face-api.js models
export async function loadModels(): Promise<void> {
  if (modelsLoaded) return;
  
  const MODEL_URL = '/models';
  
  await Promise.all([
    faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
    faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
    faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
  ]);
  
  modelsLoaded = true;
  console.log('Face recognition models loaded');
}

export async function createFamilyMember(name: string): Promise<FamilyMember> {
  const id = `family-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const member: FamilyMember = {
    id,
    name: name.trim(),
    descriptorStrings: [],
    photoUrls: [],
    createdAt: Date.now(),
  };
  await setDoc(doc(db, FAMILY_COLLECTION, id), member);
  return member;
}

// Detect faces in an image and get descriptors
export async function detectFaces(imageElement: HTMLImageElement | HTMLCanvasElement): Promise<DetectedFace[]> {
  await loadModels();
  
  const detections = await faceapi
    .detectAllFaces(imageElement)
    .withFaceLandmarks()
    .withFaceDescriptors();
  
  return detections.map(detection => ({
    descriptor: detection.descriptor,
    box: {
      x: detection.detection.box.x,
      y: detection.detection.box.y,
      width: detection.detection.box.width,
      height: detection.detection.box.height,
    },
  }));
}

// Match detected faces against known family members
// NOTE: In face-api, a match happens when distance <= threshold.
// Higher threshold => more lenient (better for glasses, different angles), but can increase false positives.
const MATCH_THRESHOLD = 0.55; // tuned: was 0.45 (too strict)

// Helper to get descriptors from member (handles all formats)
function getMemberDescriptors(member: FamilyMember): Float32Array[] {
  // New format: JSON strings
  if (member.descriptorStrings && member.descriptorStrings.length > 0) {
    return member.descriptorStrings.map(s => new Float32Array(JSON.parse(s)));
  }
  // Legacy format: nested arrays
  if (member.descriptors && member.descriptors.length > 0) {
    return member.descriptors.map(d => new Float32Array(d));
  }
  // Oldest format: single descriptor
  if (member.descriptor) {
    return [new Float32Array(member.descriptor)];
  }
  return [];
}

async function getTrainingDescriptorsFromTaggedPhotos(): Promise<Array<{ memberId: string; descriptor: Float32Array }>> {
  try {
    const photos = await getAllPhotos();
    const out: Array<{ memberId: string; descriptor: Float32Array }> = [];
    for (const p of photos) {
      const faces = (p as any).detectedFaces || [];
      for (const f of faces) {
        const memberId = f?.assignedMemberId;
        const ds = f?.descriptorString;
        if (!memberId || !ds) continue;
        try {
          out.push({ memberId, descriptor: new Float32Array(JSON.parse(ds)) });
        } catch {
          // ignore malformed
        }
      }
    }
    return out;
  } catch {
    return [];
  }
}

export async function matchFaces(detectedFaces: DetectedFace[]): Promise<DetectedFace[]> {
  const familyMembers = await getFamilyMembers();
  
  if (familyMembers.length === 0) {
    return detectedFaces;
  }
  
  // Prefer training from ALL tagged faces across all photos (best + sustainable)
  const training = await getTrainingDescriptorsFromTaggedPhotos();
  const byMember = new Map<string, Float32Array[]>();
  for (const t of training) {
    if (!byMember.has(t.memberId)) byMember.set(t.memberId, []);
    byMember.get(t.memberId)!.push(t.descriptor);
  }

  // Create labeled descriptors: first from training, fallback to legacy member descriptors
  const labeledDescriptors = familyMembers
    .map((member) => {
      const fromPhotos = byMember.get(member.id) || [];
      const fallback = getMemberDescriptors(member);
      const combined = fromPhotos.length > 0 ? fromPhotos : fallback;
      return new faceapi.LabeledFaceDescriptors(member.id, combined);
    })
    .filter((ld) => ld.descriptors.length > 0);
  
  if (labeledDescriptors.length === 0) {
    return detectedFaces;
  }
  
  const faceMatcher = new faceapi.FaceMatcher(labeledDescriptors, MATCH_THRESHOLD);
  
  return detectedFaces.map(face => {
    const match = faceMatcher.findBestMatch(face.descriptor);
    
    if (match.label !== 'unknown') {
      const matchedMember = familyMembers.find(m => m.id === match.label);
      return {
        ...face,
        matchedMember,
        confidence: 1 - match.distance, // Convert distance to confidence
      };
    }
    
    return face;
  });
}

// Save a new family member with their face descriptor
export async function saveFamilyMember(
  name: string, 
  descriptor: Float32Array,
  photoUrl?: string
): Promise<FamilyMember> {
  const id = `family-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  const member: FamilyMember = {
    id,
    name,
    descriptorStrings: [JSON.stringify(Array.from(descriptor))], // Store as JSON string
    photoUrls: photoUrl ? [photoUrl] : [],
    createdAt: Date.now(),
  };
  
  await setDoc(doc(db, FAMILY_COLLECTION, id), member);
  
  return member;
}

// Add additional photo/descriptor to existing family member (for glasses, angles, etc.)
export async function addFamilyMemberPhoto(
  memberId: string,
  descriptor: Float32Array,
  photoUrl: string
): Promise<void> {
  const memberRef = doc(db, FAMILY_COLLECTION, memberId);
  const memberSnap = await getDoc(memberRef);
  
  if (memberSnap.exists()) {
    const member = memberSnap.data() as FamilyMember;
    
    // Handle legacy and new formats
    const existingDescriptorStrings = member.descriptorStrings || 
      (member.descriptors ? member.descriptors.map(d => JSON.stringify(d)) : []) ||
      (member.descriptor ? [JSON.stringify(member.descriptor)] : []);
    const existingPhotoUrls = member.photoUrls || (member.photoUrl ? [member.photoUrl] : []);
    
    await setDoc(memberRef, {
      id: member.id,
      name: member.name,
      descriptorStrings: [...existingDescriptorStrings, JSON.stringify(Array.from(descriptor))],
      photoUrls: [...existingPhotoUrls, photoUrl],
      createdAt: member.createdAt,
    });
  }
}

// Get all family members
export async function getFamilyMembers(): Promise<FamilyMember[]> {
  try {
    const querySnapshot = await getDocs(collection(db, FAMILY_COLLECTION));
    const members: FamilyMember[] = [];
    
    querySnapshot.forEach((doc) => {
      members.push(doc.data() as FamilyMember);
    });
    
    return members.sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    console.error('Error getting family members:', error);
    return [];
  }
}

// Delete a family member
export async function deleteFamilyMember(memberId: string): Promise<void> {
  await deleteDoc(doc(db, FAMILY_COLLECTION, memberId));
}

// Update family member name
export async function updateFamilyMemberName(memberId: string, newName: string): Promise<void> {
  const memberRef = doc(db, FAMILY_COLLECTION, memberId);
  const memberSnap = await getDoc(memberRef);
  
  if (memberSnap.exists()) {
    const member = memberSnap.data() as FamilyMember;
    await setDoc(memberRef, { ...member, name: newName });
  }
}

// Process an image file and detect faces
export async function processImageForFaces(file: File): Promise<DetectedFace[]> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = async () => {
      try {
        const faces = await detectFaces(img);
        const matchedFaces = await matchFaces(faces);
        resolve(matchedFaces);
      } catch (error) {
        reject(error);
      }
    };
    
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

// Process an image URL and detect faces
export async function processImageUrlForFaces(url: string): Promise<DetectedFace[]> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = async () => {
      try {
        const faces = await detectFaces(img);
        const matchedFaces = await matchFaces(faces);
        resolve(matchedFaces);
      } catch (error) {
        reject(error);
      }
    };
    
    img.onerror = reject;
    img.src = url;
  });
}

// Extract face thumbnail from image (small size for Firestore storage)
export function extractFaceThumbnail(
  imageElement: HTMLImageElement,
  box: { x: number; y: number; width: number; height: number },
  padding: number = 0.3
): string {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  
  // Add padding around the face
  const paddingX = box.width * padding;
  const paddingY = box.height * padding;
  
  const x = Math.max(0, box.x - paddingX);
  const y = Math.max(0, box.y - paddingY);
  const width = Math.min(imageElement.width - x, box.width + paddingX * 2);
  const height = Math.min(imageElement.height - y, box.height + paddingY * 2);
  
  // Small thumbnail to keep Firestore document size small
  canvas.width = 80;
  canvas.height = 80;
  
  ctx.drawImage(imageElement, x, y, width, height, 0, 0, 80, 80);
  
  // Low quality JPEG to minimize size
  return canvas.toDataURL('image/jpeg', 0.5);
}

