// Awards milestone badges (game/milestones.ts) while the player is logged in: whenever their habits,
// friends or badges change, every milestone they have reached but not earned yet is saved.

import { setDoc, type Unsubscribe } from "firebase/firestore";
import { todayKey } from "../common";
import { reachedMilestones, type MilestoneType } from "../game/milestones";
import { milestoneData, milestoneRef, watchBadges } from "./badges";
import { watchFriendIds } from "./friends";
import { watchHabits, type Habit } from "./habits";

export const watchMilestones = (userId: string, onError: (error: Error) => void): Unsubscribe => {
  let habits: Habit[] | null = null;
  let friendCount: number | null = null;
  let earned: Set<string> | null = null;
  // Being saved; the badges listener reports them right after (the local write counts).
  const saving = new Set<MilestoneType>();

  const award = () => {
    if (!habits || friendCount === null || !earned) {
      return;
    }

    const today = todayKey();

    for (const { type, habit } of reachedMilestones(userId, habits, friendCount, today)) {
      if (earned.has(type) || saving.has(type)) {
        continue;
      }

      saving.add(type);
      setDoc(milestoneRef(userId, type), milestoneData(userId, type, today, habit))
        .catch(onError)
        .finally(() => saving.delete(type));
    }
  };

  const stops = [
    watchHabits(
      userId,
      (nextHabits) => {
        habits = nextHabits;
        award();
      },
      onError,
    ),
    watchFriendIds(
      userId,
      (friendIds) => {
        friendCount = friendIds.length;
        award();
      },
      onError,
    ),
    watchBadges(
      userId,
      (badges) => {
        earned = new Set(badges.map((badge) => badge.type));
        award();
      },
      onError,
    ),
  ];

  return () => stops.forEach((stop) => stop());
};
