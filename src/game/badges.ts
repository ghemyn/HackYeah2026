// Badge types and how they are shown. The badges collection stores the type, date and habit.

export type BadgeType = "streak" | "lazySnail";

export type BadgeInfo = {
  emoji: string;
  label: string;
  description: string;
};

export const BADGES: Record<BadgeType, BadgeInfo> = {
  streak: { emoji: "🔥", label: "Streak", description: "7 check-ins in a row without missing." },
  lazySnail: { emoji: "🐌", label: "Lazy Snail", description: "Skipped a habit for too long." },
};

export const isBadgeType = (value: unknown): value is BadgeType =>
  typeof value === "string" && Object.prototype.hasOwnProperty.call(BADGES, value);
