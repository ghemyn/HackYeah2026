<script setup lang="ts">
defineProps<{ value: number }>();
</script>

<template>
  <Transition name="score" mode="out-in">
    <span :key="value" class="score-number">{{ value }}</span>
  </Transition>
</template>

<style scoped>
.score-number { display: inline-block; font-variant-numeric: tabular-nums; }
.score-enter-active, .score-leave-active { transition: opacity 150ms, transform 150ms; }
.score-enter-from { opacity: 0; transform: translateY(6px); }
.score-leave-to { opacity: 0; transform: translateY(-6px); }
</style>
