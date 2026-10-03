<script setup lang="ts">
import { currentPageId, navigate } from "../navigation";
import { pages } from "../pages";
import { currentUser, setCurrentUser } from "../session";

const logout = () => {
  setCurrentUser(null);
  navigate(pages[0].id);
};
</script>

<template>
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
      <span>Logged in as <strong>{{ currentUser.nickname }}</strong></span>
      <button type="button" class="secondary logout" @click="logout">Log out</button>
    </div>
  </nav>
</template>

<style scoped>
.navbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  width: min(100%, 720px);
}

.tabs {
  display: flex;
  gap: 8px;
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

.user-badge .logout {
  padding: 0.5rem 0.9rem;
}

@media (max-width: 640px) {
  .navbar,
  .user-badge {
    flex-direction: column;
    align-items: stretch;
  }

  .user-badge {
    text-align: center;
  }
}
</style>
