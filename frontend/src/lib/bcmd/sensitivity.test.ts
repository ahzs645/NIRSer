import { describe, expect, it } from "vitest";
import { summarizeSensitivity } from "./sensitivity";

describe("BCMD sensitivity utilities", () => {
  it("summarizes Morris-like effects and FAST-like rank variance shares", () => {
    const result = summarizeSensitivity(
      ({ a, b }) => 3 * a + b,
      [
        { name: "a", distribution: { type: "uniform", min: 0, max: 1 }, min: 0, max: 1 },
        { name: "b", distribution: { type: "uniform", min: 0, max: 1 }, min: 0, max: 1 },
      ],
      { samples: 64, seed: 11 },
    );

    expect(result[0]).toMatchObject({ name: "a" });
    expect(result[0].effectMean).toBeCloseTo(3);
    expect(result[1].effectMean).toBeCloseTo(1);
    expect(result[0].effectAbsMean).toBeGreaterThan(result[1].effectAbsMean);
    expect(result[0].varianceShare).toBeGreaterThan(result[1].varianceShare);
  });
});
