<script setup lang="ts">
import { computed } from "vue";
import { useProfiles } from "../composables/useProfiles";
import type { Habit } from "../db/habits";
import { habitStandings } from "../game/progress";

// A habit's own leaderboard: every member, ranked by the points they earned in this habit.
const props = defineProps<{
  habit: Habit;
  // The viewer, highlighted in the list.
  userId: string;
  // The viewer's friends' IDs, marked in the list.
  friendIds: string[];
  today: string;
}>();

const standings = computed(() => habitStandings(props.habit, props.today));
const profiles = useProfiles(() => props.habit.memberIds);

// The crown goes to a clear leader only.
const leaderId = computed(() => {
  const [first, second] = standings.value;
  return first && first.points > 0 && (!second || first.points > second.points) ? first.userId : null;
});
</script>

<template>
  <ol class="habit-leaderboard">
    <li
      v-for="row in standings"
      :key="row.userId"
      class="list-row"
      :class="{ me: row.userId === userId, friend: friendIds.includes(row.userId) }"
    >
      <span class="rank">{{ row.rank }}</span>
      <span class="row-avatar">{{ profiles[row.userId]?.avatar ?? "👤" }}</span>
      <div class="row-text">
        <strong>
          {{ profiles[row.userId]?.nickname ?? row.userId }}
          <template v-if="row.userId === leaderId"> 👑</template>
          <template v-if="row.userId === userId"> (you)</template>
          <template v-else-if="friendIds.includes(row.userId)"> · friend</template>
        </strong>
        <small>
          {{ row.todayCount === 0 ? "not today" : row.todayCount === 1 ? "✓ today" : `✓ ${row.todayCount}× today` }}
          · 🔥 {{ row.streak }}
          <template v-if="row.lazySnail"> · 🐌 Lazy Snail</template>
        </small>
      </div>
      <span class="points">{{ row.points }} pts</span>
    </li>
  </ol>
</template>

<style scoped>
.habit-leaderboard {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.list-row.friend {
  border-color: rgba(167, 139, 250, 0.4);
}

.list-row.me {
  border-color: rgba(56, 189, 248, 0.5);
  background: rgba(56, 189, 248, 0.1);
}

.rank {
  width: 1.6rem;
  text-align: center;
  font-weight: 700;
  color: #94a3b8;
}

.points {
  font-weight: 700;
  white-space: nowrap;
}
</style>
