import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/field";

type SeriesVisible = {
  o2hb: boolean;
  hhb: boolean;
  thb: boolean;
  hbdiff: boolean;
  toi: boolean;
};

type PanesVisible = {
  channel1: boolean;
  channel2: boolean;
  loadCell: boolean;
};

type Bounds = {
  channel1LowerX: string;
  channel1UpperX: string;
  channel1Lower: string;
  channel1Upper: string;
  channel2LowerX: string;
  channel2UpperX: string;
  channel2Lower: string;
  channel2Upper: string;
};

const seriesLabels: Record<keyof SeriesVisible, string> = {
  o2hb: "O2Hb",
  hhb: "HHb",
  thb: "THb",
  hbdiff: "HbDiff",
  toi: "TOI",
};

type ChartControlsCardProps = {
  seriesVisible: SeriesVisible;
  setSeriesVisible: (value: SeriesVisible) => void;
  panesVisible: PanesVisible;
  setPanesVisible: (value: PanesVisible) => void;
  autoScaleY: boolean;
  setAutoScaleY: (value: boolean) => void;
  bounds: Bounds;
  setBounds: (value: Bounds) => void;
  onApplyChannelBounds: (channel: "channel1" | "channel2") => void;
};

export function ChartControlsCard({
  seriesVisible,
  setSeriesVisible,
  panesVisible,
  setPanesVisible,
  autoScaleY,
  setAutoScaleY,
  bounds,
  setBounds,
  onApplyChannelBounds,
}: ChartControlsCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Chart Controls</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2 text-sm">
          {Object.entries(seriesVisible).map(([key, value]) => (
            <label key={key} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={value}
                onChange={(event) => setSeriesVisible({ ...seriesVisible, [key]: event.target.checked })}
              />
              {seriesLabels[key as keyof SeriesVisible]}
            </label>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2 text-sm">
          {Object.entries(panesVisible).map(([key, value]) => (
            <label key={key} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={value}
                onChange={(event) => setPanesVisible({ ...panesVisible, [key]: event.target.checked })}
              />
              {key === "loadCell" ? "Load" : key.replace("channel", "Ch ")}
            </label>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={autoScaleY} onChange={(event) => setAutoScaleY(event.target.checked)} />
          Auto-scale Y
        </label>
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Channel 1 bounds</div>
            <Button size="sm" onClick={() => onApplyChannelBounds("channel1")}>
              Set
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Input value={bounds.channel1LowerX} onChange={(event) => setBounds({ ...bounds, channel1LowerX: event.target.value })} placeholder="X low" />
            <Input value={bounds.channel1UpperX} onChange={(event) => setBounds({ ...bounds, channel1UpperX: event.target.value })} placeholder="X high" />
            <Input value={bounds.channel1Lower} onChange={(event) => setBounds({ ...bounds, channel1Lower: event.target.value })} placeholder="Y low" />
            <Input value={bounds.channel1Upper} onChange={(event) => setBounds({ ...bounds, channel1Upper: event.target.value })} placeholder="Y high" />
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Channel 2 bounds</div>
            <Button size="sm" onClick={() => onApplyChannelBounds("channel2")}>
              Set
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Input value={bounds.channel2LowerX} onChange={(event) => setBounds({ ...bounds, channel2LowerX: event.target.value })} placeholder="X low" />
            <Input value={bounds.channel2UpperX} onChange={(event) => setBounds({ ...bounds, channel2UpperX: event.target.value })} placeholder="X high" />
            <Input value={bounds.channel2Lower} onChange={(event) => setBounds({ ...bounds, channel2Lower: event.target.value })} placeholder="Y low" />
            <Input value={bounds.channel2Upper} onChange={(event) => setBounds({ ...bounds, channel2Upper: event.target.value })} placeholder="Y high" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
