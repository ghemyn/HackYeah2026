import { ref, watch } from "vue";
import { onAuthStateChanged } from "firebase/auth";
import type { Unsubscribe } from "firebase/firestore";
import { toErrorMessage } from "./common";
import { registerWithNickname, signInWithNickname, signOutPlayer } from "./db/auth";
import { auth } from "./db/firebase";
import { watchMilestones } from "./db/milestones";
import { settleAccount } from "./db/settlement";
import { findUserByUid, watchUser, type UserProfile } from "./db/users";

type SessionUser = {
  id: string;
  nickname: string;
};

// Sessions used to be kept in localStorage without any proof of identity; drop that leftover.
try {
  localStorage.removeItem("habitquest.user");
} catch {
  // Storage may be unavailable; nothing to clean up then.
}

// False until Firebase has restored (or ruled out) a saved login, so the login page doesn't flash.
export const authReady = ref(false);

// Who is logged in. Comes only from Firebase Authentication, which keeps the login across restarts.
export const currentUser = ref<SessionUser | null>(null);

// Live copy of the logged-in player's document; null while loading.
export const profile = ref<UserProfile | null>(null);

// Problems with keeping the session in sync, shown in the navbar or on the login page.
export const sessionError = ref("");

// Ignores lookups that finish after a newer auth change.
let authChangeId = 0;

// Registering signs in briefly to create the account; those auth events must not log the player in.
let isRegistering = false;

onAuthStateChanged(auth, async (firebaseUser) => {
  const changeId = ++authChangeId;

  if (isRegistering) {
    return;
  }

  if (!firebaseUser) {
    currentUser.value = null;
    authReady.value = true;
    return;
  }

  try {
    const account = await findUserByUid(firebaseUser.uid);

    // Registration signs in and straight out again; skip events that are already outdated.
    if (changeId !== authChangeId || auth.currentUser?.uid !== firebaseUser.uid) {
      return;
    }

    if (account) {
      currentUser.value = { id: account.id, nickname: account.nickname };
      sessionError.value = "";
    } else {
      // A login without a player account (e.g. an interrupted registration) can't be used.
      currentUser.value = null;
      sessionError.value = "This login has no player account. Register again.";
      await signOutPlayer();
    }
  } catch (error) {
    if (changeId === authChangeId) {
      currentUser.value = null;
      sessionError.value = toErrorMessage(error, "Your account could not be loaded.");
    }
  } finally {
    if (changeId === authChangeId) {
      authReady.value = true;
    }
  }
});

// Logs in; the auth listener above then loads the player account.
export const login = async (nickname: string, password: string) => {
  sessionError.value = "";
  await signInWithNickname(nickname, password);
};

// Creates the account without logging in (the player logs in afterwards).
export const register = async (nickname: string, password: string, avatar: string): Promise<UserProfile> => {
  isRegistering = true;
  sessionError.value = "";

  try {
    return await registerWithNickname(nickname, password, avatar);
  } finally {
    isRegistering = false;
  }
};

export const logout = async () => {
  currentUser.value = null;
  await signOutPlayer();
};

// For pages, which are only shown while someone is logged in.
export const requireUserId = (): string => {
  if (!currentUser.value) {
    throw new Error("No player is logged in.");
  }

  return currentUser.value.id;
};

let stopWatchingProfile: Unsubscribe | null = null;
let stopAwardingMilestones: Unsubscribe | null = null;

watch(
  () => currentUser.value?.id ?? null,
  (userId) => {
    stopWatchingProfile?.();
    stopWatchingProfile = null;
    stopAwardingMilestones?.();
    stopAwardingMilestones = null;
    profile.value = null;

    if (!userId) {
      return;
    }

    sessionError.value = "";
    stopWatchingProfile = watchUser(
      userId,
      (nextProfile) => {
        if (nextProfile) {
          profile.value = nextProfile;
        } else {
          // The account was deleted from the database.
          void logout();
        }
      },
      (error) => {
        sessionError.value = toErrorMessage(error, "Your profile could not be loaded.");
      },
    );

    stopAwardingMilestones = watchMilestones(userId, (error) => {
      sessionError.value = toErrorMessage(error, "Milestone badges could not be updated.");
    });

    settleAccount(userId).catch((error: unknown) => {
      sessionError.value = toErrorMessage(error, "Penalties and bonuses could not be updated.");
    });
  },
  { immediate: true },
);
