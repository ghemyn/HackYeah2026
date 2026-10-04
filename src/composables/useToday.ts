import { onBeforeUnmount, ref } from "vue";
import { onDayOffsetChange, todayKey } from "../common";

// Today's date key, kept up to date if the app stays open past midnight or the debug menu changes the date.
export const useToday = () => {
  const today = ref(todayKey());
  const update = () => {
    const next = todayKey();

    if (next !== today.value) {
      today.value = next;
    }
  };
  const timer = window.setInterval(update, 60_000);
  const stopListening = onDayOffsetChange(update);

  onBeforeUnmount(() => {
    window.clearInterval(timer);
    stopListening();
  });

  return today;
};
