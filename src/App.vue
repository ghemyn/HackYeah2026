<script setup lang="ts">
import { computed } from "vue";
import NavBar from "./components/NavBar.vue";
import { currentPageId } from "./navigation";
import { findPage } from "./pages";
import LoginPage from "./pages/LoginPage.vue";
import { currentUser } from "./session";

const currentPage = computed(() => findPage(currentPageId.value));
</script>

<template>
  <main class="app-shell">
    <LoginPage v-if="!currentUser" />

    <template v-else>
      <NavBar />
      <component :is="currentPage.component" :key="currentPage.id" />
    </template>
  </main>
</template>
