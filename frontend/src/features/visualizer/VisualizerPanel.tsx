import { FileUp, Play, Square } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { veinCoordinates } from "./veins";

type VisualizerPanelProps = {
  useToi: boolean;
  visualPercent: number;
  visualAsset: string;
  mode: "realtime" | "full";
  setMode: (mode: "realtime" | "full") => void;
  contractionType: "forearm" | "neck";
  setContractionType: (type: "forearm" | "neck") => void;
  activeVeins: number;
  profileName: string;
  profileFrame: number;
  profileLength: number;
  running: boolean;
  onLoadFiles: (files: FileList | null) => void;
  onStart: () => void;
  onStop: () => void;
};

export function VisualizerPanel({
  useToi,
  visualPercent,
  visualAsset,
  mode,
  setMode,
  contractionType,
  setContractionType,
  activeVeins,
  profileName,
  profileFrame,
  profileLength,
  running,
  onLoadFiles,
  onStart,
  onStop,
}: VisualizerPanelProps) {
  return (
    <Card className="overflow-hidden">
      <div className="grid gap-0 lg:grid-cols-[180px_minmax(0,1fr)]">
        <aside className="border-b border-slate-200 bg-white p-3 lg:border-b-0 lg:border-r">
          <div className="mb-3 grid grid-cols-2 gap-1 rounded-md bg-slate-100 p-1">
            {(["realtime", "full"] as const).map((item) => (
              <button
                key={item}
                type="button"
                className={`rounded px-2 py-1 text-xs font-medium capitalize ${
                  mode === item ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"
                }`}
                onClick={() => setMode(item)}
              >
                {item === "realtime" ? "Real time" : "Full"}
              </button>
            ))}
          </div>
          <div className="mb-3 text-sm font-semibold text-slate-900">Contractions</div>
          <div className="space-y-2">
            {(["forearm", "neck"] as const).map((type) => (
              <button
                key={type}
                type="button"
                className={`w-full rounded-md border px-3 py-2 text-left text-sm capitalize ${
                  contractionType === type
                    ? "border-teal-700 bg-teal-50 text-teal-900"
                    : "border-slate-200 bg-white text-slate-700"
                }`}
                onClick={() => setContractionType(type)}
              >
                {type}
              </button>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={onStart} disabled={running}>
              <Play size={14} /> {profileName ? "Start" : "Start Demo"}
            </Button>
            <Button size="sm" variant="ghost" onClick={onStop}>
              <Square size={14} /> {profileName ? "Stop" : "Stop Demo"}
            </Button>
          </div>
          {mode === "full" && (
            <label className="mt-3 flex h-9 cursor-pointer items-center justify-center gap-2 rounded-md border border-slate-200 bg-white text-sm">
              <FileUp size={14} /> Load
              <input
                className="hidden"
                type="file"
                accept=".csv,.txt"
                multiple
                onChange={(event) => onLoadFiles(event.target.files)}
              />
            </label>
          )}
          <img
            className="mt-4 aspect-[4/3] w-full rounded-md border border-slate-200 object-cover"
            src={contractionType === "forearm" ? "/nirs-assets/images/muscletop.jpg" : "/nirs-assets/images/musclebottom.jpg"}
            alt={`${contractionType} muscle model`}
          />
          <div className="mt-3 rounded-md bg-slate-50 p-2 text-xs text-slate-600">
            Active veins: {activeVeins} / 20
            {profileName && (
              <>
                <div className="mt-1 truncate">Profile: {profileName}</div>
                <div className="mt-1">
                  Frame: {profileFrame} / {profileLength}
                </div>
              </>
            )}
          </div>
        </aside>
        <div className="relative h-[360px] bg-slate-900">
          <svg className="h-full w-full" viewBox="0 0 800 350" role="img" aria-label="NIRS visualizer vein canvas">
            {mode === "full" && (
              <image href="/nirs-assets/images/tissue.png" x="0" y="0" width="800" height="350" preserveAspectRatio="xMidYMid slice" />
            )}
            <image href="/nirs-assets/images/device.png" x="0" y="0" width="800" height="350" preserveAspectRatio="xMidYMid meet" />
            <image href="/nirs-assets/images/light.gif" x="0" y="68" width="800" height="200" opacity="0.8" preserveAspectRatio="xMidYMid meet" />
            {veinCoordinates.slice(0, activeVeins).map((vein, index) => (
              <image
                key={`${vein.x}-${vein.y}-${index}`}
                href={visualAsset}
                x={vein.x}
                y={vein.y}
                width={vein.width}
                height={vein.height}
                opacity="0.88"
                preserveAspectRatio="xMidYMid meet"
                transform={`rotate(${vein.rotation} ${vein.x + vein.width / 2} ${vein.y + vein.height / 2})`}
              />
            ))}
          </svg>
          <div className="absolute left-4 top-4 rounded-md bg-white/90 px-3 py-2 text-sm font-medium">
            Contraction model: {useToi ? `TOI ${visualPercent}%` : "HbDiff"}
          </div>
        </div>
      </div>
    </Card>
  );
}
