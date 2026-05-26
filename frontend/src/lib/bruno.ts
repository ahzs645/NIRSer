export type BrunoBoundaryConditions = "ZBC" | "EBC";
export type BrunoSeparationMode = "close" | "far";

export type ExtinctionRow = {
  wavelength: number;
  hhb: number;
  hbo2: number;
  water: number;
};

export type BrunoFitBounds = {
  start: [number, number, number, number, number];
  lower: [number, number, number, number, number];
  upper: [number, number, number, number, number];
};

export type BrunoOptions = {
  boundaryConditions: BrunoBoundaryConditions;
  separationMode: BrunoSeparationMode;
  distance: number;
  distanceMax?: number;
  waveStart: number;
  waveEnd: number;
  maxIterations: number;
};

export type BrunoResult = {
  sto2: number;
  coefficients: {
    waterFraction: number;
    hhb: number;
    hbo2: number;
    scatteringA: number;
    scatteringB: number;
  };
  residuals: number[];
  normalizedResiduals: number[];
  sumResidual: number;
  sumNormalizedResidual: number;
  score: number;
  modelDerivative: number[];
  slopeDerivative: number[];
  wavelengths: number[];
};

export type BrunoMatData = {
  wavelengths?: number[];
  extinction?: ExtinctionRow[];
  boundaries?: BrunoFitBounds;
  sourceDetectorSeparations?: number[];
  attenuation?: number[][];
};

const LOG10 = Math.log(10);
const EPSILON = 1e-12;

function clamp(value: number, lower: number, upper: number) {
  return Math.min(upper, Math.max(lower, value));
}

function mean(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1);
}

function smooth(values: number[], windowSize: number) {
  const radius = Math.floor(windowSize / 2);
  return values.map((_, index) => {
    const start = Math.max(0, index - radius);
    const end = Math.min(values.length, index + radius + 1);
    return mean(values.slice(start, end));
  });
}

function diff(values: number[]) {
  return values.slice(1).map((value, index) => value - values[index]);
}

function fitRangeIndexes(wavelengths: number[], waveStart: number, waveEnd: number) {
  const start = wavelengths.findIndex((wavelength) => wavelength >= waveStart);
  let end = wavelengths.findLastIndex((wavelength) => wavelength <= waveEnd);
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Fitting wavelength range is outside the supplied data.");
  }
  end = Math.min(end, wavelengths.length - 2);
  return { start, end };
}

function absorption(params: number[], extinction: ExtinctionRow[]) {
  const [waterFraction, hhb, hbo2] = params;
  return extinction.map((row) => waterFraction * row.water + LOG10 * (hhb * row.hhb + hbo2 * row.hbo2));
}

function scattering(params: number[], wavelengths: number[]) {
  const [, , , a, b] = params;
  return wavelengths.map((wavelength) => a * (wavelength * 0.001) ** -b);
}

function zeroBoundarySlope(mua: number, mus: number, distance: number, mode: BrunoSeparationMode, distanceMax?: number) {
  const transport = Math.sqrt(Math.max(0, 3 * mus * mua));
  if (mode === "far") {
    const far = distanceMax ?? distance;
    return (transport + 2 * (Math.log(far / distance) / Math.max(far - distance, EPSILON))) / LOG10;
  }
  return (transport + 2 / distance) / LOG10;
}

function extrapolatedReflectance(mua: number, mus: number, rho: number) {
  const z0 = 1 / Math.max(mus, EPSILON);
  const d = 1 / (3 * Math.max(mua + mus, EPSILON));
  const zb = ((1 + 0.493) / (1 - 0.493)) * 2 * d;
  const r1 = rho * rho;
  const r2 = (z0 + 2 * zb) ** 2 + rho * rho;
  const mueff = Math.sqrt(Math.max(0, 3 * mua * mus));
  const term1 = z0 * (mueff + 1 / Math.sqrt(r1)) * (Math.exp(-mueff * Math.sqrt(r1)) / r1);
  const term2 = (z0 + 2 * zb) * (mueff + 1 / Math.sqrt(r2)) * (Math.exp(-mueff * Math.sqrt(r2)) / r2);
  return Math.max((term1 + term2) / (4 * Math.PI), EPSILON);
}

function extrapolatedAttenuation(mua: number, mus: number, rho: number) {
  return -Math.log10(extrapolatedReflectance(mua, mus, rho));
}

function extrapolatedBoundarySlope(mua: number, mus: number, distance: number, mode: BrunoSeparationMode, distanceMax?: number) {
  if (mode === "far") {
    const far = distanceMax ?? distance;
    return (extrapolatedAttenuation(mua, mus, far) - extrapolatedAttenuation(mua, mus, distance)) / Math.max(far - distance, EPSILON);
  }
  const step = Math.max(distance * 1e-4, 1e-4);
  return (extrapolatedAttenuation(mua, mus, distance + step) - extrapolatedAttenuation(mua, mus, distance - step)) / (2 * step);
}

function modelSlope(params: number[], extinction: ExtinctionRow[], wavelengths: number[], options: BrunoOptions) {
  const mua = absorption(params, extinction);
  const mus = scattering(params, wavelengths);
  return wavelengths.map((_, index) =>
    options.boundaryConditions === "ZBC"
      ? zeroBoundarySlope(mua[index], mus[index], options.distance, options.separationMode, options.distanceMax)
      : extrapolatedBoundarySlope(mua[index], mus[index], options.distance, options.separationMode, options.distanceMax),
  );
}

function boundedNelderMead(
  objective: (params: number[]) => number,
  bounds: BrunoFitBounds,
  maxIterations: number,
) {
  const n = bounds.start.length;
  const project = (point: number[]) => point.map((value, index) => clamp(value, bounds.lower[index], bounds.upper[index]));
  const simplex = [project(bounds.start)];
  for (let index = 0; index < n; index += 1) {
    const point = [...bounds.start];
    const span = bounds.upper[index] - bounds.lower[index];
    point[index] = clamp(point[index] + (span > 0 ? span * 0.05 : 0.05), bounds.lower[index], bounds.upper[index]);
    simplex.push(project(point));
  }
  let scored = simplex.map((point) => ({ point, value: objective(point) }));

  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    scored = scored.sort((a, b) => a.value - b.value);
    const best = scored[0].value;
    const worst = scored[n].value;
    if (Math.abs(worst - best) < 1e-12) break;
    const centroid = Array.from({ length: n }, (_, dimension) =>
      scored.slice(0, n).reduce((sum, item) => sum + item.point[dimension], 0) / n,
    );
    const worstPoint = scored[n].point;
    const reflected = project(centroid.map((value, dimension) => value + (value - worstPoint[dimension])));
    const reflectedValue = objective(reflected);
    if (reflectedValue < scored[0].value) {
      const expanded = project(centroid.map((value, dimension) => value + 2 * (reflected[dimension] - value)));
      const expandedValue = objective(expanded);
      scored[n] = expandedValue < reflectedValue ? { point: expanded, value: expandedValue } : { point: reflected, value: reflectedValue };
    } else if (reflectedValue < scored[n - 1].value) {
      scored[n] = { point: reflected, value: reflectedValue };
    } else {
      const contracted = project(centroid.map((value, dimension) => value + 0.5 * (worstPoint[dimension] - value)));
      const contractedValue = objective(contracted);
      if (contractedValue < scored[n].value) {
        scored[n] = { point: contracted, value: contractedValue };
      } else {
        const bestPoint = scored[0].point;
        scored = scored.map((item, index) =>
          index === 0
            ? item
            : {
                point: project(item.point.map((value, dimension) => bestPoint[dimension] + 0.5 * (value - bestPoint[dimension]))),
                value: 0,
              },
        );
        scored = scored.map((item) => ({ ...item, value: objective(item.point) }));
      }
    }
  }

  return scored.sort((a, b) => a.value - b.value)[0].point;
}

export function parseNumericTable(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split(/[,\t\s;]+/).map(Number).filter(Number.isFinite))
    .filter((row) => row.length > 0);
}

export function parseSlopeTable(text: string) {
  const rows = parseNumericTable(text);
  if (rows.length === 0) throw new Error("Slope input is empty.");
  if (rows.every((row) => row.length >= 2)) {
    return {
      wavelengths: rows.map((row) => row[0]),
      slope: rows.map((row) => row[1]),
    };
  }
  return {
    wavelengths: rows.map((_, index) => index),
    slope: rows.map((row) => row[0]),
  };
}

export function parseExtinctionTable(text: string): ExtinctionRow[] {
  const rows = parseNumericTable(text);
  const parsed = rows
    .filter((row) => row.length >= 4)
    .map((row) => ({ wavelength: row[0], hhb: row[1], hbo2: row[2], water: row[3] }));
  if (parsed.length === 0) throw new Error("Extinction input needs wavelength, HHb, HbO2, and water columns.");
  return parsed;
}

export function fitSlopeFromAttenuation(attenuation: number[][], distances: number[]) {
  if (attenuation.length === 0 || distances.length === 0) throw new Error("Attenuation and distance inputs are required.");
  if (!attenuation.every((row) => row.length === distances.length)) {
    throw new Error("Each attenuation row must have one value per source-detector separation.");
  }
  const meanX = mean(distances);
  const ssXX = distances.reduce((sum, value) => sum + (value - meanX) ** 2, 0);
  if (ssXX === 0) throw new Error("Source-detector separations must not all be identical.");
  return attenuation.map((row) => {
    const meanY = mean(row);
    return row.reduce((sum, value, index) => sum + (distances[index] - meanX) * (value - meanY), 0) / ssXX;
  });
}

export function parseAttenuationTable(text: string) {
  const rows = parseNumericTable(text).filter((row) => row.length >= 2);
  if (rows.length === 0) throw new Error("Attenuation input is empty.");
  const first = rows[0];
  const looksLikeHeader = first.length >= 3 && first[0] === 0;
  if (looksLikeHeader) {
    return {
      wavelengths: rows.slice(1).map((row) => row[0]),
      distances: first.slice(1),
      attenuation: rows.slice(1).map((row) => row.slice(1)),
    };
  }
  return {
    wavelengths: rows.map((row) => row[0]),
    distances: Array.from({ length: rows[0].length - 1 }, (_, index) => index + 1),
    attenuation: rows.map((row) => row.slice(1)),
  };
}

export function brunoMatToInputs(data: BrunoMatData) {
  if (!data.wavelengths || !data.extinction) throw new Error("MAT file needs wavelengths and extinction variables.");
  const slope =
    data.attenuation && data.sourceDetectorSeparations
      ? fitSlopeFromAttenuation(data.attenuation, data.sourceDetectorSeparations)
      : undefined;
  return {
    wavelengths: data.wavelengths,
    extinction: data.extinction,
    bounds: data.boundaries,
    distances: data.sourceDetectorSeparations,
    slope,
  };
}

export function runBrunoFit(
  slope: number[],
  extinction: ExtinctionRow[],
  bounds: BrunoFitBounds,
  options: BrunoOptions,
): BrunoResult {
  const wavelengths = extinction.map((row) => row.wavelength);
  if (slope.length !== extinction.length) {
    throw new Error("Slope and extinction inputs must have the same row count.");
  }
  if (options.separationMode === "far" && (!options.distanceMax || options.distanceMax <= options.distance)) {
    throw new Error("Far-separation mode requires a max distance greater than the min distance.");
  }
  const slopeDerivative = diff(smooth(slope, 5));
  const range = fitRangeIndexes(wavelengths, options.waveStart, options.waveEnd);
  const objective = (params: number[]) => {
    const modelDerivative = diff(modelSlope(params, extinction, wavelengths, options));
    let total = 0;
    for (let index = range.start; index <= range.end; index += 1) {
      total += (modelDerivative[index] - slopeDerivative[index]) ** 2;
    }
    return total;
  };
  const coefficients = boundedNelderMead(objective, bounds, options.maxIterations);
  const modelDerivative = diff(modelSlope(coefficients, extinction, wavelengths, options));
  const residuals = modelDerivative.map((value, index) => (value - slopeDerivative[index]) ** 2);
  const modelMax = Math.max(...modelDerivative.map(Math.abs), EPSILON);
  const normalizedResiduals = modelDerivative.map((value, index) => (value / modelMax - slopeDerivative[index] / modelMax) ** 2);
  const indexFor = (target: number) => wavelengths.findIndex((wavelength) => wavelength === target);
  const hhbStart = indexFor(750);
  const hhbEnd = indexFor(770);
  const waterStart = indexFor(825);
  const waterEnd = indexFor(840);
  const hhbResiduals = hhbStart >= 0 && hhbEnd >= hhbStart ? normalizedResiduals.slice(hhbStart, hhbEnd + 1) : [];
  const waterResiduals = waterStart >= 0 && waterEnd >= waterStart ? normalizedResiduals.slice(waterStart, waterEnd + 1) : [];
  const scoreRangeValues = modelDerivative.slice(7, Math.min(197, modelDerivative.length)).map((value) => value / modelMax);
  const scoreRange = scoreRangeValues.length > 0 ? Math.max(...scoreRangeValues) - Math.min(...scoreRangeValues) : 1;
  const hhb = coefficients[1];
  const hbo2 = coefficients[2];

  return {
    sto2: (hbo2 / Math.max(hhb + hbo2, EPSILON)) * 100,
    coefficients: {
      waterFraction: coefficients[0],
      hhb,
      hbo2,
      scatteringA: coefficients[3],
      scatteringB: coefficients[4],
    },
    residuals,
    normalizedResiduals,
    sumResidual: residuals.reduce((sum, value) => sum + value, 0),
    sumNormalizedResidual: normalizedResiduals.reduce((sum, value) => sum + value, 0),
    score: (hhbResiduals.reduce((sum, value) => sum + value, 0) * waterResiduals.reduce((sum, value) => sum + value, 0)) / Math.max(scoreRange, EPSILON),
    modelDerivative,
    slopeDerivative,
    wavelengths: wavelengths.slice(1),
  };
}
