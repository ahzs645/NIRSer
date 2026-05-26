import { describe, expect, it } from "vitest";
import { sampleByDisplayRate } from "./displaySampling";

describe("display sampling", () => {
  it("samples by packets per second instead of index modulus", () => {
    const points = Array.from({ length: 11 }, (_, index) => ({ time: index * 0.1, value: index }));
    expect(sampleByDisplayRate(points, 2).map((point) => point.value)).toEqual([0, 5, 10]);
  });

  it("keeps display sampling separate from stored data", () => {
    const points = Array.from({ length: 5 }, (_, index) => ({ time: index * 0.25, value: index }));
    const sampled = sampleByDisplayRate(points, 4);
    expect(sampled).toHaveLength(5);
    expect(points).toHaveLength(5);
  });
});
