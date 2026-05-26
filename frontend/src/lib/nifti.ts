export type NiftiImage = {
  dims: [number, number, number];
  pixdim: [number, number, number];
  datatype: number;
  voxOffset: number;
  values: number[];
};

function readString(bytes: Uint8Array, offset: number, length: number) {
  return new TextDecoder().decode(bytes.slice(offset, offset + length)).replace(/\0/g, "");
}

function inferLittleEndian(view: DataView) {
  const little = view.getInt32(0, true);
  const big = view.getInt32(0, false);
  if (little === 348) return true;
  if (big === 348) return false;
  throw new Error("Not a NIfTI-1 header.");
}

function valueReader(view: DataView, datatype: number, littleEndian: boolean) {
  if (datatype === 2) return { bytes: 1, read: (offset: number) => view.getUint8(offset) };
  if (datatype === 4) return { bytes: 2, read: (offset: number) => view.getInt16(offset, littleEndian) };
  if (datatype === 8) return { bytes: 4, read: (offset: number) => view.getInt32(offset, littleEndian) };
  if (datatype === 16) return { bytes: 4, read: (offset: number) => view.getFloat32(offset, littleEndian) };
  if (datatype === 64) return { bytes: 8, read: (offset: number) => view.getFloat64(offset, littleEndian) };
  if (datatype === 512) return { bytes: 2, read: (offset: number) => view.getUint16(offset, littleEndian) };
  if (datatype === 768) return { bytes: 4, read: (offset: number) => view.getUint32(offset, littleEndian) };
  throw new Error(`Unsupported NIfTI datatype: ${datatype}`);
}

export function parseNifti(buffer: ArrayBuffer): NiftiImage {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const littleEndian = inferLittleEndian(view);
  const magic = readString(bytes, 344, 4);
  if (!magic.startsWith("n+1") && !magic.startsWith("ni1")) throw new Error("Unsupported NIfTI magic.");

  const dims: [number, number, number] = [
    view.getInt16(42, littleEndian),
    view.getInt16(44, littleEndian),
    view.getInt16(46, littleEndian),
  ];
  const pixdim: [number, number, number] = [
    view.getFloat32(80, littleEndian),
    view.getFloat32(84, littleEndian),
    view.getFloat32(88, littleEndian),
  ];
  const datatype = view.getInt16(70, littleEndian);
  const voxOffset = Math.trunc(view.getFloat32(108, littleEndian));
  const reader = valueReader(view, datatype, littleEndian);
  const voxelCount = dims[0] * dims[1] * dims[2];
  const values = Array.from({ length: voxelCount }, (_, index) => {
    const offset = voxOffset + index * reader.bytes;
    return offset + reader.bytes <= bytes.byteLength ? reader.read(offset) : Number.NaN;
  });

  return { dims, pixdim, datatype, voxOffset, values };
}

export function volumeIndex(x: number, y: number, z: number, dims: [number, number, number]) {
  return x + y * dims[0] + z * dims[0] * dims[1];
}

export function downsampleVolume(values: number[], dims: [number, number, number], step: number) {
  const stride = Math.max(1, Math.floor(step));
  const outDims: [number, number, number] = [
    Math.ceil(dims[0] / stride),
    Math.ceil(dims[1] / stride),
    Math.ceil(dims[2] / stride),
  ];
  const out = Array.from({ length: outDims[0] * outDims[1] * outDims[2] }, (_, index) => {
    const x = index % outDims[0];
    const y = Math.floor(index / outDims[0]) % outDims[1];
    const z = Math.floor(index / (outDims[0] * outDims[1]));
    return values[volumeIndex(x * stride, y * stride, z * stride, dims)] ?? Number.NaN;
  });
  return { dims: outDims, values: out };
}

export function sliceVolume(values: number[], dims: [number, number, number], axis: "x" | "y" | "z", slice: number) {
  const clamped = Math.max(0, Math.min(slice, axis === "x" ? dims[0] - 1 : axis === "y" ? dims[1] - 1 : dims[2] - 1));
  const width = axis === "x" ? dims[1] : dims[0];
  const height = axis === "z" ? dims[1] : dims[2];
  const data = Array.from({ length: width * height }, (_, index) => {
    const a = index % width;
    const b = Math.floor(index / width);
    const x = axis === "x" ? clamped : a;
    const y = axis === "y" ? clamped : axis === "x" ? a : b;
    const z = axis === "z" ? clamped : b;
    return values[volumeIndex(x, y, z, dims)] ?? Number.NaN;
  });
  return { width, height, values: data };
}
