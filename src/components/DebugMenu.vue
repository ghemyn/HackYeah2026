<script setup lang="ts">
import { computed, ref } from "vue";
import { dayOfWeek, formatShortDate, getDayOffset, setDayOffset } from "../common";
import { useToday } from "../composables/useToday";
import { WEEKDAY_LABELS } from "../game/schedule";

// Testing aid: moves the app's date a day at a time. Check-ins, penalties and taunts then use the
// emulated date, and anything they save keeps it, so use test habits and accounts.
const today = useToday();
const offset = ref(getDayOffset());
const isOpen = ref(true);

const offsetLabel = computed(() => {
  if (offset.value === 0) {
    return "real date";
  }

  const days = Math.abs(offset.value);
  return `${offset.value > 0 ? "+" : "−"}${days} day${days === 1 ? "" : "s"}`;
});

const shift = (days: number) => {
  offset.value += days;
  setDayOffset(offset.value);
};

const reset = () => {
  offset.value = 0;
  setDayOffset(0);
};
</script>

<template>
  <aside class="debug-menu" :class="{ emulated: offset !== 0 }" aria-label="Debug menu">
    <button
      type="button"
      class="debug-toggle"
      :aria-expanded="isOpen"
      :title="isOpen ? 'Hide debug menu' : 'Show debug menu'"
      @click="isOpen = !isOpen"
    >
      🛠 <span v-if="!isOpen && offset !== 0">{{ offsetLabel }}</span>
    </button>

    <template v-if="isOpen">
      <div class="debug-date" aria-live="polite">
        <strong>{{ WEEKDAY_LABELS[dayOfWeek(today)] }} {{ formatShortDate(today) }}</strong>
        <small>{{ offsetLabel }}</small>
      </div>
      <button type="button" aria-label="Previous day" title="Previous day" @click="shift(-1)">◀ −1 day</button>
      <button type="button" aria-label="Next day" title="Next day" @click="shift(1)">+1 day ▶</button>
      <button type="button" :disabled="offset === 0" @click="reset">Today</button>
    </template>
  </aside>
</template>

<style scoped>
.debug-menu {
  position: fixed;
  left: 12px;
  bottom: 12px;
  z-index: 1000;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  max-width: calc(100vw - 24px);
  padding: 6px;
  border-radius: 6px;
  background: rgba(23, 23, 23, 0.6);
  color: var(--paper);
  font-size: 0.8rem;
  opacity: 0.75;
  backdrop-filter: blur(2px);
  transition: opacity 180ms;
}

.debug-menu:hover,
.debug-menu:focus-within {
  opacity: 1;
}

/* Hard to miss while the date isn't real. */
.debug-menu.emulated {
  outline: 2px solid var(--orange);
}

.debug-menu button {
  min-height: 36px;
  padding: 0.3rem 0.6rem;
  font-size: 0.8rem;
  color: var(--paper);
  background: rgba(255, 255, 255, 0.12);
  border-color: rgba(255, 255, 255, 0.35);
}

.debug-menu .debug-toggle {
  background: transparent;
  border-color: transparent;
}

.debug-date {
  display: flex;
  flex-direction: column;
  padding: 0 6px;
  line-height: 1.2;
  white-space: nowrap;
}

.debug-date small {
  opacity: 0.8;
}
</style>
