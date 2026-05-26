import type { BrunoFitBounds } from "../../lib/bruno";

export const defaultBrunoBounds: BrunoFitBounds = {
  start: [0.75, 0.01, 0.04, 1, 1],
  lower: [0, 0, 0, 0.01, 0],
  upper: [1, 1, 1, 10, 4],
};

export const sampleBrunoSlope = Array.from({ length: 191 }, (_, index) => {
  const wavelength = 710 + index;
  const slope = 0.09 + 0.00022 * (wavelength - 710) + 0.003 * Math.sin(index / 18);
  return `${wavelength},${slope.toFixed(8)}`;
}).join("\n");

export const sampleBrunoExtinction = Array.from({ length: 191 }, (_, index) => {
  const wavelength = 710 + index;
  const hhb = 0.0015 + 0.0009 * Math.exp(-(((wavelength - 760) / 18) ** 2));
  const hbo2 = 0.0012 + 0.0007 * Math.exp(-(((wavelength - 850) / 32) ** 2));
  const water = 0.0002 + 0.00035 * Math.exp(-(((wavelength - 835) / 22) ** 2));
  return `${wavelength},${hhb.toExponential(8)},${hbo2.toExponential(8)},${water.toExponential(8)}`;
}).join("\n");
