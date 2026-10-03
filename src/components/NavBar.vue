<script setup lang="ts">
import { navigate, currentPageId } from "../navigation";
import { pages } from "../pages";
import { currentUser, logout, profile, sessionError } from "../session";

const logOut = () => {
  logout();
  navigate(pages[0].id);
};
</script>

<template>
  <header class="navbar-wrap">
    <nav class="navbar">
      <div class="tabs">
        <button
          v-for="page in pages"
          :key="page.id"
          type="button"
          :class="currentPageId === page.id ? 'primary' : 'secondary'"
          @click="navigate(page.id)"
        >
          {{ page.label }}
        </button>
      </div>

      <div v-if="currentUser" class="user-badge">
        <span class="user-avatar" aria-hidden="true">{{ profile?.avatar ?? "…" }}</span>
        <span>
          Logged in as <strong>{{ currentUser.nickname }}</strong>
          <template v-if="profile"> · {{ profile.totalPoints }} pts</template>
        </span>
        <button type="button" class="secondary small" @click="logOut">Log out</button>
      </div>
    </nav>

    <div v-if="sessionError" class="error-box">{{ sessionError }}</div>
  </header>
</template>

<style scoped>
.navbar-wrap {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: min(100%, 720px);
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
  color: #cbd5e1;
  font-size: 0.92rem;
}

.user-badge strong {
  color: white;
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
