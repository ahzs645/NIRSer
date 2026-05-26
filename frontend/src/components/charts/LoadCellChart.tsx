import { useEffect, useId, useRef, useState } from "react";
import * as d3 from "d3";
import type { Point } from "../../types/nirs";
import { formatNumber } from "../../lib/utils";
import { useElementSize } from "../../lib/useElementSize";

export type LoadCellOverlay = {
  min: Point;
  max: Point;
  slope: number;
  intercept: number;
};

const MARGIN = { top: 12, right: 18, bottom: 34, left: 60 };
const OVERLAY_COLOR = "#b45309";

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
  const { ref, width, height } = useElementSize<HTMLDivElement>({ width: 920, height: 170 });
  const svgRef = useRef<SVGSVGElement | null>(null);
  const resetRef = useRef<() => void>(() => undefined);
  const [isZoomed, setIsZoomed] = useState(false);
  const clipId = useId().replace(/:/g, "");

  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl) return;
    const plotW = width - MARGIN.left - MARGIN.right;
    const plotH = height - MARGIN.top - MARGIN.bottom;
    if (plotW <= 0 || plotH <= 0) return;

    const rawMinX = data[0]?.time ?? 0;
    const rawMaxX = data.at(-1)?.time ?? 1;
    const baseMinX = Math.max(0, rawMinX);
    const baseMaxX = Math.max(rawMaxX, baseMinX + 1e-6);
    const x0 = d3.scaleLinear().domain([baseMinX, baseMaxX]).range([MARGIN.left, width - MARGIN.right]);
    const y0 = d3.scaleLinear().domain([yDomain[0], yDomain[1]]).range([height - MARGIN.bottom, MARGIN.top]).clamp(true);

    const svg = d3.select(svgEl);
    svg.selectAll("*").remove();

    svg
      .append("clipPath")
      .attr("id", `clip-${clipId}`)
      .append("rect")
      .attr("x", MARGIN.left)
      .attr("y", MARGIN.top)
      .attr("width", plotW)
      .attr("height", plotH);

    svg.append("rect").attr("x", MARGIN.left).attr("y", MARGIN.top).attr("width", plotW).attr("height", plotH).attr("fill", "#fbfdfe");

    const gGridY = svg.append("g").attr("transform", `translate(${MARGIN.left}, 0)`);
    const gAxisX = svg.append("g").attr("transform", `translate(0, ${height - MARGIN.bottom})`);
    const gMarks = svg.append("g").attr("clip-path", `url(#clip-${clipId})`);
    const gLine = svg.append("g").attr("clip-path", `url(#clip-${clipId})`);
    const gOverlay = svg.append("g").attr("clip-path", `url(#clip-${clipId})`).attr("pointer-events", "none");

    svg
      .append("text")
      .attr("x", 14)
      .attr("y", MARGIN.top + plotH / 2)
      .attr("transform", `rotate(-90, 14, ${MARGIN.top + plotH / 2})`)
      .attr("text-anchor", "middle")
      .attr("fill", "#64748b")
      .attr("font-size", "11px")
      .text("Data (lbs)");
    svg
      .append("text")
      .attr("x", MARGIN.left + plotW / 2)
      .attr("y", height - 2)
      .attr("text-anchor", "middle")
      .attr("fill", "#64748b")
      .attr("font-size", "11px")
      .text("Time (s)");

    const lineGen = (sx: d3.ScaleLinear<number, number>, sy: d3.ScaleLinear<number, number>) =>
      d3
        .line<Point>()
        .defined((point) => Number.isFinite(point.value))
        .x((point) => sx(point.time))
        .y((point) => sy(point.value));

    const draw = (sx: d3.ScaleLinear<number, number>, sy: d3.ScaleLinear<number, number>) => {
      gGridY
        .call(
          d3
            .axisLeft(sy)
            .ticks(3)
            .tickSize(-plotW)
            .tickPadding(8)
            .tickFormat((d) => formatNumber(Number(d), 1)),
        )
        .call((g) => g.select(".domain").remove())
        .call((g) => g.selectAll(".tick line").attr("stroke", "#e8eef2"))
        .call((g) => g.selectAll("text").attr("fill", "#64748b").attr("font-size", "11px"));

      gAxisX
        .call(
          d3
            .axisBottom(sx)
            .ticks(Math.max(2, Math.floor(plotW / 90)))
            .tickFormat((d) => `${formatNumber(Number(d), 1)}s`),
        )
        .call((g) => g.selectAll("text").attr("fill", "#64748b").attr("font-size", "11px"))
        .call((g) => g.selectAll(".domain, .tick line").attr("stroke", "#cbd5e1"));

      gMarks
        .selectAll("line")
        .data(marks)
        .join("line")
        .attr("x1", (m) => sx(m))
        .attr("x2", (m) => sx(m))
        .attr("y1", MARGIN.top)
        .attr("y2", height - MARGIN.bottom)
        .attr("stroke", "#111827")
        .attr("stroke-dasharray", "4 4");

      gLine
        .selectAll("path")
        .data([data])
        .join("path")
        .attr("fill", "none")
        .attr("stroke", "#0f766e")
        .attr("stroke-width", 2)
        .attr("d", (d) => lineGen(sx, sy)(d));

      gOverlay.selectAll("*").remove();
      if (overlay) {
        const start = overlayWindow ? Math.max(sx.domain()[0], overlayWindow[0]) : sx.domain()[0];
        const end = overlayWindow ? Math.min(sx.domain()[1], overlayWindow[1]) : sx.domain()[1];
        const yAt = (time: number) => overlay.intercept + overlay.slope * time;
        if (end > start && Number.isFinite(yAt(start)) && Number.isFinite(yAt(end))) {
          gOverlay.append("line").attr("x1", sx(start)).attr("y1", sy(yAt(start))).attr("x2", sx(end)).attr("y2", sy(yAt(end))).attr("stroke", OVERLAY_COLOR).attr("stroke-width", 1.5).attr("stroke-dasharray", "6 4").attr("opacity", 0.9);
        }
        if (Number.isFinite(overlay.min.value)) {
          gOverlay.append("circle").attr("cx", sx(overlay.min.time)).attr("cy", sy(overlay.min.value)).attr("r", 3.5).attr("fill", OVERLAY_COLOR).attr("stroke", "#fff").attr("stroke-width", 1);
        }
        if (Number.isFinite(overlay.max.value)) {
          gOverlay.append("circle").attr("cx", sx(overlay.max.time)).attr("cy", sy(overlay.max.value)).attr("r", 3.5).attr("fill", OVERLAY_COLOR).attr("stroke", "#fff").attr("stroke-width", 1);
        }
      }
    };

    draw(x0, y0);

    let zx = x0;
    let zy = y0;
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 64])
      .extent([
        [MARGIN.left, MARGIN.top],
        [width - MARGIN.right, height - MARGIN.bottom],
      ])
      .translateExtent([
        [MARGIN.left, MARGIN.top],
        [width - MARGIN.right, height - MARGIN.bottom],
      ])
      .on("zoom", (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
        zx = event.transform.rescaleX(x0);
        zy = event.transform.rescaleY(y0);
        draw(zx, zy);
        setIsZoomed(event.transform.k !== 1 || event.transform.x !== 0 || event.transform.y !== 0);
      });

    svg.call(zoom).on("dblclick.zoom", () => svg.transition().duration(200).call(zoom.transform, d3.zoomIdentity));
    resetRef.current = () => svg.transition().duration(200).call(zoom.transform, d3.zoomIdentity);

    if (onCoordinate) {
      svg.on("mousemove.coord", (event: MouseEvent) => {
        const [px, py] = d3.pointer(event, svgEl);
        if (px < MARGIN.left || px > width - MARGIN.right || py < MARGIN.top || py > height - MARGIN.bottom) return;
        onCoordinate({ chart: "Load Cell", x: zx.invert(px), y: zy.invert(py) });
      });
    }
  }, [data, marks, yDomain, overlay, overlayWindow, onCoordinate, clipId, width, height]);

  return (
    <section className="flex h-full min-h-[180px] flex-col">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">Load Cell</h3>
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
          <span className="text-xs text-slate-500">{data.length} points</span>
        </div>
      </div>
      <div ref={ref} className="relative min-h-0 w-full flex-1">
        <svg ref={svgRef} width={width} height={height} className="absolute inset-0 h-full w-full cursor-crosshair touch-none" role="img" aria-label="Load Cell" />
      </div>
    </section>
  );
}
