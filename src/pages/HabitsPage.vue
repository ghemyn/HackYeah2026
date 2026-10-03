<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from "vue";
import { toErrorMessage } from "../common";
import RivalScoreboard from "../components/RivalScoreboard.vue";
import FriendHabits from "../components/FriendHabits.vue";
import HabitCard from "../components/HabitCard.vue";
import HabitForm from "../components/HabitForm.vue";
import TauntBanner from "../components/TauntBanner.vue";
import { useFriendProfiles } from "../composables/useFriendProfiles";
import { useToday } from "../composables/useToday";
import { memberStats, watchHabits, type Habit } from "../db/habits";
import { watchTauntsAt, type Taunt } from "../db/taunts";
import { checkInBlocker, isHabitDoneToday } from "../game/progress";
import { navigate } from "../navigation";
import { requireUserId } from "../session";

const userId = requireUserId();
const today = useToday();
const { friends } = useFriendProfiles(userId);

const habits = ref<Habit[]>([]);
const loaded = ref(false);
const errorMessage = ref("");
const showForm = ref(false);
const tauntError = ref("");

const stopWatching = watchHabits(
  userId,
  (nextHabits) => {
    habits.value = nextHabits;
    loaded.value = true;
    errorMessage.value = "";
  },
  (error) => {
    errorMessage.value = toErrorMessage(error, "Your habits could not be loaded.");
  },
);

// Taunts at the player, by habit. Shown above the habit's card until they check in.
const taunts = ref<Record<string, Taunt>>({});

const stopWatchingTaunts = watchTauntsAt(
  userId,
  (nextTaunts) => {
    tauntError.value = "";
    taunts.value = Object.fromEntries(nextTaunts.map((taunt) => [taunt.habitId, taunt]));
  },
  (error) => {
    tauntError.value = toErrorMessage(error, "Taunts could not be loaded.");
  },
);

onBeforeUnmount(() => {
  stopWatching();
  stopWatchingTaunts();
});

const doneCount = computed(
  () => habits.value.filter((habit) => isHabitDoneToday(memberStats(habit, userId, today.value), today.value)).length,
);
const myHabitIds = computed(() => habits.value.map((habit) => habit.id));
const actionableCount = computed(() => habits.value.filter(habit => !checkInBlocker(habit, memberStats(habit, userId, today.value), today.value)).length);
</script>

<template>
  <section class="panel">
    <div class="header">
      <p class="eyebrow">Your daily competition</p>
      <h1>SHOW UP. PULL AHEAD.</h1>
    </div>

    <RivalScoreboard v-if="loaded" :habits="habits" :user-id="userId" :today="today" />
    <div v-if="loaded" class="today-summary" aria-live="polite">
      <h2>Today's lineup</h2>
      <span>{{ doneCount }}/{{ habits.length }} habits checked in · {{ actionableCount }} available to scan</span>
    </div>
    <div v-if="errorMessage" class="error-box" role="alert">{{ errorMessage }}</div>
    <div v-if="tauntError" class="error-box" role="alert">{{ tauntError }}</div>

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
    <p v-else-if="loaded && habits.length === 0" class="hint">No habits yet. Create one, join a friend's habit below, or scan a habit's QR code.</p>

    <TransitionGroup name="lineup" tag="div" class="habit-list">
      <div v-for="habit in habits" :key="habit.id" class="habit-entry">
        <TauntBanner v-if="taunts[habit.id]" :taunt="taunts[habit.id]" :today="today" />
        <HabitCard :habit="habit" :user-id="userId" :friends="friends" :today="today" />
      </div>
    </TransitionGroup>

    <FriendHabits :user-id="userId" :friends="friends" :my-habit-ids="myHabitIds" :today="today" />
  </section>
</template>

<style scoped>
.today-summary { display:flex; align-items:baseline; justify-content:space-between; gap:12px; flex-wrap:wrap; margin-bottom:18px; }
.today-summary h2 { margin:0; font-size:1.5rem; }
.today-summary span { color:var(--muted); font-size:.85rem; }
.lineup-enter-active, .lineup-leave-active, .lineup-move { transition: opacity 250ms, transform 250ms; }
.lineup-enter-from, .lineup-leave-to { opacity:0; transform:translateY(8px); }
.form-box {
  margin-bottom: 18px;
  padding: 16px;
  border-radius: 4px;
  border: 1px solid var(--line);
}

.habit-list {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.habit-entry {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
</style>
