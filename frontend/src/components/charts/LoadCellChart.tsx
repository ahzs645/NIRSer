import { useEffect, useId, useRef, useState } from "react";
import * as d3 from "d3";
import type { Point } from "../../types/nirs";
import { formatNumber } from "../../lib/utils";

export type LoadCellOverlay = {
  min: Point;
  max: Point;
  slope: number;
  intercept: number;
};

const WIDTH = 920;
const HEIGHT = 156;
const PAD = { left: 56, right: 14, top: 10, bottom: 36 };
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
  const svgRef = useRef<SVGSVGElement | null>(null);
  const resetRef = useRef<() => void>(() => undefined);
  const [isZoomed, setIsZoomed] = useState(false);
  const clipId = useId().replace(/:/g, "");

  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl) return;

    const baseMinX = data[0]?.time ?? 0;
    const baseMaxX = data.at(-1)?.time ?? 1;
    const x0 = d3.scaleLinear().domain([baseMinX, baseMaxX]).range([PAD.left, WIDTH - PAD.right]);
    const y0 = d3.scaleLinear().domain([yDomain[0], yDomain[1]]).range([HEIGHT - PAD.bottom, PAD.top]).clamp(true);

    const svg = d3.select(svgEl);
    svg.selectAll("*").remove();

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
    const gLine = svg.append("g").attr("clip-path", `url(#clip-${clipId})`);
    const gOverlay = svg.append("g").attr("clip-path", `url(#clip-${clipId})`).attr("pointer-events", "none");

    svg
      .append("text")
      .attr("x", 14)
      .attr("y", PAD.top + (HEIGHT - PAD.top - PAD.bottom) / 2)
      .attr("transform", `rotate(-90, 14, ${PAD.top + (HEIGHT - PAD.top - PAD.bottom) / 2})`)
      .attr("text-anchor", "middle")
      .attr("fill", "#64748b")
      .attr("font-size", "11px")
      .text("Data (lbs)");
    svg
      .append("text")
      .attr("x", (WIDTH + PAD.left - PAD.right) / 2)
      .attr("y", HEIGHT - 2)
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
      gGrid
        .selectAll<SVGGElement, number>("g.gl")
        .data(sy.ticks(3))
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
        });

      gAxisX
        .call(
          d3
            .axisBottom(sx)
            .ticks(6)
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
        .attr("y1", PAD.top)
        .attr("y2", HEIGHT - PAD.bottom)
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
          gOverlay
            .append("line")
            .attr("x1", sx(start))
            .attr("y1", sy(yAt(start)))
            .attr("x2", sx(end))
            .attr("y2", sy(yAt(end)))
            .attr("stroke", OVERLAY_COLOR)
            .attr("stroke-width", 1.5)
            .attr("stroke-dasharray", "6 4")
            .attr("opacity", 0.9);
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
        onCoordinate({ chart: "Load Cell", x: zx.invert(px), y: zy.invert(py) });
      });
    }
  }, [data, marks, yDomain, overlay, overlayWindow, onCoordinate, clipId]);

  return (
    <section className="h-full min-h-[180px]">
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
      <svg
        ref={svgRef}
        className="h-[calc(100%-28px)] w-full cursor-crosshair touch-none"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label="Load Cell"
      />
    </section>
  );
}
