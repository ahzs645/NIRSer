import { describe, expect, it } from "vitest";
import {
  exportCalculatedValuesCsv,
  exportHbValuesCsv,
  exportLoadCellCsv,
  exportMarks,
  exportSectionStatsWithFilterCsv,
  exportSections,
  exportSerialEventsCsv,
  exportSourceValuesCsv,
} from "./exporters";
import type { AnalysisStats, AppSettings, NirsPacket } from "../types/nirs";

const settings: AppSettings = {
  deviceKind: "pathonix",
  useToi: false,
  nirsTimePerPacket: 0.0277777777777778,
  loadCellTimePerPacket: 0.04,
  nirsFrameRate: 4,
  loadCellFrameRate: 4,
  loadCellSerialNumber: "680844",
  loadCellPointsPerSecond: 25,
};

describe("legacy exporters", () => {
  it("exports finite load-cell values only", () => {
    expect(exportLoadCellCsv([
      { time: 0, value: 1 },
      { time: 1, value: Number.NaN },
      { time: 2, value: Number.POSITIVE_INFINITY },
      { time: 3, value: -2 },
    ])).toBe("1,-2");
  });

  it("exports marks and sections in sidecar-compatible formats", () => {
    expect(exportMarks([1, 2.345])).toBe("1.00\n2.35");
    expect(exportMarks([3, -1, Number.NaN, 1])).toBe("1.00\n3.00");
    expect(exportSections([{ id: "1", name: "baseline", initialTime: 0, endTime: 5 }])).toBe("baseline 0 5");
    expect(exportSections([
      { id: "1", name: "valid", initialTime: 0, endTime: 5 },
      { id: "2", name: "backwards", initialTime: 5, endTime: 1 },
      { id: "3", name: "nan", initialTime: Number.NaN, endTime: 2 },
      { id: "4", name: " ", initialTime: 1, endTime: 2 },
    ])).toBe("valid 0 5");
  });

  it("re-saves imported TXT source rows instead of zeroed raw placeholders", () => {
    expect(exportSourceValuesCsv([
      {
        time: 0,
        channel1: { time: 0, o2hb: 11, hhb: 12, thb: 10, hbdiff: -1, toi: 50 },
        channel2: { time: 0, o2hb: 21, hhb: 22, thb: 20, hbdiff: -1, toi: 50 },
        raw: [0, 1, 2, 10, 11, 12, 6, 20],
        sourceValues: [0, 1, 2, 10, 11, 12, 6, 20, 21, 22, 1],
      },
    ])).toBe("0,1,2,10,11,12,6,20,21,22,1");
  });

  it("exports Hb values with the original header and mark column behavior", () => {
    const packets: NirsPacket[] = [
      [35000, 35100, 35200, 35300, 35400, 35500, 35600, 35700],
      [35010, 35110, 35210, 35310, 35410, 35510, 35610, 35710],
    ];
    const csv = exportHbValuesCsv(packets, settings, [0]);
    const rows = csv.split("\n");
    expect(rows[0]).toBe("Time,Ch1O2Hb,Ch1HHb,Ch1THb,Ch2O2Hb,Ch2HHb,Ch2THb");
    expect(rows).toHaveLength(2);
    expect(rows[1].split(",")).toHaveLength(8);
    expect(rows[1].endsWith(",1")).toBe(true);
  });

  it("uses strict legacy mark tolerance around rounded packet times", () => {
    const packets: NirsPacket[] = [
      [35000, 35100, 35200, 35300, 35400, 35500, 35600, 35700],
      [35010, 35110, 35210, 35310, 35410, 35510, 35610, 35710],
      [35020, 35120, 35220, 35320, 35420, 35520, 35620, 35720],
    ];
    const tolerance = settings.nirsTimePerPacket - 0.0077777777777778;
    const roundedSecondPacketTime = Number(settings.nirsTimePerPacket.toFixed(2));

    const outsideCsv = exportHbValuesCsv(packets, settings, [
      roundedSecondPacketTime - tolerance,
      roundedSecondPacketTime + tolerance,
    ]);
    expect(outsideCsv.split("\n")[2].endsWith(",0")).toBe(true);

    const insideCsv = exportHbValuesCsv(packets, settings, [
      roundedSecondPacketTime - tolerance + Number.EPSILON,
    ]);
    expect(insideCsv.split("\n")[2].endsWith(",1")).toBe(true);
  });

  it("skips the final raw packet like the legacy Hb exporter", () => {
    const packets: NirsPacket[] = [
      [35000, 35100, 35200, 35300, 35400, 35500, 35600, 35700],
      [35010, 35110, 35210, 35310, 35410, 35510, 35610, 35710],
      [35020, 35120, 35220, 35320, 35420, 35520, 35620, 35720],
    ];

    expect(exportHbValuesCsv(packets, settings, []).split("\n")).toHaveLength(3);
  });

  it("exports every processed TXT fallback sample instead of applying the raw-packet final skip", () => {
    const packets: NirsPacket[] = [
      [0, 1, 2, 10, 11, 12, 6, 20],
      [0, 1, 2, 13, 14, 15, 6, 23],
    ];
    const fallbackSamples = [
      {
        time: 0,
        channel1: { time: 0, o2hb: 11, hhb: 12, thb: 10, hbdiff: -1, toi: 50 },
        channel2: { time: 0, o2hb: 21, hhb: 22, thb: 20, hbdiff: -1, toi: 50 },
        raw: packets[0],
      },
      {
        time: 0.02,
        channel1: { time: 0.02, o2hb: 14, hhb: 15, thb: 13, hbdiff: -1, toi: 50 },
        channel2: { time: 0.02, o2hb: 24, hhb: 25, thb: 23, hbdiff: -1, toi: 50 },
        raw: packets[1],
      },
    ];

    expect(exportHbValuesCsv(packets, settings, [], fallbackSamples).split("\n")).toHaveLength(3);
  });

  it("prefixes section stats export with filter metadata", () => {
    const dataInfo = { min: { time: 0, value: 1 }, max: { time: 1, value: 2 }, average: 1.5, slope: 0.1, r: 0.9, intercept: 1 };
    const stats: AnalysisStats = {
      channel1: { o2hb: dataInfo, hhb: dataInfo, thb: dataInfo, hbdiff: dataInfo, toi: dataInfo },
      channel2: { o2hb: dataInfo, hhb: dataInfo, thb: dataInfo, hbdiff: dataInfo, toi: dataInfo },
      loadCell: dataInfo,
    };
    const csv = exportSectionStatsWithFilterCsv(
      [{ section: { id: "s", name: "baseline", initialTime: 0, endTime: 1 }, stats }],
      { passes: 2, order: 4, cutoff: 0.02 },
    );
    expect(csv.startsWith("Filter times applied:,2\nFilter order:,4\nFilter cutoff:,0.02")).toBe(true);
    expect(csv).toContain("baseline,0,1");
    expect(csv).toContain("Channel 1\nO2Hb");
    expect(csv).toContain("HbDif");
    expect(csv).toContain("Channel 2");
    expect(csv).toContain("Load Cell");
  });

  it("exports calculated value snapshots as durable analysis rows", () => {
    const dataInfo = { min: { time: 0, value: 1 }, max: { time: 1, value: 2 }, average: 1.5, slope: 0.1, r: 0.9, intercept: 1 };
    const stats: AnalysisStats = {
      channel1: { o2hb: dataInfo, hhb: dataInfo, thb: dataInfo, hbdiff: dataInfo, toi: dataInfo },
      channel2: { o2hb: dataInfo, hhb: dataInfo, thb: dataInfo, hbdiff: dataInfo, toi: dataInfo },
      loadCell: dataInfo,
    };
    const csv = exportCalculatedValuesCsv([
      {
        id: "1",
        sectionName: "baseline, quoted",
        initialTime: 0,
        endTime: 5,
        filterPasses: 2,
        filterOrder: 4,
        filterCutoff: 0.02,
        calculatedAt: "2026-05-25T00:00:00.000Z",
        stats,
      },
    ]);

    expect(csv.split("\n")[0]).toContain("CalculatedAt,Section,InitialTime");
    expect(csv).toContain('"baseline, quoted"');
    expect(csv).toContain("channel1,o2hb");
    expect(csv).toContain("loadCell,value");
  });

  it("exports serial events with CSV escaping", () => {
    const csv = exportSerialEventsCsv([
      { timestamp: "2026-05-25T00:00:00.000Z", source: "nirs", event: "packet", detail: "1,2,3" },
    ]);

    expect(csv).toContain('"1,2,3"');
  });
});
