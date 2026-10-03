import { onBeforeUnmount, ref } from "vue";
import type { Unsubscribe } from "firebase/firestore";
import { toErrorMessage } from "../common";
import { watchFriendIds } from "../db/friends";
import { watchUser, type UserProfile } from "../db/users";

// Live profiles of a player's friends, sorted by nickname. Stops listening when the component unmounts.
export const useFriendProfiles = (userId: string) => {
  const friends = ref<UserProfile[]>([]);
  const loaded = ref(false);
  const error = ref("");

  const profileWatchers = new Map<string, Unsubscribe>();
  const profiles = new Map<string, UserProfile>();

  const publish = () => {
    friends.value = [...profiles.values()].sort((a, b) => a.nickname.localeCompare(b.nickname));
  };

  const onError = (cause: Error) => {
    error.value = toErrorMessage(cause, "Friends could not be loaded.");
  };

  const stopWatchingIds = watchFriendIds(
    userId,
    (friendIds) => {
      const wanted = new Set(friendIds);

      for (const [friendId, stop] of profileWatchers) {
        if (!wanted.has(friendId)) {
          stop();
          profileWatchers.delete(friendId);
          profiles.delete(friendId);
        }
      }

      for (const friendId of wanted) {
        if (profileWatchers.has(friendId)) {
          continue;
        }

        const stop = watchUser(
          friendId,
          (friendProfile) => {
            if (friendProfile) {
              profiles.set(friendId, friendProfile);
            } else {
              profiles.delete(friendId);
            }

            publish();
          },
          onError,
        );
        profileWatchers.set(friendId, stop);
      }

      loaded.value = true;
      publish();
    },
    onError,
  );

  onBeforeUnmount(() => {
    stopWatchingIds();
    profileWatchers.forEach((stop) => stop());
    profileWatchers.clear();
  });

  return { friends, loaded, error };
};
