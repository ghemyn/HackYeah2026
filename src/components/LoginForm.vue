<script setup lang="ts">
import { computed, ref } from "vue";
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
    errorMessage.value = error instanceof Error ? error.message : "Logging in failed.";
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

.field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.field span {
  font-size: 0.82rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: #99f6e4;
}

.field input {
  font: inherit;
  padding: 0.8rem 1rem;
  border-radius: 12px;
  border: 1px solid rgba(148, 163, 184, 0.3);
  background: rgba(15, 23, 42, 0.8);
  color: #e2e8f0;
}

.hint {
  color: #94a3b8;
}

.error-box,
.actions {
  margin-bottom: 0;
}
</style>
