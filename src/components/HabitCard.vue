<script setup lang="ts">
import { computed, ref } from "vue";
import { toErrorMessage } from "../common";
import { leaveHabit, memberStats, type Habit } from "../db/habits";
import type { UserProfile } from "../db/users";
import {
  checkInBlocker,
  describeDay,
  habitStandings,
  isHabitDoneToday,
  nextCheckInDay,
  periodProgress,
} from "../game/progress";
import { scheduleLabel } from "../game/schedule";
import { navigate } from "../navigation";
import { isNfcSupported, writeNfcText } from "../scanners/nfcScanner";
import ScoreNumber from "./ScoreNumber.vue";
import HabitLeaderboard from "./HabitLeaderboard.vue";
import HabitMembers from "./HabitMembers.vue";
import QrCodeCard from "./QrCodeCard.vue";

const props = defineProps<{
  habit: Habit;
  userId: string;
  // The viewer's friends, to show their activity in this habit.
  friends: UserProfile[];
  today: string;
}>();

const isBusy = ref(false);
const showTag = ref(false);
const showLeaderboard = ref(false);
const message = ref("");
const errorMessage = ref("");
const canWriteNfc = isNfcSupported();

const myStats = computed(() => memberStats(props.habit, props.userId, props.today));
const doneToday = computed(() => isHabitDoneToday(myStats.value, props.today));
const progress = computed(() => periodProgress(props.habit, myStats.value, props.today));
const canCheckInToday = computed(() => !checkInBlocker(props.habit, myStats.value, props.today));
const nextDay = computed(() => nextCheckInDay(props.habit, myStats.value, props.today));
const isLastMember = computed(() => props.habit.memberIds.every((memberId) => memberId === props.userId));
const standings = computed(() => habitStandings(props.habit, props.today));
const myStanding = computed(() => standings.value.find((standing) => standing.userId === props.userId));
const friendIds = computed(() => props.friends.map((friend) => friend.id));

const run = async (action: () => Promise<void>, fallbackError: string) => {
  if (isBusy.value) {
    return;
  }

  try {
    isBusy.value = true;
    message.value = "";
    errorMessage.value = "";
    await action();
  } catch (error) {
    errorMessage.value = toErrorMessage(error, fallbackError);
  } finally {
    isBusy.value = false;
  }
};

const writeTag = () =>
  run(async () => {
    message.value = "Hold an NFC sticker near the phone...";
    await writeNfcText(props.habit.tagCode);
    message.value = "NFC sticker written. Tap it on the Scan page to check in.";
  }, "Writing the NFC sticker failed.");

const leave = () => {
  const warning = isLastMember.value
    ? "You are its last member, so it will be deleted and its QR code and NFC sticker will stop working."
    : "Your points in its leaderboard will be lost. You can join again later by scanning its tag.";

  if (window.confirm(`Leave "${props.habit.name}"? ${warning}`)) {
    void run(() => leaveHabit(props.userId, props.habit.id), "Leaving the habit failed.");
  }
};
</script>

<template>
  <article class="habit-card" :class="{ done: doneToday }">
    <div class="habit-main">
      <span class="habit-icon" aria-hidden="true">{{ habit.icon }}</span>

      <div class="habit-text">
        <strong>{{ habit.name }}</strong>
        <small>
          {{ scheduleLabel(habit.schedule) }} · {{ progress.count }}/{{ progress.target }} {{ progress.label }}
        </small>
      </div>

      <!-- Opens the scanner only; checking in requires scanning this habit's QR code or NFC tag. -->
      <button v-if="canCheckInToday" type="button" class="primary check-in" @click="navigate('scan')">
        {{ doneToday ? "Scan again →" : "Scan →" }}
      </button>
      <span v-else class="status-label" :class="{ done: doneToday }">
        {{ doneToday ? "Checked in ✓" : "No scan due" }}
        <small v-if="nextDay">Next: {{ describeDay(nextDay, today) }}</small>
      </span>
    </div>

    <div class="habit-progress" role="progressbar" :aria-label="habit.name + ' ' + progress.label" :aria-valuenow="progress.count" :aria-valuemin="0" :aria-valuemax="Math.max(progress.target, progress.count)"><span :style="{ width: Math.min(100, progress.count / progress.target * 100) + '%' }"></span></div>
    <p v-if="myStanding" class="standing">
      <strong><ScoreNumber :value="myStanding.points" /> pts</strong> · #{{ myStanding.rank }} of {{ standings.length }} · 🔥
      <ScoreNumber :value="myStanding.streak" /> check-in streak
      <template v-if="myStanding.lazySnail"> · 🐌 Lazy Snail — scan the tag to shake it off!</template>
    </p>

    <HabitMembers :habit="habit" :friends="friends" :user-id="userId" :today="today" />

    <p v-if="message" class="habit-message">{{ message }}</p>
    <div v-if="errorMessage" class="error-box">{{ errorMessage }}</div>

    <div class="habit-tools">
      <button type="button" class="secondary small" @click="showLeaderboard = !showLeaderboard">
        {{ showLeaderboard ? "Hide leaderboard" : "Leaderboard" }}
      </button>
      <button type="button" class="secondary small" @click="showTag = !showTag">
        {{ showTag ? "Hide tag" : "QR / NFC tag" }}
      </button>
      <button type="button" class="secondary small danger" :disabled="isBusy" @click="leave">Leave</button>
    </div>

    <HabitLeaderboard v-if="showLeaderboard" :habit="habit" :user-id="userId" :friend-ids="friendIds" :today="today" />

    <div v-if="showTag" class="habit-tag">
      <p class="hint">
        Print this QR code or write it to an NFC sticker. Scanning it is the only way to check in. Someone scanning
        it for the first time only adds the habit to their account; later scans check them in.
      </p>
      <QrCodeCard :value="habit.tagCode" :caption="`${habit.icon} ${habit.name}`">
        <template #actions>
          <button v-if="canWriteNfc" type="button" class="secondary" :disabled="isBusy" @click="writeTag">
            Write NFC sticker
          </button>
        </template>
      </QrCodeCard>
    </div>
  </article>
</template>

<style scoped>
.habit-progress { height:4px; background:var(--line); overflow:hidden; }
.habit-progress span { display:block; height:100%; background:var(--ink); transition:width 300ms ease, background 250ms; }
.done .habit-progress span { background:var(--lime); }
.habit-card { transition:background 250ms; }
.habit-tools button { padding:5px 8px; background:transparent; border-color:transparent; font-size:.75rem; }
.habit-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 20px 0;
  border-radius: 0;
  background: transparent;
  border: 0;
  border-top: 1px solid var(--ink);
}

.habit-card.done {
  background: transparent;
  border-color: var(--ink);
}

.habit-main {
  display: flex;
  align-items: center;
  gap: 14px;
}

.habit-icon {
  font-size: 2rem;
}

.habit-text {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
  min-width: 0;
}

.habit-text strong {
  font-size: 1.1rem;
  overflow-wrap: anywhere;
}

.habit-text small {
  color: var(--muted);
}

.status-label {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  font-weight: 700;
  color: var(--ink);
  white-space: nowrap;
}

.status-label.done {
  color: #39500c;
}

.status-label small {
  font-weight: 400;
  color: var(--muted);
}

.standing {
  margin: 0;
  color: var(--ink);
}

.standing strong {
  color: var(--ink);
}

.habit-message {
  margin: 0;
  color: #39500c;
  font-weight: 700;
}

.habit-tools {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.habit-tag {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.error-box {
  margin-bottom: 0;
}

@media (max-width: 640px) {
  .habit-main {
    flex-wrap: wrap;
  }

  .check-in {
    flex-basis: 100%;
  }
}
</style>
