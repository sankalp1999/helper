import { useEffect, useState } from "react";

let now = new Date();
const listeners = new Set<(date: Date) => void>();
let intervalId: NodeJS.Timeout | null = null;

const startTimer = () => {
  if (intervalId) return;
  intervalId = setInterval(() => {
    now = new Date();
    for (const listener of listeners) {
      listener(now);
    }
  }, 60000);
};

const stopTimer = () => {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
};

export function useNow() {
  const [nowValue, setNowValue] = useState(now);

  useEffect(() => {
    const callback = (newNow: Date) => setNowValue(newNow);

    listeners.add(callback);
    startTimer();

    return () => {
      listeners.delete(callback);
      if (listeners.size === 0) {
        stopTimer();
      }
    };
  }, []);

  return nowValue;
}
