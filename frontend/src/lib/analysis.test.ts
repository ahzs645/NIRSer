import { describe, expect, it } from "vitest";
import { summarize } from "./analysis";

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
