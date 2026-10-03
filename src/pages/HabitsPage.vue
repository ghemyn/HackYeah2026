<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from "vue";
import { toErrorMessage, weekStartKey } from "../common";
import HabitCard from "../components/HabitCard.vue";
import HabitForm from "../components/HabitForm.vue";
import { useToday } from "../composables/useToday";
import { watchHabits, type Habit } from "../db/habits";
import { currentStreak, isHabitDoneToday, isLazySnail, pointsInWeek } from "../game/progress";
import { navigate } from "../navigation";
import { profile, requireUserId } from "../session";

const userId = requireUserId();
const today = useToday();

const habits = ref<Habit[]>([]);
const loaded = ref(false);
const errorMessage = ref("");
const showForm = ref(false);

const stopWatching = watchHabits(
  userId,
  (nextHabits) => {
    habits.value = nextHabits;
    loaded.value = true;
  },
  (error) => {
    errorMessage.value = toErrorMessage(error, "Your habits could not be loaded.");
  },
);

onBeforeUnmount(stopWatching);

const doneCount = computed(() => habits.value.filter((habit) => isHabitDoneToday(habit, today.value)).length);
const weekPoints = computed(() => (profile.value ? pointsInWeek(profile.value, weekStartKey(today.value)) : 0));
const streak = computed(() => (profile.value ? currentStreak(profile.value, today.value) : 0));
const lazySnail = computed(() => (profile.value ? isLazySnail(profile.value, today.value) : false));
</script>

<template>
  <section class="panel">
    <div class="header">
      <p class="eyebrow">Today</p>
      <h1>Your habits</h1>
    </div>

    <div class="stats">
      <div class="stat">
        <strong>{{ weekPoints }}</strong>
        <span>points this week</span>
      </div>
      <div class="stat">
        <strong>🔥 {{ streak }}</strong>
        <span>day streak</span>
      </div>
      <div class="stat">
        <strong>{{ doneCount }}/{{ habits.length }}</strong>
        <span>done today</span>
      </div>
    </div>

    <div v-if="lazySnail" class="snail-box">🐌 You're a Lazy Snail! Check in today to shake it off.</div>
    <div v-if="errorMessage" class="error-box">{{ errorMessage }}</div>

    <div class="actions">
      <button type="button" class="primary" @click="navigate('scan')">Scan a tag</button>
      <button type="button" class="secondary" @click="showForm = !showForm">
        {{ showForm ? "Close" : "New habit" }}
      </button>
    </div>

    <div v-if="showForm" class="form-box">
      <HabitForm :user-id="userId" @created="showForm = false" />
    </div>

    <p v-if="!loaded && !errorMessage" class="hint">Loading habits...</p>
    <p v-else-if="loaded && habits.length === 0" class="hint">No habits yet. Create your first one to start earning points.</p>

    <div class="habit-list">
      <HabitCard v-for="habit in habits" :key="habit.id" :habit="habit" :today="today" />
    </div>
  </section>
</template>

<style scoped>
.form-box {
  margin-bottom: 18px;
  padding: 16px;
  border-radius: 18px;
  border: 1px solid rgba(148, 163, 184, 0.2);
}

.habit-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.snail-box {
  margin-bottom: 16px;
  padding: 0.9rem 1rem;
  border-radius: 12px;
  background: rgba(234, 179, 8, 0.12);
  border: 1px solid rgba(250, 204, 21, 0.4);
  color: #fef08a;
}
</style>
