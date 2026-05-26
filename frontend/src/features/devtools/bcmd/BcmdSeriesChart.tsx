import { useMemo } from "react";
import * as d3 from "d3";

export type BcmdChartSeries = {
  name: string;
  points: Array<{ time: number; value: number }>;
};

const palette = ["#0f766e", "#2563eb", "#b45309", "#be123c", "#7c3aed", "#0891b2"];

export function BcmdSeriesChart({ series, height = 230 }: { series: BcmdChartSeries[]; height?: number }) {
  const layout = useMemo(() => {
    const width = 720;
    const margin = { top: 14, right: 18, bottom: 32, left: 48 };
    const all = series.flatMap((item) => item.points);
    const maxTime = Math.max(1, ...all.map((point) => point.time));
    const values = all.map((point) => point.value).filter(Number.isFinite);
    const minValue = Math.min(0, ...values);
    const maxValue = Math.max(1, ...values);
    const x = d3.scaleLinear().domain([0, maxTime]).range([margin.left, width - margin.right]);
    const y = d3.scaleLinear().domain(minValue === maxValue ? [minValue - 1, maxValue + 1] : [minValue, maxValue]).nice().range([height - margin.bottom, margin.top]);
    const xTicks = x.ticks(6).map((tick) => ({ value: tick, x: x(tick) }));
    const yTicks = y.ticks(4).map((tick) => ({ value: tick, y: y(tick) }));
    return { width, margin, x, y, xTicks, yTicks };
  }, [height, series]);

  const line = d3.line<{ time: number; value: number }>().x((point) => layout.x(point.time)).y((point) => layout.y(point.value)).curve(d3.curveStepAfter);

  return (
    <svg className="w-full rounded-md border border-slate-200 bg-white" viewBox={`0 0 ${layout.width} ${height}`} role="img">
      {layout.yTicks.map((tick) => (
        <g key={tick.value}>
          <line x1={layout.margin.left} x2={layout.width - layout.margin.right} y1={tick.y} y2={tick.y} stroke="#e2e8f0" />
          <text x={layout.margin.left - 8} y={tick.y + 4} textAnchor="end" fontSize="10" fill="#64748b">{tick.value.toFixed(2)}</text>
        </g>
      ))}
      {layout.xTicks.map((tick) => (
        <text key={tick.value} x={tick.x} y={height - 10} textAnchor="middle" fontSize="10" fill="#64748b">{tick.value.toFixed(1)}s</text>
      ))}
      {series.map((item, index) => (
        <path key={item.name} d={line(item.points) ?? ""} fill="none" stroke={palette[index % palette.length]} strokeWidth={2} />
      ))}
      <g transform={`translate(${layout.margin.left}, ${layout.margin.top})`}>
        {series.slice(0, 6).map((item, index) => (
          <g key={item.name} transform={`translate(${index * 96}, 0)`}>
            <rect width={9} height={9} fill={palette[index % palette.length]} />
            <text x={14} y={8} fontSize="10" fill="#334155">{item.name}</text>
          </g>
        ))}
      </g>
    </svg>
  );
}
