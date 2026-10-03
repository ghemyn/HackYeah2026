// Badge types and how they are shown. The badges collection stores only the type and date.

export type BadgeType = "streak" | "lazySnail" | "weeklyWinner";

export type BadgeInfo = {
  emoji: string;
  label: string;
  description: string;
};

export const BADGES: Record<BadgeType, BadgeInfo> = {
  streak: { emoji: "🔥", label: "Streak", description: "Checked in 7 days in a row." },
  lazySnail: { emoji: "🐌", label: "Lazy Snail", description: "Missed 3 days in a row." },
  weeklyWinner: { emoji: "👑", label: "Weekly winner", description: "Beat every friend last week." },
};

export const isBadgeType = (value: unknown): value is BadgeType =>
  typeof value === "string" && Object.prototype.hasOwnProperty.call(BADGES, value);
