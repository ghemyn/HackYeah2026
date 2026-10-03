<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref } from "vue";
import { toErrorMessage } from "../common";
import { checkIn, type CheckInMethod, type CheckInResult } from "../db/checkins";
import { addFriend } from "../db/friends";
import { findHabitByTagCode } from "../db/habits";
import type { UserProfile } from "../db/users";
import { NfcScanner } from "../scanners/nfcScanner";
import { parseScanPayload } from "../scanners/payload";
import { QrScanner } from "../scanners/qrScanner";
import { requireUserId } from "../session";

type ScanOutcome =
  | { kind: "check-in"; result: CheckInResult }
  | { kind: "friend"; friend: UserProfile; alreadyFriends: boolean };

const QR_READER_ID = "qr-reader";

const userId = requireUserId();

const status = ref("Scan a habit tag to check in (or join it), or a friend's code to add them.");
const errorMessage = ref("");
const outcome = ref<ScanOutcome | null>(null);
const isBusy = ref(false);
const isQrActive = ref(false);
const isNfcActive = ref(false);

const qrScanner = new QrScanner(QR_READER_ID);
const nfcScanner = new NfcScanner();

const stopQr = () => {
  qrScanner.stop();
  isQrActive.value = false;
};

// Codes only ever come from the camera or an NFC tag; there is no way to type one in.
const processScan = async (rawValue: string, source: CheckInMethod) => {
  if (isBusy.value) {
    return;
  }

  try {
    isBusy.value = true;
    errorMessage.value = "";
    outcome.value = null;
    status.value = "Checking the code...";

    const payload = parseScanPayload(rawValue);

    if (payload.kind === "friend") {
      const { friend, alreadyFriends } = await addFriend(userId, payload.userId);
      outcome.value = { kind: "friend", friend, alreadyFriends };
    } else if (payload.kind === "habit") {
      const habit = await findHabitByTagCode(payload.tagCode);

      if (!habit) {
        throw new Error("No habit uses this tag. It may have been deleted.");
      }

      // Scanning a habit you haven't joined yet joins it and checks you in.

      outcome.value = { kind: "check-in", result: await checkIn(userId, habit.id, source) };
    } else {
      throw new Error("This is not a HabitRivals habit tag or friend code.");
    }

    status.value = isNfcActive.value ? "Done. Tap another NFC tag or scan again." : "Done.";
  } catch (error) {
    errorMessage.value = toErrorMessage(error, "The code could not be processed.");
    status.value = "Scan failed. Try again.";
  } finally {
    isBusy.value = false;
  }
};

const startQrScan = async () => {
  errorMessage.value = "";
  status.value = "Opening camera. Point it at a QR code...";
  isQrActive.value = true;
  // Let the camera container become visible first; the scanner sizes itself from it.
  await nextTick();

  if (!isQrActive.value) {
    return;
  }

  qrScanner.start((decodedText) => {
    // The camera keeps decoding until it is stopped; only the first result counts.
    if (!isQrActive.value) {
      return;
    }

    stopQr();
    void processScan(decodedText, "qr");
  });
};

const startNfcScan = async () => {
  try {
    errorMessage.value = "";
    status.value = "Waiting for an NFC tag... Hold it near the back of the phone.";
    isNfcActive.value = true;

    await nfcScanner.start({
      onRead: (value) => {
        if (value) {
          void processScan(value, "nfc");
        } else {
          errorMessage.value = "The tag was read, but it is empty.";
        }
      },
      onReadError: () => {
        errorMessage.value = "The NFC tag could not be read. Hold it closer and try again.";
      },
    });
  } catch (error) {
    isNfcActive.value = false;
    errorMessage.value = toErrorMessage(error, "NFC scanning is not available on this device.");
    status.value = "NFC unavailable. Use the QR code instead.";
  }
};

const stopNfcScan = () => {
  nfcScanner.stop();
  isNfcActive.value = false;
  status.value = "NFC scanning stopped.";
};

onBeforeUnmount(() => {
  qrScanner.stop();
  nfcScanner.stop();
});
</script>

<template>
  <section class="panel">
    <div class="header">
      <p class="eyebrow">Check in</p>
      <h1>Scan a tag</h1>
    </div>

    <div class="actions">
      <button v-if="!isQrActive" type="button" class="primary" @click="startQrScan">Scan QR code</button>
      <button v-else type="button" class="secondary" @click="stopQr">Stop camera</button>
      <button v-if="!isNfcActive" type="button" class="secondary" @click="startNfcScan">Scan NFC tag</button>
      <button v-else type="button" class="secondary" @click="stopNfcScan">Stop NFC</button>
    </div>

    <div class="status-row">
      <span class="status-pill">{{ status }}</span>
    </div>

    <div v-if="errorMessage" class="error-box">{{ errorMessage }}</div>

    <div v-if="outcome" class="outcome">
      <template v-if="outcome.kind === 'check-in'">
        <span class="outcome-icon">{{ outcome.result.habit.icon }}</span>
        <div>
          <strong>{{ outcome.result.habit.name }}</strong>
          <p v-if="outcome.result.joined">You joined this habit!</p>
          <p v-if="outcome.result.status === 'already-done'">Already checked in today.</p>
          <p v-else>
            Checked in! +{{ outcome.result.points }} points
            <template v-if="outcome.result.streakBonus"> (🔥 streak bonus!)</template>
            · now {{ outcome.result.habitPoints }} pts, #{{ outcome.result.rank }} in this habit · 🔥
            {{ outcome.result.streak }}
          </p>
        </div>
      </template>
      <template v-else>
        <span class="outcome-icon">{{ outcome.friend.avatar }}</span>
        <div>
          <strong>{{ outcome.friend.nickname }}</strong>
          <p>{{ outcome.alreadyFriends ? "You are already friends." : "Added as a friend!" }}</p>
        </div>
      </template>
    </div>

    <div v-show="isQrActive" :id="QR_READER_ID" class="scanner-box" aria-live="polite"></div>
  </section>
</template>

<style scoped>
.scanner-box {
  width: 100%;
  min-height: 260px;
  border-radius: 18px;
  overflow: hidden;
  background: rgba(15, 23, 42, 0.8);
  border: 1px solid rgba(148, 163, 184, 0.22);
  margin-bottom: 18px;
}

.outcome {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 18px;
  padding: 16px;
  border-radius: 18px;
  background: rgba(34, 197, 94, 0.14);
  border: 1px solid rgba(74, 222, 128, 0.4);
}

.outcome-icon {
  font-size: 2.4rem;
}

.outcome strong {
  font-size: 1.3rem;
  color: white;
}

.outcome p {
  margin: 4px 0 0;
  color: #bbf7d0;
}
</style>
