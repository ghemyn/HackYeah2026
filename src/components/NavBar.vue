<script setup lang="ts">
import { navigate, currentPageId } from "../navigation";
import { pages } from "../pages";
import { currentUser, logout, profile, sessionError } from "../session";

const logOut = () => {
  void logout();
  navigate(pages[0].id);
};
</script>

<template>
  <header class="navbar-wrap">
    <div class="brand">HABIT<span>RIVALS</span><small>SHOW UP / TOGETHER</small></div>
    <nav class="navbar" aria-label="Main navigation">
      <div class="tabs">
        <button
          v-for="page in pages"
          :key="page.id"
          type="button"
          :aria-current="currentPageId === page.id ? 'page' : undefined"
          :class="currentPageId === page.id ? 'primary' : 'secondary'"
          @click="navigate(page.id)"
        >
          {{ page.label }}
        </button>
      </div>

      <div v-if="currentUser" class="user-badge">
        <span class="user-avatar" aria-hidden="true">{{ profile?.avatar ?? "…" }}</span>
        <span><strong>{{ currentUser.nickname }}</strong></span>
        <button type="button" class="secondary small" @click="logOut">Log out</button>
      </div>
    </nav>

    <div v-if="sessionError" class="error-box">{{ sessionError }}</div>
  </header>
</template>

<style scoped>
.brand { font-size:1.8rem; font-weight:950; letter-spacing:-.07em; display:flex; align-items:center; }
.brand span { color:#c93813; }
.brand small { margin-left:auto; font-size:.65rem; letter-spacing:.15em; color:var(--muted); }
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

.user-badge {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--ink);
  font-size: 0.92rem;
}

.user-badge strong {
  color: var(--ink);
}

.user-avatar {
  font-size: 1.6rem;
}

.error-box {
  margin-bottom: 0;
}

@media (max-width: 640px) {
  .navbar,
  .user-badge {
    flex-direction: column;
    align-items: stretch;
  }

  .tabs button {
    flex: 1 1 30%;
  }

  .user-badge {
    text-align: center;
  }
}
</style>
