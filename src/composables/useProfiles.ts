import { ref, watch } from "vue";
import { findUser, type UserProfile } from "../db/users";

// Profiles are fetched once per app session and shared by every component that needs them.
const cache = new Map<string, Promise<UserProfile | null>>();

const loadProfile = (userId: string): Promise<UserProfile | null> => {
  let pending = cache.get(userId);

  if (!pending) {
    pending = findUser(userId).catch(() => {
      // Let a later call retry after a network error.
      cache.delete(userId);
      return null;
    });
    cache.set(userId, pending);
  }

  return pending;
};

// Nicknames and avatars for a changing list of user IDs. Missing entries are still loading (or deleted).
export const useProfiles = (getUserIds: () => string[]) => {
  const profiles = ref<Record<string, UserProfile>>({});

  watch(
    () => getUserIds().slice().sort().join(","),
    () => {
      for (const userId of getUserIds()) {
        if (profiles.value[userId]) {
          continue;
        }

        void loadProfile(userId).then((profile) => {
          if (profile) {
            profiles.value = { ...profiles.value, [userId]: profile };
          }
        });
      }
    },
    { immediate: true },
  );

  return profiles;
};
