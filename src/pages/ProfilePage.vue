<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { toErrorMessage } from "../common";
import EmojiPicker from "../components/EmojiPicker.vue";
import { useToday } from "../composables/useToday";
import { watchBadges, type Badge } from "../db/badges";
import { watchHabits, type Habit } from "../db/habits";
import { updateAvatar } from "../db/users";
import { BADGES } from "../game/badges";
import { AVATARS, DEFAULT_AVATAR } from "../game/catalog";
import { habitStandings } from "../game/progress";
import { LAZY_SNAIL_AFTER_MISSED_DAYS, POINTS, STREAK_BONUS_EVERY_CHECK_INS } from "../game/rules";
import { profile, requireUserId } from "../session";

const userId = requireUserId();
const today = useToday();

const badges = ref<Badge[]>([]);
const habits = ref<Habit[]>([]);
const errorMessage = ref("");
const avatar = ref(profile.value?.avatar ?? DEFAULT_AVATAR);

const stopWatchingBadges = watchBadges(
  userId,
  (nextBadges) => {
    badges.value = nextBadges;
  },
  (error) => {
    errorMessage.value = toErrorMessage(error, "Badges could not be loaded.");
  },
);

const stopWatchingHabits = watchHabits(
  userId,
  (nextHabits) => {
    habits.value = nextHabits;
  },
  (error) => {
    errorMessage.value = toErrorMessage(error, "Your habits could not be loaded.");
  },
);

onBeforeUnmount(() => {
  stopWatchingBadges();
  stopWatchingHabits();
});

// Keep the picker in sync with the stored avatar (it may load after this page opens).
watch(
  () => profile.value?.avatar,
  (storedAvatar) => {
    if (storedAvatar) {
      avatar.value = storedAvatar;
    }
  },
);

watch(avatar, async (nextAvatar) => {
  if (!profile.value || nextAvatar === profile.value.avatar) {
    return;
  }

  try {
    errorMessage.value = "";
    await updateAvatar(userId, nextAvatar);
  } catch (error) {
    errorMessage.value = toErrorMessage(error, "The avatar could not be saved.");
  }
});

// Points only exist inside each habit's leaderboard; this lists them side by side.
const leaderboards = computed(() =>
  habits.value.flatMap((habit) => {
    const standings = habitStandings(habit, today.value);
    const mine = standings.find((standing) => standing.userId === userId);
    return mine ? [{ habit, standing: mine, size: standings.length }] : [];
  }),
);
const totalCheckIns = computed(() =>
  habits.value.reduce((sum, habit) => sum + (habit.members[userId]?.totalCheckIns ?? 0), 0),
);

const rules = [
  { action: "Check in by scanning the habit's QR or NFC tag", points: POINTS.checkIn },
  { action: `${STREAK_BONUS_EVERY_CHECK_INS} check-ins in a row without a penalty 🔥`, points: POINTS.streakBonus },
  { action: "Daily habit: each missed day (streak resets)", points: POINTS.missed },
  { action: `Daily habit: ${LAZY_SNAIL_AFTER_MISSED_DAYS} missed days in a row 🐌 (extra)`, points: POINTS.lazySnail },
  { action: "Weekly habit: each check-in short of the target", points: POINTS.missed },
  { action: "Weekly habit: a whole week without check-ins 🐌 (extra)", points: POINTS.lazySnail },
];

const formatPoints = (points: number) => (points > 0 ? `+${points}` : `${points}`);
</script>

<template>
  <section class="panel">
    <div class="header">
      <p class="eyebrow">Profile</p>
      <h1>{{ profile?.avatar }} {{ profile?.nickname ?? "Loading..." }}</h1>
    </div>

    <div class="stats">
      <div class="stat">
        <strong>{{ habits.length }}</strong>
        <span>habits joined</span>
      </div>
      <div class="stat">
        <strong>{{ totalCheckIns }}</strong>
        <span>check-ins</span>
      </div>
      <div class="stat">
        <strong>{{ badges.length }}</strong>
        <span>badges</span>
      </div>
    </div>

    <div v-if="errorMessage" class="error-box">{{ errorMessage }}</div>

    <h2>Your leaderboards</h2>
    <p class="hint">Points are earned separately in each habit.</p>
    <p v-if="leaderboards.length === 0" class="hint">Join or create a habit to get on a leaderboard.</p>
    <ul class="badge-list">
      <li v-for="{ habit, standing, size } in leaderboards" :key="habit.id" class="list-row">
        <span class="row-avatar">{{ habit.icon }}</span>
        <div class="row-text">
          <strong>{{ habit.name }}<template v-if="standing.rank === 1 && size > 1"> 👑</template></strong>
          <small>#{{ standing.rank }} of {{ size }} · 🔥 {{ standing.streak }}</small>
        </div>
        <span class="points">{{ standing.points }} pts</span>
      </li>
    </ul>

    <h2>Avatar</h2>
    <EmojiPicker v-model="avatar" :options="AVATARS" label="Avatar" />

    <h2>Badges</h2>
    <p v-if="badges.length === 0" class="hint">
      No badges yet. Check in {{ STREAK_BONUS_EVERY_CHECK_INS }} times in a row to earn your first 🔥.
    </p>
    <ul class="badge-list">
      <li v-for="badge in badges" :key="badge.id" class="list-row">
        <span class="row-avatar">{{ BADGES[badge.type].emoji }}</span>
        <div class="row-text">
          <strong>{{ BADGES[badge.type].label }}</strong>
          <small>
            <template v-if="badge.habitName">{{ badge.habitName }} · </template>{{ BADGES[badge.type].description }} ·
            {{ badge.date }}
          </small>
        </div>
      </li>
    </ul>

    <h2>How points work</h2>
    <table class="rules">
      <tbody>
        <tr v-for="rule in rules" :key="rule.action">
          <td>{{ rule.action }}</td>
          <td :class="rule.points > 0 ? 'gain' : 'loss'">{{ formatPoints(rule.points) }}</td>
        </tr>
      </tbody>
    </table>
  </section>
</template>

<style scoped>
.badge-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.points {
  font-weight: 700;
  white-space: nowrap;
}

.rules {
  width: 100%;
  border-collapse: collapse;
}

.rules td {
  padding: 0.6rem 0.4rem;
  border-bottom: 1px solid rgba(148, 163, 184, 0.15);
}

.rules td:last-child {
  text-align: right;
  font-weight: 700;
  white-space: nowrap;
}

.gain {
  color: #86efac;
}

.loss {
  color: #fca5a5;
}
</style>
