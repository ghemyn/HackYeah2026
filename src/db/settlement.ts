// Penalties and weekly bonuses are applied by the player's own app (there is no server).
// Both functions are idempotent, so they can run on every app start and before every check-in.

import { runTransaction } from "firebase/firestore";
import { addDays, todayKey, weekStartKey } from "../common";
import { pointsInWeek, rollWeek, unsettledPenalties } from "../game/progress";
import { POINTS } from "../game/rules";
import { badgeData, badgeRef } from "./badges";
import { db } from "./firebase";
import { getFriendIds } from "./friends";
import { findUser, toUserProfile, userRef, type UserProfile } from "./users";

// Applies the missed-day penalties for every day since the last check-in, up to yesterday.
export const settleMissedDays = (userId: string): Promise<void> =>
  runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(userRef(userId));

    if (!snapshot.exists()) {
      return;
    }

    const profile = toUserProfile(snapshot.id, snapshot.data());
    const today = todayKey();
    const { penalty, lazySnailDays, settledThrough } = unsettledPenalties(profile, today);

    if (penalty === 0) {
      return;
    }

    const week = rollWeek(profile, today);

    transaction.update(snapshot.ref, {
      totalPoints: profile.totalPoints + penalty,
      weekStart: week.weekStart,
      weekPoints: week.weekPoints + penalty,
      lastWeekPoints: week.lastWeekPoints,
      streak: 0,
      settledThrough,
    });

    for (const day of lazySnailDays) {
      transaction.set(badgeRef(userId, "lazySnail", day), badgeData(userId, "lazySnail", day));
    }
  });

// Gives the weekly-winner bonus once per week to a player who beat every friend last week.
export const settleWeeklyWinner = async (userId: string): Promise<void> => {
  const today = todayKey();
  const lastWeek = addDays(weekStartKey(today), -7);
  const player = await findUser(userId);

  if (!player || player.crownedWeek === lastWeek) {
    return;
  }

  const friendIds = await getFriendIds(userId);
  const friends = (await Promise.all(friendIds.map(findUser))).filter(
    (friend): friend is UserProfile => friend !== null,
  );
  const playerPoints = pointsInWeek(player, lastWeek);
  const won =
    friends.length > 0 && playerPoints > 0 && friends.every((friend) => pointsInWeek(friend, lastWeek) < playerPoints);

  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(userRef(userId));

    if (!snapshot.exists()) {
      return;
    }

    const profile = toUserProfile(snapshot.id, snapshot.data());

    if (profile.crownedWeek === lastWeek) {
      return;
    }

    if (!won) {
      transaction.update(snapshot.ref, { crownedWeek: lastWeek });
      return;
    }

    const week = rollWeek(profile, today);

    transaction.update(snapshot.ref, {
      crownedWeek: lastWeek,
      totalPoints: profile.totalPoints + POINTS.weeklyWinner,
      weekStart: week.weekStart,
      weekPoints: week.weekPoints + POINTS.weeklyWinner,
      lastWeekPoints: week.lastWeekPoints,
    });
    transaction.set(badgeRef(userId, "weeklyWinner", lastWeek), badgeData(userId, "weeklyWinner", lastWeek));
  });
};

export const settleAccount = async (userId: string): Promise<void> => {
  await settleMissedDays(userId);
  await settleWeeklyWinner(userId);
};
