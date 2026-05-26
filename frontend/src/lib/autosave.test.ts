import { describe, expect, it } from "vitest";
import { AUTOSAVE_KEY, clearAutosaveSnapshot, createAutosaveSnapshot, loadAutosaveSnapshot, saveAutosaveSnapshot } from "./autosave";

describe("real-time autosave snapshots", () => {
  it("serializes the same sidecar-compatible payloads used by manual save", () => {
    const snapshot = createAutosaveSnapshot({
      samples: [
        {
          time: 0,
          channel1: { time: 0, o2hb: 1, hhb: 2, thb: 3, hbdiff: -1, toi: 50 },
          channel2: { time: 0, o2hb: 4, hhb: 5, thb: 9, hbdiff: -1, toi: 50 },
          raw: [1, 2, 3, 4, 5, 6, 7, 8],
        },
      ],
      loadCell: [{ time: 0, value: 12 }],
      marks: [1.234],
      sections: [{ id: "s", name: "baseline", initialTime: 0, endTime: 5 }],
      preferSourceValues: false,
      sessionBaseName: "trial",
    });

    expect(snapshot.nirsFormat).toBe("raw-packets");
    expect(snapshot.nirsCsv).toBe("1,2,3,4,5,6,7,8");
    expect(snapshot.loadCellCsv).toBe("12");
    expect(snapshot.marksText).toBe("1.23");
    expect(snapshot.sectionsText).toBe("baseline 0 5");
    expect(snapshot.sessionBaseName).toBe("trial");
  });

  it("preserves imported TXT source values when requested", () => {
    const snapshot = createAutosaveSnapshot({
      samples: [
        {
          time: 0,
          channel1: { time: 0, o2hb: 11, hhb: 12, thb: 10, hbdiff: -1, toi: 50 },
          channel2: { time: 0, o2hb: 21, hhb: 22, thb: 20, hbdiff: -1, toi: 50 },
          raw: [0, 1, 2, 10, 11, 12, 6, 20],
          sourceValues: [0, 1, 2, 10, 11, 12, 6, 20, 21, 22, 1],
        },
      ],
      loadCell: [],
      marks: [],
      sections: [],
      preferSourceValues: true,
    });

    expect(snapshot.nirsFormat).toBe("source-values");
    expect(snapshot.nirsCsv).toBe("0,1,2,10,11,12,6,20,21,22,1");
  });

  it("writes snapshots to the configured storage key", () => {
    const items = new Map<string, string>();
    expect(saveAutosaveSnapshot(
      { savedAt: "now", nirsFormat: "raw-packets", nirsCsv: "1", loadCellCsv: "2", marksText: "3", sectionsText: "4" },
      { setItem: (key, value) => items.set(key, value) },
    )).toBe(true);

    expect(JSON.parse(items.get(AUTOSAVE_KEY) ?? "{}")).toEqual({
      savedAt: "now",
      nirsFormat: "raw-packets",
      nirsCsv: "1",
      loadCellCsv: "2",
      marksText: "3",
      sectionsText: "4",
    });
  });

  it("can include full session metadata for real-time restore", () => {
    const dataInfo = { min: { time: 0, value: 1 }, max: { time: 1, value: 2 }, average: 1.5, slope: 0.1, r: 0.9, intercept: 1 };
    const snapshot = createAutosaveSnapshot({
      samples: [],
      loadCell: [],
      marks: [],
      sections: [],
      preferSourceValues: false,
      sessionBaseName: "trial",
      settings: {
        deviceKind: "pathonix",
        useToi: false,
        nirsTimePerPacket: 0.0277777777777778,
        loadCellTimePerPacket: 0.04,
        nirsFrameRate: 4,
        loadCellFrameRate: 4,
        loadCellSerialNumber: "680844",
        loadCellPointsPerSecond: 25,
      },
      calculatedValues: [{
        id: "c",
        sectionName: "baseline",
        initialTime: 0,
        endTime: 1,
        filterPasses: 0,
        filterOrder: 4,
        filterCutoff: 0.02,
        calculatedAt: "2026-05-25T00:00:00.000Z",
        stats: {
          channel1: { o2hb: dataInfo, hhb: dataInfo, thb: dataInfo, hbdiff: dataInfo, toi: dataInfo },
          channel2: { o2hb: dataInfo, hhb: dataInfo, thb: dataInfo, hbdiff: dataInfo, toi: dataInfo },
          loadCell: dataInfo,
        },
      }],
      serialEvents: [{ timestamp: "2026-05-25T00:00:00.000Z", source: "nirs", event: "start", detail: "pathonix" }],
    });

    expect(snapshot.settingsJson).toContain("loadCellSerialNumber");
    expect(snapshot.calculatedValuesCsv).toContain("baseline");
    expect(snapshot.hbValuesCsv).toContain("Time,Ch1O2Hb,Ch1HHb,Ch1THb,Ch2O2Hb,Ch2HHb,Ch2THb");
    expect(snapshot.serialLogCsv).toContain("pathonix");
  });

  it("reports unavailable storage without throwing", () => {
    expect(saveAutosaveSnapshot(
      { savedAt: "now", nirsFormat: "raw-packets", nirsCsv: "1", loadCellCsv: "2", marksText: "3", sectionsText: "4" },
      null,
    )).toBe(false);
  });

  it("loads and clears snapshots from storage", () => {
    const items = new Map([[AUTOSAVE_KEY, JSON.stringify({
      savedAt: "now",
      nirsFormat: "source-values",
      nirsCsv: "1",
      loadCellCsv: "",
      marksText: "",
      sectionsText: "",
    })]]);
    const storage = {
      getItem: (key: string) => items.get(key) ?? null,
      removeItem: (key: string) => items.delete(key),
    };

    expect(loadAutosaveSnapshot(storage)?.nirsFormat).toBe("source-values");
    expect(clearAutosaveSnapshot(storage)).toBe(true);
    expect(loadAutosaveSnapshot(storage)).toBeNull();
  });
});
