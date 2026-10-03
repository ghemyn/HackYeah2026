// Nickname + password accounts on top of Firebase Authentication (email/password provider).
//
// Security model:
// - Passwords go only to Firebase Authentication over HTTPS. Google hashes them with scrypt and rate-limits
//   guessing; neither the app nor Firestore ever stores a password or a password hash.
// - Firebase needs an email, so each nickname maps to a fixed made-up address (no email is ever sent).
//   Firestore rules recompute this address to check that a signed-in user really owns a nickname.
// - Login errors never say whether the nickname or the password was wrong.

import { FirebaseError } from "firebase/app";
import {
  createUserWithEmailAndPassword,
  deleteUser,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from "firebase/auth";
import { auth } from "./firebase";
import { sha256Hex } from "./sha256";
import { createUser, toUserId, validateNickname, type UserProfile } from "./users";

// Must match `loginEmail` in firestore.rules.
const LOGIN_EMAIL_DOMAIN = "habitrivals.app";

// Firebase Authentication rejects anything shorter than 6 characters, so this is the lowest possible.
export const MIN_PASSWORD_LENGTH = 6;
export const MAX_PASSWORD_LENGTH = 128;

// The hash keeps the address plain ASCII for any nickname (e.g. "Łukasz") and within email length limits.
export const loginEmail = (userId: string): string => `${sha256Hex(userId)}@${LOGIN_EMAIL_DOMAIN}`;

// "" when acceptable, otherwise a message for the player.
export const validatePassword = (password: string, nickname: string): string => {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }

  if (password.length > MAX_PASSWORD_LENGTH) {
    return `Password must be at most ${MAX_PASSWORD_LENGTH} characters.`;
  }

  if (password.trim().toLowerCase() === nickname.trim().toLowerCase()) {
    return "Password can't be the same as the nickname.";
  }

  return "";
};

// Turns Firebase errors into messages that are safe to show (no hints about which accounts exist).
export const toAuthErrorMessage = (error: unknown, fallback: string): string => {
  if (!(error instanceof FirebaseError)) {
    return error instanceof Error && error.message ? error.message : fallback;
  }

  switch (error.code) {
    case "auth/invalid-credential":
    case "auth/invalid-login-credentials":
    case "auth/wrong-password":
    case "auth/user-not-found":
    case "auth/invalid-email":
      return "Wrong nickname or password.";
    case "auth/email-already-in-use":
      return "This nickname is already taken.";
    case "auth/weak-password":
    case "auth/password-does-not-meet-requirements":
      return "This password is too weak. Use a longer password.";
    case "auth/too-many-requests":
      return "Too many attempts. Wait a few minutes and try again.";
    case "auth/network-request-failed":
      return "Can't reach the server. Check your internet connection.";
    case "auth/user-disabled":
      return "This account has been disabled.";
    case "auth/operation-not-allowed":
    case "auth/configuration-not-found":
      return "Password login is not set up for this app yet (Firebase console → Authentication → Get started → Email/Password).";
    case "auth/invalid-api-key":
    case "auth/api-key-not-valid.-please-pass-a-valid-api-key.":
      return "The app's Firebase API key is missing or wrong (check the VITE_FIREBASE_* settings).";
    case "auth/unauthorized-domain":
    case "auth/requests-from-referer-are-blocked":
      return "This website isn't allowed to use the Firebase API key (check the key's restrictions).";
    case "permission-denied":
      return "The server refused the request (check that firestore.rules is published).";
    case "unavailable":
      return "Can't reach the database. Check your internet connection.";
    default:
      // Error codes are safe to show and make problems diagnosable; the full error goes to the console.
      console.error(error);
      return `${fallback} (${error.code})`;
  }
};

// Signs in. The session (session.ts) picks the new user up from the auth state.
export const signInWithNickname = async (nickname: string, password: string): Promise<void> => {
  const nicknameError = validateNickname(nickname.trim());

  // An invalid nickname can't have an account; answer like any other failed login.
  if (nicknameError || !password) {
    throw new Error("Wrong nickname or password.");
  }

  await signInWithEmailAndPassword(auth, loginEmail(toUserId(nickname)), password);
};

// Creates the Firebase Authentication user and the player account, then signs out again:
// registering never logs the player in. If the account can't be created, the auth user is removed.
export const registerWithNickname = async (nickname: string, password: string, avatar: string): Promise<UserProfile> => {
  const trimmed = nickname.trim();
  const problem = validateNickname(trimmed) || validatePassword(password, trimmed);

  if (problem) {
    throw new Error(problem);
  }

  const userId = toUserId(trimmed);
  const credential = await createUserWithEmailAndPassword(auth, loginEmail(userId), password);

  try {
    // The display name carries the user ID into the ID token, where Firestore rules can check it.
    await updateProfile(credential.user, { displayName: userId });
    return await createUser(trimmed, avatar, credential.user.uid);
  } catch (error) {
    // Don't leave an auth user without a player account behind.
    await deleteUser(credential.user).catch(() => undefined);
    throw error;
  } finally {
    await signOut(auth).catch(() => undefined);
  }
};

export const signOutPlayer = (): Promise<void> => signOut(auth);
