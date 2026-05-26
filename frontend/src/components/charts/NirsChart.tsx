import { useEffect, useId, useRef, useState } from "react";
import * as d3 from "d3";
import type { NirsPoint, Point } from "../../types/nirs";
import { formatNumber } from "../../lib/utils";

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

const colors: Record<SeriesKey, string> = {
  o2hb: "#dc2626",
  hhb: "#2563eb",
  thb: "#16a34a",
  hbdiff: "#f59e0b",
  toi: "#7c3aed",
};

const labels: Record<SeriesKey, string> = {
  o2hb: "O2Hb",
  hhb: "HHb",
  thb: "THb",
  hbdiff: "HbDiff",
  toi: "TOI",
};

const ALL_KEYS: SeriesKey[] = ["o2hb", "hhb", "thb", "hbdiff", "toi"];
const WIDTH = 920;
const HEIGHT = 226;
const PAD = { left: 48, right: 14, top: 12, bottom: 38 };

export function NirsChart({
  title,
  data,
  marks,
  visible,
  xDomain = ["auto", "auto"],
  yDomain = ["auto", "auto"],
  onCoordinate,
  overlays,
  overlayWindow,
}: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const resetRef = useRef<() => void>(() => undefined);
  const [isZoomed, setIsZoomed] = useState(false);
  const clipId = useId().replace(/:/g, "");

  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl) return;

    const seriesKeys = ALL_KEYS.filter((key) => visible?.[key] ?? true);
    const baseMinX = xDomain[0] === "auto" ? data[0]?.time ?? 0 : xDomain[0];
    const baseMaxX = xDomain[1] === "auto" ? data.at(-1)?.time ?? 1 : xDomain[1];
    const window = data.filter((point) => point.time >= baseMinX && point.time <= baseMaxX);
    const allY = (window.length > 0 ? window : data).flatMap((point) => seriesKeys.map((key) => point[key]));
    const baseMinY = yDomain[0] === "auto" ? Math.min(...allY, -1) : yDomain[0];
    const baseMaxY = yDomain[1] === "auto" ? Math.max(...allY, 1) : yDomain[1];

    const x0 = d3.scaleLinear().domain([baseMinX, baseMaxX]).range([PAD.left, WIDTH - PAD.right]);
    const y0 = d3.scaleLinear().domain([baseMinY, baseMaxY]).range([HEIGHT - PAD.bottom, PAD.top]);

    const svg = d3.select(svgEl);
    svg.selectAll("*").remove();

    // Clip so zoomed/panned series stay inside the plot rectangle.
    svg
      .append("clipPath")
      .attr("id", `clip-${clipId}`)
      .append("rect")
      .attr("x", PAD.left)
      .attr("y", PAD.top)
      .attr("width", WIDTH - PAD.left - PAD.right)
      .attr("height", HEIGHT - PAD.top - PAD.bottom);

    svg
      .append("rect")
      .attr("x", PAD.left)
      .attr("y", PAD.top)
      .attr("width", WIDTH - PAD.left - PAD.right)
      .attr("height", HEIGHT - PAD.top - PAD.bottom)
      .attr("fill", "#fbfdfe");

    const gGrid = svg.append("g");
    const gAxisX = svg.append("g").attr("transform", `translate(0, ${HEIGHT - PAD.bottom})`);
    const gMarks = svg.append("g").attr("clip-path", `url(#clip-${clipId})`);
    const gLines = svg.append("g").attr("clip-path", `url(#clip-${clipId})`);
    const gOverlay = svg.append("g").attr("clip-path", `url(#clip-${clipId})`).attr("pointer-events", "none");

    // Static axis titles.
    svg
      .append("text")
      .attr("x", 14)
      .attr("y", PAD.top + (HEIGHT - PAD.top - PAD.bottom) / 2)
      .attr("transform", `rotate(-90, 14, ${PAD.top + (HEIGHT - PAD.top - PAD.bottom) / 2})`)
      .attr("text-anchor", "middle")
      .attr("fill", "#64748b")
      .attr("font-size", "11px")
      .text("Data (mM*mm)");
    svg
      .append("text")
      .attr("x", (WIDTH + PAD.left - PAD.right) / 2)
      .attr("y", HEIGHT - 2)
      .attr("text-anchor", "middle")
      .attr("fill", "#64748b")
      .attr("font-size", "11px")
      .text("Time (s)");

    // Legend.
    const legend = svg.append("g").attr("transform", `translate(${PAD.left}, 4)`);
    seriesKeys.forEach((key, index) => {
      const g = legend.append("g").attr("transform", `translate(${index * 92}, 0)`);
      g.append("line").attr("x1", 0).attr("x2", 18).attr("y1", 0).attr("y2", 0).attr("stroke", colors[key]).attr("stroke-width", 3);
      g.append("text").attr("x", 24).attr("y", 4).attr("fill", "#475569").attr("font-size", "11px").text(labels[key]);
    });

    const line = (scaleX: d3.ScaleLinear<number, number>, scaleY: d3.ScaleLinear<number, number>, key: SeriesKey) =>
      d3
        .line<NirsPoint>()
        .defined((point) => Number.isFinite(point[key]))
        .x((point) => scaleX(point.time))
        .y((point) => scaleY(point[key]));

    const draw = (sx: d3.ScaleLinear<number, number>, sy: d3.ScaleLinear<number, number>) => {
      // Horizontal gridlines + y axis.
      gGrid
        .call((g) =>
          g
            .selectAll<SVGGElement, number>("g.gl")
            .data(sy.ticks(5))
            .join((enter) => enter.append("g").attr("class", "gl"))
            .call((row) => {
              row
                .selectAll("line")
                .data((d) => [d])
                .join("line")
                .attr("x1", PAD.left)
                .attr("x2", WIDTH - PAD.right)
                .attr("y1", (d) => sy(d))
                .attr("y2", (d) => sy(d))
                .attr("stroke", "#e8eef2");
              row
                .selectAll("text")
                .data((d) => [d])
                .join("text")
                .attr("x", 6)
                .attr("y", (d) => sy(d) + 4)
                .attr("fill", "#64748b")
                .attr("font-size", "11px")
                .text((d) => formatNumber(d, 1));
            }),
        );

      // X axis ticks labelled in seconds.
      gAxisX
        .call(
          d3
            .axisBottom(sx)
            .ticks(6)
            .tickFormat((d) => `${formatNumber(Number(d), 1)}s`),
        )
        .call((g) => g.selectAll("text").attr("fill", "#64748b").attr("font-size", "11px"))
        .call((g) => g.selectAll(".domain, .tick line").attr("stroke", "#cbd5e1"));

      // Marks.
      gMarks
        .selectAll("line")
        .data(marks)
        .join("line")
        .attr("x1", (m) => sx(m))
        .attr("x2", (m) => sx(m))
        .attr("y1", PAD.top)
        .attr("y2", HEIGHT - PAD.bottom)
        .attr("stroke", "#111827")
        .attr("stroke-dasharray", "4 4");

      // Series paths.
      gLines
        .selectAll<SVGPathElement, SeriesKey>("path")
        .data(seriesKeys)
        .join("path")
        .attr("fill", "none")
        .attr("stroke", (key) => colors[key])
        .attr("stroke-width", 2)
        .attr("d", (key) => line(sx, sy, key)(data));

      // Analysis overlays: regression line + min/max dots per visible series.
      const drawn = (overlays ?? []).filter((overlay) => seriesKeys.includes(overlay.key));
      const groups = gOverlay
        .selectAll<SVGGElement, SeriesOverlay>("g.ov")
        .data(drawn, (overlay) => overlay.key)
        .join((enter) => enter.append("g").attr("class", "ov"));
      groups.each(function (overlay) {
        const g = d3.select(this);
        g.selectAll("*").remove();
        const color = colors[overlay.key];
        const start = overlayWindow ? Math.max(sx.domain()[0], overlayWindow[0]) : sx.domain()[0];
        const end = overlayWindow ? Math.min(sx.domain()[1], overlayWindow[1]) : sx.domain()[1];
        const yAt = (time: number) => overlay.intercept + overlay.slope * time;
        if (end > start && Number.isFinite(yAt(start)) && Number.isFinite(yAt(end))) {
          g.append("line")
            .attr("x1", sx(start))
            .attr("y1", sy(yAt(start)))
            .attr("x2", sx(end))
            .attr("y2", sy(yAt(end)))
            .attr("stroke", color)
            .attr("stroke-width", 1.5)
            .attr("stroke-dasharray", "6 4")
            .attr("opacity", 0.9);
        }
        if (Number.isFinite(overlay.min.value)) {
          g.append("circle").attr("cx", sx(overlay.min.time)).attr("cy", sy(overlay.min.value)).attr("r", 3.5).attr("fill", color).attr("stroke", "#fff").attr("stroke-width", 1);
        }
        if (Number.isFinite(overlay.max.value)) {
          g.append("circle").attr("cx", sx(overlay.max.time)).attr("cy", sy(overlay.max.value)).attr("r", 3.5).attr("fill", color).attr("stroke", "#fff").attr("stroke-width", 1);
        }
      });
    };

    draw(x0, y0);

    // Interaction: wheel zoom + drag pan (d3-zoom), hover readout, double-click reset.
    let zx = x0;
    let zy = y0;
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 64])
      .extent([
        [PAD.left, PAD.top],
        [WIDTH - PAD.right, HEIGHT - PAD.bottom],
      ])
      .on("zoom", (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
        zx = event.transform.rescaleX(x0);
        zy = event.transform.rescaleY(y0);
        draw(zx, zy);
        setIsZoomed(event.transform.k !== 1 || event.transform.x !== 0 || event.transform.y !== 0);
      });

    svg.call(zoom).on("dblclick.zoom", () => {
      svg.transition().duration(200).call(zoom.transform, d3.zoomIdentity);
    });

    resetRef.current = () => svg.transition().duration(200).call(zoom.transform, d3.zoomIdentity);

    if (onCoordinate) {
      svg.on("mousemove.coord", (event: MouseEvent) => {
        const [px, py] = d3.pointer(event, svgEl);
        if (px < PAD.left || px > WIDTH - PAD.right || py < PAD.top || py > HEIGHT - PAD.bottom) return;
        onCoordinate({ chart: title, x: zx.invert(px), y: zy.invert(py) });
      });
    }
  }, [data, marks, visible, xDomain, yDomain, overlays, overlayWindow, onCoordinate, title, clipId]);

  return (
    <section className="h-full min-h-[220px]">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        <div className="flex items-center gap-2">
          {isZoomed && (
            <button
              type="button"
              onClick={() => resetRef.current()}
              className="rounded border border-slate-200 px-2 py-0.5 text-[11px] text-slate-600 hover:bg-slate-50"
            >
              Reset zoom
            </button>
          )}
          <span className="text-xs text-slate-500">{data.length} samples</span>
        </div>
      </div>
      <svg
        ref={svgRef}
        className="h-[calc(100%-28px)] w-full cursor-crosshair touch-none"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={title}
      />
    </section>
  );
}
