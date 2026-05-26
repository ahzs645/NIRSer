import { describe, expect, it } from "vitest";
import {
  fitSlopeFromAttenuation,
  parseAttenuationTable,
  parseExtinctionTable,
  parseSlopeTable,
  runBrunoFit,
  type BrunoFitBounds,
} from "./bruno";

const extinctionText = Array.from({ length: 191 }, (_, index) => {
  const wavelength = 710 + index;
  const hhb = 0.0015 + 0.0009 * Math.exp(-(((wavelength - 760) / 18) ** 2));
  const hbo2 = 0.0012 + 0.0007 * Math.exp(-(((wavelength - 850) / 32) ** 2));
  const water = 0.0002 + 0.00035 * Math.exp(-(((wavelength - 835) / 22) ** 2));
  return `${wavelength},${hhb},${hbo2},${water}`;
}).join("\n");

const bounds: BrunoFitBounds = {
  start: [0.75, 0.01, 0.04, 1, 1],
  lower: [0, 0, 0, 0.01, 0],
  upper: [1, 1, 1, 10, 4],
};

describe("BRUNO tooling", () => {
  it("parses slope and extinction numeric tables", () => {
    expect(parseSlopeTable("710,0.1\n711,0.2")).toEqual({
      wavelengths: [710, 711],
      slope: [0.1, 0.2],
    });
    expect(parseExtinctionTable("710 1 2 3")[0]).toEqual({
      wavelength: 710,
      hhb: 1,
      hbo2: 2,
      water: 3,
    });
  });

  it("computes attenuation slope by regression across source-detector distances", () => {
    const parsed = parseAttenuationTable("0,30,25,20,15\n710,60,50,40,30\n711,30,25,20,15");
    expect(parsed.distances).toEqual([30, 25, 20, 15]);
    expect(fitSlopeFromAttenuation(parsed.attenuation, parsed.distances)).toEqual([2, 1]);
  });

  it("runs a bounded ZBC client-side fit", () => {
    const extinction = parseExtinctionTable(extinctionText);
    const slope = extinction.map((row) => 0.09 + 0.00022 * (row.wavelength - 710) + 0.003 * Math.sin((row.wavelength - 710) / 18));
    const result = runBrunoFit(slope, extinction, bounds, {
      boundaryConditions: "ZBC",
      separationMode: "close",
      distance: 22.5,
      waveStart: 710,
      waveEnd: 900,
      maxIterations: 80,
    });

    expect(result.sto2).toBeGreaterThanOrEqual(0);
    expect(result.sto2).toBeLessThanOrEqual(100);
    expect(result.modelDerivative).toHaveLength(slope.length - 1);
    expect(result.sumResidual).toBeGreaterThanOrEqual(0);
  });
});
