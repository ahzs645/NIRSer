import { describe, expect, it } from "vitest";
import { coordinateSearch, randomSearch } from "./optimizer";

describe("BCMD optimization utilities", () => {
  it("runs deterministic random search over bounded parameters", () => {
    const result = randomSearch(
      ({ x }) => (x - 0.25) ** 2,
      [{ name: "x", min: 0, max: 1 }],
      { iterations: 25, seed: 3 },
    );

    expect(result.best.x).toBeGreaterThanOrEqual(0);
    expect(result.best.x).toBeLessThanOrEqual(1);
    expect(result.score).toBeLessThan(0.01);
    expect(result.history).toHaveLength(26);
  });

  it("improves a coordinate search objective from initial parameters", () => {
    const result = coordinateSearch(
      ({ x, y }) => (x - 2) ** 2 + (y + 1) ** 2,
      [
        { name: "x", min: -5, max: 5, initial: 0 },
        { name: "y", min: -5, max: 5, initial: 0 },
      ],
      { iterations: 20, stepScale: 0.25 },
    );

    expect(result.best.x).toBeCloseTo(2, 1);
    expect(result.best.y).toBeCloseTo(-1, 1);
    expect(result.score).toBeLessThan(0.01);
  });
});
