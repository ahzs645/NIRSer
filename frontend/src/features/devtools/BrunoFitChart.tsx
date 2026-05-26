import { useEffect, useId, useRef, useState } from "react";
import * as d3 from "d3";
import type { BrunoResult } from "../../lib/bruno";
import { formatNumber } from "../../lib/utils";
import { useElementSize } from "../../lib/useElementSize";

const MARGIN = { top: 30, right: 18, bottom: 36, left: 64 };

export function BrunoFitChart({ result }: { result: BrunoResult }) {
  const { ref, width, height } = useElementSize<HTMLDivElement>({ width: 920, height: 320 });
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

    const data = result.wavelengths.map((wavelength, index) => ({
      wavelength,
      measured: result.slopeDerivative[index],
      model: result.modelDerivative[index],
      residual: result.residuals[index],
    })).filter((point) => Number.isFinite(point.measured) && Number.isFinite(point.model));
    const minX = d3.min(data, (point) => point.wavelength) ?? 0;
    const maxX = d3.max(data, (point) => point.wavelength) ?? 1;
    const allY = data.flatMap((point) => [point.measured, point.model]);
    const minY = d3.min(allY) ?? -1;
    const maxY = d3.max(allY) ?? 1;
    const padY = Math.max((maxY - minY) * 0.08, 1e-6);

    const x0 = d3.scaleLinear().domain([minX, maxX]).range([MARGIN.left, width - MARGIN.right]);
    const y0 = d3.scaleLinear().domain([minY - padY, maxY + padY]).range([height - MARGIN.bottom, MARGIN.top]);
    const svg = d3.select(svgEl);
    svg.selectAll("*").remove();

    svg.append("clipPath").attr("id", `clip-${clipId}`).append("rect").attr("x", MARGIN.left).attr("y", MARGIN.top).attr("width", plotW).attr("height", plotH);
    svg.append("rect").attr("x", MARGIN.left).attr("y", MARGIN.top).attr("width", plotW).attr("height", plotH).attr("fill", "#fbfdfe");

    const gGridY = svg.append("g").attr("transform", `translate(${MARGIN.left}, 0)`);
    const gAxisX = svg.append("g").attr("transform", `translate(0, ${height - MARGIN.bottom})`);
    const gLines = svg.append("g").attr("clip-path", `url(#clip-${clipId})`);

    svg.append("text").attr("x", 16).attr("y", MARGIN.top + plotH / 2).attr("transform", `rotate(-90, 16, ${MARGIN.top + plotH / 2})`).attr("text-anchor", "middle").attr("fill", "#64748b").attr("font-size", "11px").text("Derivative");
    svg.append("text").attr("x", MARGIN.left + plotW / 2).attr("y", height - 2).attr("text-anchor", "middle").attr("fill", "#64748b").attr("font-size", "11px").text("Wavelength (nm)");

    const legend = svg.append("g").attr("transform", `translate(${MARGIN.left}, 14)`);
    [
      ["Measured", "#2563eb"],
      ["Model", "#dc2626"],
    ].forEach(([label, color], index) => {
      const g = legend.append("g").attr("transform", `translate(${index * 96}, 0)`);
      g.append("line").attr("x1", 0).attr("x2", 18).attr("y1", 0).attr("y2", 0).attr("stroke", color).attr("stroke-width", 3);
      g.append("text").attr("x", 24).attr("y", 4).attr("fill", "#475569").attr("font-size", "11px").text(label);
    });

    const line = (key: "measured" | "model", sx: d3.ScaleLinear<number, number>, sy: d3.ScaleLinear<number, number>) =>
      d3.line<(typeof data)[number]>().defined((point) => Number.isFinite(point[key])).x((point) => sx(point.wavelength)).y((point) => sy(point[key]));

    const draw = (sx: d3.ScaleLinear<number, number>, sy: d3.ScaleLinear<number, number>) => {
      gGridY
        .call(d3.axisLeft(sy).ticks(5).tickSize(-plotW).tickPadding(8).tickFormat((tick) => formatNumber(Number(tick), 4)))
        .call((g) => g.select(".domain").remove())
        .call((g) => g.selectAll(".tick line").attr("stroke", "#e8eef2"))
        .call((g) => g.selectAll("text").attr("fill", "#64748b").attr("font-size", "11px"));
      gAxisX
        .call(d3.axisBottom(sx).ticks(Math.max(2, Math.floor(plotW / 90))).tickFormat((tick) => `${formatNumber(Number(tick), 0)}`))
        .call((g) => g.selectAll("text").attr("fill", "#64748b").attr("font-size", "11px"))
        .call((g) => g.selectAll(".domain, .tick line").attr("stroke", "#cbd5e1"));
      gLines
        .selectAll("path")
        .data([
          { key: "measured" as const, color: "#2563eb" },
          { key: "model" as const, color: "#dc2626" },
        ])
        .join("path")
        .attr("fill", "none")
        .attr("stroke", (series) => series.color)
        .attr("stroke-width", 2)
        .attr("d", (series) => line(series.key, sx, sy)(data));
    };

    draw(x0, y0);
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 64])
      .extent([[MARGIN.left, MARGIN.top], [width - MARGIN.right, height - MARGIN.bottom]])
      .translateExtent([[MARGIN.left, MARGIN.top], [width - MARGIN.right, height - MARGIN.bottom]])
      .on("zoom", (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
        draw(event.transform.rescaleX(x0), event.transform.rescaleY(y0));
        setIsZoomed(event.transform.k !== 1 || event.transform.x !== 0 || event.transform.y !== 0);
      });
    svg.call(zoom).on("dblclick.zoom", () => svg.transition().duration(200).call(zoom.transform, d3.zoomIdentity));
    resetRef.current = () => svg.transition().duration(200).call(zoom.transform, d3.zoomIdentity);
  }, [result, width, height, clipId]);

  return (
    <section className="flex min-h-[300px] flex-col">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">Measured vs Model Derivative</h3>
        {isZoomed && (
          <button type="button" onClick={() => resetRef.current()} className="rounded border border-slate-200 px-2 py-0.5 text-[11px] text-slate-600 hover:bg-slate-50">
            Reset zoom
          </button>
        )}
      </div>
      <div ref={ref} className="relative min-h-0 w-full flex-1">
        <svg ref={svgRef} width={width} height={height} className="absolute inset-0 h-full w-full cursor-crosshair touch-none" role="img" aria-label="BRUNO fit plot" />
      </div>
    </section>
  );
}
