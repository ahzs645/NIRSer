import type { MatValue } from "./mat";

export type NirsCoarseMesh = {
  nodes: number[][];
  mesh2vox: number[];
  voxRES: number;
  vox_DIM: [number, number, number];
  link: number[][];
  wvl_ch: number[];
  chdist: number[];
  mua: number[];
  mus: number[];
  region: number[];
};

export type JacobianFile = {
  coarseMesh: NirsCoarseMesh;
  jacobian: number[][];
  category?: string;
};

function numeric(value: MatValue | undefined, name: string) {
  if (value?.kind !== "numeric") throw new Error(`Expected numeric MAT value for ${name}.`);
  return value;
}

function char(value: MatValue | undefined) {
  return value?.kind === "char" ? value.value : undefined;
}

export function matNumericRows(value: MatValue | undefined, name: string) {
  const matrix = numeric(value, name);
  const rows = matrix.dims[0] ?? 0;
  const cols = matrix.dims[1] ?? 1;
  return Array.from({ length: rows }, (_, row) =>
    Array.from({ length: cols }, (_, col) => matrix.values[row + col * rows] ?? Number.NaN),
  );
}

export function matNumericColumn(value: MatValue | undefined, name: string) {
  return matNumericRows(value, name).flat();
}

function firstStructField(struct: MatValue, field: string) {
  if (struct.kind !== "struct") throw new Error("Expected MAT struct.");
  return struct.fields[field]?.[0];
}

export function parseCoarseMesh(value: MatValue): NirsCoarseMesh {
  return {
    nodes: matNumericRows(firstStructField(value, "nodes"), "coarse_mesh.nodes"),
    mesh2vox: matNumericColumn(firstStructField(value, "mesh2vox"), "coarse_mesh.mesh2vox").map(Math.trunc),
    voxRES: matNumericColumn(firstStructField(value, "voxRES"), "coarse_mesh.voxRES")[0] ?? 1,
    vox_DIM: matNumericColumn(firstStructField(value, "vox_DIM"), "coarse_mesh.vox_DIM").slice(0, 3).map(Math.trunc) as [number, number, number],
    link: matNumericRows(firstStructField(value, "link"), "coarse_mesh.link"),
    wvl_ch: matNumericColumn(firstStructField(value, "wvl_ch"), "coarse_mesh.wvl_ch").map(Math.trunc),
    chdist: matNumericColumn(firstStructField(value, "chdist"), "coarse_mesh.chdist"),
    mua: matNumericColumn(firstStructField(value, "mua"), "coarse_mesh.mua"),
    mus: matNumericColumn(firstStructField(value, "mus"), "coarse_mesh.mus"),
    region: matNumericColumn(firstStructField(value, "region"), "coarse_mesh.region").map(Math.trunc),
  };
}

export function parseJacobianFile(variables: Map<string, MatValue>): JacobianFile {
  const coarseMesh = variables.get("coarse_mesh");
  if (!coarseMesh) throw new Error("JAC file is missing coarse_mesh.");
  return {
    coarseMesh: parseCoarseMesh(coarseMesh),
    jacobian: matNumericRows(variables.get("J"), "J"),
    category: char(variables.get("category")),
  };
}

export function wavelengthChannelMask(mesh: NirsCoarseMesh, wavelength: number) {
  return mesh.wvl_ch.map((value) => value === wavelength);
}

export function jacobianSensitivityVolume(file: JacobianFile) {
  const squaredMeans = file.jacobian[0]?.map((_, col) => {
    const values = file.jacobian.map((row) => row[col]).filter(Number.isFinite);
    return values.reduce((sum, value) => sum + value * value, 0) / Math.max(values.length, 1);
  }) ?? [];
  const dbValues = squaredMeans.map((value) => 10 * Math.log10(Math.max(value, 1e-300)));
  const max = Math.max(...dbValues.filter(Number.isFinite));
  const nodeValues = dbValues.map((value) => value - max);
  const voxelCount = file.coarseMesh.vox_DIM[0] * file.coarseMesh.vox_DIM[1] * file.coarseMesh.vox_DIM[2];
  const values = Array(voxelCount).fill(Number.NaN);
  for (let voxel = 0; voxel < Math.min(voxelCount, file.coarseMesh.mesh2vox.length); voxel += 1) {
    const meshIndex = file.coarseMesh.mesh2vox[voxel] - 1;
    if (meshIndex >= 0 && meshIndex < nodeValues.length) values[voxel] = nodeValues[meshIndex];
  }
  return {
    dims: file.coarseMesh.vox_DIM,
    pixdim: [file.coarseMesh.voxRES, file.coarseMesh.voxRES, file.coarseMesh.voxRES] as [number, number, number],
    datatype: 16,
    voxOffset: 0,
    values,
  };
}
