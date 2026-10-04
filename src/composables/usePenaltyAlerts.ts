import { ref, watch, type Ref } from "vue";
import type { Habit } from "../db/habits";
import { settleMember } from "../game/progress";
import { LAZY_SNAIL_AFTER_MISSES } from "../game/rules";

// Points lost to missed check-ins since the player last looked at a habit.
export type PenaltyAlert = {
  // Unique per alert, so a new loss restarts the animation.
  id: number;
  // Negative.
  points: number;
  // Misses behind the loss, or null if unknown (the player checked in on another device meanwhile).
  misses: number | null;
  // Whether the loss made them a Lazy Snail.
  lazySnail: boolean;
};

type SeenStats = {
  points: number;
  missedInRow: number;
  // A new membership (left and joined again) starts from scratch.
  joinedDate: string;
};

const STORAGE_PREFIX = "habitrivals.seenPoints";

// Remembered per device. Kept in memory too, in case storage is blocked.
const memory = new Map<string, SeenStats>();

const readSeen = (key: string): SeenStats | null => {
  try {
    const stored = window.localStorage.getItem(key);

    if (stored) {
      const value: unknown = JSON.parse(stored);

      if (
        value &&
        typeof value === "object" &&
        typeof (value as SeenStats).points === "number" &&
        typeof (value as SeenStats).missedInRow === "number" &&
        typeof (value as SeenStats).joinedDate === "string"
      ) {
        return value as SeenStats;
      }
    }
  } catch {
    // Storage blocked or malformed: fall back to memory.
  }

  return memory.get(key) ?? null;
};

const writeSeen = (key: string, seen: SeenStats) => {
  memory.set(key, seen);

  try {
    window.localStorage.setItem(key, JSON.stringify(seen));
  } catch {
    // Storage blocked: memory still works for this session.
  }
};

let nextAlertId = 0;

// Watches the player's points in each habit, including penalties that are due but not saved yet, and
// raises an alert when they dropped since last seen. Points only ever drop through penalties.
export const usePenaltyAlerts = (userId: string, habits: Ref<Habit[]>, today: Ref<string>) => {
  const alerts = ref<Record<string, PenaltyAlert>>({});

  watch(
    [habits, today],
    () => {
      for (const habit of habits.value) {
        const stats = habit.members[userId];

        if (!stats) {
          continue;
        }

        const settled = settleMember(habit, stats, today.value).stats;
        const key = `${STORAGE_PREFIX}.${userId}.${habit.id}`;
        const seen = readSeen(key);
        writeSeen(key, { points: settled.points, missedInRow: settled.missedInRow, joinedDate: stats.joinedDate });

        if (!seen || seen.joinedDate !== stats.joinedDate || settled.points >= seen.points) {
          continue;
        }

        alerts.value = {
          ...alerts.value,
          [habit.id]: {
            id: ++nextAlertId,
            points: settled.points - seen.points,
            misses: settled.missedInRow > seen.missedInRow ? settled.missedInRow - seen.missedInRow : null,
            lazySnail: seen.missedInRow < LAZY_SNAIL_AFTER_MISSES && settled.missedInRow >= LAZY_SNAIL_AFTER_MISSES,
          },
        };
      }
    },
    { immediate: true },
  );

  // Removes an alert once shown, unless a newer one replaced it.
  const dismiss = (habitId: string, alertId: number) => {
    if (alerts.value[habitId]?.id === alertId) {
      const { [habitId]: _dismissed, ...rest } = alerts.value;
      alerts.value = rest;
    }
  };

  return { alerts, dismiss };
};
