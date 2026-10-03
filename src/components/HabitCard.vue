<script setup lang="ts">
import { computed, ref } from "vue";
import { toErrorMessage } from "../common";
import { deleteHabit, type Habit } from "../db/habits";
import { MAX_TIMES_PER_WEEK, frequencyLabel } from "../game/catalog";
import { habitCountThisWeek, isHabitDoneToday } from "../game/progress";
import { navigate } from "../navigation";
import { isNfcSupported, writeNfcText } from "../scanners/nfcScanner";
import QrCodeCard from "./QrCodeCard.vue";

const props = defineProps<{
  habit: Habit;
  today: string;
}>();

const isBusy = ref(false);
const showTag = ref(false);
const message = ref("");
const errorMessage = ref("");
const canWriteNfc = isNfcSupported();

const doneToday = computed(() => isHabitDoneToday(props.habit, props.today));
const weekCount = computed(() => habitCountThisWeek(props.habit, props.today));
const weekTarget = computed(() => Math.min(props.habit.timesPerWeek, MAX_TIMES_PER_WEEK));

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

const writeTag = () =>
  run(async () => {
    message.value = "Hold an NFC sticker near the phone...";
    await writeNfcText(props.habit.tagCode);
    message.value = "NFC sticker written. Tap it on the Scan page to check in.";
  }, "Writing the NFC sticker failed.");

const remove = () => {
  if (!window.confirm(`Delete "${props.habit.name}"? Its QR code and NFC sticker will stop working.`)) {
    return;
  }

  void run(() => deleteHabit(props.habit.id), "The habit could not be deleted.");
};
</script>

<template>
  <article class="habit-card" :class="{ done: doneToday }">
    <div class="habit-main">
      <span class="habit-icon" aria-hidden="true">{{ habit.icon }}</span>

      <div class="habit-text">
        <strong>{{ habit.name }}</strong>
        <small>{{ frequencyLabel(habit.timesPerWeek) }} · {{ weekCount }}/{{ weekTarget }} this week</small>
      </div>

      <span v-if="doneToday" class="done-label">Done today ✓</span>
      <!-- Opens the scanner only; checking in requires scanning this habit's QR code or NFC tag. -->
      <button v-else type="button" class="primary check-in" @click="navigate('scan')">Scan to check in</button>
    </div>

    <p v-if="message" class="habit-message">{{ message }}</p>
    <div v-if="errorMessage" class="error-box">{{ errorMessage }}</div>

    <div class="habit-tools">
      <button type="button" class="secondary small" @click="showTag = !showTag">
        {{ showTag ? "Hide tag" : "QR / NFC tag" }}
      </button>
      <button type="button" class="secondary small danger" :disabled="isBusy" @click="remove">Delete</button>
    </div>

    <div v-if="showTag" class="habit-tag">
      <p class="hint">Print this QR code or write it to an NFC sticker. Scanning it is the only way to check in.</p>
      <QrCodeCard :value="habit.tagCode" :caption="`${habit.icon} ${habit.name}`">
        <template #actions>
          <button v-if="canWriteNfc" type="button" class="secondary" :disabled="isBusy" @click="writeTag">
            Write NFC sticker
          </button>
        </template>
      </QrCodeCard>
    </div>
  </article>
</template>

<style scoped>
.habit-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 16px;
  border-radius: 18px;
  background: rgba(148, 163, 184, 0.08);
  border: 1px solid rgba(148, 163, 184, 0.2);
}

.habit-card.done {
  background: rgba(34, 197, 94, 0.1);
  border-color: rgba(74, 222, 128, 0.35);
}

.habit-main {
  display: flex;
  align-items: center;
  gap: 14px;
}

.habit-icon {
  font-size: 2rem;
}

.habit-text {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
  min-width: 0;
}

.habit-text strong {
  font-size: 1.1rem;
  overflow-wrap: anywhere;
}

.habit-text small {
  color: #94a3b8;
}

.done-label {
  font-weight: 700;
  color: #86efac;
  white-space: nowrap;
}

.habit-message {
  margin: 0;
  color: #bbf7d0;
  font-weight: 700;
}

.habit-tools {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.habit-tag {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.error-box {
  margin-bottom: 0;
}

@media (max-width: 640px) {
  .habit-main {
    flex-wrap: wrap;
  }

  .check-in {
    flex-basis: 100%;
  }
}
</style>
