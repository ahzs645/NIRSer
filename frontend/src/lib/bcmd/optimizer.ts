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

export interface NelderMeadOptions extends OptimizationOptions {
  alpha?: number;
  gamma?: number;
  rho?: number;
  sigma?: number;
}

function centroid(points: Record<string, number>[], names: string[]) {
  return Object.fromEntries(names.map((name) => [name, points.reduce((sum, point) => sum + point[name], 0) / points.length]));
}

function transformPoint(
  base: Record<string, number>,
  point: Record<string, number>,
  factor: number,
  parameters: readonly OptimizationParameter[],
) {
  return Object.fromEntries(parameters.map((parameter) => [
    parameter.name,
    clamp(base[parameter.name] + factor * (base[parameter.name] - point[parameter.name]), parameter.min, parameter.max),
  ]));
}

export function nelderMeadSearch(
  objective: ObjectiveFunction,
  parameters: readonly OptimizationParameter[],
  options: NelderMeadOptions,
): OptimizationResult {
  const names = parameters.map((parameter) => parameter.name);
  const alpha = options.alpha ?? 1;
  const gamma = options.gamma ?? 2;
  const rho = options.rho ?? 0.5;
  const sigma = options.sigma ?? 0.5;
  const history: OptimizationResult["history"] = [];
  const start = initialParameters(parameters);
  let simplex = [start, ...parameters.map((parameter) => ({
    ...start,
    [parameter.name]: clamp(start[parameter.name] + (parameter.max - parameter.min) * 0.05, parameter.min, parameter.max),
  }))];

  for (let iteration = 0; iteration <= options.iterations; iteration += 1) {
    const scored = simplex.map((point) => ({ point, score: objective(point) })).sort((a, b) => a.score - b.score);
    record(history, iteration, scored[0].point, scored[0].score);
    if (iteration === options.iterations) break;
    const best = scored[0].point;
    const worst = scored.at(-1)?.point ?? best;
    const center = centroid(scored.slice(0, -1).map((item) => item.point), names);
    const reflected = transformPoint(center, worst, alpha, parameters);
    const reflectedScore = objective(reflected);

    if (reflectedScore < scored[0].score) {
      const expanded = transformPoint(center, worst, gamma, parameters);
      simplex = [...scored.slice(0, -1).map((item) => item.point), objective(expanded) < reflectedScore ? expanded : reflected];
    } else if (reflectedScore < scored.at(-2)!.score) {
      simplex = [...scored.slice(0, -1).map((item) => item.point), reflected];
    } else {
      const contracted = transformPoint(center, worst, -rho, parameters);
      if (objective(contracted) < scored.at(-1)!.score) {
        simplex = [...scored.slice(0, -1).map((item) => item.point), contracted];
      } else {
        simplex = [best, ...scored.slice(1).map((item) => Object.fromEntries(parameters.map((parameter) => [
          parameter.name,
          clamp(best[parameter.name] + sigma * (item.point[parameter.name] - best[parameter.name]), parameter.min, parameter.max),
        ])))];
      }
    }
  }

  const final = simplex.map((point) => ({ point, score: objective(point) })).sort((a, b) => a.score - b.score)[0];
  return { best: { ...final.point }, score: final.score, history };
}

export function particleSwarmSearch(
  objective: ObjectiveFunction,
  parameters: readonly OptimizationParameter[],
  options: OptimizationOptions & { particles?: number; inertia?: number; cognitive?: number; social?: number },
): OptimizationResult {
  const rng = options.rng ?? createSeededRng(options.seed ?? 1);
  const particleCount = options.particles ?? Math.max(8, parameters.length * 6);
  const inertia = options.inertia ?? 0.7;
  const cognitive = options.cognitive ?? 1.4;
  const social = options.social ?? 1.4;
  const particles = Array.from({ length: particleCount }, () => {
    const position = randomCandidate(parameters, rng);
    return { position, velocity: Object.fromEntries(parameters.map((p) => [p.name, 0])), best: position, bestScore: objective(position) };
  });
  let global = particles.slice().sort((a, b) => a.bestScore - b.bestScore)[0];
  const history: OptimizationResult["history"] = [];

  for (let iteration = 0; iteration <= options.iterations; iteration += 1) {
    record(history, iteration, global.best, global.bestScore);
    for (const particle of particles) {
      for (const parameter of parameters) {
        const r1 = rng.next();
        const r2 = rng.next();
        particle.velocity[parameter.name] =
          inertia * particle.velocity[parameter.name] +
          cognitive * r1 * (particle.best[parameter.name] - particle.position[parameter.name]) +
          social * r2 * (global.best[parameter.name] - particle.position[parameter.name]);
        particle.position[parameter.name] = clamp(particle.position[parameter.name] + particle.velocity[parameter.name], parameter.min, parameter.max);
      }
      const score = objective(particle.position);
      if (score < particle.bestScore) {
        particle.best = { ...particle.position };
        particle.bestScore = score;
      }
    }
    global = particles.slice().sort((a, b) => a.bestScore - b.bestScore)[0];
  }

  return { best: { ...global.best }, score: global.bestScore, history };
}
