import { describe, expect, it } from "vitest";
import { butterworthFilterNirsPoints, designButterworthLowpass } from "./butterworth";
import type { NirsPoint } from "../types/nirs";

describe("Butterworth filter", () => {
  it("rejects invalid low-pass cutoff values like the Java implementation", () => {
    expect(() => designButterworthLowpass(4, 0)).toThrow();
    expect(() => designButterworthLowpass(4, 0.5)).toThrow();
  });

  it("keeps point count and timestamps while filtering all NIRS series", () => {
    const points: NirsPoint[] = Array.from({ length: 20 }, (_, index) => ({
      time: index,
      o2hb: index % 2 === 0 ? 1 : 5,
      hhb: index % 2 === 0 ? 2 : 4,
      thb: index % 2 === 0 ? 3 : 9,
      hbdiff: index % 2 === 0 ? -1 : 1,
      toi: index % 2 === 0 ? 40 : 60,
    }));
    const filtered = butterworthFilterNirsPoints(points, 4, 0.02);
    expect(filtered).toHaveLength(points.length);
    expect(filtered.map((point) => point.time)).toEqual(points.map((point) => point.time));
    expect(filtered[0].o2hb).not.toBe(points[0].o2hb);
  });
});
