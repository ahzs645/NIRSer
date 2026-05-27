import { useMemo } from "react";
import * as d3 from "d3";
import type { BcmdBatchHeatmap, BcmdBestFitTables } from "../../../lib/bcmdBatch";

export function BcmdBatchHeatmapChart({ heatmap }: { heatmap: BcmdBatchHeatmap }) {
  const layout = useMemo(() => {
    const cell = 30;
    const width = 90 + Math.max(1, heatmap.columns.length) * cell;
    const height = 44 + Math.max(1, heatmap.rows.length) * cell;
    const finite = heatmap.values.flat().filter(Number.isFinite);
    const max = Math.max(...finite, 1e-9);
    const min = Math.min(...finite, 0);
    return { cell, width, height, min, max };
  }, [heatmap]);

  return (
    <svg className="w-full rounded-md border border-slate-200 bg-white" viewBox={`0 0 ${layout.width} ${layout.height}`} role="img" aria-label="BCMD batch heat map">
      <text x={8} y={16} fontSize="10" fill="#475569">{heatmap.field}</text>
      {heatmap.columns.map((column, index) => (
        <text key={column} x={90 + index * layout.cell + layout.cell / 2} y={16} textAnchor="middle" fontSize="9" fill="#475569">{column.slice(0, 8)}</text>
      ))}
      {heatmap.rows.map((row, rowIndex) => (
        <g key={row} transform={`translate(0, ${28 + rowIndex * layout.cell})`}>
          <text x={82} y={layout.cell / 2 + 4} textAnchor="end" fontSize="9" fill="#475569">{row.slice(0, 12)}</text>
          {heatmap.columns.map((column, colIndex) => {
            const value = heatmap.values[rowIndex]?.[colIndex] ?? Number.NaN;
            const t = Number.isFinite(value) ? (value - layout.min) / Math.max(layout.max - layout.min, 1e-9) : 0;
            return <rect key={column} x={90 + colIndex * layout.cell} width={layout.cell - 2} height={layout.cell - 2} fill={Number.isFinite(value) ? d3.interpolateYlOrRd(t) : "#f1f5f9"} />;
          })}
        </g>
      ))}
    </svg>
  );
}

export function BcmdBatchBestFitChart({ data }: { data: BcmdBestFitTables }) {
  const layout = useMemo(() => {
    const width = 560;
    const height = 230;
    const margin = { top: 18, right: 18, bottom: 34, left: 56 };
    const values = [...data.measured, ...data.traces.flatMap((trace) => trace.values)].filter(Number.isFinite);
    const x = d3.scaleLinear().domain([Math.min(...data.times), Math.max(...data.times)]).range([margin.left, width - margin.right]);
    const y = d3.scaleLinear().domain([Math.min(...values), Math.max(...values)]).nice().range([height - margin.bottom, margin.top]);
    return { width, height, margin, x, y };
  }, [data]);
  const line = d3.line<number>().x((_, index) => layout.x(data.times[index])).y((value) => layout.y(value));
  const colors = ["#2563eb", "#dc2626", "#0f766e", "#7c3aed"];

  return (
    <svg className="w-full rounded-md border border-slate-200 bg-white" viewBox={`0 0 ${layout.width} ${layout.height}`} role="img" aria-label="BCMD batch best fit">
      {layout.y.ticks(5).map((tick) => (
        <g key={tick}>
          <line x1={layout.margin.left} x2={layout.width - layout.margin.right} y1={layout.y(tick)} y2={layout.y(tick)} stroke="#e2e8f0" />
          <text x={layout.margin.left - 8} y={layout.y(tick) + 4} textAnchor="end" fontSize="10" fill="#64748b">{tick.toFixed(2)}</text>
        </g>
      ))}
      {layout.x.ticks(6).map((tick) => (
        <text key={tick} x={layout.x(tick)} y={layout.height - 10} textAnchor="middle" fontSize="10" fill="#64748b">{tick.toFixed(1)}</text>
      ))}
      <path d={line(data.measured) ?? ""} fill="none" stroke={colors[0]} strokeWidth={2} />
      {data.traces.map((trace, index) => (
        <path key={trace.name} d={line(trace.values) ?? ""} fill="none" stroke={colors[(index + 1) % colors.length]} strokeWidth={1.7} />
      ))}
      <g transform={`translate(${layout.margin.left}, 12)`}>
        {[data.measuredName, ...data.traces.map((trace) => trace.name)].slice(0, 4).map((name, index) => (
          <g key={name} transform={`translate(${index * 120}, 0)`}>
            <line x1={0} x2={16} stroke={colors[index % colors.length]} strokeWidth={2} />
            <text x={20} y={4} fontSize="9" fill="#475569">{name.slice(0, 14)}</text>
          </g>
        ))}
      </g>
    </svg>
  );
}
