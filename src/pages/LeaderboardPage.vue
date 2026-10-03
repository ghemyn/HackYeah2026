<script setup lang="ts">
import { computed } from "vue";
import { weekStartKey } from "../common";
import { useFriendProfiles } from "../composables/useFriendProfiles";
import { useToday } from "../composables/useToday";
import { currentStreak, isLazySnail, pointsInWeek } from "../game/progress";
import { navigate } from "../navigation";
import { profile, requireUserId } from "../session";

const userId = requireUserId();
const today = useToday();
const { friends, loaded, error } = useFriendProfiles(userId);

// Everyone's points this week, highest first. Updates live as friends check in.
const rows = computed(() => {
  const weekStart = weekStartKey(today.value);
  const players = profile.value ? [profile.value, ...friends.value] : friends.value;

  return players
    .map((player) => ({
      player,
      points: pointsInWeek(player, weekStart),
      streak: currentStreak(player, today.value),
      lazySnail: isLazySnail(player, today.value),
      isMe: player.id === userId,
    }))
    .sort((a, b) => b.points - a.points || a.player.nickname.localeCompare(b.player.nickname));
});

// The crown goes to a clear leader only.
const leaderId = computed(() => {
  const [first, second] = rows.value;
  return first && first.points > 0 && (!second || first.points > second.points) ? first.player.id : null;
});
</script>

<template>
  <section class="panel">
    <div class="header">
      <p class="eyebrow">This week</p>
      <h1>Leaderboard</h1>
    </div>

    <div v-if="error" class="error-box">{{ error }}</div>
    <p v-if="!loaded && !error" class="hint">Loading leaderboard...</p>

    <ol class="leaderboard">
      <li v-for="(row, index) in rows" :key="row.player.id" class="list-row" :class="{ me: row.isMe }">
        <span class="rank">{{ index + 1 }}</span>
        <span class="row-avatar">{{ row.player.avatar }}</span>
        <div class="row-text">
          <strong>
            {{ row.player.nickname }}
            <template v-if="row.player.id === leaderId"> 👑</template>
            <template v-if="row.isMe"> (you)</template>
          </strong>
          <small>
            🔥 {{ row.streak }} day streak
            <template v-if="row.lazySnail"> · 🐌 Lazy Snail</template>
          </small>
        </div>
        <span class="points">{{ row.points }} pts</span>
      </li>
    </ol>

    <div v-if="loaded && friends.length === 0" class="empty">
      <p class="hint">Add friends to compete with them.</p>
      <button type="button" class="primary" @click="navigate('friends')">Add friends</button>
    </div>
  </section>
</template>

<style scoped>
.leaderboard {
  list-style: none;
  margin: 0 0 18px;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
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
  font-size: 1.1rem;
  white-space: nowrap;
}
</style>
