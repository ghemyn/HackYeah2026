import { initializeApp } from "firebase/app";
import { doc, getDoc, getFirestore, serverTimestamp, setDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Each tag is stored as a document whose ID is the UUID, holding only the UUID and its name.
const TAGS_COLLECTION = "tags";

export type TagRecord = {
  uuid: string;
  name: string;
};

export const saveTag = async ({ uuid, name }: TagRecord): Promise<void> => {
  await setDoc(doc(db, TAGS_COLLECTION, uuid), { uuid, name });
};

export const findTag = async (uuid: string): Promise<TagRecord | null> => {
  const snapshot = await getDoc(doc(db, TAGS_COLLECTION, uuid));

  if (!snapshot.exists()) {
    return null;
  }

  const data = snapshot.data();
  return { uuid, name: String(data.name ?? "") };
};

// Users are keyed by their lowercased nickname so "Alice" and "alice" are the same account.
const USERS_COLLECTION = "users";

export type UserRecord = {
  nickname: string;
};

export const loginUser = async (nickname: string): Promise<{ user: UserRecord; created: boolean }> => {
  const userRef = doc(db, USERS_COLLECTION, nickname.toLowerCase());
  const snapshot = await getDoc(userRef);

  if (snapshot.exists()) {
    return { user: { nickname: String(snapshot.data().nickname ?? nickname) }, created: false };
  }

  await setDoc(userRef, { nickname, createdAt: serverTimestamp() });
  return { user: { nickname }, created: true };
};
