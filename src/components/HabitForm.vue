<script setup lang="ts">
import { computed, ref } from "vue";
import { toErrorMessage } from "../common";
import { createHabit } from "../db/habits";
import { DEFAULT_HABIT_ICON, HABIT_ICONS } from "../game/catalog";
import { DAILY_SCHEDULE, validateSchedule, type HabitSchedule } from "../game/schedule";
import EmojiPicker from "./EmojiPicker.vue";
import SchedulePicker from "./SchedulePicker.vue";

const props = defineProps<{
  userId: string;
}>();

const emit = defineEmits<{
  created: [];
}>();

const MAX_NAME_LENGTH = 40;

const name = ref("");
const icon = ref(DEFAULT_HABIT_ICON);
const schedule = ref<HabitSchedule>(DAILY_SCHEDULE);
const isSaving = ref(false);
const errorMessage = ref("");

const trimmedName = computed(() => name.value.trim());
const scheduleError = computed(() => validateSchedule(schedule.value));

const submit = async () => {
  if (!trimmedName.value || scheduleError.value || isSaving.value) {
    return;
  }

  try {
    isSaving.value = true;
    errorMessage.value = "";
    await createHabit(props.userId, { name: trimmedName.value, icon: icon.value, schedule: schedule.value });
    name.value = "";
    icon.value = DEFAULT_HABIT_ICON;
    schedule.value = DAILY_SCHEDULE;
    emit("created");
  } catch (error) {
    errorMessage.value = toErrorMessage(error, "The habit could not be created.");
  } finally {
    isSaving.value = false;
  }
};
</script>

<template>
  <form class="habit-form" @submit.prevent="submit">
    <label class="field">
      <span>Habit name</span>
      <input v-model="name" type="text" :maxlength="MAX_NAME_LENGTH" placeholder="e.g. Gym" />
    </label>

    <div class="field">
      <span>Icon</span>
      <EmojiPicker v-model="icon" :options="HABIT_ICONS" label="Habit icon" />
    </div>

    <div class="field">
      <span>Repeats</span>
      <SchedulePicker v-model="schedule" />
    </div>

    <div v-if="errorMessage" class="error-box">{{ errorMessage }}</div>

    <div class="actions">
      <button type="submit" class="primary" :disabled="!trimmedName || !!scheduleError || isSaving">
        {{ isSaving ? "Creating..." : "Create habit" }}
      </button>
    </div>
  </form>
</template>

<style scoped>
.habit-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.habit-form .actions {
  margin-bottom: 0;
}
</style>
