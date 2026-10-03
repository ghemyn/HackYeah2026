<script setup lang="ts">
import { computed, ref } from "vue";
import QRCode from "qrcode";
import { saveTag } from "../firebase";

const QR_SIZE = 320;
const CAPTION_HEIGHT = 56;

const uuid = ref("");
const name = ref("");
const qrImageUrl = ref("");
const status = ref("Generate a UUID to create a QR code.");
const errorMessage = ref("");
const isSaving = ref(false);
const isSaved = ref(false);

const trimmedName = computed(() => name.value.trim());
const canSave = computed(() => Boolean(uuid.value && trimmedName.value && !isSaving.value && !isSaved.value));

// Draws the QR code with the name as a caption underneath so the downloaded image is self-describing.
const renderQrImage = async () => {
  if (!uuid.value) {
    qrImageUrl.value = "";
    return;
  }

  const qrCanvas = document.createElement("canvas");
  await QRCode.toCanvas(qrCanvas, uuid.value, { width: QR_SIZE, margin: 2, errorCorrectionLevel: "M" });

  const caption = trimmedName.value;
  const canvas = document.createElement("canvas");
  canvas.width = QR_SIZE;
  canvas.height = QR_SIZE + (caption ? CAPTION_HEIGHT : 0);

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas is not supported on this device.");
  }

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(qrCanvas, 0, 0);

  if (caption) {
    context.fillStyle = "#0f172a";
    context.font = "bold 22px Inter, 'Segoe UI', sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(caption, QR_SIZE / 2, QR_SIZE + CAPTION_HEIGHT / 2 - 8, QR_SIZE - 24);
  }

  qrImageUrl.value = canvas.toDataURL("image/png");
};

const generate = async () => {
  try {
    errorMessage.value = "";
    uuid.value = crypto.randomUUID();
    isSaved.value = false;
    await renderQrImage();
    status.value = "New UUID generated. Name it and save it to the database.";
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "The QR code could not be generated.";
  }
};

const onNameInput = async () => {
  isSaved.value = false;
  await renderQrImage().catch(() => undefined);
};

const save = async () => {
  if (!canSave.value) {
    return;
  }

  try {
    isSaving.value = true;
    errorMessage.value = "";
    status.value = "Saving to Firebase...";
    await saveTag({ uuid: uuid.value, name: trimmedName.value });
    isSaved.value = true;
    status.value = `Saved "${trimmedName.value}" to the database.`;
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Saving to Firebase failed.";
    status.value = "Save failed";
  } finally {
    isSaving.value = false;
  }
};

const download = () => {
  if (!qrImageUrl.value) {
    return;
  }

  const safeName = trimmedName.value.replace(/[^\p{L}\p{N}_-]+/gu, "_") || uuid.value;
  const link = document.createElement("a");
  link.href = qrImageUrl.value;
  link.download = `${safeName}.png`;
  document.body.appendChild(link);
  link.click();
  link.remove();
};
</script>

<template>
  <section class="panel">
    <div class="header">
      <p class="eyebrow">UUID generator</p>
      <h1>Create a QR code</h1>
    </div>

    <div class="actions">
      <button type="button" class="primary" @click="generate">Generate UUID</button>
    </div>

    <div class="status-row">
      <span class="status-pill">{{ status }}</span>
    </div>

    <div v-if="errorMessage" class="error-box">
      {{ errorMessage }}
    </div>

    <template v-if="uuid">
      <label class="field">
        <span>Name</span>
        <input v-model="name" type="text" maxlength="60" placeholder="e.g. Backpack" @input="onNameInput" />
      </label>

      <div class="qr-preview">
        <img v-if="qrImageUrl" :src="qrImageUrl" :alt="`QR code for ${trimmedName || uuid}`" />
        <code>{{ uuid }}</code>
      </div>

      <div class="actions">
        <button type="button" class="primary" :disabled="!canSave" @click="save">
          {{ isSaving ? "Saving..." : isSaved ? "Saved" : "Save to database" }}
        </button>
        <button type="button" class="secondary" :disabled="!qrImageUrl" @click="download">Download QR code</button>
      </div>
    </template>
  </section>
</template>

<style scoped>
.field {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 18px;
}

.field span {
  font-size: 0.82rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: #99f6e4;
}

.field input {
  font: inherit;
  padding: 0.8rem 1rem;
  border-radius: 12px;
  border: 1px solid rgba(148, 163, 184, 0.3);
  background: rgba(15, 23, 42, 0.8);
  color: #e2e8f0;
}

.qr-preview {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  margin-bottom: 18px;
}

.qr-preview img {
  width: min(100%, 320px);
  border-radius: 12px;
}

.qr-preview code {
  word-break: break-all;
  color: #cbd5e1;
}
</style>
