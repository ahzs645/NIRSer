import { Play } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Input, Label, Select } from "../../components/ui/field";
import type { BrunoBoundaryConditions, BrunoSeparationMode } from "../../lib/bruno";

type Props = {
  boundaryConditions: BrunoBoundaryConditions;
  setBoundaryConditions: (value: BrunoBoundaryConditions) => void;
  separationMode: BrunoSeparationMode;
  setSeparationMode: (value: BrunoSeparationMode) => void;
  distance: string;
  setDistance: (value: string) => void;
  distanceMax: string;
  setDistanceMax: (value: string) => void;
  waveStart: string;
  setWaveStart: (value: string) => void;
  waveEnd: string;
  setWaveEnd: (value: string) => void;
  maxIterations: string;
  setMaxIterations: (value: string) => void;
  startBounds: string;
  setStartBounds: (value: string) => void;
  lowerBounds: string;
  setLowerBounds: (value: string) => void;
  upperBounds: string;
  setUpperBounds: (value: string) => void;
  slopeRows: number;
  extinctionRows: number;
  error: string | null;
  onRunFit: () => void;
};

export function BrunoFitSettingsCard({
  boundaryConditions,
  setBoundaryConditions,
  separationMode,
  setSeparationMode,
  distance,
  setDistance,
  distanceMax,
  setDistanceMax,
  waveStart,
  setWaveStart,
  waveEnd,
  setWaveEnd,
  maxIterations,
  setMaxIterations,
  startBounds,
  setStartBounds,
  lowerBounds,
  setLowerBounds,
  upperBounds,
  setUpperBounds,
  slopeRows,
  extinctionRows,
  error,
  onRunFit,
}: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Fit Settings</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1">
            <Label>Boundary</Label>
            <Select value={boundaryConditions} onChange={(event) => setBoundaryConditions(event.target.value as BrunoBoundaryConditions)}>
              <option value="ZBC">ZBC</option>
              <option value="EBC">EBC</option>
            </Select>
          </label>
          <label className="space-y-1">
            <Label>Separation</Label>
            <Select value={separationMode} onChange={(event) => setSeparationMode(event.target.value as BrunoSeparationMode)}>
              <option value="close">Close</option>
              <option value="far">Far</option>
            </Select>
          </label>
          <label className="space-y-1">
            <Label>Distance</Label>
            <Input value={distance} onChange={(event) => setDistance(event.target.value)} />
          </label>
          <label className="space-y-1">
            <Label>Max distance</Label>
            <Input value={distanceMax} onChange={(event) => setDistanceMax(event.target.value)} disabled={separationMode === "close"} />
          </label>
          <label className="space-y-1">
            <Label>Wave start</Label>
            <Input value={waveStart} onChange={(event) => setWaveStart(event.target.value)} />
          </label>
          <label className="space-y-1">
            <Label>Wave end</Label>
            <Input value={waveEnd} onChange={(event) => setWaveEnd(event.target.value)} />
          </label>
        </div>
        <label className="space-y-1">
          <Label>Start: water, HHb, HbO2, a, b</Label>
          <Input value={startBounds} onChange={(event) => setStartBounds(event.target.value)} />
        </label>
        <label className="space-y-1">
          <Label>Lower bounds</Label>
          <Input value={lowerBounds} onChange={(event) => setLowerBounds(event.target.value)} />
        </label>
        <label className="space-y-1">
          <Label>Upper bounds</Label>
          <Input value={upperBounds} onChange={(event) => setUpperBounds(event.target.value)} />
        </label>
        <label className="space-y-1">
          <Label>Max iterations</Label>
          <Input value={maxIterations} onChange={(event) => setMaxIterations(event.target.value)} />
        </label>
        <div className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">
          Parsed {slopeRows} slope rows and {extinctionRows} extinction rows.
        </div>
        {error && <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}
        <Button className="w-full" variant="primary" onClick={onRunFit}>
          <Play size={16} /> Run BRUNO Fit
        </Button>
      </CardContent>
    </Card>
  );
}
