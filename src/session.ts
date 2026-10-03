import { ref } from "vue";
import type { UserRecord } from "./firebase";

const STORAGE_KEY = "hackyeah2026.user";

const readStoredUser = (): UserRecord | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as UserRecord) : null;
  } catch {
    return null;
  }
};

export const currentUser = ref<UserRecord | null>(readStoredUser());

export const setCurrentUser = (user: UserRecord | null) => {
  currentUser.value = user;

  try {
    if (user) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Storage can be unavailable (e.g. private mode); the session then lasts until reload.
  }
};
