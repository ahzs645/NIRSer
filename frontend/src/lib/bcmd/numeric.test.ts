import { describe, expect, it } from "vitest";
import {
  angularDistance,
  applyPosthocTransform,
  cosineDistance,
  createSeededRng,
  euclideanDistance,
  gaussianNegativeLogLikelihood,
  manhattanDistance,
  meanDistance,
  sampleDistribution,
  sampleDistributions,
} from "./numeric";

describe("BCMD numeric utilities", () => {
  it("computes reusable distance metrics", () => {
    expect(euclideanDistance([1, 2, 3], [2, 4, 6])).toBeCloseTo(Math.sqrt(14));
    expect(meanDistance([1, 2, 3], [2, 4, 6])).toBeCloseTo(Math.sqrt(14 / 3));
    expect(manhattanDistance([1, 2, 3], [2, 4, 6])).toBe(6);
    expect(cosineDistance([1, 0], [0, 1])).toBeCloseTo(0.5);
    expect(angularDistance([1, 0], [0, 1])).toBeCloseTo(0.5);
    expect(gaussianNegativeLogLikelihood([1, 2], [1, 4], 2)).toBeCloseTo(
      (2 * Math.log(2 * Math.PI * 4)) / 2 + 4 / 8,
    );
  });

  it("applies posthoc transforms without mutating input", () => {
    const values = [2, 4, 6];

    expect(applyPosthocTransform(values, { type: "zero" })).toEqual([0, 2, 4]);
    expect(applyPosthocTransform(values, { type: "centre" })).toEqual([-2, 0, 2]);
    expect(applyPosthocTransform(values, ["offset", 1])).toEqual([3, 5, 7]);
    expect(applyPosthocTransform(values, ["scale", 2])).toEqual([4, 8, 12]);
    expect(applyPosthocTransform(values, { type: "norm" })).toEqual([
      -1.224744871391589,
      0,
      1.224744871391589,
    ]);
    expect(values).toEqual([2, 4, 6]);
  });

  it("samples distributions deterministically with a seeded rng", () => {
    const rng = createSeededRng(42);

    expect(sampleDistribution({ type: "constant", value: 5 }, { rng })).toBe(5);
    expect(sampleDistribution({ type: "uniform", min: 0, max: 10 }, { rng })).toBeCloseTo(2.5234517478384078);
    expect(sampleDistribution({ type: "logUniform", min: 1, max: 100 }, { rng })).toBeCloseTo(1.5005486858157);
    expect(sampleDistribution({ type: "choice", values: [10, 20, 30] }, { rng })).toBe(20);
  });

  it("samples named parameter maps with shared rng progression", () => {
    const sample = sampleDistributions(
      {
        a: { type: "uniform", min: 0, max: 1 },
        b: { type: "uniform", min: 10, max: 20 },
      },
      { seed: 7 },
    );

    expect(sample.a).toBeCloseTo(0.23878083983436227);
    expect(sample.b).toBeCloseTo(19.134932646993548);
  });
});
