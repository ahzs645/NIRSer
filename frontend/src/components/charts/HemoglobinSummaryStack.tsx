import { HemoglobinSummaryChart } from "./HemoglobinSummaryChart";
import type { HemoglobinPanelData } from "../../lib/hemoglobinGraphing";

type HemoglobinSummaryStackProps = {
  panels: HemoglobinPanelData[];
};

export function HemoglobinSummaryStack({ panels }: HemoglobinSummaryStackProps) {
  return (
    <div className="grid gap-4">
      {panels.map((panel) => (
        <div key={panel.metric} className="rounded-md border border-slate-200 bg-white p-3">
          <HemoglobinSummaryChart
            title={panel.title}
            yLabel={panel.yLabel}
            series={panel.series}
            xDomain={panel.xDomain}
            yDomain={panel.yDomain}
          />
        </div>
      ))}
    </div>
  );
}
