import { createSeededRng, mean, sampleDistributions, standardDeviation, variance } from "./numeric";
import type { Distribution, Rng } from "./numeric";

export interface SensitivityParameter {
  name: string;
  distribution: Distribution;
  min: number;
  max: number;
}

export interface SensitivityOptions {
  samples: number;
  seed?: number;
  rng?: Rng;
}

export interface SensitivityResult {
  name: string;
  effectMean: number;
  effectAbsMean: number;
  effectStdDev: number;
  correlation: number;
  varianceShare: number;
}

export type SensitivityModel = (parameters: Record<string, number>) => number;

function rank(values: readonly number[]) {
  return values
    .map((value, index) => ({ value, index }))
    .sort((left, right) => left.value - right.value)
    .reduce<number[]>((ranks, item, index) => {
      ranks[item.index] = index + 1;
      return ranks;
    }, []);
}

function pearson(left: readonly number[], right: readonly number[]) {
  if (left.length !== right.length || left.length < 2) return Number.NaN;
  const leftMean = mean(left);
  const rightMean = mean(right);
  const numerator = left.reduce((sum, value, index) => sum + (value - leftMean) * (right[index] - rightMean), 0);
  const leftScale = Math.sqrt(left.reduce((sum, value) => sum + (value - leftMean) ** 2, 0));
  const rightScale = Math.sqrt(right.reduce((sum, value) => sum + (value - rightMean) ** 2, 0));
  return leftScale === 0 || rightScale === 0 ? Number.NaN : numerator / (leftScale * rightScale);
}

export function summarizeSensitivity(
  model: SensitivityModel,
  parameters: readonly SensitivityParameter[],
  options: SensitivityOptions,
) {
  if (options.samples < 1) throw new Error("Sensitivity analysis requires at least one sample");
  const rng = options.rng ?? createSeededRng(options.seed ?? 1);
  const distributions = Object.fromEntries(parameters.map((parameter) => [parameter.name, parameter.distribution]));
  const outputValues: number[] = [];
  const sampledValues = new Map<string, number[]>(parameters.map((parameter) => [parameter.name, []]));
  const effects = new Map<string, number[]>(parameters.map((parameter) => [parameter.name, []]));

  for (let index = 0; index < options.samples; index += 1) {
    const base = sampleDistributions(distributions, { rng });
    const baseOutput = model(base);
    outputValues.push(baseOutput);
    for (const parameter of parameters) {
      sampledValues.get(parameter.name)?.push(base[parameter.name]);
      const span = parameter.max - parameter.min;
      const delta = span === 0 ? 0 : span * 0.1;
      if (delta === 0) {
        effects.get(parameter.name)?.push(0);
      } else {
        const moved = { ...base, [parameter.name]: Math.min(parameter.max, base[parameter.name] + delta) };
        const actualDelta = moved[parameter.name] - base[parameter.name];
        effects.get(parameter.name)?.push(actualDelta === 0 ? 0 : (model(moved) - baseOutput) / actualDelta);
      }
    }
  }

  const outputVariance = variance(outputValues);
  return parameters.map<SensitivityResult>((parameter) => {
    const parameterValues = sampledValues.get(parameter.name) ?? [];
    const parameterEffects = effects.get(parameter.name) ?? [];
    const correlation = pearson(rank(parameterValues), rank(outputValues));
    return {
      name: parameter.name,
      effectMean: mean(parameterEffects),
      effectAbsMean: mean(parameterEffects.map(Math.abs)),
      effectStdDev: standardDeviation(parameterEffects),
      correlation,
      varianceShare: Number.isFinite(correlation) && outputVariance > 0 ? correlation * correlation : Number.NaN,
    };
  });
}

export function morrisSensitivity(
  model: SensitivityModel,
  parameters: readonly SensitivityParameter[],
  options: SensitivityOptions & { delta?: number },
) {
  return summarizeSensitivity(model, parameters, options).map((item) => ({
    ...item,
    mu: item.effectMean,
    muStar: item.effectAbsMean,
    sigma: item.effectStdDev,
  }));
}

export function fastSensitivity(
  model: SensitivityModel,
  parameters: readonly SensitivityParameter[],
  options: SensitivityOptions,
) {
  return summarizeSensitivity(model, parameters, options).map((item) => ({
    ...item,
    firstOrder: item.varianceShare,
    totalOrder: Math.min(1, Math.abs(item.correlation)),
  }));
}
