import { collection, doc, onSnapshot, query, serverTimestamp, where, type Unsubscribe } from "firebase/firestore";
import type { DateKey } from "../common";
import { isBadgeType, type BadgeType } from "../game/badges";
import { COLLECTIONS, db, readString } from "./firebase";

export type Badge = {
  id: string;
  userId: string;
  type: BadgeType;
  date: DateKey;
};

// At most one badge of each type per player per day, so writing the same badge twice is harmless.
// ":" cannot appear in user IDs, so the document IDs never collide.
export const badgeRef = (userId: string, type: BadgeType, date: DateKey) =>
  doc(db, COLLECTIONS.badges, `${userId}:${type}:${date}`);

export const badgeData = (userId: string, type: BadgeType, date: DateKey) => ({
  userId,
  type,
  date,
  createdAt: serverTimestamp(),
});

// Live list of a player's badges, newest first.
export const watchBadges = (
  userId: string,
  onChange: (badges: Badge[]) => void,
  onError: (error: Error) => void,
): Unsubscribe =>
  onSnapshot(
    query(collection(db, COLLECTIONS.badges), where("userId", "==", userId)),
    (snapshot) => {
      const badges: Badge[] = [];

      for (const badgeDoc of snapshot.docs) {
        const data = badgeDoc.data();

        if (isBadgeType(data.type)) {
          badges.push({ id: badgeDoc.id, userId: readString(data.userId), type: data.type, date: readString(data.date) });
        }
      }

      badges.sort((a, b) => b.date.localeCompare(a.date));
      onChange(badges);
    },
    onError,
  );
