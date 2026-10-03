<script setup lang="ts">
import { onBeforeUnmount, ref } from "vue";
import { Html5QrcodeScanner } from "html5-qrcode";
import QrGenerator from "./components/QrGenerator.vue";
import { findTag } from "./firebase";

type NfcRecord = {
  recordType: string;
  data?: ArrayBuffer;
  mediaType?: string;
  id?: string;
};

type NfcMessage = {
  records: NfcRecord[];
};

type NfcReaderLike = {
  scan: () => Promise<void>;
  cancel?: () => Promise<void>;
  onreading: ((event: { message: NfcMessage; serialNumber?: string }) => void) | null;
  onreadingerror: ((event: { error: Error }) => void) | null;
};

const uuid = ref("");
const source = ref("Not captured yet");
const status = ref("Ready to read a UUID");
const errorMessage = ref("");
const qrScannerElement = ref<HTMLElement | null>(null);
const view = ref<"scan" | "generate">("scan");
const lookup = ref<"idle" | "checking" | "found" | "missing" | "error">("idle");
const tagName = ref("");

// Guards against an older lookup resolving after a newer scan.
let lookupId = 0;

let qrScanner: Html5QrcodeScanner | null = null;
let nfcReader: NfcReaderLike | null = null;

const normalizeUuid = (rawValue: string): string => {
  const trimmed = rawValue.trim().replace(/[{}]/g, "");

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(trimmed)) {
    throw new Error("This scan does not contain a valid UUID string.");
  }

  return trimmed.toLowerCase();
};

const stopQrScanner = () => {
  if (!qrScanner) {
    return;
  }

  qrScanner.clear().catch(() => undefined);
  qrScanner = null;

  if (qrScannerElement.value) {
    qrScannerElement.value.innerHTML = "";
  }
};

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
    errorMessage.value = error instanceof Error ? error.message : "The database could not be reached.";
  }
};

const handleCapturedUuid = (value: string, origin: "QR code" | "NFC tag") => {
  try {
    const nextUuid = normalizeUuid(value);
    uuid.value = nextUuid;
    source.value = origin;
    status.value = `UUID captured from ${origin}.`;
    errorMessage.value = "";
    stopQrScanner();
    void verifyUuid(nextUuid);
  } catch (error) {
    const message = error instanceof Error ? error.message : "A valid UUID could not be read.";
    errorMessage.value = message;
    status.value = `${origin} scan did not return a valid UUID.`;
  }
};

const readNfcPayload = (records: NfcRecord[]): string => {
  for (const record of records) {
    if (!record.data) {
      continue;
    }

    const decoded = new TextDecoder().decode(record.data);
    const cleaned = decoded.trim();

    if (cleaned) {
      return cleaned;
    }
  }

  return "";
};

const startQrScan = () => {
  errorMessage.value = "";
  stopQrScanner();

  if (!qrScannerElement.value) {
    errorMessage.value = "The camera container is not ready yet.";
    return;
  }

  status.value = "Opening camera. Point it at a QR code...";

  qrScanner = new Html5QrcodeScanner(
    "qr-reader",
    {
      fps: 10,
      qrbox: { width: 260, height: 260 },
      aspectRatio: 1,
    },
    false,
  );

  qrScanner.render(
    (decodedText) => {
      handleCapturedUuid(decodedText, "QR code");
    },
    () => {
      // Ignore scan errors while the camera keeps looking for a valid QR code.
    },
  );
};

const stopNfcScan = async () => {
  if (!nfcReader) {
    return;
  }

  if (typeof nfcReader.cancel === "function") {
    await nfcReader.cancel();
  }

  nfcReader = null;
};

const startNfcScan = async () => {
  const NDEFReaderCtor = (
    window as Window & {
      NDEFReader?: new () => NfcReaderLike;
    }
  ).NDEFReader;

  if (!NDEFReaderCtor) {
    errorMessage.value = "Web NFC is not supported in this browser or device. Enable NFC in the phone browser and try again.";
    status.value = "NFC unavailable";
    return;
  }

  try {
    errorMessage.value = "";
    status.value = "Waiting for an NFC tag...";

    const reader = new NDEFReaderCtor();
    nfcReader = reader;

    await reader.scan();

    reader.onreading = ({ message, serialNumber }) => {
      const discoveredValue = readNfcPayload(message.records) || serialNumber || "";

      if (discoveredValue) {
        handleCapturedUuid(discoveredValue, "NFC tag");
      } else {
        errorMessage.value = "The tag was read, but no UUID text was found in its payload.";
        status.value = "NFC tag read without UUID";
      }
    };

    reader.onreadingerror = () => {
      errorMessage.value = "The NFC tag could not be read. Please move it closer and try again.";
      status.value = "NFC read failed";
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "NFC scanning is not available on this device.";
    errorMessage.value = message;
    status.value = "NFC unavailable";
  }
};

const switchToGenerate = async () => {
  view.value = "generate";
  stopQrScanner();
  await stopNfcScan();
};

onBeforeUnmount(async () => {
  stopQrScanner();
  await stopNfcScan();
});
</script>

<template>
  <main class="app-shell">
    <nav class="tabs">
      <button type="button" :class="view === 'scan' ? 'primary' : 'secondary'" @click="view = 'scan'">Scan</button>
      <button type="button" :class="view === 'generate' ? 'primary' : 'secondary'" @click="switchToGenerate">
        Generate
      </button>
    </nav>

    <QrGenerator v-if="view === 'generate'" />

    <section v-show="view === 'scan'" class="panel">
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

      <div id="qr-reader" ref="qrScannerElement" class="scanner-box" aria-live="polite"></div>

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
  </main>
</template>
