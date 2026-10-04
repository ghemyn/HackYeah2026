<script setup lang="ts">
import { computed } from "vue";
import DebugMenu from "./components/DebugMenu.vue";
import NavBar from "./components/NavBar.vue";
import { currentPageId } from "./navigation";
import { findPage } from "./pages";
import LoginPage from "./pages/LoginPage.vue";
import { authReady, currentUser } from "./session";

const currentPage = computed(() => findPage(currentPageId.value));

// Date emulation for testing, shown in development and production. A build with VITE_DEBUG_MENU=false hides it.
const showDebugMenu = import.meta.env.VITE_DEBUG_MENU !== "false";

</script>

<template>
  <main class="app-shell">
    <p v-if="!authReady" class="hint">Loading...</p>
    <LoginPage v-else-if="!currentUser" />

    <template v-else>
      <NavBar />
      <component :is="currentPage.component" :key="currentPage.id" />
    </template>
  </main>
  <DebugMenu v-if="showDebugMenu" />
</template>
