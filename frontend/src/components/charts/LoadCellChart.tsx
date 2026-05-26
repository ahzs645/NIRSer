import type { Point } from "../../types/nirs";
import { formatNumber } from "../../lib/utils";
import { useChartViewport } from "../../lib/chartViewport";

export type LoadCellOverlay = {
  min: Point;
  max: Point;
  slope: number;
  intercept: number;
};

export function LoadCellChart({
  data,
  marks,
  yDomain = [-2, 2],
  onCoordinate,
  overlay,
  overlayWindow,
}: {
  data: Point[];
  marks: number[];
  yDomain?: [number, number];
  onCoordinate?: (coordinate: { chart: string; x: number; y: number }) => void;
  overlay?: LoadCellOverlay;
  overlayWindow?: [number, number];
}) {
  const width = 920;
  const height = 150;
  const pad = { left: 56, right: 14, top: 10, bottom: 28 };
  const baseMinX = data[0]?.time ?? 0;
  const baseMaxX = data.at(-1)?.time ?? 1;
  const { domain, isZoomed, reset, plotRef, plotHandlers } = useChartViewport(
    { xMin: baseMinX, xMax: baseMaxX, yMin: yDomain[0], yMax: yDomain[1] },
    { onHover: onCoordinate ? (x, y) => onCoordinate({ chart: "Load Cell", x, y }) : undefined },
  );
  const minX = domain.xMin;
  const maxX = domain.xMax;
  const minY = domain.yMin;
  const maxY = domain.yMax;
  const spanX = Math.max(0.001, maxX - minX);
  const spanY = Math.max(0.001, maxY - minY);
  const x = (time: number) => pad.left + ((time - minX) / spanX) * (width - pad.left - pad.right);
  const y = (value: number) => {
    const clamped = Math.min(maxY, Math.max(minY, value));
    return height - pad.bottom - ((clamped - minY) / spanY) * (height - pad.top - pad.bottom);
  };
  const path = data.map((point, index) => `${index === 0 ? "M" : "L"}${x(point.time).toFixed(2)},${y(point.value).toFixed(2)}`).join(" ");

  return (
    <section className="h-full min-h-[180px]">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">Load Cell</h3>
        <div className="flex items-center gap-2">
          {isZoomed && (
            <button
              type="button"
              onClick={reset}
              className="rounded border border-slate-200 px-2 py-0.5 text-[11px] text-slate-600 hover:bg-slate-50"
            >
              Reset zoom
            </button>
          )}
          <span className="text-xs text-slate-500">{data.length} points</span>
        </div>
      </div>
      <svg className="h-[calc(100%-28px)] w-full" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Load Cell">
        <rect x={pad.left} y={pad.top} width={width - pad.left - pad.right} height={height - pad.top - pad.bottom} fill="#fbfdfe" />
        {[0, 0.5, 1].map((tick) => (
          <g key={tick}>
            <line x1={pad.left} x2={width - pad.right} y1={pad.top + tick * (height - pad.top - pad.bottom)} y2={pad.top + tick * (height - pad.top - pad.bottom)} stroke="#e8eef2" />
            <text x={6} y={pad.top + tick * (height - pad.top - pad.bottom) + 4} className="fill-slate-500 text-[11px]">
              {formatNumber(maxY - tick * spanY, 1)}
            </text>
          </g>
        ))}
        <text
          x={14}
          y={pad.top + (height - pad.top - pad.bottom) / 2}
          className="origin-center -rotate-90 fill-slate-500 text-[11px]"
          textAnchor="middle"
        >
          Data (lbs)
        </text>
        {marks.filter((mark) => mark >= minX && mark <= maxX).map((mark) => (
          <line key={mark} x1={x(mark)} x2={x(mark)} y1={pad.top} y2={height - pad.bottom} stroke="#111827" strokeDasharray="4 4" />
        ))}
        <path d={path} fill="none" stroke="#0f766e" strokeWidth="2" />
        <text x={pad.left} y={height - 6} className="fill-slate-500 text-[11px]">{formatNumber(minX, 1)}s</text>
        <text x={width - pad.right - 44} y={height - 6} className="fill-slate-500 text-[11px]">{formatNumber(maxX, 1)}s</text>
        <text x={(width + pad.left - pad.right) / 2} y={height - 6} className="fill-slate-500 text-[11px]" textAnchor="middle">Time (s)</text>
        <rect
          ref={plotRef}
          x={pad.left}
          y={pad.top}
          width={width - pad.left - pad.right}
          height={height - pad.top - pad.bottom}
          fill="transparent"
          className="cursor-crosshair"
          {...plotHandlers}
        />
        {overlay && (() => {
          const color = "#b45309";
          const start = overlayWindow ? Math.max(minX, overlayWindow[0]) : minX;
          const end = overlayWindow ? Math.min(maxX, overlayWindow[1]) : maxX;
          const yAt = (time: number) => overlay.intercept + overlay.slope * time;
          const lineVisible = end > start && Number.isFinite(yAt(start)) && Number.isFinite(yAt(end));
          return (
            <g pointerEvents="none">
              {lineVisible && (
                <line x1={x(start)} y1={y(yAt(start))} x2={x(end)} y2={y(yAt(end))} stroke={color} strokeWidth="1.5" strokeDasharray="6 4" opacity="0.9" />
              )}
              {Number.isFinite(overlay.min.value) && (
                <circle cx={x(overlay.min.time)} cy={y(overlay.min.value)} r="3.5" fill={color} stroke="#ffffff" strokeWidth="1" />
              )}
              {Number.isFinite(overlay.max.value) && (
                <circle cx={x(overlay.max.time)} cy={y(overlay.max.value)} r="3.5" fill={color} stroke="#ffffff" strokeWidth="1" />
              )}
            </g>
          );
        })()}
      </svg>
    </section>
  );
}
