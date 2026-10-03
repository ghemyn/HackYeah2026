<script setup lang="ts">
import { computed, ref } from "vue";
import EmojiPicker from "../components/EmojiPicker.vue";
import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH, toAuthErrorMessage, validatePassword } from "../db/auth";
import { validateNickname } from "../db/users";
import { AVATARS, DEFAULT_AVATAR } from "../game/catalog";
import { login, register, sessionError } from "../session";

// Logging in is the default. Registering creates the account and returns here without logging in.
const mode = ref<"login" | "register">("login");
const nickname = ref("");
// Passwords only live in these fields until they are sent to Firebase Authentication.
const password = ref("");
const confirmPassword = ref("");
const avatar = ref(DEFAULT_AVATAR);
const errorMessage = ref("");
const successMessage = ref("");
const isBusy = ref(false);

const trimmedNickname = computed(() => nickname.value.trim());

const clearPasswords = () => {
  password.value = "";
  confirmPassword.value = "";
};

const switchMode = (nextMode: "login" | "register") => {
  mode.value = nextMode;
  errorMessage.value = "";
  successMessage.value = "";
  sessionError.value = "";
  clearPasswords();
};

const run = async (action: () => Promise<void>, fallbackError: string) => {
  if (isBusy.value) {
    return;
  }

  try {
    isBusy.value = true;
    errorMessage.value = "";
    successMessage.value = "";
    await action();
  } catch (error) {
    errorMessage.value = toAuthErrorMessage(error, fallbackError);
  } finally {
    isBusy.value = false;
  }
};

const submitLogin = () =>
  run(async () => {
    try {
      await login(trimmedNickname.value, password.value);
    } finally {
      // Never keep a password around longer than needed, whether or not it was right.
      clearPasswords();
    }
  }, "Logging in failed.");

const submitRegister = () => {
  const problem =
    validateNickname(trimmedNickname.value) ||
    validatePassword(password.value, trimmedNickname.value) ||
    (password.value === confirmPassword.value ? "" : "The passwords don't match.");

  if (problem) {
    errorMessage.value = problem;
    successMessage.value = "";
    return;
  }

  void run(async () => {
    const created = await register(trimmedNickname.value, password.value, avatar.value);
    // Back to logging in, with the new nickname filled in; registering does not log in.
    mode.value = "login";
    nickname.value = created.nickname;
    avatar.value = DEFAULT_AVATAR;
    clearPasswords();
    successMessage.value = `Account ${created.avatar} ${created.nickname} created. Log in with your password.`;
  }, "The account could not be created.");
};
</script>

<template>
  <section class="panel">
    <div class="header">
      <p class="eyebrow">HabitRivals</p>
      <h1>{{ mode === "login" ? "Log in" : "Register" }}</h1>
    </div>

    <div class="mode-switch" role="tablist" aria-label="Log in or register">
      <button
        type="button"
        role="tab"
        :aria-selected="mode === 'login'"
        :class="mode === 'login' ? 'primary' : 'secondary'"
        @click="switchMode('login')"
      >
        Log in
      </button>
      <button
        type="button"
        role="tab"
        :aria-selected="mode === 'register'"
        :class="mode === 'register' ? 'primary' : 'secondary'"
        @click="switchMode('register')"
      >
        Register
      </button>
    </div>

    <form v-if="mode === 'login'" class="login-form" @submit.prevent="submitLogin">
      <p class="hint">Turn your habits into a game with friends. Check in, earn points, climb each habit's leaderboard.</p>

      <div v-if="successMessage" class="success-box">{{ successMessage }}</div>

      <label class="field">
        <span>Nickname</span>
        <input v-model="nickname" type="text" maxlength="24" placeholder="e.g. alice" autocomplete="username" />
      </label>

      <label class="field">
        <span>Password</span>
        <input
          v-model="password"
          type="password"
          :maxlength="MAX_PASSWORD_LENGTH"
          autocomplete="current-password"
          autocapitalize="off"
          spellcheck="false"
        />
      </label>

      <div v-if="errorMessage || sessionError" class="error-box">{{ errorMessage || sessionError }}</div>

      <div class="actions">
        <button type="submit" class="primary" :disabled="!trimmedNickname || !password || isBusy">
          {{ isBusy ? "Logging in..." : "Log in" }}
        </button>
      </div>

      <p class="hint switch-hint">
        Don't have an account yet?
        <button type="button" class="link-button" @click="switchMode('register')">Register</button>
      </p>
    </form>

    <form v-else class="login-form" @submit.prevent="submitRegister">
      <p class="hint">Pick a nickname, a password and an avatar. After registering, log in with them.</p>

      <label class="field">
        <span>Nickname</span>
        <input v-model="nickname" type="text" maxlength="24" placeholder="e.g. alice" autocomplete="username" />
      </label>

      <label class="field">
        <span>Password (at least {{ MIN_PASSWORD_LENGTH }} characters)</span>
        <input
          v-model="password"
          type="password"
          :maxlength="MAX_PASSWORD_LENGTH"
          autocomplete="new-password"
          autocapitalize="off"
          spellcheck="false"
        />
      </label>

      <label class="field">
        <span>Repeat password</span>
        <input
          v-model="confirmPassword"
          type="password"
          :maxlength="MAX_PASSWORD_LENGTH"
          autocomplete="new-password"
          autocapitalize="off"
          spellcheck="false"
        />
      </label>

      <div class="field">
        <span>Avatar</span>
        <EmojiPicker v-model="avatar" :options="AVATARS" label="Avatar" />
      </div>

      <div v-if="errorMessage" class="error-box">{{ errorMessage }}</div>

      <div class="actions">
        <button type="submit" class="primary" :disabled="!trimmedNickname || !password || !confirmPassword || isBusy">
          {{ isBusy ? "Creating..." : "Create account" }}
        </button>
      </div>

      <p class="hint switch-hint">
        Already have an account?
        <button type="button" class="link-button" @click="switchMode('login')">Log in</button>
      </p>
    </form>
  </section>
</template>

<style scoped>
.mode-switch {
  display: flex;
  gap: 8px;
  margin-bottom: 18px;
}

.mode-switch button {
  flex: 1;
  padding: 0.6rem 0.8rem;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.login-form .hint {
  margin: 0;
}

.success-box {
  padding: 0.9rem 1rem;
  border-radius: 4px;
  background: rgba(34, 197, 94, 0.12);
  border: 1px solid rgba(74, 222, 128, 0.4);
  color: #39500c;
}

.switch-hint {
  text-align: center;
}

.link-button {
  display: inline;
  width: auto;
  padding: 0;
  border: none;
  background: none;
  color: #c93813;
  font-weight: 700;
  text-decoration: underline;
  cursor: pointer;
}

.error-box,
.actions {
  margin-bottom: 0;
}
</style>
