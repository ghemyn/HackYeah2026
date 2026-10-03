<script setup lang="ts">
import { onBeforeUnmount, ref } from "vue";
import { normalizeUuid, toErrorMessage } from "../common";
import { findTag } from "../firebase";
import { NfcScanner } from "../scanners/nfcScanner";
import { QrScanner } from "../scanners/qrScanner";

type ScanOrigin = "QR code" | "NFC tag";

const QR_READER_ID = "qr-reader";

const uuid = ref("");
const source = ref("Not captured yet");
const status = ref("Ready to read a UUID");
const errorMessage = ref("");
const lookup = ref<"idle" | "checking" | "found" | "missing" | "error">("idle");
const tagName = ref("");

const qrScanner = new QrScanner(QR_READER_ID);
const nfcScanner = new NfcScanner();

// Guards against an older lookup resolving after a newer scan.
let lookupId = 0;

const verifyUuid = async (value: string) => {
  const currentLookup = ++lookupId;
  lookup.value = "checking";
  tagName.value = "";

  try {
    const tag = await findTag(value);

    if (currentLookup !== lookupId) {
      return;
    }

    lookup.value = tag ? "found" : "missing";
    tagName.value = tag?.name ?? "";
  } catch (error) {
    if (currentLookup !== lookupId) {
      return;
    }

    lookup.value = "error";
    errorMessage.value = toErrorMessage(error, "The database could not be reached.");
  }
};

const handleCapturedUuid = (value: string, origin: ScanOrigin) => {
  try {
    const nextUuid = normalizeUuid(value);
    uuid.value = nextUuid;
    source.value = origin;
    status.value = `UUID captured from ${origin}.`;
    errorMessage.value = "";
    qrScanner.stop();
    void verifyUuid(nextUuid);
  } catch (error) {
    errorMessage.value = toErrorMessage(error, "A valid UUID could not be read.");
    status.value = `${origin} scan did not return a valid UUID.`;
  }
};

const startQrScan = () => {
  errorMessage.value = "";
  status.value = "Opening camera. Point it at a QR code...";
  qrScanner.start((decodedText) => handleCapturedUuid(decodedText, "QR code"));
};

const startNfcScan = async () => {
  try {
    errorMessage.value = "";
    status.value = "Waiting for an NFC tag...";

    await nfcScanner.start({
      onRead: (value) => {
        if (value) {
          handleCapturedUuid(value, "NFC tag");
        } else {
          errorMessage.value = "The tag was read, but no UUID text was found in its payload.";
          status.value = "NFC tag read without UUID";
        }
      },
      onReadError: () => {
        errorMessage.value = "The NFC tag could not be read. Please move it closer and try again.";
        status.value = "NFC read failed";
      },
    });
  } catch (error) {
    errorMessage.value = toErrorMessage(error, "NFC scanning is not available on this device.");
    status.value = "NFC unavailable";
  }
};

onBeforeUnmount(() => {
  qrScanner.stop();
  nfcScanner.stop();
});
</script>

<template>
  <section class="panel">
    <div class="header">
      <p class="eyebrow">UUID reader</p>
      <h1>Scan a unique identifier</h1>
    </div>

    <div class="actions">
      <button type="button" class="primary" @click="startQrScan">Scan QR code</button>
      <button type="button" class="secondary" @click="startNfcScan">Scan NFC tag</button>
    </div>

    <div class="status-row">
      <span class="status-pill">{{ status }}</span>
    </div>

    <div v-if="errorMessage" class="error-box">
      {{ errorMessage }}
    </div>

    <div :id="QR_READER_ID" class="scanner-box" aria-live="polite"></div>

    <div class="uuid-card">
      <label>Captured UUID</label>
      <div class="uuid-value">{{ uuid || "No UUID captured yet" }}</div>
      <small>Source: {{ source }}</small>
      <div v-if="lookup !== 'idle'" class="lookup" :class="lookup">
        <template v-if="lookup === 'checking'">Checking database...</template>
        <template v-else-if="lookup === 'found'">
          <span>Registered as</span>
          <strong>{{ tagName }}</strong>
        </template>
        <template v-else-if="lookup === 'missing'">This UUID is not registered in the database.</template>
        <template v-else>Could not verify this UUID.</template>
      </div>
    </div>
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

.uuid-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 18px;
  border-radius: 18px;
  background: rgba(15, 118, 110, 0.12);
  border: 1px solid rgba(45, 212, 191, 0.3);
}

.uuid-card label {
  font-size: 0.82rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: #99f6e4;
}

.uuid-value {
  word-break: break-all;
  font-size: clamp(1.1rem, 2vw, 1.8rem);
  font-weight: 700;
  color: white;
}

.uuid-card small {
  color: #cbd5e1;
}

.lookup {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 14px;
  border-radius: 12px;
  background: rgba(148, 163, 184, 0.12);
  color: #e2e8f0;
}

.lookup.found {
  background: rgba(34, 197, 94, 0.14);
  border: 1px solid rgba(74, 222, 128, 0.4);
}

.lookup.found strong {
  font-size: 1.4rem;
  color: white;
}

.lookup.missing,
.lookup.error {
  background: rgba(239, 68, 68, 0.12);
  border: 1px solid rgba(248, 113, 113, 0.4);
  color: #fecaca;
}
</style>
