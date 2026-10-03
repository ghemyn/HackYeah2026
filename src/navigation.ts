import { ref } from "vue";

// IDs must match the entries in src/pages/index.ts. Unknown IDs fall back to the first page.
export const currentPageId = ref("habits");

export const navigate = (pageId: string) => {
  currentPageId.value = pageId;
};
