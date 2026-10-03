// Pure scoring helpers shared by the database layer and the pages. No Firebase access here.
// All points belong to a member of a habit (HabitMemberStats), never to the account.

import { addDays, daysBetween, laterDateKey, weekStartKey, type DateKey } from "../common";
import type { Habit, HabitMemberStats } from "../db/habits";
import { MAX_TIMES_PER_WEEK } from "./catalog";
import { LAZY_SNAIL_AFTER_MISSED_DAYS, POINTS, STREAK_BONUS_EVERY_CHECK_INS } from "./rules";

export const isDailyHabit = (timesPerWeek: number): boolean => timesPerWeek >= MAX_TIMES_PER_WEEK;

export const isHabitDoneToday = (stats: Pick<HabitMemberStats, "lastCheckInDate">, today: DateKey): boolean =>
  stats.lastCheckInDate === today;

export const habitCountThisWeek = (stats: Pick<HabitMemberStats, "weekStart" | "weekCount">, today: DateKey): number =>
  stats.weekStart === weekStartKey(today) ? stats.weekCount : 0;

const countInWeek = (stats: Pick<HabitMemberStats, "weekStart" | "weekCount">, weekStart: DateKey): number =>
  stats.weekStart === weekStart ? stats.weekCount : 0;

export type Settlement = {
  // The member's stats with all penalties due before today applied.
  stats: HabitMemberStats;
  // Points lost (0 or negative).
  penalty: number;
  // Days a Lazy Snail badge was earned.
  lazySnailDays: DateKey[];
};

// Applies the penalties a member owes for days (daily habits) or whole weeks (other habits) that ended
// before today and were not charged yet. Idempotent: settling the result again changes nothing.
export const settleMember = (stats: HabitMemberStats, timesPerWeek: number, today: DateKey): Settlement => {
  const yesterday = addDays(today, -1);
  let penalty = 0;
  let settledThrough = stats.settledThrough;
  const lazySnailDays: DateKey[] = [];

  if (isDailyHabit(timesPerWeek)) {
    // Missed days are counted from the last check-in, or from joining if there was none.
    const lastActive = stats.lastCheckInDate ?? stats.joinedDate;

    for (let day = addDays(laterDateKey(stats.settledThrough, lastActive), 1); day <= yesterday; day = addDays(day, 1)) {
      penalty += POINTS.missed;

      if (daysBetween(lastActive, day) === LAZY_SNAIL_AFTER_MISSED_DAYS) {
        penalty += POINTS.lazySnail;
        lazySnailDays.push(day);
      }

      settledThrough = day;
    }
  } else {
    // Weeks are charged once they are over. The week of joining is never charged.
    const lastFinishedWeek = addDays(weekStartKey(today), -7);
    const firstWeek = addDays(weekStartKey(laterDateKey(stats.settledThrough, stats.joinedDate)), 7);

    for (let week = firstWeek; week <= lastFinishedWeek; week = addDays(week, 7)) {
      const count = countInWeek(stats, week);
      penalty += Math.max(timesPerWeek - count, 0) * POINTS.missed;

      if (count === 0) {
        penalty += POINTS.lazySnail;
        lazySnailDays.push(addDays(week, 6));
      }

      settledThrough = addDays(week, 6);
    }
  }

  return {
    stats: {
      ...stats,
      points: stats.points + penalty,
      streak: penalty < 0 ? 0 : stats.streak,
      settledThrough,
    },
    penalty,
    lazySnailDays,
  };
};

export type CheckInOutcome = {
  stats: HabitMemberStats;
  // Points earned, including the streak bonus.
  points: number;
  streakBonus: boolean;
};

// Adds today's check-in to already settled stats.
export const applyCheckIn = (stats: HabitMemberStats, today: DateKey): CheckInOutcome => {
  const streak = stats.streak + 1;
  const streakBonus = streak % STREAK_BONUS_EVERY_CHECK_INS === 0;
  const points = POINTS.checkIn + (streakBonus ? POINTS.streakBonus : 0);

  return {
    stats: {
      ...stats,
      lastCheckInDate: today,
      weekStart: weekStartKey(today),
      weekCount: habitCountThisWeek(stats, today) + 1,
      totalCheckIns: stats.totalCheckIns + 1,
      points: stats.points + points,
      streak,
    },
    points,
    streakBonus,
  };
};

// Whether a member is currently slacking: 3+ missed days in a row (daily habits),
// or no check-in at all in the last full week since joining (other habits).
export const isLazySnail = (stats: HabitMemberStats, timesPerWeek: number, today: DateKey): boolean => {
  if (isDailyHabit(timesPerWeek)) {
    const lastActive = stats.lastCheckInDate ?? stats.joinedDate;
    return daysBetween(lastActive, today) - 1 >= LAZY_SNAIL_AFTER_MISSED_DAYS;
  }

  const lastFinishedWeek = addDays(weekStartKey(today), -7);
  const firstChargeableWeek = addDays(weekStartKey(stats.joinedDate), 7);
  return lastFinishedWeek >= firstChargeableWeek && countInWeek(stats, lastFinishedWeek) === 0;
};

export type Standing = {
  userId: string;
  rank: number;
  // Includes penalties that are due but not saved yet, so the leaderboard is always fair.
  points: number;
  streak: number;
  doneToday: boolean;
  lazySnail: boolean;
};

// The habit's leaderboard: every member, highest points first. Equal points share a rank.
export const habitStandings = (
  habit: Pick<Habit, "memberIds" | "members" | "timesPerWeek">,
  today: DateKey,
): Standing[] => {
  const rows = habit.memberIds
    .filter((userId) => habit.members[userId])
    .map((userId) => {
      const stats = habit.members[userId];
      const settled = settleMember(stats, habit.timesPerWeek, today).stats;

      return {
        userId,
        rank: 0,
        points: settled.points,
        streak: settled.streak,
        doneToday: isHabitDoneToday(stats, today),
        lazySnail: isLazySnail(stats, habit.timesPerWeek, today),
      };
    })
    .sort((a, b) => b.points - a.points || a.userId.localeCompare(b.userId));

  rows.forEach((row, index) => {
    row.rank = index > 0 && rows[index - 1].points === row.points ? rows[index - 1].rank : index + 1;
  });

  return rows;
};

export type HabitSettlement = {
  members: Record<string, HabitMemberStats>;
  // Whether anything has to be saved.
  changed: boolean;
  lazySnails: { userId: string; date: DateKey }[];
};

// Settles every member of a habit, so penalties apply even to members who never open the app.
export const settleAllMembers = (
  habit: Pick<Habit, "memberIds" | "members" | "timesPerWeek">,
  today: DateKey,
): HabitSettlement => {
  const members: Record<string, HabitMemberStats> = {};
  const lazySnails: { userId: string; date: DateKey }[] = [];
  let changed = false;

  for (const userId of habit.memberIds) {
    const stats = habit.members[userId];

    if (!stats) {
      continue;
    }

    const result = settleMember(stats, habit.timesPerWeek, today);
    members[userId] = result.stats;
    changed = changed || result.stats.settledThrough !== stats.settledThrough;
    lazySnails.push(...result.lazySnailDays.map((date) => ({ userId, date })));
  }

  return { members, changed, lazySnails };
};
