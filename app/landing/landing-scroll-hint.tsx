"use client";

import { useEffect, useState } from "react";

const REMINDER_DELAY_MS = 4000;
const HORIZONTAL_GESTURE_THRESHOLD_PX = 18;

function DownArrow({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3v17m-7-7 7 7 7-7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function LandingScrollHint() {
  const [reminder, setReminder] = useState(false);

  useEffect(() => {
    let timer: number | undefined;
    let touchStart: { x: number; y: number } | null = null;

    const isAtPageEnd = () =>
      window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 48;

    const clearReminderTimer = () => {
      if (timer !== undefined) window.clearTimeout(timer);
      timer = undefined;
    };

    const scheduleReminder = () => {
      clearReminderTimer();
      if (isAtPageEnd()) return;
      timer = window.setTimeout(() => {
        if (!isAtPageEnd()) setReminder(true);
      }, REMINDER_DELAY_MS);
    };

    const showReminder = () => {
      if (isAtPageEnd()) return;
      clearReminderTimer();
      setReminder(true);
    };

    const handleScroll = () => {
      setReminder(false);
      scheduleReminder();
    };

    const handlePointerDown = () => {
      setReminder(false);
      scheduleReminder();
    };

    const handleWheel = (event: WheelEvent) => {
      const wheelScale = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerWidth : 1;
      const horizontal = Math.abs(event.deltaX) * wheelScale;
      const vertical = Math.abs(event.deltaY) * wheelScale;
      const shiftedWheel = event.shiftKey && vertical >= HORIZONTAL_GESTURE_THRESHOLD_PX;
      if (
        shiftedWheel ||
        (horizontal >= HORIZONTAL_GESTURE_THRESHOLD_PX && horizontal > vertical * 1.35)
      ) {
        showReminder();
      }
    };

    const handleTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) {
        touchStart = null;
        return;
      }
      const touch = event.touches[0];
      touchStart = { x: touch.clientX, y: touch.clientY };
    };

    const handleTouchEnd = (event: TouchEvent) => {
      const start = touchStart;
      touchStart = null;
      if (!start || event.changedTouches.length !== 1) return;

      const touch = event.changedTouches[0];
      const horizontal = Math.abs(touch.clientX - start.x);
      const vertical = Math.abs(touch.clientY - start.y);
      if (
        horizontal >= 42 &&
        horizontal > vertical * 1.35
      ) {
        showReminder();
      }
    };

    const handleTouchCancel = () => {
      touchStart = null;
    };

    scheduleReminder();

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("pointerdown", handlePointerDown, { passive: true });
    window.addEventListener("wheel", handleWheel, { passive: true });
    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchend", handleTouchEnd, { passive: true });
    window.addEventListener("touchcancel", handleTouchCancel, { passive: true });

    return () => {
      clearReminderTimer();
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("wheel", handleWheel);
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchend", handleTouchEnd);
      window.removeEventListener("touchcancel", handleTouchCancel);
    };
  }, []);

  if (!reminder) return null;

  return (
    <div className="garage-scroll-hint" role="status" aria-atomic="true">
      <DownArrow className="garage-scroll-hint__arrow" />
      <span>Deslize pra cima ou pra baixo</span>
    </div>
  );
}
