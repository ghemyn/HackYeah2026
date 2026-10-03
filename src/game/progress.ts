// Pure scoring helpers shared by the database layer and the pages. No Firebase access here.

import { addDays, daysBetween, laterDateKey, weekStartKey, type DateKey } from "../common";
import type { Habit } from "../db/habits";
import type { UserProfile } from "../db/users";
import { LAZY_SNAIL_AFTER_MISSED_DAYS, POINTS, STREAK_BONUS_EVERY_DAYS } from "./rules";

type WeekFields = Pick<UserProfile, "weekStart" | "weekPoints" | "lastWeekPoints">;

// A player's points in the week starting on `weekStart`, even if their document has not rolled over to it yet.
export const pointsInWeek = (profile: WeekFields, weekStart: DateKey): number => {
  if (profile.weekStart === weekStart) {
    return profile.weekPoints;
  }

  if (addDays(profile.weekStart, -7) === weekStart) {
    return profile.lastWeekPoints;
  }

  return 0;
};

// Week fields moved forward to the week containing `today`. Unchanged if already current.
export const rollWeek = (profile: WeekFields, today: DateKey): WeekFields => {
  const weekStart = weekStartKey(today);

  if (profile.weekStart === weekStart) {
    return { weekStart, weekPoints: profile.weekPoints, lastWeekPoints: profile.lastWeekPoints };
  }

  return { weekStart, weekPoints: 0, lastWeekPoints: pointsInWeek(profile, addDays(weekStart, -7)) };
};

// The streak as it stands today: it is lost as soon as a whole day passes without a check-in.
export const currentStreak = (profile: Pick<UserProfile, "streak" | "lastCheckInDate">, today: DateKey): number =>
  profile.lastCheckInDate === today || profile.lastCheckInDate === addDays(today, -1) ? profile.streak : 0;

// The streak after checking in today.
export const streakAfterCheckIn = (profile: Pick<UserProfile, "streak" | "lastCheckInDate">, today: DateKey): number => {
  if (profile.lastCheckInDate === today) {
    return Math.max(profile.streak, 1);
  }

  return profile.lastCheckInDate === addDays(today, -1) ? profile.streak + 1 : 1;
};

export const earnsStreakBonus = (previousStreak: number, nextStreak: number): boolean =>
  nextStreak !== previousStreak && nextStreak > 0 && nextStreak % STREAK_BONUS_EVERY_DAYS === 0;

// Days in a row without any check-in, up to and including yesterday. 0 before the first check-in.
export const missedDaysInRow = (profile: Pick<UserProfile, "lastCheckInDate">, today: DateKey): number =>
  profile.lastCheckInDate ? Math.max(daysBetween(profile.lastCheckInDate, today) - 1, 0) : 0;

// Penalties for the days since the last check-in (up to yesterday) that have not been charged yet.
// Nothing is charged before the player's first check-in.
export const unsettledPenalties = (
  profile: Pick<UserProfile, "lastCheckInDate" | "settledThrough">,
  today: DateKey,
): { penalty: number; lazySnailDays: DateKey[]; settledThrough: DateKey } => {
  const lastCheckIn = profile.lastCheckInDate;
  const yesterday = addDays(today, -1);
  let penalty = 0;
  const lazySnailDays: DateKey[] = [];

  if (!lastCheckIn) {
    return { penalty, lazySnailDays, settledThrough: profile.settledThrough };
  }

  for (let day = addDays(laterDateKey(profile.settledThrough, lastCheckIn), 1); day <= yesterday; day = addDays(day, 1)) {
    penalty += POINTS.missedDay;

    if (daysBetween(lastCheckIn, day) === LAZY_SNAIL_AFTER_MISSED_DAYS) {
      penalty += POINTS.lazySnail;
      lazySnailDays.push(day);
    }
  }

  return { penalty, lazySnailDays, settledThrough: penalty === 0 ? profile.settledThrough : yesterday };
};

export const isLazySnail = (profile: Pick<UserProfile, "lastCheckInDate">, today: DateKey): boolean =>
  missedDaysInRow(profile, today) >= LAZY_SNAIL_AFTER_MISSED_DAYS;

export const isHabitDoneToday = (habit: Pick<Habit, "lastCheckInDate">, today: DateKey): boolean =>
  habit.lastCheckInDate === today;

export const habitCountThisWeek = (habit: Pick<Habit, "weekStart" | "weekCount">, today: DateKey): number =>
  habit.weekStart === weekStartKey(today) ? habit.weekCount : 0;
