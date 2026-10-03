import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  where,
  writeBatch,
  type QuerySnapshot,
  type Unsubscribe,
} from "firebase/firestore";
import { COLLECTIONS, db, readString } from "./firebase";
import { findUser, validateNickname, type UserProfile } from "./users";

// Friendships are stored in both directions ("a:b" and "b:a") so each player can list their own friends.
// ":" cannot appear in user IDs, so the document IDs never collide.
const friendshipRef = (userId: string, friendId: string) => doc(db, COLLECTIONS.friends, `${userId}:${friendId}`);

const friendsOfQuery = (userId: string) => query(collection(db, COLLECTIONS.friends), where("userId", "==", userId));

const toFriendIds = (snapshot: QuerySnapshot): string[] =>
  snapshot.docs.map((friendDoc) => readString(friendDoc.data().friendId)).filter(Boolean);

export const getFriendIds = async (userId: string): Promise<string[]> =>
  toFriendIds(await getDocs(friendsOfQuery(userId)));

export const watchFriendIds = (
  userId: string,
  onChange: (friendIds: string[]) => void,
  onError: (error: Error) => void,
): Unsubscribe => onSnapshot(friendsOfQuery(userId), (snapshot) => onChange(toFriendIds(snapshot)), onError);

export const addFriend = async (
  userId: string,
  friendId: string,
): Promise<{ friend: UserProfile; alreadyFriends: boolean }> => {
  if (userId === friendId) {
    throw new Error("You can't add yourself as a friend.");
  }

  // Malformed IDs (e.g. from a hand-made QR code) would be invalid document paths.
  const friend = validateNickname(friendId) ? null : await findUser(friendId);

  if (!friend) {
    throw new Error("No player with that nickname exists.");
  }

  const existing = await getDoc(friendshipRef(userId, friendId));

  if (existing.exists()) {
    return { friend, alreadyFriends: true };
  }

  const batch = writeBatch(db);
  batch.set(friendshipRef(userId, friendId), { userId, friendId, createdAt: serverTimestamp() });
  batch.set(friendshipRef(friendId, userId), { userId: friendId, friendId: userId, createdAt: serverTimestamp() });
  await batch.commit();

  return { friend, alreadyFriends: false };
};

export const removeFriend = async (userId: string, friendId: string): Promise<void> => {
  const batch = writeBatch(db);
  batch.delete(friendshipRef(userId, friendId));
  batch.delete(friendshipRef(friendId, userId));
  await batch.commit();
};
