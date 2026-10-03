<script setup lang="ts">
import { computed, ref } from "vue";
import type { Habit } from "../db/habits";
import { useProfiles } from "../composables/useProfiles";
import { habitStandings } from "../game/progress";
import ScoreNumber from "./ScoreNumber.vue";

const props = defineProps<{ habits: Habit[]; userId: string; today: string }>();
const selectedHabit = ref("");
const selectedRival = ref("");
const shared = computed(() => props.habits.filter(h => h.memberIds.some(id => id !== props.userId && h.members[id])));
const habit = computed(() => shared.value.find(h => h.id === selectedHabit.value) ?? shared.value[0]);
const profiles = useProfiles(() => habit.value?.memberIds ?? []);
const standings = computed(() => habit.value ? habitStandings(habit.value, props.today) : []);
const mine = computed(() => standings.value.find(s => s.userId === props.userId));
const rivals = computed(() => standings.value.filter(s => s.userId !== props.userId));
const rival = computed(() => rivals.value.find(s => s.userId === selectedRival.value) ?? rivals.value[0]);
const lead = computed(() => mine.value && rival.value ? mine.value.points - rival.value.points : 0);
const nameOf = (id: string) => profiles.value[id]?.nickname ?? id;
</script>

<template>
  <section class="scoreboard" aria-label="Habit competition">
    <template v-if="habit && mine && rival">
      <div class="scoreboard-heading">
        <p class="eyebrow">Head to head / habit points</p>
        <label class="score-select">Habit
          <select :value="habit.id" @change="selectedHabit = ($event.target as HTMLSelectElement).value">
            <option v-for="item in shared" :key="item.id" :value="item.id">{{ item.icon }} {{ item.name }}</option>
          </select>
        </label>
      </div>
      <div class="matchup" aria-live="polite" aria-atomic="true">
        <div class="player"><span class="player-label">YOU</span><strong class="match-score"><ScoreNumber :value="mine.points" /></strong><span>{{ mine.todayCount ? `● ${mine.todayCount} check-ins today` : '○ No check-ins today' }}</span><small><ScoreNumber :value="mine.streak" /> check-in streak</small></div>
        <div class="versus">—<span>PTS</span></div>
        <div class="player rival"><span class="player-label">{{ nameOf(rival.userId) }}</span><strong class="match-score"><ScoreNumber :value="rival.points" /></strong><span>{{ rival.todayCount ? `● ${rival.todayCount} check-ins today` : '○ No check-ins today' }}</span><small><ScoreNumber :value="rival.streak" /> check-in streak</small></div>
      </div>
      <div class="match-footer">
        <strong>{{ lead === 0 ? 'All square.' : lead > 0 ? `You lead by ${lead} pts.` : `${nameOf(rival.userId)} leads by ${Math.abs(lead)} pts.` }}</strong>
        <label v-if="rivals.length > 1" class="score-select">Rival
          <select :value="rival.userId" @change="selectedRival = ($event.target as HTMLSelectElement).value"><option v-for="row in rivals" :key="row.userId" :value="row.userId">{{ nameOf(row.userId) }}</option></select>
        </label>
        <span v-else>{{ habit.name }}</span>
      </div>
    </template>
    <div v-else class="competition-empty"><p class="eyebrow">Better with a rival</p><h2>Your next rivalry<br>starts here.</h2><p>Share a habit’s QR tag, or join a friend’s habit below.</p></div>
  </section>
</template>

<style scoped>
.scoreboard { border-top: 3px solid var(--ink); border-bottom: 3px solid var(--ink); margin: 24px 0 32px; background: var(--surface); }
.scoreboard-heading, .match-footer { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 16px 22px; flex-wrap: wrap; }
.scoreboard-heading { border-bottom: 1px solid var(--line); }
.eyebrow { margin: 0; }
.score-select { display: flex; align-items: center; gap: 10px; font-size: .75rem; text-transform: uppercase; letter-spacing: .08em; max-width: 100%; }
select { min-width: 0; max-width: 260px; padding: 8px; border: 1px solid var(--line); background: transparent; font: inherit; color: var(--ink); }
.matchup { display: grid; grid-template-columns: minmax(0,1fr) auto minmax(0,1fr); padding: 28px 20px; gap: 16px; }
.player { display: flex; align-items: center; flex-direction: column; gap: 8px; text-align: center; min-width: 0; }
.player-label { font-weight: 900; text-transform: uppercase; letter-spacing: .1em; overflow-wrap: anywhere; }
.rival .player-label { color: #5936d6; }
.match-score { font-size: clamp(3rem, 10vw, 7.5rem); line-height: 1; letter-spacing: -.07em; }
.player small { color: var(--muted); }
.player > span:not(.player-label) { font-size: .8rem; }
.versus { align-self: center; font-size: 2rem; color: var(--muted); text-align: center; }
.versus span { display: block; font-size: .65rem; letter-spacing: .15em; }
.match-footer { background: var(--lime); border-top: 1px solid var(--ink); font-size: .85rem; }
.competition-empty { padding: 30px; }
.competition-empty h2 { font-size: clamp(2rem,5vw,3.5rem); text-transform: uppercase; line-height: 1; margin: 16px 0; }
@media(max-width:480px) { .matchup { gap: 8px; padding: 24px 10px; } .scoreboard-heading, .match-footer { padding: 14px; } }
</style>
