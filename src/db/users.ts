import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  where,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  updateDoc,
  type DocumentData,
  type Unsubscribe,
} from "firebase/firestore";
import { todayKey, type DateKey } from "../common";
import { DEFAULT_AVATAR } from "../game/catalog";
import { COLLECTIONS, db, readString } from "./firebase";

// The account. Points are not stored here: they belong to the player's membership in each habit.
// The document also stores `uid`, the Firebase Authentication user that owns it (see db/auth.ts).
export type UserProfile = {
  // Lowercased nickname; also the document ID.
  id: string;
  nickname: string;
  avatar: string;
  createdDate: DateKey;
};

// Nicknames become document IDs, so they must start with a letter or digit (Firestore forbids IDs like "__x__").
const NICKNAME_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N}_.-]{2,23}$/u;

export const validateNickname = (nickname: string): string =>
  NICKNAME_PATTERN.test(nickname)
    ? ""
    : "Nickname must be 3-24 characters, start with a letter or digit, and use only letters, digits, '_', '.' or '-'.";

export const toUserId = (nickname: string): string => nickname.trim().toLowerCase();

export const userRef = (userId: string) => doc(db, COLLECTIONS.users, userId);

export const toUserProfile = (id: string, data: DocumentData): UserProfile => ({
  id,
  nickname: readString(data.nickname, id),
  avatar: readString(data.avatar, DEFAULT_AVATAR),
  createdDate: readString(data.createdDate, todayKey()),
});

export const findUser = async (userId: string): Promise<UserProfile | null> => {
  const snapshot = await getDoc(userRef(userId));
  return snapshot.exists() ? toUserProfile(snapshot.id, snapshot.data()) : null;
};

// The player account owned by a Firebase Authentication user, if any.
export const findUserByUid = async (uid: string): Promise<UserProfile | null> => {
  const snapshot = await getDocs(query(collection(db, COLLECTIONS.users), where("uid", "==", uid), limit(1)));
  const userDoc = snapshot.docs[0];
  return userDoc ? toUserProfile(userDoc.id, userDoc.data()) : null;
};

// Creates the player account for a newly registered Firebase Authentication user.
export const createUser = (nickname: string, avatar: string, uid: string): Promise<UserProfile> =>
  runTransaction(db, async (transaction) => {
    const userId = toUserId(nickname);
    const ref = userRef(userId);
    const existing = await transaction.get(ref);

    if (existing.exists()) {
      throw new Error("This nickname is already taken. Pick another one, or log in if it's yours.");
    }

    const data = {
      nickname,
      avatar,
      createdDate: todayKey(),
    };

    transaction.set(ref, { ...data, uid, createdAt: serverTimestamp() });
    return toUserProfile(userId, data);
  });

export const watchUser = (
  userId: string,
  onChange: (profile: UserProfile | null) => void,
  onError: (error: Error) => void,
): Unsubscribe =>
  onSnapshot(
    userRef(userId),
    (snapshot) => onChange(snapshot.exists() ? toUserProfile(snapshot.id, snapshot.data()) : null),
    onError,
  );

export const updateAvatar = async (userId: string, avatar: string): Promise<void> => {
  await updateDoc(userRef(userId), { avatar });
};
