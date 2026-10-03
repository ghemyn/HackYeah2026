<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { toErrorMessage } from "../common";
import { findHabitsWithMembers, joinHabit, type Habit } from "../db/habits";
import type { UserProfile } from "../db/users";
import { frequencyLabel } from "../game/catalog";
import HabitMembers from "./HabitMembers.vue";

// Habits the viewer's friends are in but the viewer is not, with a button to join.
const props = defineProps<{
  userId: string;
  friends: UserProfile[];
  // Habits the viewer already belongs to; they are hidden here.
  myHabitIds: string[];
  today: string;
}>();

const habits = ref<Habit[]>([]);
const errorMessage = ref("");
const joiningId = ref<string | null>(null);

// Ignores loads that finish after a newer one has started.
let loadId = 0;

const load = async () => {
  const currentLoad = ++loadId;
  const friendIds = props.friends.map((friend) => friend.id);

  try {
    const found = friendIds.length > 0 ? await findHabitsWithMembers(friendIds) : [];

    if (currentLoad === loadId) {
      habits.value = found;
      errorMessage.value = "";
    }
  } catch (error) {
    if (currentLoad === loadId) {
      errorMessage.value = toErrorMessage(error, "Your friends' habits could not be loaded.");
    }
  }
};

// Reload only when the set of friends changes, not on every live profile update.
watch(
  () => props.friends.map((friend) => friend.id).sort().join(","),
  () => void load(),
  { immediate: true },
);

const joinable = computed(() => habits.value.filter((habit) => !props.myHabitIds.includes(habit.id)));

const join = async (habit: Habit) => {
  if (joiningId.value) {
    return;
  }

  try {
    joiningId.value = habit.id;
    errorMessage.value = "";
    await joinHabit(props.userId, habit.id);
  } catch (error) {
    errorMessage.value = toErrorMessage(error, "Joining the habit failed.");
    void load();
  } finally {
    joiningId.value = null;
  }
};
</script>

<template>
  <div v-if="joinable.length > 0 || errorMessage" class="friend-habits">
    <h2>Your friends' habits</h2>
    <div v-if="errorMessage" class="error-box">{{ errorMessage }}</div>

    <ul>
      <li v-for="habit in joinable" :key="habit.id" class="friend-habit">
        <div class="friend-habit-main">
          <span class="habit-icon" aria-hidden="true">{{ habit.icon }}</span>
          <div class="row-text">
            <strong>{{ habit.name }}</strong>
            <small>{{ frequencyLabel(habit.timesPerWeek) }}</small>
          </div>
          <button type="button" class="secondary small" :disabled="joiningId !== null" @click="join(habit)">
            {{ joiningId === habit.id ? "Joining..." : "Join" }}
          </button>
        </div>
        <HabitMembers :habit="habit" :friends="friends" :user-id="userId" :today="today" />
      </li>
    </ul>
  </div>
</template>

<style scoped>
.friend-habits ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.friend-habit {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 14px;
  border-radius: 16px;
  background: rgba(148, 163, 184, 0.08);
  border: 1px solid rgba(148, 163, 184, 0.2);
}

.friend-habit-main {
  display: flex;
  align-items: center;
  gap: 12px;
}

.habit-icon {
  font-size: 1.8rem;
}

@media (max-width: 640px) {
  .friend-habit-main button {
    width: auto;
  }
}
</style>
