<script setup lang="ts">
import { computed, onBeforeUnmount, ref, useTemplateRef, watch } from "vue";
import { formatShortDate } from "../common";
import { useProfiles } from "../composables/useProfiles";
import type { Taunt } from "../db/taunts";
import { navigate } from "../navigation";

// A taunt at the viewer, laid over the habit's card until they check in. Its parent must be
// `position: relative` around the card. "Hide for now" shrinks it to a badge that slowly circles the
// inside edge of the card, so the card stays usable; a new taunt opens it again.
const props = defineProps<{
  taunt: Taunt;
  today: string;
}>();

const profiles = useProfiles(() => [props.taunt.fromId]);
const senderName = computed(() => profiles.value[props.taunt.fromId]?.nickname ?? props.taunt.fromId);
const expanded = ref(true);

// Pixels per second along the card's edge.
const ORBIT_SPEED = 40;
// Gap between the badge and the card's edge.
const ORBIT_INSET = 6;

const layer = useTemplateRef<HTMLElement>("layer");
const badge = useTemplateRef<HTMLElement>("badge");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
let frame = 0;
let lastTime: number | null = null;
// Distance travelled clockwise from the top-left corner; starts at the top-right corner.
let distance: number | null = null;

// Moves the badge along the edge of the card, clockwise. Sizes are read every frame, so it follows the
// card when it grows or shrinks. With reduced motion the badge stays in the top-right corner.
const moveBadge = (time: number) => {
  const layerElement = layer.value;
  const badgeElement = badge.value;

  if (!layerElement || !badgeElement) {
    return;
  }

  const width = Math.max(layerElement.clientWidth - badgeElement.offsetWidth - 2 * ORBIT_INSET, 0);
  const height = Math.max(layerElement.clientHeight - badgeElement.offsetHeight - 2 * ORBIT_INSET, 0);
  const perimeter = 2 * (width + height);

  if (distance === null) {
    distance = width;
  } else if (lastTime !== null && !reducedMotion.matches) {
    // Capped so the badge doesn't jump after the tab was in the background.
    distance += (ORBIT_SPEED * Math.min(time - lastTime, 100)) / 1000;
  }

  lastTime = time;
  const along = perimeter > 0 ? distance % perimeter : 0;
  let x = 0;
  let y = 0;

  if (along < width) {
    x = along;
  } else if (along < width + height) {
    x = width;
    y = along - width;
  } else if (along < 2 * width + height) {
    x = width - (along - width - height);
    y = height;
  } else {
    y = height - (along - 2 * width - height);
  }

  badgeElement.style.translate = `${x + ORBIT_INSET}px ${y + ORBIT_INSET}px`;
};

const stopOrbit = () => {
  cancelAnimationFrame(frame);
  lastTime = null;
};

const orbit = (time: number) => {
  moveBadge(time);
  frame = requestAnimationFrame(orbit);
};

// Runs while the badge is shown. Positioned at once, so it never flashes in the wrong place.
watch(badge, (badgeElement) => {
  stopOrbit();

  if (badgeElement) {
    distance = null;
    moveBadge(performance.now());
    frame = requestAnimationFrame(orbit);
  }
});

onBeforeUnmount(stopOrbit);

watch(
  () => [props.taunt.fromId, props.taunt.date, props.taunt.emojis.join(""), props.taunt.message].join("|"),
  () => {
    expanded.value = true;
  },
);
</script>

<template>
  <div ref="layer" class="taunt-layer">
    <Transition name="taunt-pop" mode="out-in" appear>
      <div v-if="expanded" key="overlay" class="taunt-overlay" role="status" aria-live="polite">
        <div class="taunt-content">
          <div class="taunt-emojis" aria-hidden="true">
            <span v-for="(emoji, index) in taunt.emojis" :key="emoji" :style="{ animationDelay: `${index * 120}ms` }">
              {{ emoji }}
            </span>
          </div>
          <strong>
            {{ profiles[taunt.fromId]?.avatar ?? "👑" }} {{ senderName }} taunts you
            <template v-if="taunt.date && taunt.date !== today"> (since {{ formatShortDate(taunt.date) }})</template>
          </strong>
          <p v-if="taunt.message">“{{ taunt.message }}”</p>
          <small>Check in by scanning the tag to cancel it.</small>
          <div class="taunt-actions">
            <button type="button" class="primary" @click="navigate('scan')">Scan to cancel →</button>
            <button type="button" class="secondary" @click="expanded = false">Hide for now</button>
          </div>
        </div>
      </div>
      <button
        v-else
        ref="badge"
        key="badge"
        type="button"
        class="taunt-badge"
        :aria-label="`Show ${senderName}'s taunt`"
        @click="expanded = true"
      >
        <span class="taunt-badge-emojis" aria-hidden="true">{{ taunt.emojis.join("") }}</span>
        Taunted
      </button>
    </Transition>
  </div>
</template>

<style scoped>
/* Covers the habit card; only the overlay and the badge catch clicks. */
.taunt-layer {
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
}

.taunt-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding: 24px 16px;
  overflow: auto;
  pointer-events: auto;
  background: rgba(255, 237, 224, 0.9);
  backdrop-filter: blur(3px);
  border: 2px solid var(--orange);
  border-radius: 4px;
  box-shadow: 0 12px 32px rgba(130, 59, 18, 0.18);
}

.taunt-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  max-width: 520px;
  text-align: center;
}

.taunt-emojis {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 6px;
  font-size: 2.6rem;
  line-height: 1.2;
}

.taunt-emojis span {
  display: inline-block;
  animation:
    taunt-bounce-in 500ms cubic-bezier(0.34, 1.56, 0.64, 1) both,
    taunt-wiggle 1.6s ease-in-out 700ms infinite;
}

.taunt-content strong {
  color: #823b12;
  overflow-wrap: anywhere;
}

.taunt-content p {
  margin: 0;
  font-size: 1.15rem;
  overflow-wrap: anywhere;
}

.taunt-content small {
  color: var(--muted);
}

.taunt-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
  margin-top: 8px;
}

.taunt-actions button {
  min-height: 44px;
}

/* Circles the inside edge of the card (moved with `translate` by moveBadge). */
.taunt-badge {
  position: absolute;
  top: 0;
  left: 0;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 44px;
  padding: 0.4rem 0.9rem;
  pointer-events: auto;
  background: #ffede0;
  color: #823b12;
  border: 2px solid var(--orange);
  border-radius: 999px;
  box-shadow: 0 6px 16px rgba(130, 59, 18, 0.18);
}

.taunt-badge-emojis {
  display: inline-block;
  font-size: 1.2rem;
  animation: taunt-wiggle 1.6s ease-in-out infinite;
}

.taunt-pop-enter-active {
  transition:
    opacity 250ms ease,
    transform 400ms cubic-bezier(0.34, 1.56, 0.64, 1);
}

.taunt-pop-leave-active {
  transition:
    opacity 180ms ease,
    transform 180ms ease;
}

.taunt-pop-enter-from,
.taunt-pop-leave-to {
  opacity: 0;
}

.taunt-overlay.taunt-pop-enter-from,
.taunt-overlay.taunt-pop-leave-to {
  transform: scale(0.92);
}

.taunt-badge.taunt-pop-enter-from,
.taunt-badge.taunt-pop-leave-to {
  transform: scale(0.6);
}

@keyframes taunt-bounce-in {
  from {
    opacity: 0;
    transform: translateY(-24px) scale(0.4);
  }

  to {
    opacity: 1;
    transform: none;
  }
}

@keyframes taunt-wiggle {
  0%,
  60%,
  100% {
    transform: rotate(0);
  }

  70% {
    transform: rotate(-14deg) scale(1.1);
  }

  80% {
    transform: rotate(12deg) scale(1.1);
  }

  90% {
    transform: rotate(-6deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .taunt-emojis span,
  .taunt-badge-emojis {
    animation: none;
  }

  .taunt-pop-enter-active,
  .taunt-pop-leave-active {
    transition: opacity 150ms ease;
  }

  .taunt-overlay.taunt-pop-enter-from,
  .taunt-overlay.taunt-pop-leave-to,
  .taunt-badge.taunt-pop-enter-from,
  .taunt-badge.taunt-pop-leave-to {
    transform: none;
  }
}
</style>
