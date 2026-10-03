<script setup lang="ts">
import { ref, watch } from "vue";
import QRCode from "qrcode";
import { toErrorMessage, toSafeFileName } from "../common";

const props = defineProps<{
  // Text encoded in the QR code.
  value: string;
  // Printed under the QR code and used as the download file name.
  caption: string;
}>();

const QR_SIZE = 320;
const CAPTION_HEIGHT = 56;

const imageUrl = ref("");
const errorMessage = ref("");

// Ignores renders that finish after a newer one has started.
let renderId = 0;

// Draws the QR code with the caption underneath so a printed or downloaded image is self-describing.
const renderImage = async (value: string, caption: string): Promise<string> => {
  const qrCanvas = document.createElement("canvas");
  await QRCode.toCanvas(qrCanvas, value, { width: QR_SIZE, margin: 2, errorCorrectionLevel: "M" });

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

  return canvas.toDataURL("image/png");
};

watch(
  () => [props.value, props.caption.trim()] as const,
  async ([value, caption]) => {
    const currentRender = ++renderId;

    try {
      const url = await renderImage(value, caption);

      if (currentRender === renderId) {
        imageUrl.value = url;
        errorMessage.value = "";
      }
    } catch (error) {
      if (currentRender === renderId) {
        imageUrl.value = "";
        errorMessage.value = toErrorMessage(error, "The QR code could not be generated.");
      }
    }
  },
  { immediate: true },
);

const download = () => {
  if (!imageUrl.value) {
    return;
  }

  const link = document.createElement("a");
  link.href = imageUrl.value;
  link.download = `${toSafeFileName(props.caption, "qr-code")}.png`;
  document.body.appendChild(link);
  link.click();
  link.remove();
};
</script>

<template>
  <div class="qr-card">
    <img v-if="imageUrl" :src="imageUrl" :alt="`QR code: ${caption}`" />
    <div v-if="errorMessage" class="error-box">{{ errorMessage }}</div>
    <code>{{ value }}</code>

    <div class="actions">
      <button type="button" class="secondary" :disabled="!imageUrl" @click="download">Download QR code</button>
      <slot name="actions" />
    </div>
  </div>
</template>

<style scoped>
.qr-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.qr-card img {
  width: min(100%, 260px);
  border-radius: 12px;
}

.qr-card code {
  word-break: break-all;
  font-size: 0.82rem;
  color: #94a3b8;
  text-align: center;
}

.qr-card .actions {
  justify-content: center;
  margin-bottom: 0;
}
</style>
