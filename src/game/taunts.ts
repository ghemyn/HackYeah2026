// Taunts: a habit's leader (👑) can taunt members who still have to check in today. A taunt is a few emojis
// and an optional message, shown to the taunted member until they check in. Stored in db/taunts.ts.

import type { DateKey } from "../common";
import type { Habit, HabitMemberStats } from "../db/habits";
import { checkInBlocker, clearLeaderId, habitStandings, isHabitDoneToday } from "./progress";

// Must match the list in firestore.rules. Single code points only, so the rules compare them exactly.
export const TAUNT_EMOJIS = ["😏", "🫵", "😂", "🤡", "👀", "🙄", "🥱", "😴", "💤", "🐌", "🐢", "🦥", "⏰", "🍿", "👑", "🏆"];

export const MAX_TAUNT_EMOJIS = 5;

export const MAX_TAUNT_MESSAGE_LENGTH = 100;

// Why the emojis and message can't be sent, or "" if they can.
export const validateTaunt = (emojis: string[], message: string): string => {
  if (emojis.length === 0) {
    return "Pick at least one emoji.";
  }

  if (emojis.length > MAX_TAUNT_EMOJIS) {
    return `Pick at most ${MAX_TAUNT_EMOJIS} emojis.`;
  }

  if (new Set(emojis).size !== emojis.length || emojis.some((emoji) => !TAUNT_EMOJIS.includes(emoji))) {
    return "Pick emojis from the list.";
  }

  if (message.trim().length > MAX_TAUNT_MESSAGE_LENGTH) {
    return `The message can be at most ${MAX_TAUNT_MESSAGE_LENGTH} characters.`;
  }

  return "";
};

// Only members who haven't checked in today but could can be taunted, so checking in always cancels the taunt.
export const canBeTaunted = (habit: Pick<Habit, "schedule" | "createdDate">, stats: HabitMemberStats, today: DateKey) =>
  !isHabitDoneToday(stats, today) && !checkInBlocker(habit, stats, today);

// Why `fromId` can't taunt `targetId` in the habit today, or "" if they can.
export const tauntBlocker = (habit: Habit, fromId: string, targetId: string, today: DateKey): string => {
  const target = habit.members[targetId];

  if (!habit.members[fromId]) {
    return "Join this habit first.";
  }

  if (!target) {
    return "They are no longer in this habit.";
  }

  if (fromId === targetId) {
    return "You can't taunt yourself.";
  }

  if (clearLeaderId(habitStandings(habit, today)) !== fromId) {
    return "Only the leader (👑) of this habit can taunt.";
  }

  if (isHabitDoneToday(target, today)) {
    return "They already checked in today.";
  }

  if (checkInBlocker(habit, target, today)) {
    return "They can't check in today, so there's nothing to taunt them about.";
  }

  return "";
};
