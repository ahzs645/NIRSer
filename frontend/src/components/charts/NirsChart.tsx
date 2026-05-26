import type { NirsPoint, Point } from "../../types/nirs";
import { formatNumber } from "../../lib/utils";
import { useChartViewport } from "../../lib/chartViewport";

export type SeriesKey = "o2hb" | "hhb" | "thb" | "hbdiff" | "toi";

/** Min/max markers + regression line drawn on top of a series (analysis view). */
export type SeriesOverlay = {
  key: SeriesKey;
  min: Point;
  max: Point;
  slope: number;
  intercept: number;
};

type Props = {
  title: string;
  data: NirsPoint[];
  marks: number[];
  visible?: Partial<Record<keyof Omit<NirsPoint, "time">, boolean>>;
  xDomain?: [number, number] | ["auto", "auto"];
  yDomain?: [number, number] | ["auto", "auto"];
  onCoordinate?: (coordinate: { chart: string; x: number; y: number }) => void;
  /** Per-series min/max/slope overlays. Only those whose series is visible are drawn. */
  overlays?: SeriesOverlay[];
  /** Time window [start, end] the overlay stats were computed over (the active section). */
  overlayWindow?: [number, number];
};

const colors = {
  o2hb: "#dc2626",
  hhb: "#2563eb",
  thb: "#16a34a",
  hbdiff: "#f59e0b",
  toi: "#7c3aed",
};

const labels = {
  o2hb: "O2Hb",
  hhb: "HHb",
  thb: "THb",
  hbdiff: "HbDiff",
  toi: "TOI",
};

export function NirsChart({ title, data, marks, visible, xDomain = ["auto", "auto"], yDomain = ["auto", "auto"], onCoordinate, overlays, overlayWindow }: Props) {
  const width = 920;
  const height = 220;
  const pad = { left: 48, right: 14, top: 12, bottom: 28 };
  const seriesKeys = (["o2hb", "hhb", "thb", "hbdiff", "toi"] as const).filter((key) => visible?.[key] ?? true);
  const baseMinX = xDomain[0] === "auto" ? data[0]?.time ?? 0 : xDomain[0];
  const baseMaxX = xDomain[1] === "auto" ? data.at(-1)?.time ?? 1 : xDomain[1];
  const baseWindow = data.filter((point) => point.time >= baseMinX && point.time <= baseMaxX);
  const allY = (baseWindow.length > 0 ? baseWindow : data).flatMap((point) => seriesKeys.map((key) => point[key]));
  const baseMinY = yDomain[0] === "auto" ? Math.min(...allY, -1) : yDomain[0];
  const baseMaxY = yDomain[1] === "auto" ? Math.max(...allY, 1) : yDomain[1];
  const { domain, isZoomed, reset, plotRef, plotHandlers } = useChartViewport(
    { xMin: baseMinX, xMax: baseMaxX, yMin: baseMinY, yMax: baseMaxY },
    { onHover: onCoordinate ? (x, y) => onCoordinate({ chart: title, x, y }) : undefined },
  );
  const minX = domain.xMin;
  const maxX = domain.xMax;
  const minY = domain.yMin;
  const maxY = domain.yMax;
  const visibleData = data.filter((point) => point.time >= minX && point.time <= maxX);
  const spanX = Math.max(0.001, maxX - minX);
  const spanY = Math.max(0.001, maxY - minY);
  const x = (time: number) => pad.left + ((time - minX) / spanX) * (width - pad.left - pad.right);
  const y = (value: number) => height - pad.bottom - ((value - minY) / spanY) * (height - pad.top - pad.bottom);
  const pathFor = (key: (typeof seriesKeys)[number]) =>
    visibleData
      .filter((point) => Number.isFinite(point[key]))
      .map((point, index) => `${index === 0 ? "M" : "L"}${x(point.time).toFixed(2)},${y(point[key]).toFixed(2)}`)
      .join(" ");

  return (
    <section className="h-full min-h-[220px]">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
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
          <span className="text-xs text-slate-500">{data.length} samples</span>
        </div>
      </div>
      <svg className="h-[calc(100%-28px)] w-full" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={title}>
        <rect x={pad.left} y={pad.top} width={width - pad.left - pad.right} height={height - pad.top - pad.bottom} fill="#fbfdfe" />
        {[0, 0.25, 0.5, 0.75, 1].map((tick) => (
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
          Data (mM*mm)
        </text>
        {marks.filter((mark) => mark >= minX && mark <= maxX).map((mark) => (
          <line key={mark} x1={x(mark)} x2={x(mark)} y1={pad.top} y2={height - pad.bottom} stroke="#111827" strokeDasharray="4 4" />
        ))}
        {seriesKeys.map((key) => (
          <path key={key} d={pathFor(key)} fill="none" stroke={colors[key]} strokeWidth="2" />
        ))}
        <text x={pad.left} y={height - 8} className="fill-slate-500 text-[11px]">{formatNumber(minX, 1)}s</text>
        <text x={width - pad.right - 44} y={height - 8} className="fill-slate-500 text-[11px]">{formatNumber(maxX, 1)}s</text>
        <text x={(width + pad.left - pad.right) / 2} y={height - 8} className="fill-slate-500 text-[11px]" textAnchor="middle">Time (s)</text>
        <g transform={`translate(${pad.left}, 4)`}>
          {seriesKeys.map((key, index) => (
            <g key={key} transform={`translate(${index * 92}, 0)`}>
              <line x1="0" x2="18" y1="0" y2="0" stroke={colors[key]} strokeWidth="3" />
              <text x="24" y="4" className="fill-slate-600 text-[11px]">{labels[key]}</text>
            </g>
          ))}
        </g>
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
        {overlays?.map((overlay) => {
          if (!seriesKeys.includes(overlay.key)) return null;
          const color = colors[overlay.key];
          const start = overlayWindow ? Math.max(minX, overlayWindow[0]) : minX;
          const end = overlayWindow ? Math.min(maxX, overlayWindow[1]) : maxX;
          const yAt = (time: number) => overlay.intercept + overlay.slope * time;
          const lineVisible = end > start && Number.isFinite(yAt(start)) && Number.isFinite(yAt(end));
          return (
            <g key={`overlay-${overlay.key}`} pointerEvents="none">
              {lineVisible && (
                <line
                  x1={x(start)}
                  y1={y(yAt(start))}
                  x2={x(end)}
                  y2={y(yAt(end))}
                  stroke={color}
                  strokeWidth="1.5"
                  strokeDasharray="6 4"
                  opacity="0.9"
                />
              )}
              {Number.isFinite(overlay.min.value) && (
                <circle cx={x(overlay.min.time)} cy={y(overlay.min.value)} r="3.5" fill={color} stroke="#ffffff" strokeWidth="1" />
              )}
              {Number.isFinite(overlay.max.value) && (
                <circle cx={x(overlay.max.time)} cy={y(overlay.max.value)} r="3.5" fill={color} stroke="#ffffff" strokeWidth="1" />
              )}
            </g>
          );
        })}
      </svg>
    </section>
  );
}
