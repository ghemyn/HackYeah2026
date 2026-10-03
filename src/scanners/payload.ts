// What HabitQuest QR codes and NFC tags contain:
// - a habit tag: the habit's secret tag code (a plain UUID)
// - a friend code: "habitquest:friend:<userId>"

import { normalizeUuid } from "../common";

const FRIEND_PREFIX = "habitquest:friend:";

export type ScanPayload =
  | { kind: "habit"; tagCode: string }
  | { kind: "friend"; userId: string }
  | { kind: "unknown" };

export const friendCodePayload = (userId: string): string => `${FRIEND_PREFIX}${userId}`;

export const parseScanPayload = (rawValue: string): ScanPayload => {
  const value = rawValue.trim();

  if (value.toLowerCase().startsWith(FRIEND_PREFIX)) {
    const userId = value.slice(FRIEND_PREFIX.length).trim().toLowerCase();
    return userId ? { kind: "friend", userId } : { kind: "unknown" };
  }

  try {
    return { kind: "habit", tagCode: normalizeUuid(value) };
  } catch {
    return { kind: "unknown" };
  }
};
