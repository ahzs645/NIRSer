import type { NirsPoint } from "../types/nirs";

type Coefficients = {
  a: number[];
  b: number[];
};

function calculateBCoefficientsLowpass(order: number) {
  const b = new Array(order + 1).fill(0);
  b[0] = 1;
  b[1] = order;
  const m = Math.floor(order / 2);
  for (let i = 2; i <= m; i += 1) {
    b[i] = (((order - i) + 1) * b[i - 1]) / i;
    b[order - i] = b[i];
  }
  b[order - 1] = order;
  b[order] = 1;
  return b;
}

function binomialMult(order: number, polePairs: number[]) {
  const output = new Array(2 * order).fill(0);
  for (let i = 0; i < order; i += 1) {
    for (let j = i; j > 0; j -= 1) {
      output[2 * j] +=
        polePairs[2 * i] * output[2 * (j - 1)] -
        polePairs[2 * i + 1] * output[2 * (j - 1) + 1];
      output[2 * j + 1] +=
        polePairs[2 * i] * output[2 * (j - 1) + 1] +
        polePairs[2 * i + 1] * output[2 * (j - 1)];
    }
    output[0] += polePairs[2 * i];
    output[1] += polePairs[2 * i + 1];
  }
  return output;
}

function calculateACoefficientsLowpass(order: number, cutoff: number) {
  const polePairs = new Array(2 * order).fill(0);
  const theta = 2 * Math.PI * cutoff;
  const sinTheta = Math.sin(theta);
  const cosTheta = Math.cos(theta);
  for (let i = 0; i < order; i += 1) {
    const poleAngle = (Math.PI * (2 * i + 1)) / (2 * order);
    const poleSin = Math.sin(poleAngle);
    const poleCos = Math.cos(poleAngle);
    const divisor = 1 + sinTheta * poleSin;
    polePairs[2 * i] = -cosTheta / divisor;
    polePairs[2 * i + 1] = (-sinTheta * poleCos) / divisor;
  }
  const multiplied = binomialMult(order, polePairs);
  const a = new Array(order + 1).fill(0);
  a[0] = 1;
  for (let i = 1; i <= order; i += 1) {
    a[i] = multiplied[2 * i - 2];
  }
  return a;
}

function scalingFactorLowpass(order: number, cutoff: number) {
  const theta = 2 * Math.PI * cutoff;
  const sinTheta = Math.sin(theta);
  const halfPole = Math.PI / (2 * order);
  let divisor = 1;
  for (let i = 0; i < Math.floor(order / 2); i += 1) {
    divisor *= 1 + sinTheta * Math.sin((2 * i + 1) * halfPole);
  }
  const base = Math.sin(theta / 2);
  if (order % 2 !== 0) {
    divisor *= base + Math.cos(theta / 2);
  }
  return base ** order / divisor;
}

export function designButterworthLowpass(order: number, cutoff: number): Coefficients {
  if (order < 1 || !Number.isFinite(order)) throw new Error("Filter order must be at least 1.");
  if (cutoff <= 0 || cutoff >= 0.5 || !Number.isFinite(cutoff)) {
    throw new Error("Filter cutoff must be greater than 0 and less than 0.5.");
  }
  const a = calculateACoefficientsLowpass(Math.floor(order), cutoff);
  const scale = scalingFactorLowpass(Math.floor(order), cutoff);
  const b = calculateBCoefficientsLowpass(Math.floor(order)).map((value) => value * scale);
  return { a, b };
}

class IirFilter {
  private readonly xBuffer: number[];
  private readonly yBuffer: number[];
  private readonly coefficients: Coefficients;
  private xPos = 0;
  private yPos = 0;

  constructor(coefficients: Coefficients) {
    this.coefficients = coefficients;
    this.xBuffer = new Array(Math.max(0, coefficients.b.length - 1)).fill(0);
    this.yBuffer = new Array(Math.max(0, coefficients.a.length - 1)).fill(0);
  }

  step(input: number) {
    let output = this.coefficients.b[0] * input;
    for (let i = 1; i < this.coefficients.b.length; i += 1) {
      output += this.coefficients.b[i] * this.xBuffer[(this.xPos + this.xBuffer.length - i) % this.xBuffer.length];
    }
    for (let i = 1; i < this.coefficients.a.length; i += 1) {
      output -= this.coefficients.a[i] * this.yBuffer[(this.yPos + this.yBuffer.length - i) % this.yBuffer.length];
    }
    if (this.xBuffer.length > 0) {
      this.xBuffer[this.xPos] = input;
      this.xPos = (this.xPos + 1) % this.xBuffer.length;
    }
    if (this.yBuffer.length > 0) {
      this.yBuffer[this.yPos] = output;
      this.yPos = (this.yPos + 1) % this.yBuffer.length;
    }
    return output;
  }
}

function filterSeries(values: number[], coefficients: Coefficients) {
  const forward = new IirFilter(coefficients);
  const forwardValues = values.map((value) => forward.step(value));
  const backward = new IirFilter(coefficients);
  return forwardValues
    .slice()
    .reverse()
    .map((value) => backward.step(value))
    .reverse();
}

export function butterworthFilterNirsPoints(points: NirsPoint[], order: number, cutoff: number) {
  if (points.length === 0) return [];
  const coefficients = designButterworthLowpass(order, cutoff);
  const keys = ["o2hb", "hhb", "thb", "hbdiff", "toi"] as const;
  const filtered = Object.fromEntries(
    keys.map((key) => [key, filterSeries(points.map((point) => point[key]), coefficients)]),
  ) as Record<(typeof keys)[number], number[]>;
  return points.map((point, index) => ({
    time: point.time,
    o2hb: filtered.o2hb[index],
    hhb: filtered.hhb[index],
    thb: filtered.thb[index],
    hbdiff: filtered.hbdiff[index],
    toi: filtered.toi[index],
  }));
}
