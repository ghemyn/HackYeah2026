<script setup lang="ts">
import { onBeforeUnmount, ref } from "vue";
import { normalizeUuid, toErrorMessage } from "../common";
import { findTag } from "../firebase";
import { NfcScanner } from "../scanners/nfcScanner";
import { QrScanner } from "../scanners/qrScanner";

type ScanOrigin = "Kod QR" | "Tag NFC";

const QR_READER_ID = "qr-reader";

const uuid = ref("");
const source = ref("Jeszcze nie zeskanowano");
const status = ref("Gotowy do skanowania wyzwania / znajomego");
const errorMessage = ref("");
const lookup = ref<"idle" | "checking" | "found" | "missing" | "error">("idle");
const tagName = ref("");

const qrScanner = new QrScanner(QR_READER_ID);
const nfcScanner = new NfcScanner();

// Zabezpieczenie przed wyścigiem zapytań do bazy
let lookupId = 0;

const stopAllScanners = () => {
  qrScanner.stop();
  nfcScanner.stop();
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
    errorMessage.value = toErrorMessage(error, "Brak połączenia z bazą danych Firebase.");
  }
};

const handleCapturedUuid = (value: string, origin: ScanOrigin) => {
  try {
    const nextUuid = normalizeUuid(value);
    uuid.value = nextUuid;
    source.value = origin;
    status.value = `Pobrano kod przez: ${origin}.`;
    errorMessage.value = "";
    stopAllScanners();
    void verifyUuid(nextUuid);
  } catch (error) {
    errorMessage.value = toErrorMessage(error, "Nie udało się odczytać poprawnego kodu UUID.");
    status.value = `Skanowanie (${origin}) nie zwróciło poprawnego kodu.`;
  }
};

const startQrScan = async () => {
  try {
    stopAllScanners();
    errorMessage.value = "";
    status.value = "Uruchamianie kamery... Nakieruj na kod QR znajomego.";
    await qrScanner.start((decodedText) => handleCapturedUuid(decodedText, "Kod QR"));
  } catch (error) {
    errorMessage.value = toErrorMessage(error, "Brak dostępu do kamery.");
    status.value = "Kamera niedostępna";
  }
};

const startNfcScan = async () => {
  try {
    stopAllScanners();
    errorMessage.value = "";
    status.value = "Zbliż telefon do tagu NFC / telefonu znajomego...";

    await nfcScanner.start({
      onRead: (value) => {
        if (value) {
          handleCapturedUuid(value, "Tag NFC");
        } else {
          errorMessage.value = "Odczytano tag NFC, ale nie zawierał on kodu UUID.";
          status.value = "Pusty tag NFC";
        }
      },
      onReadError: () => {
        errorMessage.value = "Nie udało się odczytać NFC. Przytrzymaj bliżej i spróbuj ponownie.";
        status.value = "Błąd odczytu NFC";
      },
    });
  } catch (error) {
    errorMessage.value = toErrorMessage(error, "Skanowanie NFC nie jest obsługiwane na tym urządzeniu.");
    status.value = "NFC niedostępne";
  }
};

onBeforeUnmount(() => {
  stopAllScanners();
});
</script>

<template>
  <section class="panel">
    <div class="header">
      <p class="eyebrow">Skaner Wyzwań</p>
      <h1>Zeskanuj kod QR lub NFC znajomego</h1>
    </div>

    <div class="actions">
      <button type="button" class="primary" @click="startQrScan">📷 Skanuj kod QR</button>
      <button type="button" class="secondary" @click="startNfcScan">📲 Zbliż NFC</button>
    </div>

    <div class="status-row">
      <span class="status-pill">{{ status }}</span>
    </div>

    <div v-if="errorMessage" class="error-box">
      {{ errorMessage }}
    </div>

    <div :id="QR_READER_ID" class="scanner-box" aria-live="polite"></div>

    <div class="uuid-card">
      <label>Zeskanowany Identyfikator</label>
      <div class="uuid-value">{{ uuid || "Brak zeskanowanego kodu" }}</div>
      <small>Źródło: {{ source }}</small>
      <div v-if="lookup !== 'idle'" class="lookup" :class="lookup">
        <template v-if="lookup === 'checking'">Sprawdzanie w bazie Firebase...</template>
        <template v-else-if="lookup === 'found'">
          <span>Znaleziono w bazie jako:</span>
          <strong>{{ tagName }}</strong>
        </template>
        <template v-else-if="lookup === 'missing'">Ten kod nie jest jeszcze przypisany w bazie.</template>
        <template v-else>Nie udało się zweryfikować kodu.</template>
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

/* Odbicie lustrzane kamery wewnątrz skanera QR */
.scanner-box :deep(video) {
  transform: scaleX(-1) !important;
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