<script setup lang="ts">
import { computed } from "vue";
import type { Habit } from "../db/habits";
import type { UserProfile } from "../db/users";
import { checkInsOn, periodProgress } from "../game/progress";

// Shows how the viewer's friends are doing in a shared habit. Other members are only counted.
const props = defineProps<{
  habit: Habit;
  friends: UserProfile[];
  // The viewer, who is never listed here.
  userId: string;
  today: string;
}>();

const friendRows = computed(() =>
  props.friends
    .filter((friend) => props.habit.members[friend.id])
    .map((friend) => {
      const stats = props.habit.members[friend.id];
      return {
        friend,
        todayCount: checkInsOn(stats, props.today),
        progress: periodProgress(props.habit, stats, props.today),
        lastCheckInDate: stats.lastCheckInDate,
      };
    })
    .sort((a, b) => b.todayCount - a.todayCount || b.progress.count - a.progress.count),
);

const otherCount = computed(
  () => props.habit.memberIds.filter((memberId) => memberId !== props.userId).length - friendRows.value.length,
);
</script>

<template>
  <div v-if="friendRows.length > 0 || otherCount > 0" class="habit-members">
    <ul>
      <li v-for="row in friendRows" :key="row.friend.id" :class="{ done: row.todayCount > 0 }">
        <span aria-hidden="true">{{ row.friend.avatar }}</span>
        <strong>{{ row.friend.nickname }}</strong>
        <small>
          <template v-if="row.todayCount > 1">✓ {{ row.todayCount }}× today</template>
          <template v-else-if="row.todayCount === 1">✓ today</template>
          <template v-else>{{ row.lastCheckInDate ? `last ${row.lastCheckInDate}` : "not yet" }}</template>
          · {{ row.progress.count }}/{{ row.progress.target }} {{ row.progress.label }}
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
  color: var(--ink);
}

.habit-members li.done small {
  color: #39500c;
}

.habit-members small {
  color: var(--muted);
}

.others {
  font-size: 0.82rem;
}
</style>
