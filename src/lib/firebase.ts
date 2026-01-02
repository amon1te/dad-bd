import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyCIAtzjPjKWHu3I788NEPEM0bWjLZkeGFY",
  authDomain: "dad-bd-29a3a.firebaseapp.com",
  projectId: "dad-bd-29a3a",
  storageBucket: "dad-bd-29a3a.firebasestorage.app",
  messagingSenderId: "649850855778",
  appId: "1:649850855778:web:af89084d27ed7de720cc3b",
  measurementId: "G-2F75FHRVVE"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;
