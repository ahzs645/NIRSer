export type DistanceMetric = "euclidean" | "mean" | "manhattan" | "cosine" | "angular" | "gaussianNll";

export type PosthocTransform =
  | { type: "zero" }
  | { type: "centre" }
  | { type: "norm" }
  | { type: "offset"; value: number }
  | { type: "scale"; value: number }
  | ["zero"]
  | ["centre"]
  | ["norm"]
  | ["offset", number]
  | ["scale", number];

export type Distribution =
  | { type: "constant"; value: number }
  | { type: "uniform"; min: number; max: number }
  | { type: "normal"; mean: number; sd: number }
  | { type: "logUniform"; min: number; max: number }
  | { type: "choice"; values: readonly number[] };

export interface Rng {
  next: () => number;
}

export interface SampleOptions {
  rng?: Rng;
  seed?: number;
}

const TWO_PI = Math.PI * 2;

export function createSeededRng(seed = 1): Rng {
  let state = seed >>> 0;
  return {
    next: () => {
      state = (state * 1664525 + 1013904223) >>> 0;
      return state / 0x100000000;
    },
  };
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function mean(values: readonly number[]) {
  if (values.length === 0) return Number.NaN;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function variance(values: readonly number[]) {
  if (values.length === 0) return Number.NaN;
  const average = mean(values);
  return values.reduce((sum, value) => sum + (value - average) ** 2, 0) / values.length;
}

export function standardDeviation(values: readonly number[]) {
  return Math.sqrt(variance(values));
}

function assertSameLength(left: readonly number[], right: readonly number[]) {
  if (left.length !== right.length) {
    throw new Error(`Expected arrays with the same length, received ${left.length} and ${right.length}`);
  }
}

function dot(left: readonly number[], right: readonly number[]) {
  return left.reduce((sum, value, index) => sum + value * right[index], 0);
}

function norm(values: readonly number[]) {
  return Math.sqrt(values.reduce((sum, value) => sum + value * value, 0));
}

export function euclideanDistance(left: readonly number[], right: readonly number[]) {
  assertSameLength(left, right);
  return Math.sqrt(left.reduce((sum, value, index) => sum + (value - right[index]) ** 2, 0));
}

export function meanDistance(left: readonly number[], right: readonly number[]) {
  assertSameLength(left, right);
  if (left.length === 0) return Number.NaN;
  return Math.sqrt(left.reduce((sum, value, index) => sum + (value - right[index]) ** 2, 0) / left.length);
}

export function manhattanDistance(left: readonly number[], right: readonly number[]) {
  assertSameLength(left, right);
  return left.reduce((sum, value, index) => sum + Math.abs(value - right[index]), 0);
}

export function cosineDistance(left: readonly number[], right: readonly number[]) {
  assertSameLength(left, right);
  const denominator = norm(left) * norm(right);
  if (denominator === 0) return Number.NaN;
  const similarity = clamp(dot(left, right) / denominator, -1, 1);
  return (1 - similarity) / 2;
}

export function angularDistance(left: readonly number[], right: readonly number[]) {
  assertSameLength(left, right);
  const denominator = norm(left) * norm(right);
  if (denominator === 0) return Number.NaN;
  return Math.acos(clamp(dot(left, right) / denominator, -1, 1)) / Math.PI;
}

export function gaussianNegativeLogLikelihood(left: readonly number[], right: readonly number[], sigma?: number) {
  assertSameLength(left, right);
  if (left.length === 0) return Number.NaN;
  const residuals = left.map((value, index) => value - right[index]);
  const resolvedSigma = sigma ?? standardDeviation(residuals);
  if (!Number.isFinite(resolvedSigma) || resolvedSigma <= 0) return Number.NaN;
  const squaredError = residuals.reduce((sum, value) => sum + value * value, 0);
  return (left.length * Math.log(TWO_PI * resolvedSigma * resolvedSigma)) / 2 + squaredError / (2 * resolvedSigma * resolvedSigma);
}

export function distance(left: readonly number[], right: readonly number[], metric: DistanceMetric, sigma?: number) {
  if (metric === "euclidean") return euclideanDistance(left, right);
  if (metric === "mean") return meanDistance(left, right);
  if (metric === "manhattan") return manhattanDistance(left, right);
  if (metric === "cosine") return cosineDistance(left, right);
  if (metric === "angular") return angularDistance(left, right);
  return gaussianNegativeLogLikelihood(left, right, sigma);
}

function transformKind(transform: PosthocTransform) {
  return Array.isArray(transform) ? transform[0] : transform.type;
}

function transformValue(transform: PosthocTransform) {
  return Array.isArray(transform) ? transform[1] : "value" in transform ? transform.value : undefined;
}

export function applyPosthocTransform(values: readonly number[], transform: PosthocTransform) {
  if (values.length === 0) return [];
  const kind = transformKind(transform);
  if (kind === "zero") return values.map((value) => value - values[0]);
  if (kind === "centre") {
    const average = mean(values);
    return values.map((value) => value - average);
  }
  if (kind === "norm") {
    const average = mean(values);
    const deviation = standardDeviation(values);
    return deviation === 0 ? values.map(() => Number.NaN) : values.map((value) => (value - average) / deviation);
  }
  const value = transformValue(transform) ?? 0;
  if (kind === "offset") return values.map((item) => item + value);
  return values.map((item) => item * value);
}

export function applyPosthocTransforms(values: readonly number[], transforms: readonly PosthocTransform[]) {
  return transforms.reduce<readonly number[]>((current, transform) => applyPosthocTransform(current, transform), values).slice();
}

function resolveRng(options: SampleOptions = {}) {
  return options.rng ?? createSeededRng(options.seed ?? 1);
}

function randomUnit(rng: Rng) {
  return clamp(rng.next(), Number.EPSILON, 1 - Number.EPSILON);
}

export function sampleDistribution(distribution: Distribution, options: SampleOptions = {}) {
  const rng = resolveRng(options);
  if (distribution.type === "constant") return distribution.value;
  if (distribution.type === "uniform") return distribution.min + rng.next() * (distribution.max - distribution.min);
  if (distribution.type === "logUniform") {
    if (distribution.min <= 0 || distribution.max <= 0) throw new Error("logUniform bounds must be positive");
    const low = Math.log(distribution.min);
    return Math.exp(low + rng.next() * (Math.log(distribution.max) - low));
  }
  if (distribution.type === "choice") {
    if (distribution.values.length === 0) throw new Error("choice distribution requires at least one value");
    return distribution.values[Math.min(distribution.values.length - 1, Math.floor(rng.next() * distribution.values.length))];
  }
  const radius = Math.sqrt(-2 * Math.log(randomUnit(rng)));
  const theta = TWO_PI * randomUnit(rng);
  return distribution.mean + distribution.sd * radius * Math.cos(theta);
}

export function sampleDistributions<TName extends string>(
  distributions: Record<TName, Distribution>,
  options: SampleOptions = {},
) {
  const rng = resolveRng(options);
  const sample = {} as Record<TName, number>;
  for (const key of Object.keys(distributions) as TName[]) {
    sample[key] = sampleDistribution(distributions[key], { rng });
  }
  return sample;
}

export function linspace(start: number, end: number, count: number) {
  if (!Number.isInteger(count) || count < 2) throw new Error("linspace requires a count of at least 2");
  const step = (end - start) / (count - 1);
  return Array.from({ length: count }, (_, index) => start + step * index);
}
