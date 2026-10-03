<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { toErrorMessage } from "../common";
import { useProfiles } from "../composables/useProfiles";
import type { Habit } from "../db/habits";
import { watchHabitTaunts, type Taunt } from "../db/taunts";
import { clearLeaderId, habitStandings } from "../game/progress";
import { canBeTaunted } from "../game/taunts";
import TauntComposer from "./TauntComposer.vue";

// A habit's own leaderboard: every member, ranked by the points they earned in this habit.
// The leader can taunt members who haven't checked in yet today.
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
const leaderId = computed(() => clearLeaderId(standings.value));

// Taunts in this habit, by taunted member.
const taunts = ref<Record<string, Taunt>>({});
const tauntError = ref("");
const tauntSentTo = ref("");
// The member the leader is writing a taunt at.
const composingFor = ref<string | null>(null);

watch(
  () => props.habit.id,
  (habitId, _previous, onCleanup) => {
    taunts.value = {};
    onCleanup(
      watchHabitTaunts(
        habitId,
        (nextTaunts) => {
          taunts.value = Object.fromEntries(nextTaunts.map((taunt) => [taunt.targetId, taunt]));
          tauntError.value = "";
        },
        (error) => {
          tauntError.value = toErrorMessage(error, "Taunts could not be loaded.");
        },
      ),
    );
  },
  { immediate: true },
);

// Members the viewer can taunt right now (only when the viewer leads).
const tauntableIds = computed(() =>
  leaderId.value === props.userId
    ? props.habit.memberIds.filter(
        (memberId) =>
          memberId !== props.userId &&
          props.habit.members[memberId] &&
          canBeTaunted(props.habit, props.habit.members[memberId], props.today),
      )
    : [],
);

const nameOf = (memberId: string) => profiles.value[memberId]?.nickname ?? memberId;

const startTaunt = (memberId: string) => {
  composingFor.value = composingFor.value === memberId ? null : memberId;
  tauntSentTo.value = "";
};

const onTauntSent = () => {
  tauntSentTo.value = composingFor.value ? nameOf(composingFor.value) : "";
  composingFor.value = null;
};
</script>

<template>
  <div class="leaderboard-box">
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
            {{ nameOf(row.userId) }}
            <template v-if="row.userId === leaderId"> 👑</template>
            <template v-if="row.userId === userId"> (you)</template>
            <template v-else-if="friendIds.includes(row.userId)"> · friend</template>
          </strong>
          <small>
            {{ row.todayCount === 0 ? "not today" : row.todayCount === 1 ? "✓ today" : `✓ ${row.todayCount}× today` }}
            · 🔥 {{ row.streak }}
            <template v-if="row.lazySnail"> · 🐌 Lazy Snail</template>
          </small>
          <small v-if="taunts[row.userId]" class="taunted">Taunted {{ taunts[row.userId].emojis.join("") }}</small>
        </div>
        <button
          v-if="tauntableIds.includes(row.userId)"
          type="button"
          class="secondary small taunt-button"
          @click="startTaunt(row.userId)"
        >
          {{ taunts[row.userId] ? "Taunt again" : "Taunt 😏" }}
        </button>
        <span class="points">{{ row.points }} pts</span>
      </li>
    </ol>

    <TauntComposer
      v-if="composingFor && tauntableIds.includes(composingFor)"
      :key="composingFor"
      :habit-id="habit.id"
      :from-id="userId"
      :target-id="composingFor"
      :target-name="nameOf(composingFor)"
      @sent="onTauntSent"
      @cancel="composingFor = null"
    />
    <p v-if="tauntSentTo" class="taunt-sent">😏 Taunt sent to {{ tauntSentTo }}.</p>
    <div v-if="tauntError" class="error-box">{{ tauntError }}</div>
  </div>
</template>

<style scoped>
.leaderboard-box {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

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
  border-color: #ece7ff;
  background: #ece7ff;
}

.rank {
  width: 1.6rem;
  text-align: center;
  font-weight: 700;
  color: var(--muted);
}

.points {
  font-weight: 700;
  white-space: nowrap;
}

.row-text small.taunted {
  color: #823b12;
}

.taunt-button {
  white-space: nowrap;
}

.taunt-sent {
  margin: 0;
  color: #823b12;
  font-weight: 700;
}

.error-box {
  margin-bottom: 0;
}
</style>
