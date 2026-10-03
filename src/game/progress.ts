// Pure scoring helpers shared by the database layer and the pages. No Firebase access here.
// All points belong to a member of a habit (HabitMemberStats), never to the account.

import { addDays, dayOfWeek, formatShortDate, laterDateKey, type DateKey } from "../common";
import type { Habit, HabitMemberStats } from "../db/habits";
import { LAZY_SNAIL_AFTER_MISSES, POINTS, STREAK_BONUS_EVERY_CHECK_INS } from "./rules";
import { dailyLimit, isScheduledDay, periodOf, scheduleLabel, WEEKDAY_LABELS, type Period } from "./schedule";

// What the scoring needs to know about a habit. Interval cycles start on `createdDate`.
type HabitRules = Pick<Habit, "schedule" | "createdDate">;

// Check-ins on `day` (only known for the member's last check-in day, which is all that is ever needed).
export const checkInsOn = (stats: Pick<HabitMemberStats, "lastCheckInDate" | "lastDateCount">, day: DateKey): number =>
  stats.lastCheckInDate === day ? Math.max(stats.lastDateCount, 1) : 0;

export const isHabitDoneToday = (stats: Pick<HabitMemberStats, "lastCheckInDate">, today: DateKey): boolean =>
  stats.lastCheckInDate === today;

// Whether the member has used up the habit's check-ins for `day`.
export const isDailyLimitReached = (habit: HabitRules, stats: HabitMemberStats, day: DateKey): boolean =>
  checkInsOn(stats, day) >= dailyLimit(habit.schedule);

// Check-ins in `period`. A last check-in inside the period always counts, even if the stored count is
// missing or refers to another period (e.g. data written before periods existed).
const countInPeriod = (
  stats: Pick<HabitMemberStats, "periodStart" | "periodCount" | "lastCheckInDate">,
  period: Period,
): number => {
  const stored = stats.periodStart === period.start ? stats.periodCount : 0;
  const lastInPeriod =
    stats.lastCheckInDate !== null && stats.lastCheckInDate >= period.start && stats.lastCheckInDate <= period.end;
  return Math.max(stored, lastInPeriod ? 1 : 0);
};

export type PeriodProgress = {
  count: number;
  target: number;
  // e.g. "today", "this week", "until Oct 9".
  label: string;
};

export const periodProgress = (habit: HabitRules, stats: HabitMemberStats, today: DateKey): PeriodProgress => {
  const period = periodOf(habit.schedule, habit.createdDate, today);
  let label = `until ${formatShortDate(period.end)}`;

  if (habit.schedule.type === "weekdays") {
    label = "this week";
  } else if (habit.schedule.days === 1) {
    label = "today";
  }

  return { count: countInPeriod(stats, period), target: period.target, label };
};

// Why the member cannot check in on `day`, or "" if they can.
export const checkInBlocker = (habit: HabitRules, stats: HabitMemberStats, day: DateKey): string => {
  if (isDailyLimitReached(habit, stats, day)) {
    const limit = dailyLimit(habit.schedule);
    return limit === 1 ? "Already checked in today." : `Already checked in ${limit}× today, the most for one day.`;
  }

  if (!isScheduledDay(habit.schedule, day)) {
    return `Today isn't scheduled for this habit (${scheduleLabel(habit.schedule)}).`;
  }

  const period = periodOf(habit.schedule, habit.createdDate, day);

  if (countInPeriod(stats, period) >= period.target) {
    return `Target reached for this cycle. The next one starts ${formatShortDate(addDays(period.end, 1))}.`;
  }

  return "";
};

// The next day (from today on) the member can check in. Looks ahead one cycle plus a week at most.
export const nextCheckInDay = (habit: HabitRules, stats: HabitMemberStats, today: DateKey): DateKey | null => {
  const limit = habit.schedule.type === "interval" ? habit.schedule.days + 7 : 7;

  for (let offset = 0; offset <= limit; offset++) {
    const day = addDays(today, offset);

    if (!checkInBlocker(habit, stats, day)) {
      return day;
    }
  }

  return null;
};

// "today", "tomorrow" or e.g. "Wed Oct 8".
export const describeDay = (day: DateKey, today: DateKey): string => {
  if (day === today) {
    return "today";
  }

  return day === addDays(today, 1) ? "tomorrow" : `${WEEKDAY_LABELS[dayOfWeek(day)]} ${formatShortDate(day)}`;
};

export type Settlement = {
  // The member's stats with all penalties due before today applied.
  stats: HabitMemberStats;
  // Points lost (0 or negative).
  penalty: number;
  // Days a Lazy Snail badge was earned.
  lazySnailDays: DateKey[];
};

// Charges the member for every scheduled day (weekday schedules) or finished cycle (interval schedules)
// that ended before today without enough check-ins. Nothing up to the day of joining is charged.
// Idempotent: settling the result again changes nothing.
export const settleMember = (habit: HabitRules, stats: HabitMemberStats, today: DateKey): Settlement => {
  const yesterday = addDays(today, -1);
  const alreadySettled = laterDateKey(stats.settledThrough, stats.joinedDate);
  let penalty = 0;
  let missedInRow = stats.missedInRow;
  let settledThrough = stats.settledThrough;
  const lazySnailDays: DateKey[] = [];

  const miss = (count: number, day: DateKey) => {
    const before = missedInRow;
    penalty += count * POINTS.missed;
    missedInRow += count;

    if (before < LAZY_SNAIL_AFTER_MISSES && missedInRow >= LAZY_SNAIL_AFTER_MISSES) {
      penalty += POINTS.lazySnail;
      lazySnailDays.push(day);
    }
  };

  if (habit.schedule.type === "weekdays") {
    // Every check-in settles first, so the only check-in after `settledThrough` can be `lastCheckInDate`.
    for (let day = addDays(alreadySettled, 1); day <= yesterday; day = addDays(day, 1)) {
      if (isScheduledDay(habit.schedule, day) && stats.lastCheckInDate !== day) {
        miss(1, day);
      }

      settledThrough = day;
    }
  } else {
    // Only cycles starting after the last settled day are charged, so the cycle a member joins in is free.
    let period = periodOf(habit.schedule, habit.createdDate, addDays(alreadySettled, 1));

    if (period.start <= alreadySettled) {
      period = periodOf(habit.schedule, habit.createdDate, addDays(period.end, 1));
    }

    while (period.end <= yesterday) {
      const shortfall = Math.max(period.target - countInPeriod(stats, period), 0);

      if (shortfall > 0) {
        miss(shortfall, period.end);
      }

      settledThrough = period.end;
      period = periodOf(habit.schedule, habit.createdDate, addDays(period.end, 1));
    }
  }

  return {
    stats: {
      ...stats,
      points: stats.points + penalty,
      streak: penalty < 0 ? 0 : stats.streak,
      missedInRow,
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

// Adds today's check-in to already settled stats. Call checkInBlocker first.
export const applyCheckIn = (habit: HabitRules, stats: HabitMemberStats, today: DateKey): CheckInOutcome => {
  const period = periodOf(habit.schedule, habit.createdDate, today);
  const streak = stats.streak + 1;
  const streakBonus = streak % STREAK_BONUS_EVERY_CHECK_INS === 0;
  const points = POINTS.checkIn + (streakBonus ? POINTS.streakBonus : 0);

  return {
    stats: {
      ...stats,
      lastCheckInDate: today,
      lastDateCount: checkInsOn(stats, today) + 1,
      periodStart: period.start,
      periodCount: countInPeriod(stats, period) + 1,
      totalCheckIns: stats.totalCheckIns + 1,
      points: stats.points + points,
      streak,
      missedInRow: 0,
    },
    points,
    streakBonus,
  };
};

export type Standing = {
  userId: string;
  rank: number;
  // Include penalties that are due but not saved yet, so the leaderboard is always fair.
  points: number;
  streak: number;
  // Check-ins today.
  todayCount: number;
  lazySnail: boolean;
};

// The habit's leaderboard: every member, highest points first. Equal points share a rank.
export const habitStandings = (
  habit: HabitRules & Pick<Habit, "memberIds" | "members">,
  today: DateKey,
): Standing[] => {
  const rows = habit.memberIds
    .filter((userId) => habit.members[userId])
    .map((userId) => {
      const stats = habit.members[userId];
      const settled = settleMember(habit, stats, today).stats;

      return {
        userId,
        rank: 0,
        points: settled.points,
        streak: settled.streak,
        todayCount: checkInsOn(stats, today),
        lazySnail: settled.missedInRow >= LAZY_SNAIL_AFTER_MISSES,
      };
    })
    .sort((a, b) => b.points - a.points || a.userId.localeCompare(b.userId));

  rows.forEach((row, index) => {
    row.rank = index > 0 && rows[index - 1].points === row.points ? rows[index - 1].rank : index + 1;
  });

  return rows;
};

// The habit's leader (👑): first with points above 0 and no tie for first place. Otherwise null.
export const clearLeaderId = (standings: Standing[]): string | null => {
  const [first, second] = standings;
  return first && first.points > 0 && (!second || first.points > second.points) ? first.userId : null;
};

export type HabitSettlement = {
  members: Record<string, HabitMemberStats>;
  // Whether anything has to be saved.
  changed: boolean;
  lazySnails: { userId: string; date: DateKey }[];
};

// Settles every member of a habit, so penalties apply even to members who never open the app.
export const settleAllMembers = (
  habit: HabitRules & Pick<Habit, "memberIds" | "members">,
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

    const result = settleMember(habit, stats, today);
    members[userId] = result.stats;
    changed = changed || result.stats.settledThrough !== stats.settledThrough;
    lazySnails.push(...result.lazySnailDays.map((date) => ({ userId, date })));
  }

  return { members, changed, lazySnails };
};
