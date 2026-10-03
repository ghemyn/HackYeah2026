<script setup lang="ts">
import { computed, ref } from "vue";
import { toErrorMessage } from "../common";
import EmojiPicker from "../components/EmojiPicker.vue";
import { createUser, findUser, toUserId, validateNickname } from "../db/users";
import { AVATARS, DEFAULT_AVATAR } from "../game/catalog";
import { login } from "../session";

// Logging in with an unknown nickname leads to a second step where the new player picks an avatar.
const step = ref<"nickname" | "sign-up">("nickname");
const nickname = ref("");
const avatar = ref(DEFAULT_AVATAR);
const errorMessage = ref("");
const isBusy = ref(false);

const trimmedNickname = computed(() => nickname.value.trim());

const run = async (action: () => Promise<void>, fallbackError: string) => {
  try {
    isBusy.value = true;
    errorMessage.value = "";
    await action();
  } catch (error) {
    errorMessage.value = toErrorMessage(error, fallbackError);
  } finally {
    isBusy.value = false;
  }
};

const submitNickname = () => {
  const validationError = validateNickname(trimmedNickname.value);

  if (validationError) {
    errorMessage.value = validationError;
    return;
  }

  void run(async () => {
    const existing = await findUser(toUserId(trimmedNickname.value));

    if (existing) {
      login(existing);
    } else {
      step.value = "sign-up";
    }
  }, "Logging in failed.");
};

const signUp = () =>
  run(async () => {
    login(await createUser(trimmedNickname.value, avatar.value));
  }, "The account could not be created.");

const back = () => {
  step.value = "nickname";
  errorMessage.value = "";
};
</script>

<template>
  <section class="panel">
    <div class="header">
      <p class="eyebrow">HabitRivals</p>
      <h1>{{ step === "nickname" ? "Log in" : "Pick your avatar" }}</h1>
    </div>

    <form v-if="step === 'nickname'" class="login-form" @submit.prevent="submitNickname">
      <p class="hint">Turn your habits into a game with friends. Check in, earn points, climb each habit's leaderboard.</p>

      <label class="field">
        <span>Nickname</span>
        <input v-model="nickname" type="text" maxlength="24" placeholder="e.g. alice" autocomplete="username" />
      </label>

      <small class="hint">New nicknames create an account.</small>

      <div v-if="errorMessage" class="error-box">{{ errorMessage }}</div>

      <div class="actions">
        <button type="submit" class="primary" :disabled="!trimmedNickname || isBusy">
          {{ isBusy ? "Checking..." : "Continue" }}
        </button>
      </div>
    </form>

    <form v-else class="login-form" @submit.prevent="signUp">
      <p class="hint">
        <strong>{{ trimmedNickname }}</strong> is a new player. Choose an avatar to finish creating the account.
      </p>

      <EmojiPicker v-model="avatar" :options="AVATARS" label="Avatar" />

      <div v-if="errorMessage" class="error-box">{{ errorMessage }}</div>

      <div class="actions">
        <button type="submit" class="primary" :disabled="isBusy">
          {{ isBusy ? "Creating..." : `Start as ${avatar} ${trimmedNickname}` }}
        </button>
        <button type="button" class="secondary" :disabled="isBusy" @click="back">Back</button>
      </div>
    </form>
  </section>
</template>

<style scoped>
.login-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.login-form .hint {
  margin: 0;
}

.error-box,
.actions {
  margin-bottom: 0;
}
</style>
