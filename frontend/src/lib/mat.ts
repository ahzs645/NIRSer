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
const MX_STRUCT = 2;
const MX_CHAR = 4;
const MX_DOUBLE = 6;
const MX_SINGLE = 7;
const MX_INT8 = 8;
const MX_UINT8 = 9;
const MX_INT16 = 10;
const MX_UINT16 = 11;
const MX_INT32 = 12;
const MX_UINT32 = 13;

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

export type MatValue =
  | { kind: "numeric"; name: string; dims: number[]; values: number[]; classType: number }
  | { kind: "char"; name: string; dims: number[]; value: string }
  | { kind: "struct"; name: string; dims: number[]; fields: Record<string, MatValue[]> };

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

function matrixClass(elements: MatElement[]) {
  const flags = numericValues(elements[0]);
  return Math.trunc(flags[0] ?? 0) & 0xff;
}

function matrixName(elements: MatElement[]) {
  return new TextDecoder().decode(elements[2].bytes).replace(/\0/g, "").trim();
}

function parseMatValue(bytes: Uint8Array): MatValue | null {
  const elements = readElements(bytes);
  if (elements.length < 3) return null;
  const classType = matrixClass(elements);
  const dims = numericValues(elements[1]).map((value) => Math.trunc(value));
  const name = matrixName(elements);

  if ([MX_DOUBLE, MX_SINGLE, MX_INT8, MX_UINT8, MX_INT16, MX_UINT16, MX_INT32, MX_UINT32].includes(classType)) {
    const values = elements[3] ? numericValues(elements[3]) : [];
    return { kind: "numeric", name, dims, values, classType };
  }

  if (classType === MX_CHAR) {
    const chars = elements[3] ? numericValues(elements[3]) : [];
    return { kind: "char", name, dims, value: String.fromCharCode(...chars).replace(/\0/g, "") };
  }

  if (classType === MX_STRUCT && elements.length >= 5) {
    const fieldNameLength = Math.max(1, Math.trunc(numericValues(elements[3])[0] ?? 1));
    const rawNames = new TextDecoder().decode(elements[4].bytes);
    const fieldNames: string[] = [];
    for (let offset = 0; offset + fieldNameLength <= rawNames.length; offset += fieldNameLength) {
      const fieldName = rawNames.slice(offset, offset + fieldNameLength).replace(/\0/g, "").trim();
      if (fieldName) fieldNames.push(fieldName);
    }
    const fields: Record<string, MatValue[]> = Object.fromEntries(fieldNames.map((fieldName) => [fieldName, []]));
    let elementIndex = 5;
    const structCount = Math.max(1, dims.reduce((product, value) => product * value, 1));
    for (let item = 0; item < structCount; item += 1) {
      for (const fieldName of fieldNames) {
        const fieldElement = elements[elementIndex];
        elementIndex += 1;
        const parsed = fieldElement?.type === MI_MATRIX ? parseMatValue(fieldElement.bytes) : null;
        if (parsed) fields[fieldName].push(parsed);
      }
    }
    return { kind: "struct", name, dims, fields };
  }

  return null;
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
  const variables = parseMatVariables(buffer);
  const matrices = new Map<string, MatNumericMatrix>();
  for (const [name, value] of variables) {
    if (value.kind === "numeric" && value.values.length > 0) matrices.set(name, value);
  }
  return matrices;
}

export function parseMatVariables(buffer: ArrayBuffer): Map<string, MatValue> {
  const bytes = new Uint8Array(buffer);
  const variables = new Map<string, MatValue>();
  let offset = 128;
  const view = new DataView(buffer);

  while (offset + 8 <= bytes.byteLength) {
    const tag = readTag(view, offset);
    const payload = bytes.slice(tag.dataOffset, tag.dataOffset + tag.byteLength);
    if (tag.type === MI_COMPRESSED) {
      for (const element of readElements(decompressSync(payload))) {
        if (element.type === MI_MATRIX) {
          const value = parseMatValue(element.bytes);
          if (value?.name) variables.set(value.name, value);
        }
      }
    } else if (tag.type === MI_MATRIX) {
      const value = parseMatValue(payload);
      if (value?.name) variables.set(value.name, value);
    }
    offset = tag.type === MI_COMPRESSED ? tag.rawNextOffset : tag.nextOffset;
  }

  return variables;
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
