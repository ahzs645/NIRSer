import { distance, type DistanceMetric, applyPosthocTransforms, type PosthocTransform } from "./numeric";
import type { SimulationPoint } from "./solver";
import type { BcmdJobFile } from "./jobs";

export interface BcmdObjectiveSeries {
  name: string;
  observed: number[];
  predicted: number[];
  weight?: number;
  posthoc?: PosthocTransform[];
}

export function weightedBcmdObjective(series: readonly BcmdObjectiveSeries[], metric: DistanceMetric = "euclidean") {
  return series.reduce((sum, item) => {
    const observed = applyPosthocTransforms(item.observed, item.posthoc ?? []);
    const predicted = applyPosthocTransforms(item.predicted, item.posthoc ?? []);
    return sum + (item.weight ?? 1) * distance(observed, predicted, metric);
  }, 0);
}

export function simulationColumn(points: readonly SimulationPoint[], name: string) {
  return points.map((point) => point.output[name] ?? point.state[name] ?? 0);
}

export function aliasesFromBcmdJob(job: BcmdJobFile) {
  return Object.fromEntries((job.byKey.alias ?? []).flatMap((entry) => {
    const [from, to] = entry.values;
    return from && to ? [[from, to]] : [];
  }));
}

export function weightsFromBcmdJob(job: BcmdJobFile) {
  return Object.fromEntries((job.byKey.weight ?? []).flatMap((entry) => {
    const [name, value] = entry.values;
    const weight = Number(value);
    return name && Number.isFinite(weight) ? [[name, weight]] : [];
  }));
}

export function posthocFromBcmdJob(job: BcmdJobFile) {
  const transforms: Record<string, PosthocTransform[]> = {};
  for (const entry of job.byKey.post ?? []) {
    const [name, kind, value] = entry.values;
    if (!name || !kind) continue;
    transforms[name] ??= [];
    if (kind === "zero" || kind === "centre" || kind === "norm") transforms[name].push([kind]);
    if ((kind === "offset" || kind === "scale") && Number.isFinite(Number(value))) transforms[name].push([kind, Number(value)]);
  }
  return transforms;
}
