import { doc, runTransaction, serverTimestamp } from "firebase/firestore";
import { todayKey } from "../common";
import { applyCheckIn, habitStandings, settleAllMembers } from "../game/progress";
import { POINTS } from "../game/rules";
import { badgeData, badgeRef } from "./badges";
import { COLLECTIONS, db } from "./firebase";
import { habitRef, isHabitMember, membershipData, newMemberStats, toHabit, type Habit } from "./habits";
import { writeLazySnailBadges } from "./settlement";
import { userRef } from "./users";

// Check-ins require scanning the habit's own QR code or NFC tag; there is no button check-in.
export type CheckInMethod = "qr" | "nfc";

export type CheckInResult =
  | {
      status: "checked-in";
      habit: Habit;
      joined: boolean;
      // Points earned in this habit's leaderboard, including the streak bonus.
      points: number;
      habitPoints: number;
      rank: number;
      streak: number;
      streakBonus: boolean;
    }
  | { status: "already-done"; habit: Habit; joined: boolean };

// One check-in per player per habit per day: the document ID makes a second one impossible.
// ":" cannot appear in habit IDs (UUIDs), user IDs or dates, so the IDs never collide.
const checkinRef = (habitId: string, userId: string, date: string) =>
  doc(db, COLLECTIONS.checkins, `${habitId}:${userId}:${date}`);

// Checks the player in to a habit and adds the points to that habit's leaderboard.
// Scanning a habit the player has not joined yet joins it first.
export const checkIn = (userId: string, habitId: string, method: CheckInMethod): Promise<CheckInResult> =>
  runTransaction(db, async (transaction) => {
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

    // Charge everyone's missed check-ins first, so they are never skipped.
    const settlement = settleAllMembers(habit, today);
    writeLazySnailBadges(transaction, habit, settlement);
    const members = { ...settlement.members };
    const myStats = members[userId] ?? newMemberStats(today);

    if (checkinSnapshot.exists()) {
      // Already checked in today. A player who left and re-joined today gets the check-in back without points.
      if (joined) {
        members[userId] = { ...applyCheckIn(myStats, today).stats, points: 0 };
      }

      if (joined || settlement.changed) {
        transaction.update(habitSnapshot.ref, membershipData(members));
      }

      return { status: "already-done", habit, joined };
    }

    const outcome = applyCheckIn(myStats, today);
    members[userId] = outcome.stats;

    transaction.set(checkinRef(habitId, userId, today), {
      userId,
      habitId,
      date: today,
      method,
      points: POINTS.checkIn,
      createdAt: serverTimestamp(),
    });
    transaction.update(habitSnapshot.ref, membershipData(members));

    if (outcome.streakBonus) {
      transaction.set(badgeRef(userId, "streak", today, habit), badgeData(userId, "streak", today, habit));
    }

    const updatedHabit = { ...habit, ...membershipData(members) };
    const rank = habitStandings(updatedHabit, today).find((standing) => standing.userId === userId)?.rank ?? 1;

    return {
      status: "checked-in",
      habit: updatedHabit,
      joined,
      points: outcome.points,
      habitPoints: outcome.stats.points,
      rank,
      streak: outcome.stats.streak,
      streakBonus: outcome.streakBonus,
    };
  });
