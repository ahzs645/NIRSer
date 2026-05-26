import { describe, expect, it } from "vitest";
import {
  applyInverseOperator,
  computeTikhonovInverseOperator,
  filterGoodChannels,
  invertMatrix,
  multiplyMatrices,
  sensitivityDb,
} from "./inverseMath";

describe("inverse reconstruction math", () => {
  it("inverts and multiplies small matrices", () => {
    const inverse = invertMatrix([
      [4, 7],
      [2, 6],
    ]);
    expect(multiplyMatrices([[4, 7]], inverse)[0]).toEqual([expect.closeTo(1, 10), expect.closeTo(0, 10)]);
  });

  it("builds a ridge inverse operator and applies channel frames", () => {
    const operator = computeTikhonovInverseOperator(
      [
        [1, 0],
        [0, 1],
      ],
      0.01,
    );
    const reconstructed = applyInverseOperator(operator, [[1], [2]]);
    expect(reconstructed[0][0]).toBeCloseTo(0.990099, 5);
    expect(reconstructed[1][0]).toBeCloseTo(1.980198, 5);
  });

  it("computes relative sensitivity dB and channel masks", () => {
    expect(sensitivityDb([[1, 2]])).toEqual([expect.closeTo(-6.0205999, 6), 0]);
    expect(filterGoodChannels([1, Number.NaN, 3], [1, 1, 0])).toEqual([true, false, false]);
  });
});
