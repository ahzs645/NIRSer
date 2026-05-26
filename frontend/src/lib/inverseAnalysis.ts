import type { MatNumericMatrix } from "./mat";

export type VoxelMesh = {
  nodes: number[][];
  vox_DIM: [number, number, number];
  voxRES: number | [number, number, number];
  voxnodes?: number[][];
  mesh2vox?: number[];
};

export type VoxelVolume = {
  img: number[] | number[][];
  field: string;
  mesh: VoxelMesh;
  RES: VoxelMesh["voxRES"];
  dims: [number, number, number, number?];
};

export type HemoglobinCurves = {
  hbo: number[][];
  hbb: number[][];
  hbt: number[][];
};

export type ScalpBrainHemoglobinSummary = {
  scalp: HemoglobinCurves;
  brain: HemoglobinCurves;
  subjectCount: number;
  frameCount: number;
  missingFields: string[];
};

function finiteValues(values: number[]) {
  return values.filter(Number.isFinite);
}

export function nanMedian(values: number[]): number {
  const finite = finiteValues(values).sort((a, b) => a - b);
  if (finite.length === 0) return Number.NaN;
  const mid = Math.floor(finite.length / 2);
  return finite.length % 2 === 0 ? (finite[mid - 1] + finite[mid]) / 2 : finite[mid];
}

export function nanMean(values: number[]): number {
  const finite = finiteValues(values);
  return finite.length === 0 ? Number.NaN : finite.reduce((sum, value) => sum + value, 0) / finite.length;
}

export function nanStd(values: number[]): number {
  const finite = finiteValues(values);
  if (finite.length < 2) return 0;
  const mean = nanMean(finite);
  const variance = finite.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (finite.length - 1);
  return Math.sqrt(variance);
}

export function standardError(values: number[]): number {
  const finite = finiteValues(values);
  return finite.length === 0 ? Number.NaN : nanStd(finite) / Math.sqrt(finite.length);
}

export function evaluateConcentrationAbs(
  mua830: number[][],
  mua690: number[][],
  hbo830: number,
  hbo690: number,
  hbb830: number,
  hbb690: number,
) {
  if (mua830.length !== mua690.length || mua830.some((row, index) => row.length !== mua690[index]?.length)) {
    throw new Error("830 nm and 690 nm absorption matrices must have matching dimensions.");
  }
  const determinant = hbo830 * hbb690 - hbo690 * hbb830;
  if (determinant === 0) throw new Error("Extinction coefficient matrix is singular.");

  const hbo = mua830.map((row830, rowIndex) =>
    row830.map((value830, columnIndex) => (hbb690 * value830 - hbb830 * mua690[rowIndex][columnIndex]) / determinant),
  );
  const hbb = mua830.map((row830, rowIndex) =>
    row830.map((value830, columnIndex) => (-hbo690 * value830 + hbo830 * mua690[rowIndex][columnIndex]) / determinant),
  );
  return { hbo, hbb };
}

export function baselineSubtract(values: number[][], baselineFrameCount: number) {
  const frameCount = Math.max(1, Math.floor(baselineFrameCount));
  return values.map((row) => {
    const baseline = nanMean(row.slice(0, frameCount));
    return row.map((value) => value - baseline);
  });
}

function columnMajorIndex(x: number, y: number, z: number, dims: [number, number, number]) {
  return x + y * dims[0] + z * dims[0] * dims[1];
}

export function voxelizeField(mesh: VoxelMesh, field: string, valuesByNode: number[][]): VoxelVolume {
  if (!mesh.vox_DIM) throw new Error("Estimation of voxelization transform is missing.");
  if (!mesh.voxRES) throw new Error("Mesh voxelization transform was not computed.");
  if (mesh.nodes.length !== valuesByNode.length) throw new Error("The selected field cannot be voxelized.");

  const frameCount = valuesByNode[0]?.length ?? 0;
  const voxelCount = mesh.vox_DIM[0] * mesh.vox_DIM[1] * mesh.vox_DIM[2];
  const values = Array.from({ length: voxelCount }, () => Array(frameCount).fill(0));

  if (mesh.voxnodes && mesh.mesh2vox) {
    for (let voxel = 0; voxel < Math.min(voxelCount, mesh.mesh2vox.length); voxel += 1) {
      const meshIndex = mesh.mesh2vox[voxel] - 1;
      if (meshIndex >= 0 && meshIndex < valuesByNode.length) values[voxel] = [...valuesByNode[meshIndex]];
    }
  } else {
    for (let index = 0; index < Math.min(voxelCount, valuesByNode.length); index += 1) {
      values[index] = [...valuesByNode[index]];
    }
  }

  return {
    img: frameCount === 1 ? values.map((row) => row[0]) : values,
    field,
    mesh,
    RES: mesh.voxRES,
    dims: frameCount === 1 ? mesh.vox_DIM : [...mesh.vox_DIM, frameCount],
  };
}

export function voxelSeriesAt(volume: VoxelVolume, x: number, y: number, z: number) {
  const index = columnMajorIndex(x, y, z, volume.dims.slice(0, 3) as [number, number, number]);
  const img = volume.img;
  return Array.isArray(img[index]) ? [...(img[index] as number[])] : [img[index] as number];
}

function matrixRows(matrix: MatNumericMatrix) {
  const rows = matrix.dims[0] ?? 0;
  const cols = matrix.dims[1] ?? 1;
  return Array.from({ length: rows }, (_, row) =>
    Array.from({ length: cols }, (_, col) => matrix.values[row + col * rows] ?? Number.NaN),
  );
}

function requiredMatrix(matrices: Map<string, MatNumericMatrix>, name: string) {
  const matrix = matrices.get(name);
  if (!matrix) throw new Error(`MAT file is missing ${name}.`);
  return matrixRows(matrix);
}

function optionalMatrix(matrices: Map<string, MatNumericMatrix>, name: string, fallbackShape: number[][]) {
  const matrix = matrices.get(name);
  return matrix ? matrixRows(matrix) : fallbackShape.map((row) => row.map(() => Number.NaN));
}

function addMatrices(left: number[][], right: number[][]) {
  return left.map((row, rowIndex) => row.map((value, columnIndex) => value + (right[rowIndex]?.[columnIndex] ?? 0)));
}

export function summarizeAverageHemoglobinMat(matrices: Map<string, MatNumericMatrix>): ScalpBrainHemoglobinSummary {
  const scalpHbo = requiredMatrix(matrices, "DHbOs");
  const brainHbo = requiredMatrix(matrices, "DHbOb");
  const brainHbb = requiredMatrix(matrices, "DHbb");
  const missingFields = ["DHbs"].filter((name) => !matrices.has(name));
  const scalpHbb = optionalMatrix(matrices, "DHbs", scalpHbo);
  return {
    scalp: { hbo: scalpHbo, hbb: scalpHbb, hbt: addMatrices(scalpHbo, scalpHbb) },
    brain: { hbo: brainHbo, hbb: brainHbb, hbt: addMatrices(brainHbo, brainHbb) },
    frameCount: scalpHbo.length,
    subjectCount: scalpHbo[0]?.length ?? 0,
    missingFields,
  };
}

export function frameStats(rowsByFrame: number[][]) {
  return rowsByFrame.map((values) => ({
    mean: nanMean(values),
    median: nanMedian(values),
    std: nanStd(values),
    sem: standardError(values),
  }));
}
