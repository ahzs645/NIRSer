import { clamp, createSeededRng, sampleDistributions } from "./numeric";
import type { Distribution, Rng } from "./numeric";

export interface OptimizationParameter {
  name: string;
  min: number;
  max: number;
  initial?: number;
  distribution?: Distribution;
}

export interface OptimizationOptions {
  iterations: number;
  seed?: number;
  rng?: Rng;
}

export interface CoordinateSearchOptions extends OptimizationOptions {
  stepScale?: number;
  shrink?: number;
  tolerance?: number;
}

export interface OptimizationResult {
  best: Record<string, number>;
  score: number;
  history: Array<{ iteration: number; parameters: Record<string, number>; score: number }>;
}

export type ObjectiveFunction = (parameters: Record<string, number>) => number;

function initialParameters(parameters: readonly OptimizationParameter[]) {
  return Object.fromEntries(
    parameters.map((parameter) => [
      parameter.name,
      clamp(parameter.initial ?? (parameter.min + parameter.max) / 2, parameter.min, parameter.max),
    ]),
  );
}

function randomCandidate(parameters: readonly OptimizationParameter[], rng: Rng) {
  const distributions: Record<string, Distribution> = Object.fromEntries(
    parameters.map((parameter) => [
      parameter.name,
      parameter.distribution ?? ({ type: "uniform", min: parameter.min, max: parameter.max } satisfies Distribution),
    ]),
  );
  const sample = sampleDistributions(distributions, { rng });
  for (const parameter of parameters) {
    sample[parameter.name] = clamp(sample[parameter.name], parameter.min, parameter.max);
  }
  return sample;
}

function record(history: OptimizationResult["history"], iteration: number, parameters: Record<string, number>, score: number) {
  history.push({ iteration, parameters: { ...parameters }, score });
}

export function randomSearch(
  objective: ObjectiveFunction,
  parameters: readonly OptimizationParameter[],
  options: OptimizationOptions,
): OptimizationResult {
  if (options.iterations < 1) throw new Error("Optimization requires at least one iteration");
  const rng = options.rng ?? createSeededRng(options.seed ?? 1);
  const history: OptimizationResult["history"] = [];
  let best = initialParameters(parameters);
  let bestScore = objective(best);
  record(history, 0, best, bestScore);

  for (let iteration = 1; iteration <= options.iterations; iteration += 1) {
    const candidate = randomCandidate(parameters, rng);
    const score = objective(candidate);
    record(history, iteration, candidate, score);
    if (score < bestScore) {
      best = candidate;
      bestScore = score;
    }
  }

  return { best: { ...best }, score: bestScore, history };
}

export function coordinateSearch(
  objective: ObjectiveFunction,
  parameters: readonly OptimizationParameter[],
  options: CoordinateSearchOptions,
): OptimizationResult {
  if (options.iterations < 1) throw new Error("Optimization requires at least one iteration");
  const history: OptimizationResult["history"] = [];
  const shrink = options.shrink ?? 0.5;
  const tolerance = options.tolerance ?? 1e-8;
  let current = initialParameters(parameters);
  let currentScore = objective(current);
  let steps = Object.fromEntries(
    parameters.map((parameter) => [parameter.name, (parameter.max - parameter.min) * (options.stepScale ?? 0.25)]),
  );
  record(history, 0, current, currentScore);

  for (let iteration = 1; iteration <= options.iterations; iteration += 1) {
    let improved = false;
    for (const parameter of parameters) {
      for (const direction of [-1, 1]) {
        const candidate = {
          ...current,
          [parameter.name]: clamp(current[parameter.name] + direction * steps[parameter.name], parameter.min, parameter.max),
        };
        const score = objective(candidate);
        record(history, iteration, candidate, score);
        if (score < currentScore) {
          current = candidate;
          currentScore = score;
          improved = true;
        }
      }
    }
    if (!improved) {
      steps = Object.fromEntries(Object.entries(steps).map(([name, step]) => [name, step * shrink]));
      if (Math.max(...Object.values(steps)) < tolerance) break;
    }
  }

  return { best: { ...current }, score: currentScore, history };
}
