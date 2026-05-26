import { describe, expect, it } from "vitest";
import {
  importCalculatedValuesCsv,
  importLegacyTextMarks,
  importLoadCellCsv,
  importMarksText,
  importNirsText,
  importSectionsText,
  importSerialEventsCsv,
  sidecarStem,
} from "./importers";

describe("legacy importers", () => {
  it("imports TXT NIRS files with the JavaFX column mapping", () => {
    const text = ["header 1", "header 2", "header 3", "0\t1\t2\t10\t11\t12\t6\t20\t21\t22\t1"].join("\n");
    const samples = importNirsText(text);
    expect(samples).toHaveLength(1);
    expect(samples[0].time).toBe(0);
    expect(samples[0].channel1).toMatchObject({ thb: 10, o2hb: 11, hhb: 12, hbdiff: -1 });
    expect(samples[0].channel2).toMatchObject({ thb: 20, o2hb: 21, hhb: 22, hbdiff: -1 });
    expect(samples[0].raw).toEqual([0, 1, 2, 10, 11, 12, 6, 20]);
    expect(samples[0].sourceValues).toEqual([0, 1, 2, 10, 11, 12, 6, 20, 21, 22, 1]);
    expect(importLegacyTextMarks(text)).toEqual([1]);
  });

  it("collapses legacy TXT mark flags to one marker and ignores non-one flags", () => {
    const multipleMarks = [
      "header 1",
      "header 2",
      "header 3",
      "0\t1\t2\t10\t11\t12\t6\t20\t21\t22\t1",
      "0\t1\t2\t10\t11\t12\t6\t20\t21\t22\t1",
    ].join("\n");
    const noMarks = [
      "header 1",
      "header 2",
      "header 3",
      "0\t1\t2\t10\t11\t12\t6\t20\t21\t22\t0",
      "0\t1\t2\t10\t11\t12\t6\t20\t21\t22\t2",
      "0\t1\t2\t10\t11\t12\t6\t20\t21\t22",
    ].join("\n");

    expect(importLegacyTextMarks(multipleMarks)).toEqual([1]);
    expect(importLegacyTextMarks(noMarks)).toEqual([]);
  });

  it("imports sidecar load cell, marks, and sections", () => {
    expect(importLoadCellCsv("1,2,3", 0.04)).toEqual([
      { time: 0, value: 1 },
      { time: 0.04, value: 2 },
      { time: 0.08, value: 3 },
    ]);
    expect(importMarksText("1.25\n2.5\n")).toEqual([1.25, 2.5]);
    expect(importSectionsText("baseline 0 5\nwork 5 10\n").map(({ name, initialTime, endTime }) => ({ name, initialTime, endTime }))).toEqual([
      { name: "baseline", initialTime: 0, endTime: 5 },
      { name: "work", initialTime: 5, endTime: 10 },
    ]);
    expect(sidecarStem("trial.csv")).toBe("trial");
  });

  it("imports original FUTEK bridge load-cell text lines", () => {
    expect(importLoadCellCsv("1 lbs\n2.5 lbs\nbad\nLCDLine2: -3.25 lb", 0.04)).toEqual([
      { time: 0, value: 1 },
      { time: 0.04, value: 2.5 },
      { time: 0.08, value: -3.25 },
    ]);
  });

  it("falls back to the legacy load-cell interval when import settings are invalid", () => {
    expect(importLoadCellCsv("1,2", Number.NaN)).toEqual([
      { time: 0, value: 1 },
      { time: 0.04, value: 2 },
    ]);
  });

  it("ignores invalid mark lines and keeps dotted sidecar filename stems", () => {
    expect(importMarksText("1.25\nbad\n\n2.5 seconds\n-1\n3\n")).toEqual([1.25, 3]);
    expect(sidecarStem("trial.v1.csv")).toBe("trial.v1");
    expect(sidecarStem("trial")).toBe("trial");
  });

  it("preserves multi-word section names and rejects invalid time ranges", () => {
    const sections = importSectionsText("baseline 0 5\nnamed baseline 10 20\nmissing-times\nbackwards 5 1\nzero 2 2\n");

    expect(sections.map(({ name, initialTime, endTime }) => ({ name, initialTime, endTime }))).toEqual([
      { name: "baseline", initialTime: 0, endTime: 5 },
      { name: "named baseline", initialTime: 10, endTime: 20 },
    ]);
  });

  it("restores calculated value snapshots from exported analysis rows", () => {
    const csv = [
      "CalculatedAt,Section,InitialTime,EndTime,FilterPasses,FilterOrder,FilterCutoff,Source,Metric,Min,MinTime,Max,MaxTime,Average,Slope,R",
      '2026-05-25T00:00:00.000Z,"baseline, quoted",0,5,2,4,0.02,channel1,o2hb,1,0,2,1,1.5,0.1,0.9',
      '2026-05-25T00:00:00.000Z,"baseline, quoted",0,5,2,4,0.02,loadCell,value,3,0,4,1,3.5,0.2,0.8',
    ].join("\n");

    const snapshots = importCalculatedValuesCsv(csv);

    expect(snapshots).toHaveLength(1);
    expect(snapshots[0]).toMatchObject({
      sectionName: "baseline, quoted",
      initialTime: 0,
      endTime: 5,
      filterPasses: 2,
      filterOrder: 4,
      filterCutoff: 0.02,
    });
    expect(snapshots[0].stats.channel1.o2hb.average).toBe(1.5);
    expect(snapshots[0].stats.loadCell.slope).toBe(0.2);
  });

  it("restores serial events from exported logs", () => {
    const events = importSerialEventsCsv('Timestamp,Source,Event,Detail\n2026-05-25T00:00:00.000Z,nirs,packet,"1,2,3"');

    expect(events).toEqual([
      { timestamp: "2026-05-25T00:00:00.000Z", source: "nirs", event: "packet", detail: "1,2,3" },
    ]);
  });
});
