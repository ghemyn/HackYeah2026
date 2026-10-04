// Helpers shared by several parts of the app. Page-specific logic belongs in the page itself.

// ---------- UUIDs ----------

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const generateUuid = (): string => crypto.randomUUID();

// Accepts UUIDs with surrounding whitespace or braces and returns the lowercase canonical form.
export const normalizeUuid = (rawValue: string): string => {
  const trimmed = rawValue.trim().replace(/[{}]/g, "");

  if (!UUID_PATTERN.test(trimmed)) {
    throw new Error("This code does not contain a valid UUID.");
  }

  return trimmed.toLowerCase();
};

// ---------- Errors and strings ----------

export const toErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error && error.message ? error.message : fallback;

export const toSafeFileName = (value: string, fallback: string): string =>
  value.trim().replace(/[^\p{L}\p{N}_-]+/gu, "_") || fallback;

// ---------- Dates ----------
// Days are stored as "YYYY-MM-DD" strings in the player's local time zone.
// Zero-padded keys sort correctly as plain strings, so `a < b` compares dates.

export type DateKey = string;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const pad = (value: number) => String(value).padStart(2, "0");

export const toDateKey = (date: Date): DateKey =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const fromDateKey = (key: DateKey): Date => {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
};

export const addDays = (key: DateKey, days: number): DateKey => {
  const date = fromDateKey(key);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
};

// Date emulation for testing (see components/DebugMenu.vue): days added to the real date.
// Not saved, so reloading the app goes back to the real date.
let dayOffset = 0;
const dayOffsetListeners = new Set<() => void>();

export const getDayOffset = (): number => dayOffset;

export const setDayOffset = (days: number) => {
  dayOffset = days;
  dayOffsetListeners.forEach((listener) => listener());
};

// Returns a function that stops listening.
export const onDayOffsetChange = (listener: () => void): (() => void) => {
  dayOffsetListeners.add(listener);
  return () => dayOffsetListeners.delete(listener);
};

// Today in local time, moved by the emulated day offset. Every date the app shows or saves comes from here.
export const todayKey = (): DateKey => addDays(toDateKey(new Date()), dayOffset);

// Whole days from `from` to `to` (negative if `to` is earlier). Rounding absorbs daylight-saving shifts.
export const daysBetween = (from: DateKey, to: DateKey): number =>
  Math.round((fromDateKey(to).getTime() - fromDateKey(from).getTime()) / MS_PER_DAY);

// Weeks start on Monday.
export const weekStartKey = (key: DateKey): DateKey => {
  const daysSinceMonday = (fromDateKey(key).getDay() + 6) % 7;
  return addDays(key, -daysSinceMonday);
};

export const laterDateKey = (a: DateKey, b: DateKey): DateKey => (a > b ? a : b);

// 0 = Monday ... 6 = Sunday.
export const dayOfWeek = (key: DateKey): number => (fromDateKey(key).getDay() + 6) % 7;

// e.g. "Oct 9", in the viewer's language.
export const formatShortDate = (key: DateKey): string =>
  fromDateKey(key).toLocaleDateString(undefined, { month: "short", day: "numeric" });
