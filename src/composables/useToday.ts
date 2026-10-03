import { onBeforeUnmount, ref } from "vue";
import { todayKey } from "../common";

// Today's date key, kept up to date if the app stays open past midnight.
export const useToday = () => {
  const today = ref(todayKey());
  const timer = window.setInterval(() => {
    const next = todayKey();

    if (next !== today.value) {
      today.value = next;
    }
  }, 60_000);

  onBeforeUnmount(() => window.clearInterval(timer));

  return today;
};
