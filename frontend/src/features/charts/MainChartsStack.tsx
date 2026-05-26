import { Card, CardContent } from "../../components/ui/card";
import { LoadCellChart, type LoadCellOverlay } from "../../components/charts/LoadCellChart";
import { NirsChart, type SeriesOverlay } from "../../components/charts/NirsChart";
import { formatNumber } from "../../lib/utils";
import type { NirsPoint, Point } from "../../types/nirs";

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

type MainChartsStackProps = {
  channel1: NirsPoint[];
  channel2: NirsPoint[];
  loadCell: Point[];
  marks: number[];
  seriesVisible: SeriesVisible;
  panesVisible: PanesVisible;
  channel1XDomain: [number, number] | ["auto", "auto"];
  channel2XDomain: [number, number] | ["auto", "auto"];
  channel1Domain: [number, number] | ["auto", "auto"];
  channel2Domain: [number, number] | ["auto", "auto"];
  loadCellDomain: [number, number];
  coordinate: { chart: string; x: number; y: number } | null;
  onCoordinate: (coordinate: { chart: string; x: number; y: number }) => void;
  channel1Overlays?: SeriesOverlay[];
  channel2Overlays?: SeriesOverlay[];
  loadCellOverlay?: LoadCellOverlay;
  overlayWindow?: [number, number];
  /** False when no device/imported/demo data is loaded yet — shows the empty-state CTA. */
  hasData?: boolean;
  /** Loads the synthetic demo dataset (wired to resetDemo in App). */
  onLoadDemo?: () => void;
};

export function MainChartsStack({
  channel1,
  channel2,
  loadCell,
  marks,
  seriesVisible,
  panesVisible,
  channel1XDomain,
  channel2XDomain,
  channel1Domain,
  channel2Domain,
  loadCellDomain,
  coordinate,
  onCoordinate,
  channel1Overlays,
  channel2Overlays,
  loadCellOverlay,
  overlayWindow,
  hasData = true,
  onLoadDemo,
}: MainChartsStackProps) {
  const coordinateText = coordinate
    ? `${coordinate.chart}: X ${formatNumber(coordinate.x)}s, Y ${formatNumber(coordinate.y)}`
    : "Move over a chart to inspect X/Y · scroll to zoom · drag to pan · double-click to reset";

  return (
    <div className="grid gap-4">
      {hasData ? (
        <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
          {coordinateText}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center">
          <p className="text-sm font-medium text-slate-700">No data loaded yet</p>
          <p className="text-xs text-slate-500">Load the synthetic demo dataset, or connect a device / import a file.</p>
          {onLoadDemo && (
            <button
              type="button"
              onClick={onLoadDemo}
              className="mt-1 rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800"
            >
              Load demo data
            </button>
          )}
        </div>
      )}
      {panesVisible.channel1 && (
        <Card>
          <CardContent className="h-[300px]">
            <NirsChart
              title="Channel 1"
              data={channel1}
              marks={marks}
              visible={seriesVisible}
              xDomain={channel1XDomain}
              yDomain={channel1Domain}
              onCoordinate={onCoordinate}
              overlays={channel1Overlays}
              overlayWindow={overlayWindow}
            />
          </CardContent>
        </Card>
      )}
      {panesVisible.channel2 && (
        <Card>
          <CardContent className="h-[300px]">
            <NirsChart
              title="Channel 2"
              data={channel2}
              marks={marks}
              visible={seriesVisible}
              xDomain={channel2XDomain}
              yDomain={channel2Domain}
              onCoordinate={onCoordinate}
              overlays={channel2Overlays}
              overlayWindow={overlayWindow}
            />
          </CardContent>
        </Card>
      )}
      {panesVisible.loadCell && (
        <Card>
          <CardContent className="h-[220px]">
            <LoadCellChart
              data={loadCell}
              marks={marks}
              yDomain={loadCellDomain}
              onCoordinate={onCoordinate}
              overlay={loadCellOverlay}
              overlayWindow={overlayWindow}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
