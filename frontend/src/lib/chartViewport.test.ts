import { describe, expect, it } from "vitest";
import { panRange, zoomRange } from "./chartViewport";

describe("chart viewport math", () => {
  it("zooms in around a focus point (factor < 1)", () => {
    expect(zoomRange(0, 10, 5, 0.5)).toEqual([2.5, 7.5]);
  });

  it("keeps the focus point's relative position fixed while zooming", () => {
    const [min, max] = zoomRange(0, 10, 2, 0.5);
    expect((2 - min) / (max - min)).toBeCloseTo(0.2, 10);
  });

  it("zooms out with factor > 1", () => {
    expect(zoomRange(0, 10, 5, 2)).toEqual([-5, 15]);
  });

  it("pans a range by a signed delta", () => {
    expect(panRange(0, 10, 3)).toEqual([3, 13]);
    expect(panRange(0, 10, -4)).toEqual([-4, 6]);
  });
});
