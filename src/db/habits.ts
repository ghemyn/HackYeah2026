import {
  FieldPath,
  arrayRemove,
  arrayUnion,
  collection,
  deleteField,
  doc,
  getDocs,
  limit,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  where,
  type DocumentData,
  type Unsubscribe,
} from "firebase/firestore";
import { generateUuid, todayKey, type DateKey } from "../common";
import { DEFAULT_HABIT_ICON, MAX_TIMES_PER_WEEK } from "../game/catalog";
import { COLLECTIONS, db, readNumber, readOptionalString, readString } from "./firebase";

// One member's progress in a shared habit.
export type HabitMemberStats = {
  joinedDate: DateKey;
  lastCheckInDate: DateKey | null;
  // Check-ins during the week starting on `weekStart`.
  weekStart: DateKey | null;
  weekCount: number;
  totalCheckIns: number;
};

// Habits are shared: anyone can join one, and every member checks in by scanning the same tag.
export type Habit = {
  id: string;
  // Who created the habit; they have no special rights afterwards.
  creatorId: string;
  name: string;
  icon: string;
  // 7 means every day.
  timesPerWeek: number;
  // Secret code written into the habit's QR code and NFC sticker.
  tagCode: string;
  createdDate: DateKey;
  // Used to query a player's habits; always has the same users as `members`.
  memberIds: string[];
  members: Record<string, HabitMemberStats>;
};

export type NewHabit = {
  name: string;
  icon: string;
  timesPerWeek: number;
};

// Firestore allows at most 30 values in an "array-contains-any" filter.
const MAX_ARRAY_CONTAINS_ANY = 30;

export const habitRef = (habitId: string) => doc(db, COLLECTIONS.habits, habitId);

// Path to one member's stats. A FieldPath is needed because user IDs may contain ".".
export const memberStatsPath = (userId: string) => new FieldPath("members", userId);

export const newMemberStats = (today: DateKey): HabitMemberStats => ({
  joinedDate: today,
  lastCheckInDate: null,
  weekStart: null,
  weekCount: 0,
  totalCheckIns: 0,
});

const toMemberStats = (value: unknown, fallbackDate: DateKey): HabitMemberStats => {
  const data = value && typeof value === "object" ? (value as DocumentData) : {};

  return {
    joinedDate: readString(data.joinedDate, fallbackDate),
    lastCheckInDate: readOptionalString(data.lastCheckInDate),
    weekStart: readOptionalString(data.weekStart),
    weekCount: readNumber(data.weekCount),
    totalCheckIns: readNumber(data.totalCheckIns),
  };
};

export const toHabit = (id: string, data: DocumentData): Habit => {
  const createdDate = readString(data.createdDate, todayKey());
  const memberIds = Array.isArray(data.memberIds)
    ? data.memberIds.filter((memberId): memberId is string => typeof memberId === "string")
    : [];
  const storedMembers = data.members && typeof data.members === "object" ? (data.members as DocumentData) : {};
  const members: Record<string, HabitMemberStats> = {};

  for (const memberId of memberIds) {
    members[memberId] = toMemberStats(storedMembers[memberId], createdDate);
  }

  return {
    id,
    creatorId: readString(data.creatorId),
    name: readString(data.name, "Habit"),
    icon: readString(data.icon, DEFAULT_HABIT_ICON),
    timesPerWeek: readNumber(data.timesPerWeek, MAX_TIMES_PER_WEEK),
    tagCode: readString(data.tagCode),
    createdDate,
    memberIds,
    members,
  };
};

export const isHabitMember = (habit: Pick<Habit, "memberIds">, userId: string): boolean =>
  habit.memberIds.includes(userId);

// A member's stats, or empty stats for someone who has not joined.
export const memberStats = (habit: Pick<Habit, "members">, userId: string, today: DateKey): HabitMemberStats =>
  habit.members[userId] ?? newMemberStats(today);

const sortHabits = (habits: Habit[]): Habit[] =>
  habits.sort((a, b) => a.createdDate.localeCompare(b.createdDate) || a.name.localeCompare(b.name));

// Creates a habit with the creator as its first member.
export const createHabit = async (userId: string, habit: NewHabit): Promise<void> => {
  const today = todayKey();

  await setDoc(habitRef(generateUuid()), {
    creatorId: userId,
    name: habit.name,
    icon: habit.icon,
    timesPerWeek: habit.timesPerWeek,
    tagCode: generateUuid(),
    createdDate: today,
    memberIds: [userId],
    members: { [userId]: newMemberStats(today) },
    createdAt: serverTimestamp(),
  });
};

export const joinHabit = (userId: string, habitId: string): Promise<void> =>
  runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(habitRef(habitId));

    if (!snapshot.exists()) {
      throw new Error("This habit no longer exists.");
    }

    if (isHabitMember(toHabit(snapshot.id, snapshot.data()), userId)) {
      return;
    }

    transaction.update(snapshot.ref, memberStatsPath(userId), newMemberStats(todayKey()), "memberIds", arrayUnion(userId));
  });

// Removes the player from the habit. The last member to leave deletes it, which also retires its tag.
export const leaveHabit = (userId: string, habitId: string): Promise<void> =>
  runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(habitRef(habitId));

    if (!snapshot.exists()) {
      return;
    }

    const habit = toHabit(snapshot.id, snapshot.data());

    if (!isHabitMember(habit, userId)) {
      return;
    }

    if (habit.memberIds.every((memberId) => memberId === userId)) {
      transaction.delete(snapshot.ref);
      return;
    }

    transaction.update(snapshot.ref, memberStatsPath(userId), deleteField(), "memberIds", arrayRemove(userId));
  });

// Live list of the habits a player is a member of, oldest first.
export const watchHabits = (
  userId: string,
  onChange: (habits: Habit[]) => void,
  onError: (error: Error) => void,
): Unsubscribe =>
  onSnapshot(
    query(collection(db, COLLECTIONS.habits), where("memberIds", "array-contains", userId)),
    (snapshot) => onChange(sortHabits(snapshot.docs.map((habitDoc) => toHabit(habitDoc.id, habitDoc.data())))),
    onError,
  );

// Habits that at least one of the given players is a member of, oldest first.
export const findHabitsWithMembers = async (userIds: string[]): Promise<Habit[]> => {
  const habits = new Map<string, Habit>();

  for (let start = 0; start < userIds.length; start += MAX_ARRAY_CONTAINS_ANY) {
    const chunk = userIds.slice(start, start + MAX_ARRAY_CONTAINS_ANY);
    const snapshot = await getDocs(
      query(collection(db, COLLECTIONS.habits), where("memberIds", "array-contains-any", chunk)),
    );

    for (const habitDoc of snapshot.docs) {
      habits.set(habitDoc.id, toHabit(habitDoc.id, habitDoc.data()));
    }
  }

  return sortHabits([...habits.values()]);
};

export const findHabitByTagCode = async (tagCode: string): Promise<Habit | null> => {
  const snapshot = await getDocs(
    query(collection(db, COLLECTIONS.habits), where("tagCode", "==", tagCode), limit(1)),
  );
  const habitDoc = snapshot.docs[0];
  return habitDoc ? toHabit(habitDoc.id, habitDoc.data()) : null;
};
