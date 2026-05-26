/// <reference types="node" />
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildHemoglobinErrorSeries, buildMatlabHemoglobinPanels } from "./hemoglobinGraphing";
import { summarizeAverageHemoglobinMat } from "./inverseAnalysis";
import { parseNumericMatFile } from "./mat";

const includedDataDir = "/Users/ahmadjalil/Downloads/New Folder With Items 2/25866682";

function readIncludedMat(filename: string) {
  const path = `${includedDataDir}/${filename}`;
  if (!existsSync(path)) throw new Error(`Included test data missing: ${path}`);
  const bytes = readFileSync(path);
  return parseNumericMatFile(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
}

describe("hemoglobin graphing utilities", () => {
  it("builds scaled mean and SEM error points", () => {
    const series = buildHemoglobinErrorSeries(
      [
        [1, 2, 3],
        [2, Number.NaN, 4],
      ],
      "Scalp",
      "scalp",
      0.5,
      1000,
    );

    expect(series.available).toBe(true);
    expect(series.points[0]).toMatchObject({
      time: 0.5,
      mean: 2000,
      sem: expect.closeTo(577.350269, 5),
      subjectCount: 3,
    });
    expect(series.points[1]).toMatchObject({
      time: 1,
      mean: 3000,
      subjectCount: 2,
    });
  });

  it("creates MATLAB-equivalent panel metadata from included MAT summary data", () => {
    const summary = summarizeAverageHemoglobinMat(readIncludedMat("AverageHemoglobinScalpBrain.mat"));
    const panels = buildMatlabHemoglobinPanels(summary);

    expect(panels.map((panel) => panel.title)).toEqual(["O2Hb", "HHb", "HbT"]);
    expect(panels[0]).toMatchObject({
      xDomain: [0, 50],
      yDomain: [-2, 2],
      yLabel: "O2Hb (microM)",
      missingFields: ["DHbs"],
    });
    expect(panels[0].series).toHaveLength(2);
    expect(panels[0].series[0].points).toHaveLength(101);
    expect(panels[0].series[0].points[0].time).toBe(0.5);
    expect(panels[1].series.find((series) => series.id === "scalp")?.available).toBe(false);
    expect(panels[1].series.find((series) => series.id === "brain")?.available).toBe(true);
  });
});
