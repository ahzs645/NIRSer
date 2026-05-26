import { Calculator, Trash2 } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { StatBlock } from "../../components/ui/StatBlock";
import { formatNumber } from "../../lib/utils";
import type { AnalysisStats, CalculatedValuesSnapshot } from "../../types/nirs";
import { StatsTable } from "./StatsTable";

type ActiveSectionStatsCardProps = {
  stats: AnalysisStats;
  showTable: boolean;
  snapshots: CalculatedValuesSnapshot[];
  onCalculateValues: () => void;
  onClearSnapshots: () => void;
  onExportSnapshots: () => void;
};

export function ActiveSectionStatsCard({
  stats,
  showTable,
  snapshots,
  onCalculateValues,
  onClearSnapshots,
  onExportSnapshots,
}: ActiveSectionStatsCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle>Active Section Stats</CardTitle>
          <Button size="sm" onClick={onCalculateValues}>
            <Calculator size={14} /> Calculate Values
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {showTable && <StatsTable stats={stats} />}
        <div className="grid grid-cols-2 gap-2">
          <StatBlock label="Ch1 O2 min" value={stats.channel1.o2hb.min.value} time={stats.channel1.o2hb.min.time} />
          <StatBlock label="Ch1 O2 max" value={stats.channel1.o2hb.max.value} time={stats.channel1.o2hb.max.time} />
          <StatBlock label="Ch2 O2 min" value={stats.channel2.o2hb.min.value} time={stats.channel2.o2hb.min.time} />
          <StatBlock label="Ch2 O2 max" value={stats.channel2.o2hb.max.value} time={stats.channel2.o2hb.max.time} />
          <StatBlock label="Avg" value={stats.loadCell.average} />
          <StatBlock label="Slope" value={stats.loadCell.slope} />
        </div>
        {snapshots.length > 0 && (
          <div className="rounded-md border border-slate-200">
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 bg-slate-50 px-3 py-2">
              <div className="text-xs font-semibold uppercase text-slate-500">Calculated Values</div>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={onExportSnapshots}>
                  Export
                </Button>
                <Button size="sm" variant="ghost" onClick={onClearSnapshots}>
                  <Trash2 size={14} /> Clear
                </Button>
              </div>
            </div>
            <div className="max-h-72 overflow-auto">
              {snapshots.map((snapshot) => (
                <div key={snapshot.id} className="border-b border-slate-100 p-3 last:border-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-medium text-slate-900">{snapshot.sectionName}</div>
                    <div className="text-xs text-slate-500">{new Date(snapshot.calculatedAt).toLocaleTimeString()}</div>
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {formatNumber(snapshot.initialTime)}-{formatNumber(snapshot.endTime)}s, filter passes {snapshot.filterPasses}
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded bg-white p-2">
                      <div className="text-slate-500">Ch1 O2 avg</div>
                      <div className="font-medium tabular-nums">{formatNumber(snapshot.stats.channel1.o2hb.average)}</div>
                    </div>
                    <div className="rounded bg-white p-2">
                      <div className="text-slate-500">Ch2 O2 avg</div>
                      <div className="font-medium tabular-nums">{formatNumber(snapshot.stats.channel2.o2hb.average)}</div>
                    </div>
                    <div className="rounded bg-white p-2">
                      <div className="text-slate-500">Load avg</div>
                      <div className="font-medium tabular-nums">{formatNumber(snapshot.stats.loadCell.average)}</div>
                    </div>
                    <div className="rounded bg-white p-2">
                      <div className="text-slate-500">Load slope</div>
                      <div className="font-medium tabular-nums">{formatNumber(snapshot.stats.loadCell.slope)}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
