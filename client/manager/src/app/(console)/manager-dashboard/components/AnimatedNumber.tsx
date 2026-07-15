"use client";

import { useEffect, useRef, useState } from "react";

interface AnimatedNumberProps {
  value: number;
  format: (value: number) => string;
  /** Tween duration in milliseconds. */
  duration?: number;
  className?: string;
}

const easeOutCubic = (progress: number) => 1 - Math.pow(1 - progress, 3);

/**
 * Renders a number that tweens between its previous and next value whenever `value`
 * changes, so periodic refreshes read as a smooth count instead of a hard jump. The
 * first value is shown immediately (no count-up from 0), and each change briefly
 * pulses the text green (increase) or red (decrease).
 */
export function AnimatedNumber({ value, format, duration = 700, className }: AnimatedNumberProps) {
  const safeValue = Number.isFinite(value) ? value : 0;
  const [display, setDisplay] = useState(safeValue);
  const displayRef = useRef(safeValue);
  const frameRef = useRef<number | null>(null);
  const mountedRef = useRef(false);
  const [pulse, setPulse] = useState<"up" | "down" | null>(null);

  useEffect(() => {
    // First render shows the value as-is; we only animate later changes.
    if (!mountedRef.current) {
      mountedRef.current = true;
      displayRef.current = safeValue;
      setDisplay(safeValue);
      return;
    }

    const from = displayRef.current;
    const to = safeValue;
    if (from === to) {
      return;
    }

    setPulse(to > from ? "up" : "down");

    const startTime = performance.now();
    const step = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const current = from + (to - from) * easeOutCubic(progress);
      displayRef.current = current;
      setDisplay(current);
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(step);
      } else {
        displayRef.current = to;
        setDisplay(to);
        frameRef.current = null;
      }
    };

    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
    }
    frameRef.current = requestAnimationFrame(step);

    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [safeValue, duration]);

  // Clear the pulse highlight once its animation finishes.
  useEffect(() => {
    if (!pulse) {
      return;
    }
    const timer = window.setTimeout(() => setPulse(null), duration);
    return () => window.clearTimeout(timer);
  }, [pulse, duration]);

  const pulseClass = pulse ? ` manager-animated-number--${pulse}` : "";
  return (
    <span className={`manager-animated-number${pulseClass}${className ? ` ${className}` : ""}`}>
      {format(display)}
    </span>
  );
}
