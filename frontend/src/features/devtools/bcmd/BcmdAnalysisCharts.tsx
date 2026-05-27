import { useMemo } from "react";
import * as d3 from "d3";
import type { OptimizationResult } from "../../../lib/bcmd/optimizer";
import type { SensitivityResult } from "../../../lib/bcmd/sensitivity";

export function BcmdSensitivityHeatmap({ sensitivity }: { sensitivity: SensitivityResult[] }) {
  const layout = useMemo(() => {
    const width = 320;
    const cell = 34;
    const margin = { top: 12, right: 14, bottom: 64, left: 58 };
    const metrics = [
      { key: "effectAbsMean" as const, label: "mu*" },
      { key: "effectStdDev" as const, label: "sigma" },
      { key: "varianceShare" as const, label: "var" },
    ];
    const values = sensitivity.flatMap((item) => metrics.map((metric) => Number(item[metric.key]) || 0));
    const max = Math.max(1e-9, ...values);
    return { width, height: margin.top + sensitivity.length * cell + margin.bottom, cell, margin, metrics, max };
  }, [sensitivity]);

  return (
    <svg className="w-full rounded-md border border-slate-200 bg-white" viewBox={`0 0 ${layout.width} ${layout.height}`} role="img" aria-label="BCMD sensitivity heat map">
      {sensitivity.map((item, row) => (
        <g key={item.name} transform={`translate(0, ${layout.margin.top + row * layout.cell})`}>
          <text x={layout.margin.left - 8} y={layout.cell / 2 + 4} textAnchor="end" fontSize="10" fill="#475569">{item.name}</text>
          {layout.metrics.map((metric, col) => {
            const raw = Number(item[metric.key]) || 0;
            const intensity = Math.max(0, Math.min(1, raw / layout.max));
            return (
              <g key={metric.key} transform={`translate(${layout.margin.left + col * layout.cell}, 0)`}>
                <rect width={layout.cell - 2} height={layout.cell - 2} fill={d3.interpolateYlOrRd(intensity)} />
                <text x={(layout.cell - 2) / 2} y={layout.cell / 2 + 4} textAnchor="middle" fontSize="9" fill={intensity > 0.55 ? "white" : "#334155"}>
                  {raw.toFixed(raw >= 10 ? 0 : 2)}
                </text>
              </g>
            );
          })}
        </g>
      ))}
      {layout.metrics.map((metric, col) => (
        <text key={metric.key} x={layout.margin.left + col * layout.cell + layout.cell / 2} y={layout.height - 28} textAnchor="middle" fontSize="10" fill="#475569">{metric.label}</text>
      ))}
    </svg>
  );
}

export function BcmdBestFitChart({ result }: { result: OptimizationResult }) {
  const layout = useMemo(() => {
    const width = 320;
    const height = 190;
    const margin = { top: 16, right: 14, bottom: 34, left: 48 };
    const scores = result.history.map((item) => item.score).filter(Number.isFinite);
    const x = d3.scaleLinear().domain([0, Math.max(1, result.history.length - 1)]).range([margin.left, width - margin.right]);
    const y = d3.scaleLinear().domain([Math.min(...scores), Math.max(...scores)]).nice().range([height - margin.bottom, margin.top]);
    const best: Array<{ iteration: number; score: number }> = [];
    let bestScore = Number.POSITIVE_INFINITY;
    for (const item of result.history) {
      if (item.score < bestScore) bestScore = item.score;
      best.push({ iteration: item.iteration, score: bestScore });
    }
    return { width, height, margin, x, y, best };
  }, [result]);
  const line = d3.line<{ iteration: number; score: number }>().x((point) => layout.x(point.iteration)).y((point) => layout.y(point.score));

  return (
    <svg className="w-full rounded-md border border-slate-200 bg-white" viewBox={`0 0 ${layout.width} ${layout.height}`} role="img" aria-label="BCMD best fit trace">
      {layout.y.ticks(4).map((tick) => (
        <g key={tick}>
          <line x1={layout.margin.left} x2={layout.width - layout.margin.right} y1={layout.y(tick)} y2={layout.y(tick)} stroke="#e2e8f0" />
          <text x={layout.margin.left - 8} y={layout.y(tick) + 4} textAnchor="end" fontSize="10" fill="#64748b">{tick.toFixed(2)}</text>
        </g>
      ))}
      {layout.x.ticks(5).map((tick) => (
        <text key={tick} x={layout.x(tick)} y={layout.height - 10} textAnchor="middle" fontSize="10" fill="#64748b">{tick.toFixed(0)}</text>
      ))}
      <path d={line(layout.best) ?? ""} fill="none" stroke="#0f766e" strokeWidth={2} />
      <text x={layout.margin.left} y={12} fontSize="10" fill="#475569">Best score by iteration</text>
    </svg>
  );
}
