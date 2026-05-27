/// <reference types="node" />
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { externalFixtureDir } from "./externalFixtures";
import {
  baselineSubtract,
  evaluateConcentrationAbs,
  frameStats,
  nanMedian,
  summarizeAverageHemoglobinMat,
  voxelSeriesAt,
  voxelizeField,
} from "./inverseAnalysis";
import { parseNumericMatFile } from "./mat";

const includedDataDir = externalFixtureDir();
const channelSpaceDataAvailable = existsSync(`${includedDataDir}/dataChannelSpace.mat`);
const averageHemoglobinDataAvailable = existsSync(`${includedDataDir}/AverageHemoglobinScalpBrain.mat`);

function readIncludedMat(filename: string) {
  const path = `${includedDataDir}/${filename}`;
  if (!existsSync(path)) throw new Error(`Included test data missing: ${path}`);
  const bytes = readFileSync(path);
  return parseNumericMatFile(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
}

describe("inverse analysis utilities", () => {
  it("solves absolute hemoglobin concentrations from paired wavelength absorption", () => {
    const hbo = 2;
    const hbb = 3;
    const mua830 = [[0.02135 * hbo + 0.01791 * hbb]];
    const mua690 = [[0.0096 * hbo + 0.04931 * hbb]];

    const result = evaluateConcentrationAbs(mua830, mua690, 0.02135, 0.0096, 0.01791, 0.04931);

    expect(result.hbo[0][0]).toBeCloseTo(hbo, 10);
    expect(result.hbb[0][0]).toBeCloseTo(hbb, 10);
  });

  it("baseline subtracts the first frames and ignores NaN when summarizing", () => {
    expect(baselineSubtract([[2, 4, 8]], 2)[0]).toEqual([-1, 1, 5]);
    expect(nanMedian([Number.NaN, 10, 2, 4])).toBe(4);
    expect(frameStats([[1, 2, 3], [Number.NaN, 5]])).toMatchObject([
      { mean: 2, median: 2, sem: expect.closeTo(0.577350269, 8) },
      { mean: 5, median: 5, sem: 0 },
    ]);
  });

  it("voxelizes mesh fields with MATLAB-style one-based mesh2vox indexes", () => {
    const volume = voxelizeField(
      {
        nodes: [[0, 0, 0], [1, 0, 0]],
        vox_DIM: [2, 1, 1],
        voxRES: 1,
        voxnodes: [[0, 0, 0], [1, 0, 0]],
        mesh2vox: [2, 1],
      },
      "DHbO",
      [
        [10, 11],
        [20, 21],
      ],
    );

    expect(volume.dims).toEqual([2, 1, 1, 2]);
    expect(voxelSeriesAt(volume, 0, 0, 0)).toEqual([20, 21]);
    expect(voxelSeriesAt(volume, 1, 0, 0)).toEqual([10, 11]);
  });

  it.skipIf(!channelSpaceDataAvailable)("loads included channel-space MAT data dimensions", () => {
    const matrices = readIncludedMat("dataChannelSpace.mat");
    const data = matrices.get("data");

    expect(data?.dims).toEqual([22, 101, 240]);
    expect(data?.values.length).toBe(22 * 101 * 240);
  }, 20_000);

  it.skipIf(!averageHemoglobinDataAvailable)("summarizes included scalp/brain hemoglobin curves", () => {
    const matrices = readIncludedMat("AverageHemoglobinScalpBrain.mat");
    const summary = summarizeAverageHemoglobinMat(matrices);

    expect(summary.frameCount).toBe(101);
    expect(summary.subjectCount).toBe(22);
    expect(summary.missingFields).toEqual(["DHbs"]);
    expect(summary.scalp.hbt).toHaveLength(101);
    expect(summary.brain.hbt).toHaveLength(101);
    expect(summary.scalp.hbt[0]).toHaveLength(22);
    expect(frameStats(summary.brain.hbo)[50].mean).toBeTypeOf("number");
  }, 20_000);
});
