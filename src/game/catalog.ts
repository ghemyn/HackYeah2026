// Choices offered in the UI. Add new avatars, icons or frequencies here.

export const AVATARS = ["🦊", "🐼", "🐸", "🐯", "🦁", "🐵", "🐧", "🦄", "🐙", "🐢", "🦉", "🐝"];

export const DEFAULT_AVATAR = AVATARS[0];

export const HABIT_ICONS = ["💪", "📚", "💧", "😴", "🏃", "🧘", "🥗", "🎸", "🧹", "💊", "🚭", "✍️"];

export const DEFAULT_HABIT_ICON = HABIT_ICONS[0];

export const MAX_TIMES_PER_WEEK = 7;

export const FREQUENCY_OPTIONS = [7, 6, 5, 4, 3, 2, 1];

export const frequencyLabel = (timesPerWeek: number): string =>
  timesPerWeek >= MAX_TIMES_PER_WEEK ? "Every day" : `${timesPerWeek}× a week`;
