import { useEffect, useRef, useState, type MouseEvent } from "react";

export type ViewDomain = { xMin: number; xMax: number; yMin: number; yMax: number };

/** Zoom a [min, max] range around `focus`. factor < 1 zooms in, > 1 zooms out. */
export function zoomRange(min: number, max: number, focus: number, factor: number): [number, number] {
  return [focus - (focus - min) * factor, focus + (max - focus) * factor];
}

/** Shift a [min, max] range by `delta`. */
export function panRange(min: number, max: number, delta: number): [number, number] {
  return [min + delta, max + delta];
}

const MIN_SPAN = 1e-6;
const ZOOM_STEP = 0.85;

type Options = { onHover?: (x: number, y: number) => void };

/**
 * Interactive viewport (wheel zoom + drag pan) layered over a chart's base domain.
 * Returns the effective domain to render with, plus a ref + handlers for the plot rect.
 * The manual viewport is tagged with the base domain it was created for, so it is
 * automatically discarded when the base domain changes (new data, bounds, auto-scale)
 * — no reset effect required.
 */
export function useChartViewport(base: ViewDomain, options: Options = {}) {
  const [viewportState, setViewportState] = useState<{ key: string; domain: ViewDomain } | null>(null);
  const baseKey = `${base.xMin}|${base.xMax}|${base.yMin}|${base.yMax}`;
  const viewport = viewportState && viewportState.key === baseKey ? viewportState.domain : null;
  const domain = viewport ?? base;

  // The wheel listener is attached once; give it the latest domain/baseKey via a ref synced each render.
  const latestRef = useRef({ domain, baseKey });
  useEffect(() => {
    latestRef.current = { domain, baseKey };
  });

  const dragRef = useRef<{ startX: number; startY: number; domain: ViewDomain } | null>(null);
  const elRef = useRef<SVGRectElement | null>(null);

  // Wheel listeners are passive by default in React, so attach our own to allow preventDefault.
  useEffect(() => {
    const el = elRef.current;
    if (!el) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const { domain: current, baseKey: key } = latestRef.current;
      const focusX = current.xMin + ((event.clientX - rect.left) / rect.width) * (current.xMax - current.xMin);
      const focusY = current.yMax - ((event.clientY - rect.top) / rect.height) * (current.yMax - current.yMin);
      const factor = event.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
      const [xMin, xMax] = zoomRange(current.xMin, current.xMax, focusX, factor);
      const [yMin, yMax] = zoomRange(current.yMin, current.yMax, focusY, factor);
      if (xMax - xMin < MIN_SPAN || yMax - yMin < MIN_SPAN) return;
      setViewportState({ key, domain: { xMin, xMax, yMin, yMax } });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const plotRef = (el: SVGRectElement | null) => {
    elRef.current = el;
  };

  const plotHandlers = {
    onMouseDown: (event: MouseEvent<SVGRectElement>) => {
      dragRef.current = { startX: event.clientX, startY: event.clientY, domain };
    },
    onMouseMove: (event: MouseEvent<SVGRectElement>) => {
      const rect = event.currentTarget.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const drag = dragRef.current;
      if (drag) {
        const spanX = drag.domain.xMax - drag.domain.xMin;
        const spanY = drag.domain.yMax - drag.domain.yMin;
        const dx = ((event.clientX - drag.startX) / rect.width) * spanX;
        const dy = ((event.clientY - drag.startY) / rect.height) * spanY;
        const [xMin, xMax] = panRange(drag.domain.xMin, drag.domain.xMax, -dx);
        const [yMin, yMax] = panRange(drag.domain.yMin, drag.domain.yMax, dy);
        setViewportState({ key: baseKey, domain: { xMin, xMax, yMin, yMax } });
        return;
      }
      const x = domain.xMin + ((event.clientX - rect.left) / rect.width) * (domain.xMax - domain.xMin);
      const y = domain.yMax - ((event.clientY - rect.top) / rect.height) * (domain.yMax - domain.yMin);
      options.onHover?.(x, y);
    },
    onMouseUp: () => {
      dragRef.current = null;
    },
    onMouseLeave: () => {
      dragRef.current = null;
    },
    onDoubleClick: () => {
      setViewportState(null);
    },
  };

  return {
    domain,
    isZoomed: viewport !== null,
    reset: () => setViewportState(null),
    plotRef,
    plotHandlers,
  };
}
