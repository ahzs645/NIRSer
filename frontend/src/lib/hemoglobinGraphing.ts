import type { HemoglobinCurves, ScalpBrainHemoglobinSummary } from "./inverseAnalysis";
import { frameStats } from "./inverseAnalysis";

export type HemoglobinMetric = "hbo" | "hbb" | "hbt";
export type HemoglobinRegion = "scalp" | "brain";

export type HemoglobinErrorPoint = {
  time: number;
  mean: number;
  sem: number;
  subjectCount: number;
};

export type HemoglobinErrorSeries = {
  id: HemoglobinRegion;
  label: string;
  points: HemoglobinErrorPoint[];
  available: boolean;
};

export type HemoglobinPanelData = {
  metric: HemoglobinMetric;
  title: string;
  yLabel: string;
  yDomain: [number, number];
  xDomain: [number, number];
  series: HemoglobinErrorSeries[];
  missingFields: string[];
};

export const hemoglobinMetricLabels: Record<HemoglobinMetric, string> = {
  hbo: "O2Hb",
  hbb: "HHb",
  hbt: "HbT",
};

function metricRows(curves: HemoglobinCurves, metric: HemoglobinMetric) {
  return curves[metric];
}

function available(rows: number[][]) {
  return rows.some((row) => row.some(Number.isFinite));
}

export function buildHemoglobinErrorSeries(
  rowsByFrame: number[][],
  label: string,
  id: HemoglobinRegion,
  timePerFrame = 0.5,
  valueScale = 1000,
): HemoglobinErrorSeries {
  const stats = frameStats(rowsByFrame);
  return {
    id,
    label,
    available: available(rowsByFrame),
    points: stats.map((statsForFrame, index) => ({
      time: (index + 1) * timePerFrame,
      mean: statsForFrame.mean * valueScale,
      sem: statsForFrame.sem * valueScale,
      subjectCount: rowsByFrame[index]?.filter(Number.isFinite).length ?? 0,
    })),
  };
}

export function buildHemoglobinPanelData(
  summary: ScalpBrainHemoglobinSummary,
  metric: HemoglobinMetric,
  options: {
    timePerFrame?: number;
    valueScale?: number;
    xDomain?: [number, number];
    yDomain?: [number, number];
  } = {},
): HemoglobinPanelData {
  const timePerFrame = options.timePerFrame ?? 0.5;
  const valueScale = options.valueScale ?? 1000;
  return {
    metric,
    title: hemoglobinMetricLabels[metric],
    yLabel: `${hemoglobinMetricLabels[metric]} (microM)`,
    xDomain: options.xDomain ?? [0, 50],
    yDomain: options.yDomain ?? [-2, 2],
    missingFields: [...summary.missingFields],
    series: [
      buildHemoglobinErrorSeries(metricRows(summary.scalp, metric), "Scalp", "scalp", timePerFrame, valueScale),
      buildHemoglobinErrorSeries(metricRows(summary.brain, metric), "Brain", "brain", timePerFrame, valueScale),
    ],
  };
}

export function buildMatlabHemoglobinPanels(summary: ScalpBrainHemoglobinSummary): HemoglobinPanelData[] {
  return [
    buildHemoglobinPanelData(summary, "hbo"),
    buildHemoglobinPanelData(summary, "hbb"),
    buildHemoglobinPanelData(summary, "hbt"),
  ];
}
