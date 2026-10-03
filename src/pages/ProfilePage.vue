<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { toErrorMessage, weekStartKey } from "../common";
import EmojiPicker from "../components/EmojiPicker.vue";
import { useToday } from "../composables/useToday";
import { watchBadges, type Badge } from "../db/badges";
import { updateAvatar } from "../db/users";
import { BADGES } from "../game/badges";
import { AVATARS, DEFAULT_AVATAR } from "../game/catalog";
import { currentStreak, pointsInWeek } from "../game/progress";
import { LAZY_SNAIL_AFTER_MISSED_DAYS, POINTS, STREAK_BONUS_EVERY_DAYS } from "../game/rules";
import { profile, requireUserId } from "../session";

const userId = requireUserId();
const today = useToday();

const badges = ref<Badge[]>([]);
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

onBeforeUnmount(stopWatchingBadges);

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

const weekPoints = computed(() => (profile.value ? pointsInWeek(profile.value, weekStartKey(today.value)) : 0));
const streak = computed(() => (profile.value ? currentStreak(profile.value, today.value) : 0));

const rules = [
  { action: "Check in by scanning a habit's QR or NFC tag", points: POINTS.checkIn },
  { action: `${STREAK_BONUS_EVERY_DAYS}-day streak 🔥`, points: POINTS.streakBonus },
  { action: "Beat all friends in a week 👑", points: POINTS.weeklyWinner },
  { action: "Miss a day (streak resets)", points: POINTS.missedDay },
  { action: `Miss ${LAZY_SNAIL_AFTER_MISSED_DAYS} days in a row 🐌 (extra)`, points: POINTS.lazySnail },
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
        <strong>{{ profile?.totalPoints ?? 0 }}</strong>
        <span>total points</span>
      </div>
      <div class="stat">
        <strong>{{ weekPoints }}</strong>
        <span>this week</span>
      </div>
      <div class="stat">
        <strong>🔥 {{ streak }}</strong>
        <span>day streak</span>
      </div>
    </div>

    <div v-if="errorMessage" class="error-box">{{ errorMessage }}</div>

    <h2>Avatar</h2>
    <EmojiPicker v-model="avatar" :options="AVATARS" label="Avatar" />

    <h2>Badges</h2>
    <p v-if="badges.length === 0" class="hint">No badges yet. Keep a 7-day streak to earn your first 🔥.</p>
    <ul class="badge-list">
      <li v-for="badge in badges" :key="badge.id" class="list-row">
        <span class="row-avatar">{{ BADGES[badge.type].emoji }}</span>
        <div class="row-text">
          <strong>{{ BADGES[badge.type].label }}</strong>
          <small>{{ BADGES[badge.type].description }} · {{ badge.date }}</small>
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
