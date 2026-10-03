<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from "vue";
import { toErrorMessage } from "../common";
import FriendHabits from "../components/FriendHabits.vue";
import HabitCard from "../components/HabitCard.vue";
import HabitForm from "../components/HabitForm.vue";
import TauntBanner from "../components/TauntBanner.vue";
import { useFriendProfiles } from "../composables/useFriendProfiles";
import { useToday } from "../composables/useToday";
import { memberStats, watchHabits, type Habit } from "../db/habits";
import { watchTauntsAt, type Taunt } from "../db/taunts";
import { habitStandings, isHabitDoneToday } from "../game/progress";
import { navigate } from "../navigation";
import { requireUserId } from "../session";

const userId = requireUserId();
const today = useToday();
const { friends } = useFriendProfiles(userId);

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

// Taunts at the player, by habit. Shown above the habit's card until they check in.
const taunts = ref<Record<string, Taunt>>({});

const stopWatchingTaunts = watchTauntsAt(
  userId,
  (nextTaunts) => {
    taunts.value = Object.fromEntries(nextTaunts.map((taunt) => [taunt.habitId, taunt]));
  },
  (error) => {
    errorMessage.value = toErrorMessage(error, "Taunts could not be loaded.");
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
// My standing in each habit's own leaderboard.
const myStandings = computed(() =>
  habits.value.flatMap((habit) => {
    const standings = habitStandings(habit, today.value);
    const mine = standings.find((standing) => standing.userId === userId);
    return mine ? [{ habit, standing: mine, size: standings.length }] : [];
  }),
);
const firstPlaces = computed(() => myStandings.value.filter(({ standing, size }) => size > 1 && standing.rank === 1).length);
const lazySnailHabits = computed(() =>
  myStandings.value.filter(({ standing }) => standing.lazySnail).map(({ habit }) => habit.name),
);
</script>

<template>
  <section class="panel">
    <div class="header">
      <p class="eyebrow">Home</p>
      <h1>Your habits</h1>
    </div>

    <div class="stats">
      <div class="stat">
        <strong>{{ habits.length }}</strong>
        <span>habits joined</span>
      </div>
      <div class="stat">
        <strong>👑 {{ firstPlaces }}</strong>
        <span>leaderboards led</span>
      </div>
      <div class="stat">
        <strong>{{ doneCount }}/{{ habits.length }}</strong>
        <span>done today</span>
      </div>
    </div>

    <div v-if="lazySnailHabits.length > 0" class="snail-box">
      🐌 You're a Lazy Snail in {{ lazySnailHabits.join(", ") }}! Scan the tag to shake it off.
    </div>
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
    <p v-else-if="loaded && habits.length === 0" class="hint">No habits yet. Create one, join a friend's habit below, or scan a habit's QR code.</p>

    <div class="habit-list">
      <div v-for="habit in habits" :key="habit.id" class="habit-entry">
        <TauntBanner v-if="taunts[habit.id]" :taunt="taunts[habit.id]" :today="today" />
        <HabitCard :habit="habit" :user-id="userId" :friends="friends" :today="today" />
      </div>
    </div>

    <FriendHabits :user-id="userId" :friends="friends" :my-habit-ids="myHabitIds" :today="today" />
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

.habit-entry {
  display: flex;
  flex-direction: column;
  gap: 6px;
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
