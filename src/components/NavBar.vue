<script setup lang="ts">
import { navigate, currentPageId } from "../navigation";
import { pages } from "../pages";
import { sessionError } from "../session";
import ProfileMenu from "./ProfileMenu.vue";

const tabs = pages.filter((page) => !page.hideTab);
</script>

<template>
  <header class="navbar-wrap">
    <div class="brand-row">
      <div class="brand">HABIT<span>RIVALS</span></div>

      <ProfileMenu />
    </div>
    <nav class="navbar" aria-label="Main navigation">
      <div class="tabs">
        <button
          v-for="page in tabs"
          :key="page.id"
          type="button"
          :aria-current="currentPageId === page.id ? 'page' : undefined"
          :class="currentPageId === page.id ? 'primary' : 'secondary'"
          @click="navigate(page.id)"
        >
          {{ page.label }}
        </button>
      </div>
    </nav>

    <div v-if="sessionError" class="error-box">{{ sessionError }}</div>
  </header>
</template>

<style scoped>
.brand { font-size:1.8rem; font-weight:950; letter-spacing:-.07em; display:flex; align-items:center; }
.brand span { color:#c93813; }
.brand-row { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px 16px; }
.tabs .primary { background:var(--ink); color:var(--surface); }
.navbar-wrap {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: min(100%, 1080px);
  border-bottom: 2px solid var(--ink);
  padding-bottom: 20px;
}

.navbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
}

.tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tabs button {
  padding: 0.6rem 0.9rem;
}

.error-box {
  margin-bottom: 0;
}

@media (max-width: 640px) {
  .navbar {
    flex-direction: column;
    align-items: stretch;
  }

  .tabs button {
    flex: 1 1 30%;
    padding: 0.4rem 0.6rem;
    font-size: 0.9rem;
  }
}
</style>
