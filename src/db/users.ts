import {
  doc,
  getDoc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  updateDoc,
  type DocumentData,
  type Unsubscribe,
} from "firebase/firestore";
import { todayKey, weekStartKey, type DateKey } from "../common";
import { DEFAULT_AVATAR } from "../game/catalog";
import { COLLECTIONS, db, readNumber, readOptionalString, readString } from "./firebase";

export type UserProfile = {
  // Lowercased nickname; also the document ID.
  id: string;
  nickname: string;
  avatar: string;
  totalPoints: number;
  // Points earned in the week starting on `weekStart` (a Monday).
  weekPoints: number;
  weekStart: DateKey;
  // Points of the week before `weekStart`.
  lastWeekPoints: number;
  // Consecutive days with at least one check-in, as of `lastCheckInDate`.
  streak: number;
  lastCheckInDate: DateKey | null;
  createdDate: DateKey;
  // Last day whose missed-day penalties have already been applied.
  settledThrough: DateKey;
  // Monday of the last week the weekly-winner bonus was evaluated for.
  crownedWeek: DateKey | null;
};

// Nicknames become document IDs, so they must start with a letter or digit (Firestore forbids IDs like "__x__").
const NICKNAME_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N}_.-]{2,23}$/u;

export const validateNickname = (nickname: string): string =>
  NICKNAME_PATTERN.test(nickname)
    ? ""
    : "Nickname must be 3-24 characters, start with a letter or digit, and use only letters, digits, '_', '.' or '-'.";

export const toUserId = (nickname: string): string => nickname.trim().toLowerCase();

export const userRef = (userId: string) => doc(db, COLLECTIONS.users, userId);

export const toUserProfile = (id: string, data: DocumentData): UserProfile => {
  const createdDate = readString(data.createdDate, todayKey());

  return {
    id,
    nickname: readString(data.nickname, id),
    avatar: readString(data.avatar, DEFAULT_AVATAR),
    totalPoints: readNumber(data.totalPoints),
    weekPoints: readNumber(data.weekPoints),
    weekStart: readString(data.weekStart, weekStartKey(createdDate)),
    lastWeekPoints: readNumber(data.lastWeekPoints),
    streak: readNumber(data.streak),
    lastCheckInDate: readOptionalString(data.lastCheckInDate),
    createdDate,
    settledThrough: readString(data.settledThrough, createdDate),
    crownedWeek: readOptionalString(data.crownedWeek),
  };
};

export const findUser = async (userId: string): Promise<UserProfile | null> => {
  const snapshot = await getDoc(userRef(userId));
  return snapshot.exists() ? toUserProfile(snapshot.id, snapshot.data()) : null;
};

export const createUser = (nickname: string, avatar: string): Promise<UserProfile> =>
  runTransaction(db, async (transaction) => {
    const userId = toUserId(nickname);
    const ref = userRef(userId);
    const existing = await transaction.get(ref);

    if (existing.exists()) {
      throw new Error("This nickname is already taken. Go back and log in instead.");
    }

    const today = todayKey();
    const data = {
      nickname,
      avatar,
      totalPoints: 0,
      weekPoints: 0,
      weekStart: weekStartKey(today),
      lastWeekPoints: 0,
      streak: 0,
      lastCheckInDate: null,
      createdDate: today,
      settledThrough: today,
      crownedWeek: null,
    };

    transaction.set(ref, { ...data, createdAt: serverTimestamp() });
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
