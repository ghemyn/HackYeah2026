import { ref } from "vue";

// IDs must match the entries in src/pages/index.ts.
export const currentPageId = ref("scan");

export const navigate = (pageId: string) => {
  currentPageId.value = pageId;
};
