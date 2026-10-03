import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
  type DocumentData,
  type Unsubscribe,
} from "firebase/firestore";
import { generateUuid, todayKey, type DateKey } from "../common";
import { DEFAULT_HABIT_ICON, MAX_TIMES_PER_WEEK } from "../game/catalog";
import { COLLECTIONS, db, readNumber, readOptionalString, readString } from "./firebase";

export type Habit = {
  id: string;
  userId: string;
  name: string;
  icon: string;
  // 7 means every day.
  timesPerWeek: number;
  // Secret code written into the habit's QR code and NFC sticker.
  tagCode: string;
  createdDate: DateKey;
  lastCheckInDate: DateKey | null;
  // Check-ins during the week starting on `weekStart`.
  weekStart: DateKey | null;
  weekCount: number;
  totalCheckIns: number;
};

export type NewHabit = {
  name: string;
  icon: string;
  timesPerWeek: number;
};

export const habitRef = (habitId: string) => doc(db, COLLECTIONS.habits, habitId);

export const toHabit = (id: string, data: DocumentData): Habit => ({
  id,
  userId: readString(data.userId),
  name: readString(data.name, "Habit"),
  icon: readString(data.icon, DEFAULT_HABIT_ICON),
  timesPerWeek: readNumber(data.timesPerWeek, MAX_TIMES_PER_WEEK),
  tagCode: readString(data.tagCode),
  createdDate: readString(data.createdDate, todayKey()),
  lastCheckInDate: readOptionalString(data.lastCheckInDate),
  weekStart: readOptionalString(data.weekStart),
  weekCount: readNumber(data.weekCount),
  totalCheckIns: readNumber(data.totalCheckIns),
});

export const createHabit = async (userId: string, habit: NewHabit): Promise<void> => {
  await setDoc(habitRef(generateUuid()), {
    userId,
    name: habit.name,
    icon: habit.icon,
    timesPerWeek: habit.timesPerWeek,
    tagCode: generateUuid(),
    createdDate: todayKey(),
    lastCheckInDate: null,
    weekStart: null,
    weekCount: 0,
    totalCheckIns: 0,
    createdAt: serverTimestamp(),
  });
};

export const deleteHabit = async (habitId: string): Promise<void> => {
  await deleteDoc(habitRef(habitId));
};

// Live list of a player's habits, oldest first.
export const watchHabits = (
  userId: string,
  onChange: (habits: Habit[]) => void,
  onError: (error: Error) => void,
): Unsubscribe =>
  onSnapshot(
    query(collection(db, COLLECTIONS.habits), where("userId", "==", userId)),
    (snapshot) => {
      const habits = snapshot.docs.map((habitDoc) => toHabit(habitDoc.id, habitDoc.data()));
      habits.sort((a, b) => a.createdDate.localeCompare(b.createdDate) || a.name.localeCompare(b.name));
      onChange(habits);
    },
    onError,
  );

export const findHabitByTagCode = async (tagCode: string): Promise<Habit | null> => {
  const snapshot = await getDocs(
    query(collection(db, COLLECTIONS.habits), where("tagCode", "==", tagCode), limit(1)),
  );
  const habitDoc = snapshot.docs[0];
  return habitDoc ? toHabit(habitDoc.id, habitDoc.data()) : null;
};
