`<script setup lang="ts">
import { onBeforeUnmount, ref } from "vue";
import { Html5QrcodeScanner } from "html5-qrcode";

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

const handleCapturedUuid = (value: string, origin: "QR code" | "NFC tag") => {
  try {
    const nextUuid = normalizeUuid(value);
    uuid.value = nextUuid;
    source.value = origin;
    status.value = `UUID captured from ${origin}.`;
    errorMessage.value = "";
    stopQrScanner();
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

onBeforeUnmount(async () => {
  stopQrScanner();
  await stopNfcScan();
});
</script>

<template>
  <main class="app-shell">
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

      <div id="qr-reader" ref="qrScannerElement" class="scanner-box" aria-live="polite"></div>

      <div class="uuid-card">
        <label>Captured UUID</label>
        <div class="uuid-value">{{ uuid || "No UUID captured yet" }}</div>
        <small>Source: {{ source }}</small>
      </div>
    </section>
  </main>
</template>

<style scoped>
:global(body) {
  margin: 0;
  min-height: 100vh;
  background: linear-gradient(135deg, #0f172a 0%, #111827 100%);
  font-family: Inter, "Segoe UI", sans-serif;
  color: #e2e8f0;
}

* {
  box-sizing: border-box;
}

button {
  font: inherit;
}

.app-shell {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 24px;
}

.panel {
  width: min(100%, 720px);
  background: rgba(15, 23, 42, 0.86);
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 24px;
  box-shadow: 0 24px 60px rgba(15, 23, 42, 0.45);
  padding: 24px;
}

.header {
  margin-bottom: 18px;
}

.eyebrow {
  margin: 0 0 8px;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-size: 0.72rem;
  color: #60a5fa;
}

h1 {
  margin: 0;
  font-size: clamp(2rem, 4vw, 3rem);
  line-height: 1.1;
}

.actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 18px;
}

button {
  border: none;
  border-radius: 12px;
  padding: 0.9rem 1.2rem;
  font-weight: 700;
  cursor: pointer;
  transition: transform 0.2s ease, opacity 0.2s ease;
}

button:hover {
  transform: translateY(-1px);
}

.primary {
  background: linear-gradient(135deg, #38bdf8 0%, #2563eb 100%);
  color: white;
}

.secondary {
  background: rgba(148, 163, 184, 0.14);
  color: #e2e8f0;
  border: 1px solid rgba(148, 163, 184, 0.2);
}

.status-row {
  margin-bottom: 14px;
}

.status-pill {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 0.45rem 0.8rem;
  background: rgba(56, 189, 248, 0.12);
  border: 1px solid rgba(56, 189, 248, 0.2);
  color: #bae6fd;
  font-size: 0.88rem;
}

.error-box {
  margin-bottom: 16px;
  padding: 0.9rem 1rem;
  border-radius: 12px;
  background: rgba(239, 68, 68, 0.12);
  border: 1px solid rgba(248, 113, 113, 0.4);
  color: #fecaca;
}

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

@media (max-width: 640px) {
  .panel {
    padding: 18px;
  }

  .actions {
    flex-direction: column;
  }

  button {
    width: 100%;
  }
}
</style>
`