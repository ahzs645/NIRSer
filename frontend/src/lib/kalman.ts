import type { NirsPoint } from "../types/nirs";

type KalmanOptions = {
  processNoise: number;
  measurementNoise: number;
};

class OneDimensionalKalmanFilter {
  private estimate: number;
  private errorCovariance = 1;
  private readonly processNoise: number;
  private readonly measurementNoise: number;

  constructor(initialEstimate: number, processNoise: number, measurementNoise: number) {
    this.estimate = initialEstimate;
    this.processNoise = processNoise;
    this.measurementNoise = measurementNoise;
  }

  update(measurement: number) {
    this.errorCovariance += this.processNoise;
    const gain = this.errorCovariance / (this.errorCovariance + this.measurementNoise);
    this.estimate += gain * (measurement - this.estimate);
    this.errorCovariance *= 1 - gain;
    return this.estimate;
  }
}

function sanitizeNoise(value: number, fallback: number) {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function filterSeries(values: number[], options: KalmanOptions) {
  if (values.length === 0) return values;
  const filter = new OneDimensionalKalmanFilter(
    values[0],
    sanitizeNoise(options.processNoise, 0.001),
    sanitizeNoise(options.measurementNoise, 0.1),
  );
  return values.map((value) => filter.update(value));
}

export function kalmanFilterNirsPoints(points: NirsPoint[], options: KalmanOptions) {
  const o2hb = filterSeries(points.map((point) => point.o2hb), options);
  const hhb = filterSeries(points.map((point) => point.hhb), options);
  const thb = filterSeries(points.map((point) => point.thb), options);
  const hbdiff = filterSeries(points.map((point) => point.hbdiff), options);
  const toi = filterSeries(points.map((point) => point.toi), options);

  return points.map((point, index) => ({
    ...point,
    o2hb: o2hb[index],
    hhb: hhb[index],
    thb: thb[index],
    hbdiff: hbdiff[index],
    toi: toi[index],
  }));
}
