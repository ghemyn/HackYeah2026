import { doc, runTransaction, serverTimestamp } from "firebase/firestore";
import { todayKey } from "../common";
import { applyCheckIn, checkInBlocker, habitStandings, isDailyLimitReached, settleAllMembers } from "../game/progress";
import { LAZY_SNAIL_AFTER_MISSES, POINTS } from "../game/rules";
import { badgeData, badgeRef, milestoneData, milestoneRef } from "./badges";
import { COLLECTIONS, db } from "./firebase";
import { habitRef, isHabitMember, membershipData, tauntRef, toHabit, type Habit } from "./habits";
import { writeLazySnailBadges } from "./settlement";
import { userRef } from "./users";

// Check-ins require scanning the habit's own QR code or NFC tag; there is no button check-in.
export type CheckInMethod = "qr" | "nfc";

export type CheckInResult =
  | {
      status: "checked-in";
      habit: Habit;
      // Points earned in this habit's leaderboard, including the streak bonus.
      points: number;
      habitPoints: number;
      rank: number;
      streak: number;
      streakBonus: boolean;
      // Whether a taunt at the player in this habit was cancelled.
      tauntCancelled: boolean;
    }
  | { status: "already-done"; habit: Habit };

// `number` is the check-in's position that day (1, 2, ...), since some habits allow several a day.
// ":" cannot appear in habit IDs (UUIDs), user IDs or dates, so the IDs never collide.
const checkinRef = (habitId: string, userId: string, date: string, number: number) =>
  doc(db, COLLECTIONS.checkins, `${habitId}:${userId}:${date}:${number}`);

// Checks a member in to a habit and adds the points to that habit's leaderboard, and cancels any taunt at them.
// Players must join the habit first (their first scan of its tag only joins it; see joinHabit).
export const checkIn = (userId: string, habitId: string, method: CheckInMethod): Promise<CheckInResult> =>
  runTransaction(db, async (transaction) => {
    const today = todayKey();
    // The habit document holds the member's check-in counts. The transaction retries if it changes
    // meanwhile, so two scans at once can never both pass the daily limit.
    const [userSnapshot, habitSnapshot, tauntSnapshot, comebackSnapshot] = await Promise.all([
      transaction.get(userRef(userId)),
      transaction.get(habitRef(habitId)),
      transaction.get(tauntRef(habitId, userId)),
      transaction.get(milestoneRef(userId, "comeback")),
    ]);

    if (!userSnapshot.exists()) {
      throw new Error("Your account no longer exists. Please log in again.");
    }

    if (!habitSnapshot.exists()) {
      throw new Error("This habit no longer exists.");
    }

    const habit = toHabit(habitSnapshot.id, habitSnapshot.data());

    if (!isHabitMember(habit, userId)) {
      throw new Error("You haven't joined this habit yet. Scan its tag once to join, then again to check in.");
    }

    // Charge everyone's missed check-ins first, so they are never skipped.
    const settlement = settleAllMembers(habit, today);
    writeLazySnailBadges(transaction, habit, settlement);
    const members = { ...settlement.members };

    // Checking in cancels a taunt. Only deleted if it exists: the rules check who the taunt was at.
    // Also cancelled when today's check-ins are already done (a leader in another time zone may be a day ahead).
    const cancelTaunt = () => {
      if (tauntSnapshot.exists()) {
        transaction.delete(tauntSnapshot.ref);
      }
    };

    if (isDailyLimitReached(habit, members[userId], today)) {
      if (settlement.changed) {
        transaction.update(habitSnapshot.ref, membershipData(members));
      }

      cancelTaunt();
      return { status: "already-done", habit };
    }

    // Unscheduled weekdays and cycles whose target is already reached earn nothing, so they are refused.
    const blocker = checkInBlocker(habit, members[userId], today);

    if (blocker) {
      throw new Error(blocker);
    }

    // Checking in while being a Lazy Snail earns the Comeback milestone (once).
    if (members[userId].missedInRow >= LAZY_SNAIL_AFTER_MISSES && !comebackSnapshot.exists()) {
      transaction.set(comebackSnapshot.ref, milestoneData(userId, "comeback", today, habit));
    }

    const outcome = applyCheckIn(habit, members[userId], today);
    members[userId] = outcome.stats;

    transaction.set(checkinRef(habitId, userId, today, outcome.stats.lastDateCount), {
      userId,
      habitId,
      date: today,
      method,
      points: POINTS.checkIn,
      createdAt: serverTimestamp(),
    });
    transaction.update(habitSnapshot.ref, membershipData(members));
    cancelTaunt();

    if (outcome.streakBonus) {
      transaction.set(badgeRef(userId, "streak", today, habit), badgeData(userId, "streak", today, habit));
    }

    const updatedHabit = { ...habit, ...membershipData(members) };
    const rank = habitStandings(updatedHabit, today).find((standing) => standing.userId === userId)?.rank ?? 1;

    return {
      status: "checked-in",
      habit: updatedHabit,
      points: outcome.points,
      habitPoints: outcome.stats.points,
      rank,
      streak: outcome.stats.streak,
      streakBonus: outcome.streakBonus,
      tauntCancelled: tauntSnapshot.exists(),
    };
  });
