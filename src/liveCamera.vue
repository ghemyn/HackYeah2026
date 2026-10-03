<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from "vue";

const emit = defineEmits<{
  (e: "photoTaken", dataUrl: string): void;
}>();

const videoRef = ref<HTMLVideoElement | null>(null);
const canvasRef = ref<HTMLCanvasElement | null>(null);
const isMirrored = ref(true);
const facingMode = ref<"user" | "environment">("user");
let stream: MediaStream | null = null;

async function startCamera() {
  stopCamera();
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: facingMode.value },
      audio: false,
    });
    if (videoRef.value) {
      videoRef.value.srcObject = stream;
    }
  } catch (err) {
    console.error("Błąd dostępu do kamery:", err);
  }
}

function stopCamera() {
  if (stream) {
    stream.getTracks().forEach((track) => track.stop());
    stream = null;
  }
}

function toggleCamera() {
  facingMode.value = facingMode.value === "user" ? "environment" : "user";
  isMirrored.value = facingMode.value === "user";
  startCamera();
}

function takePhoto() {
  const video = videoRef.value;
  const canvas = canvasRef.value;
  if (!video || !canvas) return;

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  if (isMirrored.value) {
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
  }

  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
  emit("photoTaken", dataUrl);
}

onMounted(() => {
  startCamera();
});

onBeforeUnmount(() => {
  stopCamera();
});
</script>

<template>
  <div class="camera-box">
    <video
      ref="videoRef"
      autoplay
      playsinline
      muted
      :class="{ mirrored: isMirrored }"
    ></video>
    <canvas ref="canvasRef" style="display: none"></canvas>

    <div class="controls">
      <button type="button" class="btn-small" @click="isMirrored = !isMirrored">
        🪞 Lustro: {{ isMirrored ? "ON" : "OFF" }}
      </button>
      <button type="button" class="btn-snap" @click="takePhoto" title="Zrób zdjęcie"></button>
      <button type="button" class="btn-small" @click="toggleCamera">
        🔄 Obróć
      </button>
    </div>
  </div>
</template>

<style scoped>
.camera-box {
  position: relative;
  width: 100%;
  max-width: 420px;
  margin: 0 auto;
  border-radius: 16px;
  overflow: hidden;
  background: #000;
}
video {
  width: 100%;
  height: 340px;
  object-fit: cover;
  display: block;
}
video.mirrored {
  transform: scaleX(-1);
}
.controls {
  position: absolute;
  bottom: 14px;
  left: 0;
  right: 0;
  display: flex;
  justify-content: space-around;
  align-items: center;
  padding: 0 16px;
}
.btn-small {
  background: rgba(0, 0, 0, 0.7);
  color: #fff;
  border: 1px solid #444;
  padding: 8px 12px;
  border-radius: 12px;
  font-size: 12px;
  cursor: pointer;
}
.btn-snap {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background: #fff;
  border: 4px solid #6366f1;
  cursor: pointer;
}
</style>