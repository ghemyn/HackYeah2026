<script setup lang="ts">
import { computed } from "vue";
import { MAX_TIMES_PER_WEEK } from "../game/catalog";
import type { Habit } from "../db/habits";
import type { UserProfile } from "../db/users";
import { habitCountThisWeek, isHabitDoneToday } from "../game/progress";

// Shows how the viewer's friends are doing in a shared habit. Other members are only counted.
const props = defineProps<{
  habit: Habit;
  friends: UserProfile[];
  // The viewer, who is never listed here.
  userId: string;
  today: string;
}>();

const weekTarget = computed(() => Math.min(props.habit.timesPerWeek, MAX_TIMES_PER_WEEK));

const friendRows = computed(() =>
  props.friends
    .filter((friend) => props.habit.members[friend.id])
    .map((friend) => {
      const stats = props.habit.members[friend.id];
      return {
        friend,
        doneToday: isHabitDoneToday(stats, props.today),
        weekCount: habitCountThisWeek(stats, props.today),
        lastCheckInDate: stats.lastCheckInDate,
      };
    })
    .sort((a, b) => Number(b.doneToday) - Number(a.doneToday) || b.weekCount - a.weekCount),
);

const otherCount = computed(
  () => props.habit.memberIds.filter((memberId) => memberId !== props.userId).length - friendRows.value.length,
);
</script>

<template>
  <div v-if="friendRows.length > 0 || otherCount > 0" class="habit-members">
    <ul>
      <li v-for="row in friendRows" :key="row.friend.id" :class="{ done: row.doneToday }">
        <span aria-hidden="true">{{ row.friend.avatar }}</span>
        <strong>{{ row.friend.nickname }}</strong>
        <small>
          {{ row.doneToday ? "✓ today" : row.lastCheckInDate ? `last ${row.lastCheckInDate}` : "not yet" }}
          · {{ row.weekCount }}/{{ weekTarget }} this week
        </small>
      </li>
    </ul>
    <small v-if="otherCount > 0" class="others">
      {{ friendRows.length > 0 ? "+" : "" }}{{ otherCount }} other {{ otherCount === 1 ? "player" : "players" }}
    </small>
  </div>
</template>

<style scoped>
.habit-members {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.habit-members ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.habit-members li {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 6px;
  color: #cbd5e1;
}

.habit-members li.done small {
  color: #86efac;
}

.habit-members small {
  color: #94a3b8;
}

.others {
  font-size: 0.82rem;
}
</style>
