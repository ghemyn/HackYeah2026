<script setup lang="ts">
import { ref } from "vue";
import { toErrorMessage } from "../common";
import QrCodeCard from "../components/QrCodeCard.vue";
import { useFriendProfiles } from "../composables/useFriendProfiles";
import { useToday } from "../composables/useToday";
import { addFriend, removeFriend } from "../db/friends";
import { toUserId } from "../db/users";
import { currentStreak, isLazySnail } from "../game/progress";
import { navigate } from "../navigation";
import { friendCodePayload } from "../scanners/payload";
import { currentUser, requireUserId } from "../session";

const userId = requireUserId();
const today = useToday();
const { friends, loaded, error: loadError } = useFriendProfiles(userId);

const nickname = ref("");
const message = ref("");
const errorMessage = ref("");
const isBusy = ref(false);

const run = async (action: () => Promise<void>, fallbackError: string) => {
  if (isBusy.value) {
    return;
  }

  try {
    isBusy.value = true;
    message.value = "";
    errorMessage.value = "";
    await action();
  } catch (error) {
    errorMessage.value = toErrorMessage(error, fallbackError);
  } finally {
    isBusy.value = false;
  }
};

const addByNickname = () =>
  run(async () => {
    const { friend, alreadyFriends } = await addFriend(userId, toUserId(nickname.value));
    message.value = alreadyFriends ? `${friend.nickname} is already your friend.` : `${friend.nickname} added!`;
    nickname.value = "";
  }, "The friend could not be added.");

const remove = (friendId: string, friendNickname: string) => {
  if (window.confirm(`Remove ${friendNickname} from your friends?`)) {
    void run(() => removeFriend(userId, friendId), "The friend could not be removed.");
  }
};
</script>

<template>
  <section class="panel">
    <div class="header">
      <p class="eyebrow">Friends</p>
      <h1>Play together</h1>
    </div>

    <div class="friend-code">
      <p class="hint">Let a friend scan this code on their Scan page to add you.</p>
      <QrCodeCard :value="friendCodePayload(userId)" :caption="currentUser?.nickname ?? userId">
        <template #actions>
          <button type="button" class="primary" @click="navigate('scan')">Scan a friend's code</button>
        </template>
      </QrCodeCard>
    </div>

    <form class="add-friend" @submit.prevent="addByNickname">
      <label class="field">
        <span>Or add by nickname</span>
        <input v-model="nickname" type="text" maxlength="24" placeholder="Friend's nickname" autocomplete="off" />
      </label>
      <button type="submit" class="secondary" :disabled="!nickname.trim() || isBusy">Add friend</button>
    </form>

    <p v-if="message" class="success-text">{{ message }}</p>
    <div v-if="errorMessage" class="error-box">{{ errorMessage }}</div>
    <div v-if="loadError" class="error-box">{{ loadError }}</div>

    <h2>Your friends</h2>
    <p v-if="!loaded && !loadError" class="hint">Loading friends...</p>
    <p v-else-if="loaded && friends.length === 0" class="hint">No friends yet. Share your code to get started.</p>

    <ul class="friend-list">
      <li v-for="friend in friends" :key="friend.id" class="list-row">
        <span class="row-avatar">{{ friend.avatar }}</span>
        <div class="row-text">
          <strong>{{ friend.nickname }}</strong>
          <small>
            🔥 {{ currentStreak(friend, today) }} day streak · {{ friend.totalPoints }} pts
            <template v-if="isLazySnail(friend, today)"> · 🐌 Lazy Snail</template>
          </small>
        </div>
        <button type="button" class="secondary small danger" :disabled="isBusy" @click="remove(friend.id, friend.nickname)">
          Remove
        </button>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.friend-code {
  margin-bottom: 18px;
}

.add-friend {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 18px;
}

.add-friend button {
  align-self: flex-start;
}

.friend-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
</style>
