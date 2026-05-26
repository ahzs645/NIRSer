import { useEffect, useRef, useState } from "react";

/**
 * Tracks an element's content-box size via ResizeObserver so charts can render at
 * real pixel dimensions and fill their container (no fixed-viewBox letterboxing).
 * Falls back to `fallback` when ResizeObserver is unavailable (e.g. jsdom tests)
 * or before the first measurement, so charts still draw something measurable.
 */
export function useElementSize<T extends HTMLElement>(fallback: { width: number; height: number }) {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState(fallback);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect && rect.width > 0 && rect.height > 0) {
        setSize({ width: rect.width, height: rect.height });
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, width: size.width, height: size.height };
}
