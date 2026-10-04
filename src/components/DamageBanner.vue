<script setup lang="ts">
import { onBeforeUnmount } from "vue";
import type { PenaltyAlert } from "../composables/usePenaltyAlerts";

// Points lost to missed check-ins, laid over the habit's card like a taunt. Pops in, stays for 2 seconds,
// then fades out over 2 seconds, and lets clicks through meanwhile. Its parent must be `position: relative` around the card.
const props = defineProps<{
  alert: PenaltyAlert;
}>();

const emit = defineEmits<{
  done: [];
}>();

// Shown for 2 seconds (including the 300ms pop-in), then the 2-second fade; must match the animation below.
const SHOWN_FOR_MS = 4000;

const timer = window.setTimeout(() => emit("done"), SHOWN_FOR_MS);
onBeforeUnmount(() => window.clearTimeout(timer));

const emojis = props.alert.lazySnail ? ["💥", "📉", "🐌"] : ["💥", "📉"];
</script>

<template>
  <div class="damage-overlay" role="status" aria-live="polite">
    <div class="damage-content">
      <div class="damage-emojis" aria-hidden="true">
        <span v-for="(emoji, index) in emojis" :key="emoji" :style="{ animationDelay: `${index * 120}ms` }">
          {{ emoji }}
        </span>
      </div>
      <strong class="damage-points">{{ alert.points }} pts</strong>
      <p>
        <template v-if="alert.misses === 1">You missed a check-in.</template>
        <template v-else-if="alert.misses">You missed {{ alert.misses }} check-ins.</template>
        <template v-else>You missed check-ins.</template>
        <template v-if="alert.lazySnail"> You're a Lazy Snail now!</template>
      </p>
    </div>
  </div>
</template>

<style scoped>
.damage-overlay {
  position: absolute;
  inset: 0;
  z-index: 3;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding: 24px 16px;
  overflow: hidden;
  pointer-events: none;
  background: rgba(255, 237, 224, 0.9);
  backdrop-filter: blur(3px);
  border: 2px solid var(--orange);
  border-radius: 4px;
  box-shadow: 0 12px 32px rgba(130, 59, 18, 0.18);
  animation: damage-show 4000ms linear forwards;
}

.damage-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  max-width: 520px;
  text-align: center;
}

.damage-emojis {
  display: flex;
  justify-content: center;
  gap: 6px;
  font-size: 2.6rem;
  line-height: 1.2;
}

.damage-emojis span {
  display: inline-block;
  animation: damage-bounce-in 500ms cubic-bezier(0.34, 1.56, 0.64, 1) both;
}

.damage-points {
  color: #a62e18;
  font-size: 1.8rem;
  font-variant-numeric: tabular-nums;
}

.damage-content p {
  margin: 0;
  font-size: 1.15rem;
  color: #823b12;
}

/* Of 4s: 0–7.5% is the 300ms pop-in, it stays until 50% (2s), then fades out over the last 2s. */
@keyframes damage-show {
  0% {
    opacity: 0;
    transform: scale(0.92);
    animation-timing-function: ease-out;
  }

  7.5% {
    opacity: 1;
    transform: scale(1);
  }

  50% {
    opacity: 1;
    transform: scale(1);
    animation-timing-function: ease-in;
  }

  100% {
    opacity: 0;
    transform: scale(1);
  }
}

@keyframes damage-bounce-in {
  from {
    opacity: 0;
    transform: translateY(-24px) scale(0.4);
  }

  to {
    opacity: 1;
    transform: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .damage-overlay {
    animation-name: damage-fade;
  }

  .damage-emojis span {
    animation: none;
  }
}

@keyframes damage-fade {
  0% {
    opacity: 0;
  }

  7.5% {
    opacity: 1;
  }

  50% {
    opacity: 1;
  }

  100% {
    opacity: 0;
  }
}
</style>
