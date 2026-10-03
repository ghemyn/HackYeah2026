// All game numbers live here so they can be tuned after testing without touching any other file.
// Points are earned and lost per habit: each habit has its own leaderboard.

export const POINTS = {
  // Scanning the habit's QR code or tapping its NFC tag (the only way to check in).
  checkIn: 10,
  // Added every time a member's streak in a habit reaches a multiple of STREAK_BONUS_EVERY_CHECK_INS.
  streakBonus: 50,
  // For every miss: a scheduled weekday without a check-in, or a check-in short of the target
  // when an "X times every Y days" cycle ends.
  missed: -5,
  // Extra penalty with the Lazy Snail badge when misses in a row reach LAZY_SNAIL_AFTER_MISSES.
  lazySnail: -15,
} as const;

// A streak counts check-ins since the last penalty in that habit.
export const STREAK_BONUS_EVERY_CHECK_INS = 7;

export const LAZY_SNAIL_AFTER_MISSES = 3;
