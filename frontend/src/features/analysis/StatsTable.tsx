import type { AnalysisStats, ChannelStats, DataInfo } from "../../types/nirs";
import { formatNumber } from "../../lib/utils";

const metricRows: Array<[keyof ChannelStats, string]> = [
  ["o2hb", "O2Hb"],
  ["hhb", "HHb"],
  ["thb", "THb"],
  ["hbdiff", "HbDiff"],
  ["toi", "TOI"],
];

function StatCell({ info }: { info: DataInfo }) {
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
      <span className="text-slate-500">Min</span>
      <span className="text-right tabular-nums">{formatNumber(info.min.value)}</span>
      <span className="text-slate-500">Max</span>
      <span className="text-right tabular-nums">{formatNumber(info.max.value)}</span>
      <span className="text-slate-500">Avg</span>
      <span className="text-right tabular-nums">{formatNumber(info.average)}</span>
      <span className="text-slate-500">Slope</span>
      <span className="text-right tabular-nums">{formatNumber(info.slope)}</span>
      <span className="text-slate-500">r</span>
      <span className="text-right tabular-nums">{formatNumber(info.r)}</span>
    </div>
  );
}

export function StatsTable({ stats }: { stats: AnalysisStats }) {
  return (
    <div className="overflow-hidden rounded-md border border-slate-200">
      <table className="w-full border-collapse text-left">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="w-16 border-b border-slate-200 p-2 font-medium">Signal</th>
            <th className="border-b border-slate-200 p-2 font-medium">Channel 1</th>
            <th className="border-b border-slate-200 p-2 font-medium">Channel 2</th>
          </tr>
        </thead>
        <tbody>
          {metricRows.map(([key, label]) => (
            <tr key={key} className="border-b border-slate-100 last:border-0">
              <th className="bg-white p-2 align-top text-xs font-semibold text-slate-700">{label}</th>
              <td className="p-2 align-top">
                <StatCell info={stats.channel1[key]} />
              </td>
              <td className="p-2 align-top">
                <StatCell info={stats.channel2[key]} />
              </td>
            </tr>
          ))}
          <tr>
            <th className="bg-white p-2 align-top text-xs font-semibold text-slate-700">Load</th>
            <td className="p-2 align-top" colSpan={2}>
              <StatCell info={stats.loadCell} />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
