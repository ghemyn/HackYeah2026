import { defineAsyncComponent, type Component } from "vue";

export type PageDefinition = {
  id: string;
  label: string;
  component: Component;
};

// Pages shown in the navbar once logged in. To add a page, create it in this folder and add one entry here.
// Pages are loaded lazily, so each one ends up in its own chunk.
export const pages: PageDefinition[] = [
  { id: "scan", label: "Scan", component: defineAsyncComponent(() => import("./QrScannerPage.vue")) },
  { id: "generate", label: "Generate", component: defineAsyncComponent(() => import("./QrGeneratorPage.vue")) },
];

export const findPage = (id: string): PageDefinition => pages.find((page) => page.id === id) ?? pages[0];
