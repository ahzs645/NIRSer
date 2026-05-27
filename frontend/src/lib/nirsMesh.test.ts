/// <reference types="node" />
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseMatVariables } from "./mat";
import { parseJacobianFile, wavelengthChannelMask } from "./nirsMesh";

const includedDataDir = "/Users/ahmadjalil/Downloads/New Folder With Items 2/25866682";
const externalDataAvailable = existsSync(`${includedDataDir}/JAC830.jac`);

function readIncludedMat(filename: string) {
  const path = `${includedDataDir}/${filename}`;
  if (!existsSync(path)) throw new Error(`Included test data missing: ${path}`);
  const bytes = readFileSync(path);
  return parseMatVariables(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
}

describe("NIRS mesh/Jacobian MAT adapters", () => {
  it.skipIf(!externalDataAvailable)("parses included Jacobian structs into typed mesh data", () => {
    const jac = parseJacobianFile(readIncludedMat("JAC830.jac"));

    expect(jac.jacobian).toHaveLength(120);
    expect(jac.coarseMesh.nodes).toHaveLength(74060);
    expect(jac.coarseMesh.link).toHaveLength(240);
    expect(jac.coarseMesh.vox_DIM).toHaveLength(3);
    expect(wavelengthChannelMask(jac.coarseMesh, 830).filter(Boolean)).toHaveLength(120);
  }, 30_000);
});
