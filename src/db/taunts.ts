import {
  collection,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  where,
  type DocumentData,
  type Unsubscribe,
} from "firebase/firestore";
import { todayKey, type DateKey } from "../common";
import { tauntBlocker, validateTaunt } from "../game/taunts";
import { COLLECTIONS, db, readString } from "./firebase";
import { habitRef, tauntRef, toHabit } from "./habits";

// A leader's taunt at a member who hasn't checked in yet. Deleted when the member checks in (see checkIn)
// or leaves the habit. A newer taunt at the same member in the same habit replaces it.
export type Taunt = {
  id: string;
  habitId: string;
  // The taunted member.
  targetId: string;
  // The leader who sent it.
  fromId: string;
  emojis: string[];
  // May be empty.
  message: string;
  // The day it was sent.
  date: DateKey;
};

const toTaunt = (id: string, data: DocumentData): Taunt => ({
  id,
  habitId: readString(data.habitId),
  targetId: readString(data.targetId),
  fromId: readString(data.fromId),
  emojis: Array.isArray(data.emojis)
    ? data.emojis.filter((emoji): emoji is string => typeof emoji === "string")
    : [],
  message: readString(data.message),
  date: readString(data.date),
});

// Sends a taunt from the habit's leader to a member who still has to check in today.
export const sendTaunt = (
  fromId: string,
  habitId: string,
  targetId: string,
  emojis: string[],
  message: string,
): Promise<void> =>
  runTransaction(db, async (transaction) => {
    const invalid = validateTaunt(emojis, message);

    if (invalid) {
      throw new Error(invalid);
    }

    // Reading the habit in the transaction means the taunt is refused if the target checks in
    // or the sender loses the lead meanwhile.
    const snapshot = await transaction.get(habitRef(habitId));

    if (!snapshot.exists()) {
      throw new Error("This habit no longer exists.");
    }

    const today = todayKey();
    const blocker = tauntBlocker(toHabit(snapshot.id, snapshot.data()), fromId, targetId, today);

    if (blocker) {
      throw new Error(blocker);
    }

    transaction.set(tauntRef(habitId, targetId), {
      habitId,
      targetId,
      fromId,
      emojis,
      message: message.trim(),
      date: today,
      createdAt: serverTimestamp(),
    });
  });

const watchTaunts = (
  field: "targetId" | "habitId",
  value: string,
  onChange: (taunts: Taunt[]) => void,
  onError: (error: Error) => void,
): Unsubscribe =>
  onSnapshot(
    query(collection(db, COLLECTIONS.taunts), where(field, "==", value)),
    (snapshot) => onChange(snapshot.docs.map((tauntDoc) => toTaunt(tauntDoc.id, tauntDoc.data()))),
    onError,
  );

// Live list of the taunts at a player, in all their habits.
export const watchTauntsAt = (
  targetId: string,
  onChange: (taunts: Taunt[]) => void,
  onError: (error: Error) => void,
): Unsubscribe => watchTaunts("targetId", targetId, onChange, onError);

// Live list of the taunts in one habit.
export const watchHabitTaunts = (
  habitId: string,
  onChange: (taunts: Taunt[]) => void,
  onError: (error: Error) => void,
): Unsubscribe => watchTaunts("habitId", habitId, onChange, onError);
