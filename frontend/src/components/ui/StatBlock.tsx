import { formatNumber } from "../../lib/utils";

export function StatBlock({ label, value, time }: { label: string; value: number; time?: number }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-sm font-semibold text-slate-950">{formatNumber(value, label === "Avg" ? 5 : 2)}</div>
      {time !== undefined && <div className="text-xs text-slate-500">{formatNumber(time)}s</div>}
    </div>
  );
}
