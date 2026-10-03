import { doc, runTransaction, serverTimestamp } from "firebase/firestore";
import { todayKey, weekStartKey } from "../common";
import { earnsStreakBonus, habitCountThisWeek, rollWeek, streakAfterCheckIn } from "../game/progress";
import { POINTS } from "../game/rules";
import { badgeData, badgeRef } from "./badges";
import { COLLECTIONS, db } from "./firebase";
import { habitRef, toHabit, type Habit } from "./habits";
import { settleMissedDays } from "./settlement";
import { toUserProfile, userRef } from "./users";

// Check-ins require scanning the habit's own QR code or NFC tag; there is no button check-in.
export type CheckInMethod = "qr" | "nfc";

export type CheckInResult =
  | { status: "checked-in"; habit: Habit; points: number; streak: number; streakBonus: boolean }
  | { status: "already-done"; habit: Habit };

// One check-in per habit per day: the document ID makes a second one impossible.
const checkinRef = (habitId: string, date: string) => doc(db, COLLECTIONS.checkins, `${habitId}_${date}`);

export const checkIn = async (userId: string, habitId: string, method: CheckInMethod): Promise<CheckInResult> => {
  // Apply penalties for days missed before today first, so they are never skipped.
  await settleMissedDays(userId);

  return runTransaction(db, async (transaction) => {
    const today = todayKey();
    const [userSnapshot, habitSnapshot, checkinSnapshot] = await Promise.all([
      transaction.get(userRef(userId)),
      transaction.get(habitRef(habitId)),
      transaction.get(checkinRef(habitId, today)),
    ]);

    if (!userSnapshot.exists()) {
      throw new Error("Your account no longer exists. Please log in again.");
    }

    if (!habitSnapshot.exists()) {
      throw new Error("This habit no longer exists.");
    }

    const habit = toHabit(habitSnapshot.id, habitSnapshot.data());

    if (habit.userId !== userId) {
      throw new Error("This habit belongs to another player.");
    }

    if (checkinSnapshot.exists()) {
      return { status: "already-done", habit };
    }

    const profile = toUserProfile(userSnapshot.id, userSnapshot.data());
    const previousStreak = profile.lastCheckInDate === today ? profile.streak : 0;
    const streak = streakAfterCheckIn(profile, today);
    const streakBonus = earnsStreakBonus(previousStreak, streak);
    const points = POINTS.checkIn + (streakBonus ? POINTS.streakBonus : 0);
    const week = rollWeek(profile, today);

    transaction.set(checkinRef(habitId, today), {
      userId,
      habitId,
      date: today,
      method,
      points: POINTS.checkIn,
      createdAt: serverTimestamp(),
    });

    transaction.update(habitSnapshot.ref, {
      lastCheckInDate: today,
      weekStart: weekStartKey(today),
      weekCount: habitCountThisWeek(habit, today) + 1,
      totalCheckIns: habit.totalCheckIns + 1,
    });

    transaction.update(userSnapshot.ref, {
      totalPoints: profile.totalPoints + points,
      weekStart: week.weekStart,
      weekPoints: week.weekPoints + points,
      lastWeekPoints: week.lastWeekPoints,
      streak,
      lastCheckInDate: today,
    });

    if (streakBonus) {
      transaction.set(badgeRef(userId, "streak", today), badgeData(userId, "streak", today));
    }

    return { status: "checked-in", habit, points, streak, streakBonus };
  });
};
