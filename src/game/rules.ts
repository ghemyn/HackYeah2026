// All game numbers live here so they can be tuned after testing without touching any other file.
// Points are earned and lost per habit: each habit has its own leaderboard.

export const POINTS = {
  // Scanning the habit's QR code or tapping its NFC tag (the only way to check in).
  checkIn: 10,
  // Added every time a member's streak in a habit reaches a multiple of STREAK_BONUS_EVERY_CHECK_INS.
  streakBonus: 50,
  // Daily habits: for every day without a check-in.
  // Other habits: for every check-in short of the weekly target, charged when the week ends.
  missed: -5,
  // Extra penalty with the Lazy Snail badge: on the LAZY_SNAIL_AFTER_MISSED_DAYS-th missed day in a row
  // of a daily habit, or for a whole week without any check-in in other habits.
  lazySnail: -15,
} as const;

// A streak counts check-ins since the last penalty in that habit.
export const STREAK_BONUS_EVERY_CHECK_INS = 7;

export const LAZY_SNAIL_AFTER_MISSED_DAYS = 3;
