import { useEffect, useId, useRef } from "react";
import * as d3 from "d3";
import type { HemoglobinErrorPoint, HemoglobinErrorSeries } from "../../lib/hemoglobinGraphing";
import { formatNumber } from "../../lib/utils";
import { useElementSize } from "../../lib/useElementSize";

type HemoglobinSummaryChartProps = {
  title: string;
  yLabel: string;
  series: HemoglobinErrorSeries[];
  xDomain?: [number, number];
  yDomain?: [number, number];
  height?: number;
};

const MARGIN = { top: 30, right: 20, bottom: 36, left: 62 };
const colors: Record<string, string> = {
  scalp: "#b91c1c",
  brain: "#1d4ed8",
};

export function HemoglobinSummaryChart({
  title,
  yLabel,
  series,
  xDomain = [0, 50],
  yDomain = [-2, 2],
  height = 220,
}: HemoglobinSummaryChartProps) {
  const { ref, width, height: measuredHeight } = useElementSize<HTMLDivElement>({ width: 920, height });
  const svgRef = useRef<SVGSVGElement | null>(null);
  const clipId = useId().replace(/:/g, "");
  const chartHeight = measuredHeight || height;

  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl) return;
    const plotW = width - MARGIN.left - MARGIN.right;
    const plotH = chartHeight - MARGIN.top - MARGIN.bottom;
    if (plotW <= 0 || plotH <= 0) return;

    const visibleSeries = series.filter((item) => item.available);
    const x = d3.scaleLinear().domain(xDomain).range([MARGIN.left, width - MARGIN.right]);
    const y = d3.scaleLinear().domain(yDomain).range([chartHeight - MARGIN.bottom, MARGIN.top]).clamp(true);
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

    svg
      .append("g")
      .attr("transform", `translate(${MARGIN.left}, 0)`)
      .call(
        d3
          .axisLeft(y)
          .ticks(5)
          .tickSize(-plotW)
          .tickPadding(8)
          .tickFormat((tick) => formatNumber(Number(tick), 1)),
      )
      .call((g) => g.select(".domain").remove())
      .call((g) => g.selectAll(".tick line").attr("stroke", "#e8eef2"))
      .call((g) => g.selectAll("text").attr("fill", "#64748b").attr("font-size", "11px"));

    svg
      .append("g")
      .attr("transform", `translate(0, ${chartHeight - MARGIN.bottom})`)
      .call(
        d3
          .axisBottom(x)
          .ticks(Math.max(2, Math.floor(plotW / 90)))
          .tickFormat((tick) => `${formatNumber(Number(tick), 1)}s`),
      )
      .call((g) => g.selectAll("text").attr("fill", "#64748b").attr("font-size", "11px"))
      .call((g) => g.selectAll(".domain, .tick line").attr("stroke", "#cbd5e1"));

    svg
      .append("text")
      .attr("x", 14)
      .attr("y", MARGIN.top + plotH / 2)
      .attr("transform", `rotate(-90, 14, ${MARGIN.top + plotH / 2})`)
      .attr("text-anchor", "middle")
      .attr("fill", "#64748b")
      .attr("font-size", "11px")
      .text(yLabel);

    svg
      .append("text")
      .attr("x", MARGIN.left + plotW / 2)
      .attr("y", chartHeight - 2)
      .attr("text-anchor", "middle")
      .attr("fill", "#64748b")
      .attr("font-size", "11px")
      .text("Time (s)");

    const legend = svg.append("g").attr("transform", `translate(${MARGIN.left}, 14)`);
    visibleSeries.forEach((item, index) => {
      const group = legend.append("g").attr("transform", `translate(${index * 92}, 0)`);
      group.append("line").attr("x1", 0).attr("x2", 18).attr("stroke", colors[item.id]).attr("stroke-width", 3);
      group.append("text").attr("x", 24).attr("y", 4).attr("fill", "#475569").attr("font-size", "11px").text(item.label);
    });

    const line = d3
      .line<HemoglobinErrorPoint>()
      .defined((point) => Number.isFinite(point.mean))
      .x((point) => x(point.time))
      .y((point) => y(point.mean));

    const plot = svg.append("g").attr("clip-path", `url(#clip-${clipId})`);
    for (const item of visibleSeries) {
      const color = colors[item.id];
      const finitePoints = item.points.filter((point) => Number.isFinite(point.mean) && Number.isFinite(point.sem));

      plot
        .append("path")
        .datum(item.points)
        .attr("fill", "none")
        .attr("stroke", color)
        .attr("stroke-width", 2)
        .attr("d", line);

      const errorGroups = plot.selectAll<SVGGElement, HemoglobinErrorPoint>(`g.error-${item.id}`).data(finitePoints).join("g");
      errorGroups
        .append("line")
        .attr("x1", (point) => x(point.time))
        .attr("x2", (point) => x(point.time))
        .attr("y1", (point) => y(point.mean - point.sem))
        .attr("y2", (point) => y(point.mean + point.sem))
        .attr("stroke", color)
        .attr("stroke-width", 1)
        .attr("opacity", 0.65);
      errorGroups
        .append("line")
        .attr("x1", (point) => x(point.time) - 3)
        .attr("x2", (point) => x(point.time) + 3)
        .attr("y1", (point) => y(point.mean - point.sem))
        .attr("y2", (point) => y(point.mean - point.sem))
        .attr("stroke", color)
        .attr("stroke-width", 1);
      errorGroups
        .append("line")
        .attr("x1", (point) => x(point.time) - 3)
        .attr("x2", (point) => x(point.time) + 3)
        .attr("y1", (point) => y(point.mean + point.sem))
        .attr("y2", (point) => y(point.mean + point.sem))
        .attr("stroke", color)
        .attr("stroke-width", 1);
    }
  }, [chartHeight, clipId, series, width, xDomain, yDomain, yLabel]);

  const missingLabels = series.filter((item) => !item.available).map((item) => item.label);

  return (
    <section className="flex h-full min-h-[200px] flex-col">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        {missingLabels.length > 0 && <span className="text-xs text-amber-700">Unavailable: {missingLabels.join(", ")}</span>}
      </div>
      <div ref={ref} className="relative min-h-0 w-full flex-1">
        <svg ref={svgRef} width={width} height={chartHeight} className="absolute inset-0 h-full w-full" role="img" aria-label={`${title} hemoglobin summary`} />
      </div>
    </section>
  );
}
