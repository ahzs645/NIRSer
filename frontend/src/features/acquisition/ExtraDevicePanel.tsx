import { useState } from "react";
import { PlugZap, X } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Input, Label } from "../../components/ui/field";
import { NirsChart } from "../../components/charts/NirsChart";
import { formatNumber } from "../../lib/utils";
import type { NirsPoint } from "../../types/nirs";

type ExtraDevicePanelProps = {
  channel1: NirsPoint[];
  channel2: NirsPoint[];
  marks: number[];
  status: string;
  selectedPort: string;
  realTimeSave: boolean;
  setRealTimeSave: (value: boolean) => void;
  coordinate: { chart: string; x: number; y: number } | null;
  onCoordinate: (coordinate: { chart: string; x: number; y: number }) => void;
  onSelectPort: () => void;
  onConnectDemo: () => void;
  onDisconnect: () => void;
  onSaveData: () => void;
  onRemove: () => void;
};

export function ExtraDevicePanel({
  channel1,
  channel2,
  marks,
  status,
  selectedPort,
  realTimeSave,
  setRealTimeSave,
  coordinate,
  onCoordinate,
  onSelectPort,
  onConnectDemo,
  onDisconnect,
  onSaveData,
  onRemove,
}: ExtraDevicePanelProps) {
  const [r2Draft, setR2Draft] = useState({ lower: "-15", upper: "15" });
  const [r3Draft, setR3Draft] = useState({ lower: "-15", upper: "15" });
  const [r2Domain, setR2Domain] = useState<[number, number]>([-15, 15]);
  const [r3Domain, setR3Domain] = useState<[number, number]>([-15, 15]);

  function applyDomain(draft: { lower: string; upper: string }, setter: (domain: [number, number]) => void) {
    const lower = Number(draft.lower);
    const upper = Number(draft.upper);
    if (!Number.isFinite(lower) || !Number.isFinite(upper) || lower >= upper) return;
    setter([lower, upper]);
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <div>
          <CardTitle>Extra Device</CardTitle>
          <p className="mt-1 text-xs text-slate-500">Status: {status}</p>
          <p className="text-xs text-slate-500">Port: {selectedPort}</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={onSaveData}>
            Save data
          </Button>
          <Button size="sm" onClick={onSelectPort}>
            Select Port
          </Button>
          <Button size="sm" onClick={onConnectDemo}>
            <PlugZap size={14} /> Demo
          </Button>
          <Button size="sm" variant="ghost" onClick={onDisconnect}>
            Disconnect
          </Button>
          <Button size="icon" variant="danger" onClick={onRemove} aria-label="Remove extra device">
            <X size={14} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_220px]">
        <div className="space-y-3">
          <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
            {coordinate
              ? `${coordinate.chart}: X ${formatNumber(coordinate.x)}s, Y ${formatNumber(coordinate.y)}`
              : "Move over an extra-device chart to inspect X/Y coordinates"}
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            <div className="h-[260px]">
              <NirsChart title="Extra Device R2 / IR2" data={channel1} marks={marks} yDomain={r2Domain} onCoordinate={onCoordinate} />
            </div>
            <div className="h-[260px]">
              <NirsChart title="Extra Device R3 / IR3" data={channel2} marks={marks} yDomain={r3Domain} onCoordinate={onCoordinate} />
            </div>
          </div>
        </div>
        <div className="space-y-4 rounded-md border border-slate-200 bg-slate-50 p-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={realTimeSave}
              onChange={(event) => setRealTimeSave(event.target.checked)}
            />
            Real time save mode
          </label>
          <div className="space-y-2">
            <div className="text-sm font-medium text-slate-700">R2 IR2 Controls</div>
            <div>
              <Label>Lower bound</Label>
              <Input value={r2Draft.lower} onChange={(event) => setR2Draft({ ...r2Draft, lower: event.target.value })} />
            </div>
            <div>
              <Label>Upper bound</Label>
              <Input value={r2Draft.upper} onChange={(event) => setR2Draft({ ...r2Draft, upper: event.target.value })} />
            </div>
            <Button className="w-full" onClick={() => applyDomain(r2Draft, setR2Domain)}>
              Set ranges
            </Button>
          </div>
          <div className="space-y-2 border-t border-slate-200 pt-3">
            <div className="text-sm font-medium text-slate-700">R3 IR3 Controls</div>
            <div>
              <Label>Lower bound</Label>
              <Input value={r3Draft.lower} onChange={(event) => setR3Draft({ ...r3Draft, lower: event.target.value })} />
            </div>
            <div>
              <Label>Upper bound</Label>
              <Input value={r3Draft.upper} onChange={(event) => setR3Draft({ ...r3Draft, upper: event.target.value })} />
            </div>
            <Button className="w-full" onClick={() => applyDomain(r3Draft, setR3Domain)}>
              Set ranges
            </Button>
          </div>
          <div className="max-h-24 overflow-auto rounded-md border border-slate-200 bg-white p-2 text-xs text-slate-600">
            {marks.map((mark, index) => (
              <div key={`${mark}-${index}`}>Mark {index + 1}: {mark.toFixed(2)}s</div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
