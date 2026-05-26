import { describe, expect, it } from "vitest";
import { formatAnalysisStatsTsv, summarize } from "./analysis";
import type { AnalysisStats, ChannelStats, DataInfo } from "../types/nirs";

describe("analysis statistics", () => {
  it("ignores malformed points while preserving finite summary values", () => {
    const info = summarize([
      { time: 0, value: 1 },
      { time: 1, value: Number.NaN },
      { time: Number.NaN, value: 2 },
      { time: 2, value: 3 },
    ]);

    expect(info.min).toEqual({ time: 0, value: 1 });
    expect(info.max).toEqual({ time: 2, value: 3 });
    expect(info.average).toBe(2);
    expect(info.slope).toBe(1);
  });

  it("returns zeroed stats when no finite points are available", () => {
    expect(summarize([{ time: Number.NaN, value: Number.NaN }])).toMatchObject({
      min: { time: 0, value: 0 },
      max: { time: 0, value: 0 },
      average: 0,
      slope: 0,
      r: 0,
      intercept: 0,
    });
  });
});

describe("formatAnalysisStatsTsv", () => {
  const info = (min: number, max: number, average: number, slope: number, r: number): DataInfo => ({
    min: { time: 0, value: min },
    max: { time: 1, value: max },
    average,
    slope,
    r,
    intercept: 0,
  });
  const channel: ChannelStats = {
    o2hb: info(1, 2, 1.5, 0.1, 0.9),
    hhb: info(0, 0, 0, 0, 0),
    thb: info(0, 0, 0, 0, 0),
    hbdiff: info(0, 0, 0, 0, 0),
    toi: info(0, 0, 0, 0, 0),
  };
  const stats: AnalysisStats = { channel1: channel, channel2: channel, loadCell: info(-1, 1, 0, 0, 0) };

  it("emits a header, one row per metric, and a final load-cell row", () => {
    const lines = formatAnalysisStatsTsv(stats).split("\n");
    expect(lines).toHaveLength(7); // header + O2Hb/HHb/THb/HbDiff/TOI + Load Cell
    expect(lines[0].split("\t")).toHaveLength(11);
    expect(lines[0]).toMatch(/^Signal\t/);
    expect(lines[1]).toBe("O2Hb\t1.00\t2.00\t1.50\t0.10\t0.90\t1.00\t2.00\t1.50\t0.10\t0.90");
    expect(lines[6]).toMatch(/^Load Cell\t-1.00\t1.00\t0.00\t0.00\t0.00/);
  });
});
