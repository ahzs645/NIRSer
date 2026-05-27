/// <reference types="node" />
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { externalFixtureDir } from "./externalFixtures";
import { downsampleVolume, parseNifti, sliceVolume } from "./nifti";

const includedDataDir = externalFixtureDir();
const externalDataAvailable = existsSync(`${includedDataDir}/MPRAGE_R.nii`);

function readIncluded(filename: string) {
  const path = `${includedDataDir}/${filename}`;
  if (!existsSync(path)) throw new Error(`Included test data missing: ${path}`);
  const bytes = readFileSync(path);
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

describe("NIfTI utilities", () => {
  it.skipIf(!externalDataAvailable)("parses included MRI volume headers and values", () => {
    const image = parseNifti(readIncluded("MPRAGE_R.nii"));

    expect(image.dims.every((value) => value > 0)).toBe(true);
    expect(image.values).toHaveLength(image.dims[0] * image.dims[1] * image.dims[2]);
    expect(image.voxOffset).toBeGreaterThanOrEqual(348);
  }, 20_000);

  it("downsamples and slices volumes in column-major voxel order", () => {
    const downsampled = downsampleVolume([1, 2, 3, 4, 5, 6, 7, 8], [2, 2, 2], 2);
    expect(downsampled).toEqual({ dims: [1, 1, 1], values: [1] });

    const slice = sliceVolume([1, 2, 3, 4, 5, 6, 7, 8], [2, 2, 2], "z", 1);
    expect(slice).toEqual({ width: 2, height: 2, values: [5, 6, 7, 8] });
  });
});
