// Badge types and how they are shown. The badges collection stores the type, date and habit.

import { MILESTONES, type MilestoneType } from "./milestones";

// Streak and Lazy Snail badges can be earned again and again; milestones once (see milestones.ts).
export type BadgeType = "streak" | "lazySnail" | MilestoneType;

export type BadgeInfo = {
  emoji: string;
  label: string;
  description: string;
};

export const BADGES: Record<BadgeType, BadgeInfo> = {
  streak: { emoji: "🔥", label: "Streak", description: "7 check-ins in a row without missing." },
  lazySnail: { emoji: "🐌", label: "Lazy Snail", description: "Skipped a habit for too long." },
  ...MILESTONES,
};

export const isBadgeType = (value: unknown): value is BadgeType =>
  typeof value === "string" && Object.prototype.hasOwnProperty.call(BADGES, value);
