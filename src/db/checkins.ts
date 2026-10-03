import { arrayUnion, doc, runTransaction, serverTimestamp } from "firebase/firestore";
import { todayKey, weekStartKey } from "../common";
import { earnsStreakBonus, habitCountThisWeek, rollWeek, streakAfterCheckIn } from "../game/progress";
import { POINTS } from "../game/rules";
import { badgeData, badgeRef } from "./badges";
import { COLLECTIONS, db } from "./firebase";
import { habitRef, isHabitMember, memberStats, memberStatsPath, toHabit, type Habit, type HabitMemberStats } from "./habits";
import { settleMissedDays } from "./settlement";
import { toUserProfile, userRef } from "./users";

// Check-ins require scanning the habit's own QR code or NFC tag; there is no button check-in.
export type CheckInMethod = "qr" | "nfc";

export type CheckInResult =
  | { status: "checked-in"; habit: Habit; joined: boolean; points: number; streak: number; streakBonus: boolean }
  | { status: "already-done"; habit: Habit; joined: boolean };

// One check-in per player per habit per day: the document ID makes a second one impossible.
// ":" cannot appear in habit IDs (UUIDs), user IDs or dates, so the IDs never collide.
const checkinRef = (habitId: string, userId: string, date: string) =>
  doc(db, COLLECTIONS.checkins, `${habitId}:${userId}:${date}`);

// Checks the player in to a habit. Scanning a habit the player has not joined yet joins it first.
export const checkIn = async (userId: string, habitId: string, method: CheckInMethod): Promise<CheckInResult> => {
  // Apply penalties for days missed before today first, so they are never skipped.
  await settleMissedDays(userId);

  return runTransaction(db, async (transaction) => {
    const today = todayKey();
    const [userSnapshot, habitSnapshot, checkinSnapshot] = await Promise.all([
      transaction.get(userRef(userId)),
      transaction.get(habitRef(habitId)),
      transaction.get(checkinRef(habitId, userId, today)),
    ]);

    if (!userSnapshot.exists()) {
      throw new Error("Your account no longer exists. Please log in again.");
    }

    if (!habitSnapshot.exists()) {
      throw new Error("This habit no longer exists.");
    }

    const habit = toHabit(habitSnapshot.id, habitSnapshot.data());
    const joined = !isHabitMember(habit, userId);
    const stats = memberStats(habit, userId, today);
    const weekStart = weekStartKey(today);
    const statsAfterCheckIn: HabitMemberStats = {
      ...stats,
      lastCheckInDate: today,
      weekStart,
      weekCount: habitCountThisWeek(stats, today) + 1,
      totalCheckIns: stats.totalCheckIns + 1,
    };

    if (checkinSnapshot.exists()) {
      // Left and re-joined on a day already checked in: restore the membership with today's check-in.
      if (joined) {
        transaction.update(habitSnapshot.ref, memberStatsPath(userId), statsAfterCheckIn, "memberIds", arrayUnion(userId));
      }

      return { status: "already-done", habit, joined };
    }

    const profile = toUserProfile(userSnapshot.id, userSnapshot.data());
    const previousStreak = profile.lastCheckInDate === today ? profile.streak : 0;
    const streak = streakAfterCheckIn(profile, today);
    const streakBonus = earnsStreakBonus(previousStreak, streak);
    const points = POINTS.checkIn + (streakBonus ? POINTS.streakBonus : 0);
    const week = rollWeek(profile, today);

    transaction.set(checkinRef(habitId, userId, today), {
      userId,
      habitId,
      date: today,
      method,
      points: POINTS.checkIn,
      createdAt: serverTimestamp(),
    });

    transaction.update(habitSnapshot.ref, memberStatsPath(userId), statsAfterCheckIn, "memberIds", arrayUnion(userId));

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

    return { status: "checked-in", habit, joined, points, streak, streakBonus };
  });
};
