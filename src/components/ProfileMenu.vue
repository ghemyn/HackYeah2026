<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, useTemplateRef, watch } from "vue";
import { currentPageId, navigate } from "../navigation";
import { pages } from "../pages";
import { currentUser, logout, profile } from "../session";

// The player's avatar and name; opens a menu with Profile and Log out.
const isOpen = ref(false);
const root = useTemplateRef<HTMLElement>("root");
const toggleButton = useTemplateRef<HTMLButtonElement>("toggle");
// In page order (refs inside v-for don't guarantee it).
const menuButtons = (): HTMLButtonElement[] => [
  ...(root.value?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? []),
];

const close = (returnFocus = false) => {
  isOpen.value = false;

  if (returnFocus) {
    toggleButton.value?.focus();
  }
};

const openProfile = () => {
  close();
  navigate("profile");
};

const logOut = () => {
  close();
  void logout();
  navigate(pages[0].id);
};

const menuItems = [
  { icon: "👤", label: "Profile", danger: false, action: openProfile },
  { icon: "↪", label: "Log out", danger: true, action: logOut },
];

// Closes when clicking anywhere else.
const onDocumentClick = (event: MouseEvent) => {
  if (root.value && !root.value.contains(event.target as Node)) {
    close();
  }
};

watch(isOpen, async (open) => {
  if (open) {
    document.addEventListener("click", onDocumentClick);
    await nextTick();
    menuButtons()[0]?.focus();
  } else {
    document.removeEventListener("click", onDocumentClick);
  }
});

onBeforeUnmount(() => document.removeEventListener("click", onDocumentClick));

// Arrow keys move between the items; Escape closes the menu.
const onMenuKeydown = (event: KeyboardEvent) => {
  const buttons = menuButtons();
  const index = buttons.indexOf(document.activeElement as HTMLButtonElement);

  if (event.key === "Escape") {
    event.preventDefault();
    close(true);
  } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    const step = event.key === "ArrowDown" ? 1 : -1;
    buttons[(index + step + buttons.length) % buttons.length]?.focus();
  } else if (event.key === "Tab") {
    close();
  }
};
</script>

<template>
  <div v-if="currentUser" ref="root" class="profile-menu">
    <button
      ref="toggle"
      type="button"
      class="profile-button"
      :class="{ active: currentPageId === 'profile' }"
      aria-haspopup="menu"
      :aria-expanded="isOpen"
      @click="isOpen = !isOpen"
      @keydown.down.prevent="isOpen = true"
    >
      <span class="profile-avatar" aria-hidden="true">{{ profile?.avatar ?? "…" }}</span>
      <strong>{{ currentUser.nickname }}</strong>
      <span class="profile-caret" aria-hidden="true">▾</span>
    </button>

    <div v-if="isOpen" class="profile-dropdown" role="menu" :aria-label="`${currentUser.nickname}'s menu`" @keydown="onMenuKeydown">
      <button
        v-for="item in menuItems"
        :key="item.label"
        type="button"
        role="menuitem"
        :class="{ danger: item.danger }"
        @click="item.action"
      >
        <span aria-hidden="true">{{ item.icon }}</span> {{ item.label }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.profile-menu {
  position: relative;
}

.profile-button {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 44px;
  padding: 0.35rem 0.75rem;
  background: transparent;
  color: var(--ink);
  border-color: var(--line);
  font-size: 0.92rem;
}

.profile-button.active {
  border-color: var(--ink);
}

.profile-avatar {
  font-size: 1.6rem;
  line-height: 1;
}

.profile-caret {
  font-size: 0.8rem;
  color: var(--muted);
}

.profile-dropdown {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  z-index: 20;
  display: flex;
  flex-direction: column;
  min-width: 180px;
  padding: 6px;
  /* The page's paper colour, a touch lighter so the menu still stands out. */
  background: #f8f6f0;
  border: 1px solid var(--ink);
  border-radius: 3px;
  box-shadow: 0 12px 28px rgba(23, 23, 23, 0.15);
}

.profile-dropdown button {
  min-height: 44px;
  padding: 0.5rem 0.75rem;
  text-align: left;
  background: transparent;
  color: var(--ink);
  border-color: transparent;
}

.profile-dropdown button.danger {
  color: #a62e18;
}

.profile-dropdown button:hover:not(:disabled),
.profile-dropdown button:focus-visible {
  transform: none;
  background: rgba(23, 23, 23, 0.06);
}
</style>
