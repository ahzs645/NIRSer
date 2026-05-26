import { decompressSync } from "fflate";
import type { BrunoMatData, ExtinctionRow } from "./bruno";

const MI_INT8 = 1;
const MI_UINT8 = 2;
const MI_INT16 = 3;
const MI_UINT16 = 4;
const MI_INT32 = 5;
const MI_UINT32 = 6;
const MI_SINGLE = 7;
const MI_DOUBLE = 9;
const MI_MATRIX = 14;
const MI_COMPRESSED = 15;

const bytesByType = new Map([
  [MI_INT8, 1],
  [MI_UINT8, 1],
  [MI_INT16, 2],
  [MI_UINT16, 2],
  [MI_INT32, 4],
  [MI_UINT32, 4],
  [MI_SINGLE, 4],
  [MI_DOUBLE, 8],
]);

type MatElement = {
  type: number;
  bytes: Uint8Array;
};

type NumericMatrix = {
  name: string;
  dims: number[];
  values: number[];
};

export type MatNumericMatrix = NumericMatrix;

function aligned(offset: number) {
  return offset + ((8 - (offset % 8)) % 8);
}

function readTag(view: DataView, offset: number) {
  const first = view.getUint32(offset, true);
  const smallBytes = first >>> 16;
  if (smallBytes > 0) {
    return {
      type: first & 0xffff,
      byteLength: smallBytes,
      dataOffset: offset + 4,
      rawNextOffset: offset + 8,
      nextOffset: offset + 8,
    };
  }
  const byteLength = view.getUint32(offset + 4, true);
  return {
    type: first,
    byteLength,
    dataOffset: offset + 8,
    rawNextOffset: offset + 8 + byteLength,
    nextOffset: aligned(offset + 8 + byteLength),
  };
}

function readElements(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const elements: MatElement[] = [];
  let offset = 0;
  while (offset + 8 <= bytes.byteLength) {
    const tag = readTag(view, offset);
    elements.push({
      type: tag.type,
      bytes: bytes.slice(tag.dataOffset, tag.dataOffset + tag.byteLength),
    });
    offset = tag.nextOffset;
  }
  return elements;
}

function numericValues(element: MatElement) {
  const bytesPerValue = bytesByType.get(element.type);
  if (!bytesPerValue) return [];
  const view = new DataView(element.bytes.buffer, element.bytes.byteOffset, element.bytes.byteLength);
  const values: number[] = [];
  for (let offset = 0; offset + bytesPerValue <= element.bytes.byteLength; offset += bytesPerValue) {
    if (element.type === MI_INT8) values.push(view.getInt8(offset));
    else if (element.type === MI_UINT8) values.push(view.getUint8(offset));
    else if (element.type === MI_INT16) values.push(view.getInt16(offset, true));
    else if (element.type === MI_UINT16) values.push(view.getUint16(offset, true));
    else if (element.type === MI_INT32) values.push(view.getInt32(offset, true));
    else if (element.type === MI_UINT32) values.push(view.getUint32(offset, true));
    else if (element.type === MI_SINGLE) values.push(view.getFloat32(offset, true));
    else if (element.type === MI_DOUBLE) values.push(view.getFloat64(offset, true));
  }
  return values;
}

function parseMatrix(bytes: Uint8Array): NumericMatrix | null {
  const elements = readElements(bytes);
  if (elements.length < 4) return null;
  const dims = numericValues(elements[1]).map((value) => Math.trunc(value));
  const name = new TextDecoder().decode(elements[2].bytes).replace(/\0/g, "").trim();
  const values = numericValues(elements[3]);
  return name && dims.length > 0 && values.length > 0 ? { name, dims, values } : null;
}

function columnMajorToRows(matrix: NumericMatrix) {
  const rows = matrix.dims[0] ?? 0;
  const cols = matrix.dims[1] ?? 1;
  return Array.from({ length: rows }, (_, row) =>
    Array.from({ length: cols }, (_, col) => matrix.values[row + col * rows] ?? 0),
  );
}

function flattenColumn(matrix: NumericMatrix) {
  return columnMajorToRows(matrix).flat();
}

export function parseNumericMatFile(buffer: ArrayBuffer): Map<string, MatNumericMatrix> {
  const bytes = new Uint8Array(buffer);
  const matrices = new Map<string, MatNumericMatrix>();
  let offset = 128;
  const view = new DataView(buffer);

  while (offset + 8 <= bytes.byteLength) {
    const tag = readTag(view, offset);
    const payload = bytes.slice(tag.dataOffset, tag.dataOffset + tag.byteLength);
    if (tag.type === MI_COMPRESSED) {
      for (const element of readElements(decompressSync(payload))) {
        if (element.type === MI_MATRIX) {
          const matrix = parseMatrix(element.bytes);
          if (matrix) matrices.set(matrix.name, matrix);
        }
      }
    } else if (tag.type === MI_MATRIX) {
      const matrix = parseMatrix(payload);
      if (matrix) matrices.set(matrix.name, matrix);
    }
    offset = tag.type === MI_COMPRESSED ? tag.rawNextOffset : tag.nextOffset;
  }

  return matrices;
}

export function parseMatFile(buffer: ArrayBuffer): BrunoMatData {
  const matrices = parseNumericMatFile(buffer);

  const wavelengthsMatrix = matrices.get("wavelengths");
  const extinctionMatrix = matrices.get("extinction");
  const boundariesMatrix = matrices.get("boundaries");
  const sdMatrix = matrices.get("SD_separations");
  const attenuationMatrix = matrices.get("atten_example");

  const extinctionRows = extinctionMatrix ? columnMajorToRows(extinctionMatrix) : undefined;
  const extinction: ExtinctionRow[] | undefined = extinctionRows?.map((row) => ({
    wavelength: row[0],
    hhb: row[1],
    hbo2: row[2],
    water: row[3],
  }));
  const boundaryRows = boundariesMatrix ? columnMajorToRows(boundariesMatrix) : undefined;

  return {
    wavelengths: wavelengthsMatrix ? flattenColumn(wavelengthsMatrix) : undefined,
    extinction,
    boundaries: boundaryRows && boundaryRows.length >= 3
      ? {
          start: boundaryRows[0].slice(0, 5) as [number, number, number, number, number],
          lower: boundaryRows[1].slice(0, 5) as [number, number, number, number, number],
          upper: boundaryRows[2].slice(0, 5) as [number, number, number, number, number],
        }
      : undefined,
    sourceDetectorSeparations: sdMatrix ? flattenColumn(sdMatrix) : undefined,
    attenuation: attenuationMatrix ? columnMajorToRows(attenuationMatrix) : undefined,
  };
}
