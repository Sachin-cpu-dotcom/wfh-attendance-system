import { useEffect, useRef, useState } from "react";

const ACTIVITY_EVENTS = ["mousemove", "keydown", "click", "scroll", "touchstart"];

// Fires onIdle() once idleMinutes of true inactivity pass. Resets on any activity.
// Also exposes `idleSeconds` so callers can show "you were idle for Xm" in the popup.
export default function useIdleTimer(idleMinutes = 10, enabled = true) {
  const [isIdle, setIsIdle] = useState(false);
  const [idleSeconds, setIdleSeconds] = useState(0);
  const lastActivityRef = useRef(Date.now());

  useEffect(() => {
    if (!enabled) return;

    function markActive() {
      lastActivityRef.current = Date.now();
      setIsIdle(false);
      setIdleSeconds(0);
    }

    ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, markActive));

    const interval = setInterval(() => {
      const idleFor = Math.floor((Date.now() - lastActivityRef.current) / 1000);
      setIdleSeconds(idleFor);
      if (idleFor >= idleMinutes * 60) {
        setIsIdle(true);
      }
    }, 1000);

    return () => {
      ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, markActive));
      clearInterval(interval);
    };
  }, [idleMinutes, enabled]);

  function dismiss() {
    lastActivityRef.current = Date.now();
    setIsIdle(false);
    setIdleSeconds(0);
  }

  return { isIdle, idleSeconds, dismiss };
}
