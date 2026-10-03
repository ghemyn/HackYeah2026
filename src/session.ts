import { ref, watch } from "vue";
import type { Unsubscribe } from "firebase/firestore";
import { toErrorMessage } from "./common";
import { settleAccount } from "./db/settlement";
import { watchUser, type UserProfile } from "./db/users";

type SessionUser = {
  id: string;
  nickname: string;
};

const STORAGE_KEY = "habitquest.user";

const readStoredUser = (): SessionUser | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;

    if (
      parsed &&
      typeof parsed === "object" &&
      typeof (parsed as SessionUser).id === "string" &&
      typeof (parsed as SessionUser).nickname === "string"
    ) {
      return { id: (parsed as SessionUser).id, nickname: (parsed as SessionUser).nickname };
    }
  } catch {
    // Unreadable storage simply means nobody is logged in.
  }

  return null;
};

const storeUser = (user: SessionUser | null) => {
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

// Who is logged in. Survives app restarts.
export const currentUser = ref<SessionUser | null>(readStoredUser());

// Live copy of the logged-in player's document; null while loading.
export const profile = ref<UserProfile | null>(null);

// Problems with keeping the profile in sync, shown in the navbar.
export const sessionError = ref("");

export const login = (user: UserProfile) => {
  currentUser.value = { id: user.id, nickname: user.nickname };
  storeUser(currentUser.value);
};

export const logout = () => {
  currentUser.value = null;
  storeUser(null);
};

// For pages, which are only shown while someone is logged in.
export const requireUserId = (): string => {
  if (!currentUser.value) {
    throw new Error("No player is logged in.");
  }

  return currentUser.value.id;
};

let stopWatchingProfile: Unsubscribe | null = null;

watch(
  () => currentUser.value?.id ?? null,
  (userId) => {
    stopWatchingProfile?.();
    stopWatchingProfile = null;
    profile.value = null;
    sessionError.value = "";

    if (!userId) {
      return;
    }

    stopWatchingProfile = watchUser(
      userId,
      (nextProfile) => {
        if (nextProfile) {
          profile.value = nextProfile;
        } else {
          // The account was deleted from the database.
          logout();
        }
      },
      (error) => {
        sessionError.value = toErrorMessage(error, "Your profile could not be loaded.");
      },
    );

    settleAccount(userId).catch((error: unknown) => {
      sessionError.value = toErrorMessage(error, "Penalties and bonuses could not be updated.");
    });
  },
  { immediate: true },
);
