// All game numbers live here so they can be tuned after testing without touching any other file.

export const POINTS = {
  // Scanning the habit's QR code or tapping its NFC tag (the only way to check in).
  checkIn: 10,
  // Added every time the daily streak reaches a multiple of STREAK_BONUS_EVERY_DAYS.
  streakBonus: 50,
  // Given at the start of a new week to whoever had strictly more points than every friend last week.
  weeklyWinner: 20,
  // For every day without a single check-in (counted only after the player's first check-in).
  missedDay: -5,
  // Extra penalty on the LAZY_SNAIL_AFTER_MISSED_DAYS-th missed day in a row, plus the Lazy Snail badge.
  lazySnail: -15,
} as const;

export const STREAK_BONUS_EVERY_DAYS = 7;

export const LAZY_SNAIL_AFTER_MISSED_DAYS = 3;
