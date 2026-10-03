<script setup lang="ts">
import { ref } from "vue";
import { toErrorMessage } from "../common";
import { sendTaunt } from "../db/taunts";
import { MAX_TAUNT_EMOJIS, MAX_TAUNT_MESSAGE_LENGTH, TAUNT_EMOJIS, validateTaunt } from "../game/taunts";

// The leader writes a taunt at a member who hasn't checked in yet: a few emojis and an optional message.
const props = defineProps<{
  habitId: string;
  // The leader (the viewer).
  fromId: string;
  targetId: string;
  targetName: string;
}>();

const emit = defineEmits<{
  sent: [];
  cancel: [];
}>();

const emojis = ref<string[]>([]);
const message = ref("");
const isSending = ref(false);
const errorMessage = ref("");

const toggle = (emoji: string) => {
  if (emojis.value.includes(emoji)) {
    emojis.value = emojis.value.filter((selected) => selected !== emoji);
  } else if (emojis.value.length < MAX_TAUNT_EMOJIS) {
    emojis.value = [...emojis.value, emoji];
  }
};

const send = async () => {
  if (isSending.value) {
    return;
  }

  errorMessage.value = validateTaunt(emojis.value, message.value);

  if (errorMessage.value) {
    return;
  }

  try {
    isSending.value = true;
    await sendTaunt(props.fromId, props.habitId, props.targetId, emojis.value, message.value);
    emit("sent");
  } catch (error) {
    errorMessage.value = toErrorMessage(error, "The taunt could not be sent.");
  } finally {
    isSending.value = false;
  }
};
</script>

<template>
  <form class="taunt-composer" @submit.prevent="send">
    <strong>Taunt {{ targetName }}</strong>
    <small class="hint">Pick up to {{ MAX_TAUNT_EMOJIS }} emojis. They'll see it until they check in.</small>

    <div class="taunt-emojis" role="group" aria-label="Taunt emojis">
      <button
        v-for="emoji in TAUNT_EMOJIS"
        :key="emoji"
        type="button"
        :aria-pressed="emojis.includes(emoji)"
        :class="{ selected: emojis.includes(emoji) }"
        :disabled="!emojis.includes(emoji) && emojis.length >= MAX_TAUNT_EMOJIS"
        @click="toggle(emoji)"
      >
        {{ emoji }}
      </button>
    </div>

    <label class="field">
      <span>Message (optional)</span>
      <input v-model="message" :maxlength="MAX_TAUNT_MESSAGE_LENGTH" placeholder="Still on the couch?" />
    </label>

    <p v-if="emojis.length > 0" class="taunt-preview">{{ emojis.join(" ") }} {{ message.trim() }}</p>
    <div v-if="errorMessage" class="error-box">{{ errorMessage }}</div>

    <div class="taunt-actions">
      <button type="submit" class="primary small" :disabled="isSending || emojis.length === 0">
        {{ isSending ? "Sending..." : "Send taunt" }}
      </button>
      <button type="button" class="secondary small" :disabled="isSending" @click="emit('cancel')">Cancel</button>
    </div>
  </form>
</template>

<style scoped>
.taunt-composer {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px;
  border-radius: 16px;
  background: rgba(249, 115, 22, 0.08);
  border: 1px solid rgba(251, 146, 60, 0.35);
}

.taunt-composer .hint {
  margin: 0;
}

.taunt-emojis {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(44px, 1fr));
  gap: 6px;
}

.taunt-emojis button {
  width: 100%;
  padding: 0.45rem 0;
  font-size: 1.3rem;
  line-height: 1;
  background: rgba(148, 163, 184, 0.1);
  border: 2px solid transparent;
}

.taunt-emojis button.selected {
  border-color: #fb923c;
  background: rgba(251, 146, 60, 0.2);
}

.taunt-preview {
  margin: 0;
  font-size: 1.1rem;
  overflow-wrap: anywhere;
}

.taunt-composer .error-box {
  margin-bottom: 0;
}

.taunt-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
</style>
