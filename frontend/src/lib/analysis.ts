import type { AnalysisStats, ChannelStats, DataInfo, NirsPoint, Point, ProcessedNirsSample } from "../types/nirs";

const emptyPoint: Point = { time: 0, value: 0 };

function regression(points: Point[]) {
  const n = points.length;
  if (n < 2) return { slope: 0, intercept: 0, r: 0 };
  const sumX = points.reduce((sum, point) => sum + point.time, 0);
  const sumY = points.reduce((sum, point) => sum + point.value, 0);
  const meanX = sumX / n;
  const meanY = sumY / n;
  let ssXX = 0;
  let ssYY = 0;
  let ssXY = 0;
  for (const point of points) {
    const dx = point.time - meanX;
    const dy = point.value - meanY;
    ssXX += dx * dx;
    ssYY += dy * dy;
    ssXY += dx * dy;
  }
  const slope = ssXX === 0 ? 0 : ssXY / ssXX;
  const intercept = meanY - slope * meanX;
  const r = ssXX === 0 || ssYY === 0 ? 0 : ssXY / Math.sqrt(ssXX * ssYY);
  return { slope, intercept, r };
}

export function summarize(points: Point[]): DataInfo {
  const finitePoints = points.filter((point) => Number.isFinite(point.time) && Number.isFinite(point.value));
  if (finitePoints.length === 0) {
    return { min: emptyPoint, max: emptyPoint, average: 0, slope: 0, r: 0, intercept: 0 };
  }
  const min = finitePoints.reduce((best, point) => (point.value < best.value ? point : best), finitePoints[0]);
  const max = finitePoints.reduce((best, point) => (point.value > best.value ? point : best), finitePoints[0]);
  const average = finitePoints.reduce((sum, point) => sum + point.value, 0) / finitePoints.length;
  return { min, max, average, ...regression(finitePoints) };
}

function pointsFor(samples: ProcessedNirsSample[], channel: "channel1" | "channel2", key: keyof Omit<NirsPoint, "time">) {
  return samples.map((sample) => ({
    time: sample.time,
    value: sample[channel][key],
  }));
}

export function calculateStats(
  samples: ProcessedNirsSample[],
  loadCell: Point[],
  initialTime = 0,
  endTime = Number.POSITIVE_INFINITY,
): AnalysisStats {
  const nirsWindow = samples.filter((sample) => sample.time >= initialTime && sample.time <= endTime);
  const loadWindow = loadCell.filter((point) => point.time >= initialTime && point.time <= endTime);
  const channelStats = (channel: "channel1" | "channel2") => ({
    o2hb: summarize(pointsFor(nirsWindow, channel, "o2hb")),
    hhb: summarize(pointsFor(nirsWindow, channel, "hhb")),
    thb: summarize(pointsFor(nirsWindow, channel, "thb")),
    hbdiff: summarize(pointsFor(nirsWindow, channel, "hbdiff")),
    toi: summarize(pointsFor(nirsWindow, channel, "toi")),
  });
  return {
    channel1: channelStats("channel1"),
    channel2: channelStats("channel2"),
    loadCell: summarize(loadWindow),
  };
}

/**
 * Render the active-section stats as a tab-separated table (one metric per row, both
 * channels side by side, load cell last) for copy-to-clipboard. Mirrors the on-screen
 * StatsTable and replaces the legacy app's copy/paste of its values ListView.
 */
export function formatAnalysisStatsTsv(stats: AnalysisStats): string {
  const fmt = (value: number) => (Number.isFinite(value) ? value.toFixed(2) : "0.00");
  const cells = (info: DataInfo) => [info.min.value, info.max.value, info.average, info.slope, info.r].map(fmt);
  const header = [
    "Signal",
    "Ch1 Min", "Ch1 Max", "Ch1 Avg", "Ch1 Slope", "Ch1 r",
    "Ch2 Min", "Ch2 Max", "Ch2 Avg", "Ch2 Slope", "Ch2 r",
  ].join("\t");
  const metrics: Array<[keyof ChannelStats, string]> = [
    ["o2hb", "O2Hb"],
    ["hhb", "HHb"],
    ["thb", "THb"],
    ["hbdiff", "HbDiff"],
    ["toi", "TOI"],
  ];
  const rows = metrics.map(([key, label]) =>
    [label, ...cells(stats.channel1[key]), ...cells(stats.channel2[key])].join("\t"),
  );
  const loadRow = ["Load Cell", ...cells(stats.loadCell), "", "", "", "", ""].join("\t");
  return [header, ...rows, loadRow].join("\n");
}

export function movingAverage(points: NirsPoint[], windowSize: number) {
  const size = Math.max(1, Math.floor(windowSize));
  return points.map((point, index) => {
    const window = points.slice(Math.max(0, index - size + 1), index + 1);
    const avg = (key: keyof Omit<NirsPoint, "time">) =>
      window.reduce((sum, item) => sum + item[key], 0) / window.length;
    return {
      time: point.time,
      o2hb: avg("o2hb"),
      hhb: avg("hhb"),
      thb: avg("thb"),
      hbdiff: avg("hbdiff"),
      toi: avg("toi"),
    };
  });
}
