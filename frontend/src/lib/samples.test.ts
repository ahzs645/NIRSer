import { describe, expect, it } from "vitest";
import type { NirsPacket, NirsPoint } from "../types/nirs";
import { defaultSettings } from "./defaults";
import { buildSamples, applyFilterPasses } from "./samples";

const packet: NirsPacket = [35000, 35100, 35200, 35300, 35400, 35500, 35600, 35700];

describe("sample helpers", () => {
  it("builds processed samples using the configured packet interval", () => {
    const samples = buildSamples([packet, packet], defaultSettings);
    expect(samples).toHaveLength(2);
    expect(samples[0].time).toBe(0);
    expect(samples[1].time).toBeCloseTo(defaultSettings.nirsTimePerPacket);
    expect(samples[1].raw).toEqual(packet);
  });

  it("leaves points unchanged when no filter passes are requested", () => {
    const points: NirsPoint[] = [
      { time: 0, o2hb: 1, hhb: 2, thb: 3, hbdiff: -1, toi: 50 },
      { time: 1, o2hb: 2, hhb: 3, thb: 5, hbdiff: -1, toi: 50 },
    ];
    expect(applyFilterPasses(points, 0, 4, 0.02)).toBe(points);
  });

  it("can apply the original-style Kalman analysis filter mode", () => {
    const points: NirsPoint[] = [
      { time: 0, o2hb: 0, hhb: 0, thb: 0, hbdiff: 0, toi: 0 },
      { time: 1, o2hb: 10, hhb: 6, thb: 16, hbdiff: 4, toi: 60 },
      { time: 2, o2hb: 0, hhb: 0, thb: 0, hbdiff: 0, toi: 0 },
    ];

    const filtered = applyFilterPasses(points, 1, 0.5, 0.01, "kalman");

    expect(filtered).toHaveLength(points.length);
    expect(filtered.map((point) => point.time)).toEqual([0, 1, 2]);
    expect(filtered[1].o2hb).toBeGreaterThan(0);
    expect(filtered[1].o2hb).toBeLessThan(10);
    expect(filtered[2].o2hb).toBeGreaterThan(0);
  });
});
