import {
  collection,
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
import { DEFAULT_HABIT_ICON } from "../game/catalog";
import { toSchedule, type HabitSchedule } from "../game/schedule";
import { COLLECTIONS, db, readNumber, readOptionalString, readString } from "./firebase";

// One member's progress in a shared habit. Points live here: each habit has its own leaderboard.
export type HabitMemberStats = {
  joinedDate: DateKey;
  lastCheckInDate: DateKey | null;
  // Check-ins on `lastCheckInDate` (habits can allow several a day).
  lastDateCount: number;
  // Check-ins in the cycle (or week, for weekday schedules) starting on `periodStart`.
  periodStart: DateKey | null;
  periodCount: number;
  totalCheckIns: number;
  // This member's points in this habit's leaderboard.
  points: number;
  // Check-ins since the last penalty in this habit.
  streak: number;
  // Misses since the last check-in; the Lazy Snail badge comes at 3.
  missedInRow: number;
  // Last day whose missed check-ins are already charged (see settleMember in game/progress.ts).
  settledThrough: DateKey;
};

// Habits are shared: anyone can join one, and every member checks in by scanning the same tag.
export type Habit = {
  id: string;
  // Who created the habit; they have no special rights afterwards.
  creatorId: string;
  name: string;
  icon: string;
  schedule: HabitSchedule;
  // Secret code written into the habit's QR code and NFC sticker.
  tagCode: string;
  // Interval cycles ("X times every Y days") start on this day.
  createdDate: DateKey;
  // Used to query a player's habits; always has the same users as `members`.
  memberIds: string[];
  members: Record<string, HabitMemberStats>;
};

export type NewHabit = {
  name: string;
  icon: string;
  schedule: HabitSchedule;
};

// Firestore allows at most 30 values in an "array-contains-any" filter.
const MAX_ARRAY_CONTAINS_ANY = 30;

export const habitRef = (habitId: string) => doc(db, COLLECTIONS.habits, habitId);

export const newMemberStats = (today: DateKey): HabitMemberStats => ({
  joinedDate: today,
  lastCheckInDate: null,
  lastDateCount: 0,
  periodStart: null,
  periodCount: 0,
  totalCheckIns: 0,
  points: 0,
  streak: 0,
  missedInRow: 0,
  settledThrough: today,
});

const toMemberStats = (value: unknown, fallbackDate: DateKey): HabitMemberStats => {
  const data = value && typeof value === "object" ? (value as DocumentData) : {};

  return {
    joinedDate: readString(data.joinedDate, fallbackDate),
    lastCheckInDate: readOptionalString(data.lastCheckInDate),
    lastDateCount: readNumber(data.lastDateCount),
    periodStart: readOptionalString(data.periodStart),
    periodCount: readNumber(data.periodCount),
    totalCheckIns: readNumber(data.totalCheckIns),
    points: readNumber(data.points),
    streak: readNumber(data.streak),
    missedInRow: readNumber(data.missedInRow),
    settledThrough: readString(data.settledThrough, fallbackDate),
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
    schedule: toSchedule(data.schedule, data.timesPerWeek),
    tagCode: readString(data.tagCode),
    createdDate,
    memberIds,
    members,
  };
};

export const isHabitMember = (habit: Pick<Habit, "memberIds">, userId: string): boolean =>
  habit.memberIds.includes(userId);

// The fields that hold membership. They are always written together, inside a transaction.
export const membershipData = (members: Record<string, HabitMemberStats>) => ({
  memberIds: Object.keys(members),
  members,
});

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
    schedule: habit.schedule,
    tagCode: generateUuid(),
    createdDate: today,
    ...membershipData({ [userId]: newMemberStats(today) }),
    createdAt: serverTimestamp(),
  });
};

// Adds the player to the habit. Resolves to false if they were already a member.
export const joinHabit = (userId: string, habitId: string): Promise<boolean> =>
  runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(habitRef(habitId));

    if (!snapshot.exists()) {
      throw new Error("This habit no longer exists.");
    }

    const habit = toHabit(snapshot.id, snapshot.data());

    if (isHabitMember(habit, userId)) {
      return false;
    }

    transaction.update(snapshot.ref, membershipData({ ...habit.members, [userId]: newMemberStats(todayKey()) }));
    return true;
  });

// Removes the player and their points from the habit. The last member to leave deletes it, which also retires its tag.
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

    const members = { ...habit.members };
    delete members[userId];
    transaction.update(snapshot.ref, membershipData(members));
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
