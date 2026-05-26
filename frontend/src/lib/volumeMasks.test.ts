import { describe, expect, it } from "vitest";
import { buildHeadMask, fillHoles3d, thresholdMask } from "./volumeMasks";

describe("volume mask utilities", () => {
  it("thresholds sensitivity values and builds MATLAB-style head labels", () => {
    const sensitivity = thresholdMask([-50, -30, -10], -40);
    expect(sensitivity).toEqual([false, true, true]);
    expect(buildHeadMask([true, false, true], sensitivity)).toEqual([0, 1, 2]);
  });

  it("fills enclosed holes in a 3D mask", () => {
    const dims: [number, number, number] = [3, 3, 3];
    const mask = Array(27).fill(true);
    mask[13] = false;

    expect(fillHoles3d(mask, dims)[13]).toBe(true);
  });
});
