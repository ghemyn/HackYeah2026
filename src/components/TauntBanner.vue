<script setup lang="ts">
import { formatShortDate } from "../common";
import { useProfiles } from "../composables/useProfiles";
import type { Taunt } from "../db/taunts";

// A taunt at the viewer, shown above the habit's card until they check in.
const props = defineProps<{
  taunt: Taunt;
  today: string;
}>();

const profiles = useProfiles(() => [props.taunt.fromId]);
</script>

<template>
  <div class="taunt-banner" role="status">
    <span class="taunt-emojis" aria-hidden="true">{{ taunt.emojis.join(" ") }}</span>
    <div class="taunt-text">
      <strong>
        {{ profiles[taunt.fromId]?.avatar ?? "👑" }} {{ profiles[taunt.fromId]?.nickname ?? taunt.fromId }} taunts you
        <template v-if="taunt.date && taunt.date !== today"> (since {{ formatShortDate(taunt.date) }})</template>
      </strong>
      <p v-if="taunt.message">“{{ taunt.message }}”</p>
      <small>Check in by scanning the tag to cancel it.</small>
    </div>
  </div>
</template>

<style scoped>
.taunt-banner {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 4px;
  background: rgba(249, 115, 22, 0.12);
  border: 1px solid rgba(251, 146, 60, 0.45);
}

.taunt-emojis {
  font-size: 1.6rem;
  line-height: 1.2;
  max-width: 40%;
  overflow-wrap: anywhere;
}

.taunt-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}

.taunt-text strong {
  color: #823b12;
  overflow-wrap: anywhere;
}

.taunt-text p {
  margin: 0;
  font-size: 1.05rem;
  overflow-wrap: anywhere;
}

.taunt-text small {
  color: var(--muted);
}
</style>
