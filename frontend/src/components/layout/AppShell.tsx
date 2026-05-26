import type { ReactNode } from "react";
import {
  Activity,
  BarChart3,
  FileUp,
  Gauge,
  Pause,
  Play,
  RotateCcw,
  Save,
  Square,
} from "lucide-react";
import { Button } from "../ui/button";
import type { DeviceKind } from "../../types/nirs";

export type AppView = "acquisition" | "analysis" | "visualizer";

type AppShellProps = {
  view: AppView;
  setView: (view: AppView) => void;
  nirsSampleCount: number;
  loadCellPointCount: number;
  markCount: number;
  running: boolean;
  biasActive: boolean;
  deviceKind: DeviceKind;
  deviceKindLocked: boolean;
  startLabel: string;
  onStart: () => void;
  onPause: () => void;
  onDeviceKindChange: (deviceKind: DeviceKind) => void;
  onToggleBias: () => void;
  onStop: () => void;
  onResetDemo: () => void;
  onAddDevice: () => void;
  onSetFrameRate: () => void;
  onSaveData: () => void;
  realTimeSave: boolean;
  onToggleRealTimeSave: (value: boolean) => void;
  onLoadDataFiles: (files: FileList | null) => void;
  onOpenRealTimeVisualizer: () => void;
  onOpenVisualizationDemo: () => void;
  onSaveAnalysis: () => void;
  onExportSectionsCsv: () => void;
  onExportHbValuesCsv: () => void;
  onAddMark: () => void;
  onDeleteSection: () => void;
  onLoadVisualizerFiles: (files: FileList | null) => void;
  children: ReactNode;
};

const navItems = [
  ["acquisition", Gauge, "Acquisition"],
  ["analysis", BarChart3, "Analysis"],
  ["visualizer", Activity, "Visualizer"],
] as const;

export function AppShell({
  view,
  setView,
  nirsSampleCount,
  loadCellPointCount,
  markCount,
  running,
  biasActive,
  deviceKind,
  deviceKindLocked,
  startLabel,
  onStart,
  onPause,
  onDeviceKindChange,
  onToggleBias,
  onStop,
  onResetDemo,
  onAddDevice,
  onSetFrameRate,
  onSaveData,
  realTimeSave,
  onToggleRealTimeSave,
  onLoadDataFiles,
  onOpenRealTimeVisualizer,
  onOpenVisualizationDemo,
  onSaveAnalysis,
  onExportSectionsCsv,
  onExportHbValuesCsv,
  onAddMark,
  onDeleteSection,
  onLoadVisualizerFiles,
  children,
}: AppShellProps) {
  const isAnalysis = view === "analysis";
  const isVisualizer = view === "visualizer";
  const isAcquisition = view === "acquisition";

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <aside className="fixed inset-y-0 left-0 z-10 hidden w-64 border-r border-slate-200 bg-white p-4 lg:block">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-teal-700 text-white">
            <Activity size={20} />
          </div>
          <div>
            <h1 className="text-base font-semibold">NIRSer Web</h1>
            <p className="text-xs text-slate-500">Client-side NIRS workstation</p>
          </div>
        </div>
        <nav className="space-y-2">
          {navItems.map(([key, Icon, label]) => (
            <Button
              key={key}
              variant={view === key ? "primary" : "ghost"}
              className="w-full justify-start"
              onClick={() => setView(key)}
            >
              <Icon size={16} /> {label}
            </Button>
          ))}
        </nav>
      </aside>

      <section className="lg:pl-64">
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold capitalize">{view}</h2>
              <p className="text-sm text-slate-500">
                {nirsSampleCount} NIRS samples, {loadCellPointCount} load-cell points, {markCount} marks
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <details className="relative">
                <summary className="flex h-10 cursor-pointer list-none items-center justify-center rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-800 hover:bg-slate-50">
                  File
                </summary>
                <div className="absolute right-0 z-20 mt-2 w-56 rounded-md border border-slate-200 bg-white p-2 shadow-lg">
                  {isAnalysis ? (
                    <>
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                        onClick={onSaveAnalysis}
                      >
                        <Save size={15} /> Save
                      </button>
                      <button
                        type="button"
                        className="w-full rounded px-2 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                        onClick={onExportSectionsCsv}
                      >
                        Export sections as CSV
                      </button>
                      <button
                        type="button"
                        className="w-full rounded px-2 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                        onClick={onExportHbValuesCsv}
                      >
                        Export Hb values as CSV
                      </button>
                    </>
                  ) : isVisualizer ? (
                    <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-2 text-sm text-slate-700 hover:bg-slate-50">
                      <FileUp size={15} /> Load
                      <input
                        className="hidden"
                        type="file"
                        accept=".csv,.txt"
                        onChange={(event) => onLoadVisualizerFiles(event.target.files)}
                      />
                    </label>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                        onClick={onSaveData}
                      >
                        <Save size={15} /> Save Data
                      </button>
                      <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-2 text-sm text-slate-700 hover:bg-slate-50">
                        <input
                          type="checkbox"
                          checked={realTimeSave}
                          onChange={(event) => onToggleRealTimeSave(event.target.checked)}
                        />
                        Real time save mode
                      </label>
                      <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-2 text-sm text-slate-700 hover:bg-slate-50">
                        <FileUp size={15} /> Load data file
                        <input
                          className="hidden"
                          type="file"
                          accept=".csv,.txt,.json"
                          multiple
                          onChange={(event) => onLoadDataFiles(event.target.files)}
                        />
                      </label>
                    </>
                  )}
                </div>
              </details>
              <details className="relative">
                <summary className="flex h-10 cursor-pointer list-none items-center justify-center rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-800 hover:bg-slate-50">
                  Options
                </summary>
                <div className="absolute right-0 z-20 mt-2 w-56 rounded-md border border-slate-200 bg-white p-2 shadow-lg">
                  {isAnalysis ? (
                    <>
                      <button
                        type="button"
                        className="w-full rounded px-2 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                        onClick={onAddMark}
                      >
                        Add mark
                      </button>
                      <button
                        type="button"
                        className="w-full rounded px-2 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                        onClick={onDeleteSection}
                      >
                        Delete section
                      </button>
                    </>
                  ) : isVisualizer ? (
                    <div className="rounded px-2 py-2 text-sm text-slate-500">No visualizer options</div>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="w-full rounded px-2 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                        onClick={onSetFrameRate}
                      >
                        Set frame rate
                      </button>
                      <button
                        type="button"
                        className="w-full rounded px-2 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                        onClick={onAddDevice}
                      >
                        Add device
                      </button>
                      <button
                        type="button"
                        className="w-full rounded px-2 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                        onClick={onOpenRealTimeVisualizer}
                      >
                        Real time visualization
                      </button>
                      <button
                        type="button"
                        className="w-full rounded px-2 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                        onClick={onOpenVisualizationDemo}
                      >
                        Visualization demo
                      </button>
                    </>
                  )}
                </div>
              </details>
              {navItems.map(([key, Icon, label]) => (
                <Button key={key} variant={view === key ? "primary" : "secondary"} onClick={() => setView(key)}>
                  <Icon size={16} /> {label}
                </Button>
              ))}
              {isAcquisition && (
                <div
                  className="flex h-10 overflow-hidden rounded-md border border-slate-200 bg-slate-50"
                  aria-label="Device type"
                >
                  {(
                    [
                      ["pathonix", "Pathonix"],
                      ["unbc", "UNBC Device"],
                    ] as const
                  ).map(([kind, label]) => (
                    <button
                      key={kind}
                      type="button"
                      className={`px-3 text-sm font-medium transition ${
                        deviceKind === kind
                          ? "bg-teal-700 text-white"
                          : "text-slate-700 hover:bg-white disabled:text-slate-400"
                      }`}
                      disabled={deviceKindLocked}
                      onClick={() => onDeviceKindChange(kind)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
              <Button onClick={onStart} variant="primary" disabled={running}>
                <Play size={16} /> {startLabel}
              </Button>
              <Button onClick={onPause} variant="secondary" disabled={!running}>
                <Pause size={16} /> Pause
              </Button>
              <Button onClick={onToggleBias} variant={biasActive ? "primary" : "secondary"}>
                <Gauge size={16} /> {biasActive ? "Clear Bias" : "Bias"}
              </Button>
              {isAcquisition && (
                <Button onClick={onAddMark} variant="secondary">
                  Mark
                </Button>
              )}
              <Button onClick={onStop}>
                <Square size={16} /> Stop
              </Button>
              <Button onClick={onResetDemo}>
                <RotateCcw size={16} /> Demo
              </Button>
              <Button onClick={onAddDevice}>
                <Activity size={16} /> Add Device
              </Button>
              <Button onClick={onSaveData}>
                <Save size={16} /> Save Data
              </Button>
            </div>
          </div>
        </header>
        {children}
      </section>
    </main>
  );
}
