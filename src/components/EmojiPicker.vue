<script setup lang="ts">
defineProps<{
  options: string[];
  label: string;
}>();

const selected = defineModel<string>({ required: true });
</script>

<template>
  <div class="emoji-picker" role="radiogroup" :aria-label="label">
    <button
      v-for="option in options"
      :key="option"
      type="button"
      role="radio"
      :aria-checked="selected === option"
      :class="{ selected: selected === option }"
      @click="selected = option"
    >
      {{ option }}
    </button>
  </div>
</template>

<style scoped>
.emoji-picker {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(52px, 1fr));
  gap: 8px;
}

.emoji-picker button {
  width: 100%;
  padding: 0.6rem 0;
  font-size: 1.5rem;
  line-height: 1;
  background: var(--line);
  border: 2px solid transparent;
}

.emoji-picker button.selected {
  border-color: #c93813;
  background: #ece7ff;
}
</style>
