import { describe, expect, it } from "vitest";
import { defaultSections, defaultSettings, normalizeSettings } from "./defaults";

describe("default app settings", () => {
  it("keeps the JavaFX acquisition defaults centralized", () => {
    expect(defaultSettings).toMatchObject({
      deviceKind: "pathonix",
      useToi: false,
      nirsTimePerPacket: 0.0277777777777778,
      loadCellTimePerPacket: 0.04,
      nirsFrameRate: 9,
      loadCellFrameRate: 9,
      loadCellSerialNumber: "680844",
      loadCellPointsPerSecond: 25,
    });
  });

  it("creates fresh default analysis sections", () => {
    const first = defaultSections();
    const second = defaultSections();
    expect(first.map(({ name, initialTime, endTime }) => ({ name, initialTime, endTime }))).toEqual([
      { name: "baseline", initialTime: 0, endTime: 8 },
      { name: "contraction", initialTime: 8, endTime: 20 },
    ]);
    expect(first[0].id).not.toBe(second[0].id);
  });

  it("normalizes imported settings and rejects invalid values", () => {
    expect(normalizeSettings({
      deviceKind: "bad",
      useToi: "yes",
      nirsTimePerPacket: -1,
      loadCellTimePerPacket: 0,
      nirsFrameRate: Number.NaN,
      loadCellFrameRate: "8",
      loadCellSerialNumber: "  123  ",
      loadCellPointsPerSecond: "50",
    })).toMatchObject({
      deviceKind: "pathonix",
      useToi: false,
      nirsTimePerPacket: defaultSettings.nirsTimePerPacket,
      loadCellTimePerPacket: 0.02,
      nirsFrameRate: defaultSettings.nirsFrameRate,
      loadCellFrameRate: 8,
      loadCellSerialNumber: "123",
      loadCellPointsPerSecond: 50,
    });
  });
});
