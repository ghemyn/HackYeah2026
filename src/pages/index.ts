import { defineAsyncComponent, type Component } from "vue";

export type PageDefinition = {
  id: string;
  label: string;
  component: Component;
};

// Pages shown in the navbar once logged in, in this order. The first one opens after logging in.
// To add a page, create it in this folder and add one line here (keep one page per line to avoid merge conflicts).
// Pages are loaded lazily, so each one ends up in its own chunk.
export const pages: PageDefinition[] = [
  { id: "habits", label: "Habits", component: defineAsyncComponent(() => import("./HabitsPage.vue")) },
  { id: "scan", label: "Scan", component: defineAsyncComponent(() => import("./ScanPage.vue")) },
  { id: "friends", label: "Friends", component: defineAsyncComponent(() => import("./FriendsPage.vue")) },
  { id: "profile", label: "Profile", component: defineAsyncComponent(() => import("./ProfilePage.vue")) },
  // TODO(challenges): challengesPage.vue is still empty, and an empty .vue file fails the build.
  // Re-enable this line once the page has content. The path must match the file name's case exactly.
  // { id: "challenges", label: "Challenge", component: defineAsyncComponent(() => import("./challengesPage.vue")) },
];

export const findPage = (id: string): PageDefinition => pages.find((page) => page.id === id) ?? pages[0];
