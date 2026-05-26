import { FileUp } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Input, Label, Select } from "../../components/ui/field";
import { formatNumber } from "../../lib/utils";
import type { AppSettings } from "../../types/nirs";

// The legacy app's "Set frame rate" was a fixed dropdown (default 9 packets/s); mirror that
// as preset options while still honoring any custom rate loaded from a settings file.
const NIRS_FRAME_RATE_PRESETS = [1, 2, 3, 5, 9, 10, 15, 20, 25, 30];

type DeviceCardProps = {
  settings: AppSettings;
  setSettings: (settings: AppSettings) => void;
  sessionBaseName: string;
  setSessionBaseName: (value: string) => void;
  biasLabel: string;
  biasTimeDraft: string;
  setBiasTimeDraft: (value: string) => void;
  applyBiasTime: () => void;
  maxTimeDraft: string;
  setMaxTimeDraft: (value: string) => void;
  applyMaxTime: () => void;
  maxTimeError: string | null;
  loadCellStatus: string;
  loadCellVisible: boolean;
  setLoadCellVisible: (value: boolean) => void;
  realTimeSave: boolean;
  realTimeSaveStatus: string;
  hasAutosaveSnapshot: boolean;
  setRealTimeSave: (value: boolean) => void;
  restoreAutosaveSnapshot: () => void;
  clearAutosaveSnapshot: () => void;
  downloadAutosaveSnapshot: () => void;
  setLoadCellPointsPerSecond: (pointsPerSecond: number) => void;
  connectLoadCell: () => void;
  disconnectLoadCell: () => void;
  serialPortLabel: string;
  serialStatus: string;
  serialEventCount: number;
  serialConnected: boolean;
  webSerialSupported: boolean;
  connectSerial: () => void;
  disconnectSerial: () => void;
  exportSerialLog: () => void;
  importDataBundle: (files: FileList | File[] | null) => void;
  importNirsFile: (file: File | null) => void;
  importLoadCellFile: (file: File | null) => void;
  importSettingsFile: (file: File | null) => void;
  exportSettings: () => void;
  exportSessionBundle: () => void;
};

export function DeviceCard({
  settings,
  setSettings,
  sessionBaseName,
  setSessionBaseName,
  biasLabel,
  biasTimeDraft,
  setBiasTimeDraft,
  applyBiasTime,
  maxTimeDraft,
  setMaxTimeDraft,
  applyMaxTime,
  maxTimeError,
  loadCellStatus,
  loadCellVisible,
  setLoadCellVisible,
  realTimeSave,
  realTimeSaveStatus,
  hasAutosaveSnapshot,
  setRealTimeSave,
  restoreAutosaveSnapshot,
  clearAutosaveSnapshot,
  downloadAutosaveSnapshot,
  setLoadCellPointsPerSecond,
  connectLoadCell,
  disconnectLoadCell,
  serialPortLabel,
  serialStatus,
  serialEventCount,
  serialConnected,
  webSerialSupported,
  connectSerial,
  disconnectSerial,
  exportSerialLog,
  importDataBundle,
  importNirsFile,
  importLoadCellFile,
  importSettingsFile,
  exportSettings,
  exportSessionBundle,
}: DeviceCardProps) {
  function updatePositiveSetting(key: "nirsTimePerPacket" | "loadCellTimePerPacket" | "nirsFrameRate" | "loadCellFrameRate", value: string) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) return;
    setSettings({ ...settings, [key]: numeric });
  }

  const frameRateOptions = NIRS_FRAME_RATE_PRESETS.includes(settings.nirsFrameRate)
    ? NIRS_FRAME_RATE_PRESETS
    : [settings.nirsFrameRate, ...NIRS_FRAME_RATE_PRESETS].sort((left, right) => left - right);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Device</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <Label>Device type</Label>
          <Select
            value={settings.deviceKind}
            onChange={(event) => setSettings({ ...settings, deviceKind: event.target.value as AppSettings["deviceKind"] })}
          >
            <option value="pathonix">Pathonix</option>
            <option value="unbc">UNBC Device</option>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label>NIRS sec/packet</Label>
            <Input
              type="number"
              step="0.001"
              value={settings.nirsTimePerPacket}
              onChange={(event) => updatePositiveSetting("nirsTimePerPacket", event.target.value)}
            />
          </div>
          <div>
            <Label>Load sec/point</Label>
            <Input
              type="number"
              step="0.001"
              value={settings.loadCellTimePerPacket}
              onChange={(event) => updatePositiveSetting("loadCellTimePerPacket", event.target.value)}
            />
          </div>
        </div>
        <div id="frame-rate-settings" className="grid grid-cols-2 gap-2 scroll-mt-24">
          <div>
            <Label>NIRS display packets/s</Label>
            <Select
              aria-label="NIRS display packets/s"
              value={String(settings.nirsFrameRate)}
              onChange={(event) => updatePositiveSetting("nirsFrameRate", event.target.value)}
            >
              {frameRateOptions.map((rate) => (
                <option key={rate} value={rate}>
                  {rate}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Load display packets/s</Label>
            <Input
              type="number"
              min="1"
              step="1"
              value={settings.loadCellFrameRate}
              onChange={(event) => updatePositiveSetting("loadCellFrameRate", event.target.value)}
            />
          </div>
        </div>
        <div className="text-xs text-slate-500">
          Frame rate is packets/second and only affects display. Default 9.
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={settings.useToi}
            onChange={(event) => setSettings({ ...settings, useToi: event.target.checked })}
          />
          Use TOI instead of HbDiff
        </label>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={exportSettings}>
            Export Settings
          </Button>
          <label className="flex h-9 cursor-pointer items-center justify-center gap-2 rounded-md border border-slate-200 bg-white text-sm">
            <FileUp size={14} /> Import Settings
            <input
              className="hidden"
              type="file"
              accept=".json,application/json"
              onChange={(event) => importSettingsFile(event.target.files?.[0] ?? null)}
            />
          </label>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={realTimeSave}
            onChange={(event) => setRealTimeSave(event.target.checked)}
          />
          Real time save mode
        </label>
        <div>
          <Label>Session file name</Label>
          <Input value={sessionBaseName} onChange={(event) => setSessionBaseName(event.target.value)} />
          <div className="mt-1 text-xs text-slate-500">
            Save Data writes matching NIRS, load-cell, marks, and sections sidecars.
          </div>
          <Button className="mt-2 w-full" variant="secondary" onClick={exportSessionBundle}>
            Export Session Bundle
          </Button>
        </div>
        <div className="rounded-md border border-slate-200 bg-slate-50 p-2 text-xs text-slate-600">
          Real-time save: {realTimeSaveStatus}
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Button size="sm" variant="secondary" onClick={restoreAutosaveSnapshot} disabled={!hasAutosaveSnapshot}>
              Restore Snapshot
            </Button>
            <Button size="sm" variant="ghost" onClick={clearAutosaveSnapshot} disabled={!hasAutosaveSnapshot}>
              Clear Snapshot
            </Button>
            <Button className="col-span-2" size="sm" variant="primary" onClick={downloadAutosaveSnapshot}>
              Download Snapshot
            </Button>
          </div>
        </div>
        <div className="space-y-2 rounded-md bg-slate-50 p-2 text-xs text-slate-600">
          <div>Bias: {biasLabel}</div>
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <Input
              type="number"
              step="0.1"
              placeholder="Bias at time (s)"
              aria-label="Bias at time"
              value={biasTimeDraft}
              onChange={(event) => setBiasTimeDraft(event.target.value)}
            />
            <Button variant="secondary" aria-label="Set bias at time" onClick={applyBiasTime}>
              Set Bias
            </Button>
          </div>
        </div>
        <div>
          <Label>Max time</Label>
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <Input
              type="number"
              step="0.1"
              aria-label="Max time"
              value={maxTimeDraft}
              onChange={(event) => setMaxTimeDraft(event.target.value)}
            />
            <Button aria-label="Set max time" onClick={applyMaxTime}>
              Set
            </Button>
          </div>
          {maxTimeError && <div className="mt-1 text-xs text-red-600">{maxTimeError}</div>}
        </div>
        <div className="rounded-md border border-slate-200 bg-slate-50 p-2 text-xs text-slate-600">
          <div>Port: {serialPortLabel}</div>
          <div>Status: {serialStatus}</div>
          <div>Serial log: {serialEventCount} events</div>
          {!webSerialSupported && <div>Web Serial is unavailable in this browser; use CSV import or demo data.</div>}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={connectSerial} disabled={!webSerialSupported}>
            Select Port
          </Button>
          <Button onClick={disconnectSerial} variant="ghost" disabled={!serialConnected}>
            Disconnect
          </Button>
          <Button className="col-span-2" variant="secondary" onClick={exportSerialLog} disabled={serialEventCount === 0}>
            Export Serial Log
          </Button>
        </div>
        <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
          <div className="mb-2 text-sm font-medium text-slate-700">Load Cell</div>
          <div className="space-y-2">
            <div>
              <Label>Serial Number</Label>
              <Input
                value={settings.loadCellSerialNumber}
                onChange={(event) => setSettings({ ...settings, loadCellSerialNumber: event.target.value })}
              />
            </div>
            <div>
              <Label>Points/Second</Label>
              <Select
                value={String(settings.loadCellPointsPerSecond)}
                onChange={(event) => setLoadCellPointsPerSecond(Number(event.target.value))}
              >
                <option value="10">10</option>
                <option value="25">25</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={connectLoadCell}>
                Connect
              </Button>
              <Button variant="ghost" onClick={disconnectLoadCell}>
                Disconnect
              </Button>
              <Button className="col-span-2" variant="secondary" onClick={() => setLoadCellVisible(!loadCellVisible)}>
                {loadCellVisible ? "Hide" : "Show"}
              </Button>
            </div>
            <div className="text-xs text-slate-600">Load-cell status: {loadCellStatus}</div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="col-span-2 flex h-10 cursor-pointer items-center justify-center gap-2 rounded-md border border-slate-200 bg-white text-sm">
            <FileUp size={16} /> Data Bundle
            <input
              className="hidden"
              type="file"
              accept=".csv,.txt,.json"
              multiple
              onChange={(event) => importDataBundle(event.target.files)}
            />
          </label>
          <label className="flex h-10 cursor-pointer items-center justify-center gap-2 rounded-md border border-slate-200 bg-white text-sm">
            <FileUp size={16} /> NIRS CSV
            <input className="hidden" type="file" accept=".csv,.txt" onChange={(event) => importNirsFile(event.target.files?.[0] ?? null)} />
          </label>
          <label className="flex h-10 cursor-pointer items-center justify-center gap-2 rounded-md border border-slate-200 bg-white text-sm">
            <FileUp size={16} /> Load CSV
            <input className="hidden" type="file" accept=".csv,.txt" onChange={(event) => importLoadCellFile(event.target.files?.[0] ?? null)} />
          </label>
        </div>
        <div className="text-xs text-slate-500">Current NIRS interval: {formatNumber(settings.nirsTimePerPacket, 3)}s</div>
      </CardContent>
    </Card>
  );
}
