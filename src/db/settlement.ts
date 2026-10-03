// Penalties are applied by the players' apps (there is no server). Settling a habit charges every member,
// so a member who never opens the app still loses points when someone else in the habit does.
// Settling is idempotent, so it can run on every app start and before every check-in.

import { collection, getDocs, query, runTransaction, where, type Transaction } from "firebase/firestore";
import { todayKey } from "../common";
import { settleAllMembers, type HabitSettlement } from "../game/progress";
import { badgeData, badgeRef } from "./badges";
import { COLLECTIONS, db } from "./firebase";
import { habitRef, toHabit, type Habit } from "./habits";

// Writes the Lazy Snail badges of a settlement. The members themselves are saved by the caller.
export const writeLazySnailBadges = (transaction: Transaction, habit: Habit, settlement: HabitSettlement) => {
  for (const { userId, date } of settlement.lazySnails) {
    transaction.set(badgeRef(userId, "lazySnail", date, habit), badgeData(userId, "lazySnail", date, habit));
  }
};

export const settleHabit = (habitId: string): Promise<void> =>
  runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(habitRef(habitId));

    if (!snapshot.exists()) {
      return;
    }

    const habit = toHabit(snapshot.id, snapshot.data());
    const settlement = settleAllMembers(habit, todayKey());

    if (!settlement.changed) {
      return;
    }

    transaction.update(snapshot.ref, { members: settlement.members });
    writeLazySnailBadges(transaction, habit, settlement);
  });

// Settles every habit the player belongs to.
export const settleAccount = async (userId: string): Promise<void> => {
  const snapshot = await getDocs(
    query(collection(db, COLLECTIONS.habits), where("memberIds", "array-contains", userId)),
  );

  for (const habitDoc of snapshot.docs) {
    await settleHabit(habitDoc.id);
  }
};
