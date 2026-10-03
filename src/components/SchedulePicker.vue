<script setup lang="ts">
import { computed, ref, watch } from "vue";
import {
  MAX_INTERVAL_DAYS,
  MAX_INTERVAL_TIMES,
  WEEKDAY_LABELS,
  scheduleLabel,
  validateSchedule,
  type HabitSchedule,
} from "../game/schedule";

// Edits how a habit repeats: "X times every Y days" or "on these weekdays".
const schedule = defineModel<HabitSchedule>({ required: true });

const INTERVAL_PRESETS = [
  { label: "Every day", times: 1, days: 1 },
  { label: "3× a day", times: 3, days: 1 },
  { label: "Every 2 days", times: 1, days: 2 },
  { label: "3× a week", times: 3, days: 7 },
  { label: "Once a week", times: 1, days: 7 },
];

const WEEKDAY_PRESETS = [
  { label: "Weekdays", days: [0, 1, 2, 3, 4] },
  { label: "Weekends", days: [5, 6] },
  { label: "Every day", days: [0, 1, 2, 3, 4, 5, 6] },
];

// Both modes keep their own values, so switching back and forth loses nothing.
const mode = ref<HabitSchedule["type"]>(schedule.value.type);
const times = ref(schedule.value.type === "interval" ? schedule.value.times : 1);
const intervalDays = ref(schedule.value.type === "interval" ? schedule.value.days : 1);
const weekdays = ref<number[]>(schedule.value.type === "weekdays" ? [...schedule.value.days] : [0, 2, 4]);

const current = computed<HabitSchedule>(() =>
  mode.value === "interval"
    ? { type: "interval", times: Number(times.value), days: Number(intervalDays.value) }
    : { type: "weekdays", days: [...weekdays.value].sort((a, b) => a - b) },
);

const error = computed(() => validateSchedule(current.value));

watch(current, (next) => {
  schedule.value = next;
});

// Reset the form's fields when the parent resets the schedule (e.g. after creating a habit).
watch(schedule, (next) => {
  if (JSON.stringify(next) === JSON.stringify(current.value)) {
    return;
  }

  mode.value = next.type;

  if (next.type === "interval") {
    times.value = next.times;
    intervalDays.value = next.days;
  } else {
    weekdays.value = [...next.days];
  }
});

const toggleWeekday = (day: number) => {
  weekdays.value = weekdays.value.includes(day)
    ? weekdays.value.filter((selected) => selected !== day)
    : [...weekdays.value, day];
};

const applyIntervalPreset = (preset: { times: number; days: number }) => {
  times.value = preset.times;
  intervalDays.value = preset.days;
};

const isIntervalPreset = (preset: { times: number; days: number }) =>
  mode.value === "interval" && Number(times.value) === preset.times && Number(intervalDays.value) === preset.days;

const isWeekdayPreset = (preset: { days: number[] }) =>
  mode.value === "weekdays" && [...weekdays.value].sort((a, b) => a - b).join(",") === preset.days.join(",");
</script>

<template>
  <div class="schedule-picker">
    <div class="mode-switch" role="tablist" aria-label="How the habit repeats">
      <button
        type="button"
        role="tab"
        :aria-selected="mode === 'interval'"
        :class="mode === 'interval' ? 'primary' : 'secondary'"
        @click="mode = 'interval'"
      >
        Every few days
      </button>
      <button
        type="button"
        role="tab"
        :aria-selected="mode === 'weekdays'"
        :class="mode === 'weekdays' ? 'primary' : 'secondary'"
        @click="mode = 'weekdays'"
      >
        On set weekdays
      </button>
    </div>

    <template v-if="mode === 'interval'">
      <div class="interval-row">
        <input
          v-model.number="times"
          type="number"
          min="1"
          :max="MAX_INTERVAL_TIMES"
          inputmode="numeric"
          aria-label="Times"
        />
        <span>{{ Number(times) === 1 ? "time" : "times" }} every</span>
        <input
          v-model.number="intervalDays"
          type="number"
          min="1"
          :max="MAX_INTERVAL_DAYS"
          inputmode="numeric"
          aria-label="Days"
        />
        <span>{{ Number(intervalDays) === 1 ? "day" : "days" }}</span>
      </div>

      <div class="presets">
        <button
          v-for="preset in INTERVAL_PRESETS"
          :key="preset.label"
          type="button"
          class="chip"
          :class="{ selected: isIntervalPreset(preset) }"
          @click="applyIntervalPreset(preset)"
        >
          {{ preset.label }}
        </button>
      </div>
    </template>

    <template v-else>
      <div class="weekday-row" role="group" aria-label="Days of the week">
        <button
          v-for="(label, day) in WEEKDAY_LABELS"
          :key="label"
          type="button"
          class="chip weekday"
          :class="{ selected: weekdays.includes(day) }"
          :aria-pressed="weekdays.includes(day)"
          @click="toggleWeekday(day)"
        >
          {{ label }}
        </button>
      </div>

      <div class="presets">
        <button
          v-for="preset in WEEKDAY_PRESETS"
          :key="preset.label"
          type="button"
          class="chip"
          :class="{ selected: isWeekdayPreset(preset) }"
          @click="weekdays = [...preset.days]"
        >
          {{ preset.label }}
        </button>
      </div>
    </template>

    <p v-if="error" class="schedule-error">{{ error }}</p>
    <p v-else class="schedule-summary">Repeats: <strong>{{ scheduleLabel(current) }}</strong></p>
  </div>
</template>

<style scoped>
.schedule-picker {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.mode-switch {
  display: flex;
  gap: 8px;
}

.mode-switch button {
  flex: 1;
  padding: 0.6rem 0.8rem;
}

.interval-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  color: var(--ink);
}

.interval-row input {
  width: 4.5rem;
  font: inherit;
  text-align: center;
  padding: 0.6rem 0.4rem;
  border-radius: 4px;
  border: 1px solid var(--line);
  background: var(--surface);
  color: var(--ink);
}

.presets,
.weekday-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.chip {
  padding: 0.45rem 0.8rem;
  border-radius: 999px;
  font-size: 0.88rem;
  background: var(--line);
  color: var(--ink);
  border: 1px solid var(--line);
}

.chip.selected {
  background: #ece7ff;
  border-color: #c93813;
  color: var(--ink);
}

.weekday {
  min-width: 3.4rem;
}

.schedule-summary {
  margin: 0;
  color: var(--muted);
}

.schedule-summary strong {
  color: var(--ink);
}

.schedule-error {
  margin: 0;
  color: #a62e18;
}

@media (max-width: 640px) {
  .mode-switch button,
  .chip {
    width: auto;
  }

  .weekday-row .chip {
    flex: 1 1 22%;
  }
}
</style>
