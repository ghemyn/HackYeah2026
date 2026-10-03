import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const db = getFirestore(initializeApp(firebaseConfig));

// Firestore collection names. The fields of each one are described in README.md ("Database").
export const COLLECTIONS = {
  users: "users",
  habits: "habits",
  checkins: "checkins",
  friends: "friends",
  badges: "badges",
} as const;

// Readers that tolerate missing or malformed fields in stored documents.
export const readString = (value: unknown, fallback = ""): string => (typeof value === "string" ? value : fallback);

export const readOptionalString = (value: unknown): string | null => (typeof value === "string" ? value : null);

export const readNumber = (value: unknown, fallback = 0): number =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;
