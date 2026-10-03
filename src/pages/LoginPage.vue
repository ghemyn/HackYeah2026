<script setup lang="ts">
import { computed, ref } from "vue";
import { toErrorMessage } from "../common";
import { loginUser } from "../firebase";
import { setCurrentUser } from "../session";

const nickname = ref("");
const errorMessage = ref("");
const isLoggingIn = ref(false);

const trimmedNickname = computed(() => nickname.value.trim());

// Nicknames become Firestore document IDs, so keep them to a safe character set.
const validateNickname = (value: string): string => {
  if (!/^[\p{L}\p{N}_.-]{3,24}$/u.test(value)) {
    return "Nickname must be 3-24 characters: letters, digits, '_', '.' or '-'.";
  }

  return "";
};

const login = async () => {
  const validationError = validateNickname(trimmedNickname.value);

  if (validationError) {
    errorMessage.value = validationError;
    return;
  }

  try {
    isLoggingIn.value = true;
    errorMessage.value = "";
    const { user } = await loginUser(trimmedNickname.value);
    setCurrentUser(user);
  } catch (error) {
    errorMessage.value = toErrorMessage(error, "Logging in failed.");
  } finally {
    isLoggingIn.value = false;
  }
};
</script>

<template>
  <section class="panel">
    <div class="header">
      <p class="eyebrow">Welcome</p>
      <h1>Log in</h1>
    </div>

    <form class="login-form" @submit.prevent="login">
      <label class="field">
        <span>Nickname</span>
        <input v-model="nickname" type="text" maxlength="24" placeholder="e.g. alice" autocomplete="username" />
      </label>

      <small class="hint">New nicknames create an account automatically.</small>

      <div v-if="errorMessage" class="error-box">
        {{ errorMessage }}
      </div>

      <div class="actions">
        <button type="submit" class="primary" :disabled="!trimmedNickname || isLoggingIn">
          {{ isLoggingIn ? "Logging in..." : "Log in" }}
        </button>
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

.hint {
  color: #94a3b8;
}

.error-box,
.actions {
  margin-bottom: 0;
}
</style>
