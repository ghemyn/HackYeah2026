// How often a habit repeats. Pure helpers, no Firebase access.

import { addDays, dayOfWeek, daysBetween, weekStartKey, type DateKey } from "../common";

export type HabitSchedule =
  // `times` check-ins in every cycle of `days` days (more than one a day is fine).
  // Cycles start on the habit's creation date.
  | { type: "interval"; times: number; days: number }
  // A check-in on each of these weekdays (0 = Monday ... 6 = Sunday).
  | { type: "weekdays"; days: number[] };

export const MAX_INTERVAL_DAYS = 31;

export const MAX_INTERVAL_TIMES = 20;

export const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export const DAILY_SCHEDULE: HabitSchedule = { type: "interval", times: 1, days: 1 };

const isWholeNumber = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value);

// "" when valid, otherwise a message for the player.
export const validateSchedule = (schedule: HabitSchedule): string => {
  if (schedule.type === "interval") {
    if (!isWholeNumber(schedule.days) || schedule.days < 1 || schedule.days > MAX_INTERVAL_DAYS) {
      return `The cycle must be between 1 and ${MAX_INTERVAL_DAYS} days.`;
    }

    if (!isWholeNumber(schedule.times) || schedule.times < 1 || schedule.times > MAX_INTERVAL_TIMES) {
      return `Times must be between 1 and ${MAX_INTERVAL_TIMES}.`;
    }

    return "";
  }

  const valid = schedule.days.every((day) => isWholeNumber(day) && day >= 0 && day <= 6);
  return valid && schedule.days.length > 0 ? "" : "Pick at least one day of the week.";
};

// Reads a stored schedule. Habits created before schedules existed only have `timesPerWeek`.
export const toSchedule = (value: unknown, legacyTimesPerWeek: unknown): HabitSchedule => {
  const data = value && typeof value === "object" ? (value as Record<string, unknown>) : null;
  let schedule: HabitSchedule | null = null;

  if (data?.type === "interval") {
    schedule = { type: "interval", times: Number(data.times), days: Number(data.days) };
  } else if (data?.type === "weekdays" && Array.isArray(data.days)) {
    schedule = { type: "weekdays", days: [...new Set(data.days.map(Number))].sort((a, b) => a - b) };
  } else if (typeof legacyTimesPerWeek === "number") {
    schedule =
      legacyTimesPerWeek >= 7 ? DAILY_SCHEDULE : { type: "interval", times: legacyTimesPerWeek, days: 7 };
  }

  return schedule && !validateSchedule(schedule) ? schedule : DAILY_SCHEDULE;
};

const timesLabel = (times: number) => (times === 1 ? "Once" : times === 2 ? "Twice" : `${times} times`);

export const scheduleLabel = (schedule: HabitSchedule): string => {
  if (schedule.type === "interval") {
    const { times, days } = schedule;

    if (times === days) {
      return "Every day";
    }

    if (days === 1) {
      return `${timesLabel(times)} a day`;
    }

    if (times === 1) {
      return days === 7 ? "Once a week" : `Every ${days} days`;
    }

    return days === 7 ? `${timesLabel(times)} a week` : `${timesLabel(times)} every ${days} days`;
  }

  const key = schedule.days.join(",");

  if (key === "0,1,2,3,4,5,6") {
    return "Every day";
  }

  if (key === "0,1,2,3,4") {
    return "Weekdays";
  }

  if (key === "5,6") {
    return "Weekends";
  }

  return `Every ${schedule.days.map((day) => WEEKDAY_LABELS[day]).join(", ")}`;
};

export type Period = {
  start: DateKey;
  end: DateKey;
  // Check-ins expected in the period.
  target: number;
};

// The cycle (interval schedules) or Monday-to-Sunday week (weekday schedules) that contains `date`.
// `anchor` is the habit's creation date, where interval cycles start.
export const periodOf = (schedule: HabitSchedule, anchor: DateKey, date: DateKey): Period => {
  if (schedule.type === "interval") {
    const index = Math.floor(daysBetween(anchor, date) / schedule.days);
    const start = addDays(anchor, index * schedule.days);
    return { start, end: addDays(start, schedule.days - 1), target: schedule.times };
  }

  const start = weekStartKey(date);
  return { start, end: addDays(start, 6), target: schedule.days.length };
};

// Most check-ins allowed on one day: the cycle's target spread evenly over its days, rounded up.
// "3 times a day" allows 3, "5 times every 2 days" allows 3, "3 times a week" allows 1.
export const dailyLimit = (schedule: HabitSchedule): number =>
  schedule.type === "interval" ? Math.ceil(schedule.times / schedule.days) : 1;

export const isScheduledDay = (schedule: HabitSchedule, date: DateKey): boolean =>
  schedule.type === "interval" || schedule.days.includes(dayOfWeek(date));
