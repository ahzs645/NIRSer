import { describe, expect, it } from "vitest";
import { implicitEulerStep, radauLikeImplicitStep, solveNewtonSystem } from "./dae";
import { processBcmdModel } from "./model";
import { compileBcmdRuntimeModel } from "./runtime";
import { exportBcmdSbmlCoreXml } from "./sbml";
import { fastSensitivity, morrisSensitivity } from "./sensitivity";

describe("BCMD final parity browser equivalents", () => {
  it("solves algebraic residual systems with Newton iteration", () => {
    const result = solveNewtonSystem(["x"], { x: 1 }, ({ x }) => [x * x - 4]);

    expect(result.converged).toBe(true);
    expect(result.values.x).toBeCloseTo(2);
  });

  it("provides implicit Euler and Radau-like implicit steps for stiff-safe client solving", () => {
    const euler = implicitEulerStep({ x: 1 }, 0, 0.1, (state) => ({ x: -10 * state.x }));
    const radauLike = radauLikeImplicitStep({ x: 1 }, 0, 0.1, (state) => ({ x: -10 * state.x }));

    expect(euler.values.x).toBeCloseTo(0.5);
    expect(radauLike.values.x).toBeGreaterThan(0);
  });

  it("parses labels, compartments, reversible rates, and auxiliary derivatives", () => {
    const model = processBcmdModel("x' + y' = 1 \"aux\"\n[A, cyt] <-> [B, mito] {kf * A; kr * B} \"rxn\"\nx := 0\ny := 0");

    expect(model.roots).toEqual(["x", "y"]);
    expect(model.reactions[0]).toMatchObject({ rate: "kf * A" });
    expect(model.nodes.find((node) => node.kind === "differentialEquation")).toMatchObject({ label: "aux" });
  });

  it("solves algebraic equations during runtime output evaluation", () => {
    const runtime = compileBcmdRuntimeModel(processBcmdModel("@output z\nx' = z\nz: z = gain * x\nx := 1\ngain := 2"));
    const points = runtime.simulate({ end: 0.1, step: 0.1 });

    expect(points.at(-1)?.output.z).toBeGreaterThan(2);
  });

  it("exposes Morris and FAST named sensitivity adapters", () => {
    const params = [{ name: "a", min: 0, max: 1, distribution: { type: "uniform" as const, min: 0, max: 1 } }];

    expect(morrisSensitivity(({ a }) => a * 2, params, { samples: 8 })[0]).toHaveProperty("muStar");
    expect(fastSensitivity(({ a }) => a * 2, params, { samples: 8 })[0]).toHaveProperty("firstOrder");
  });

  it("exports a stricter SBML core skeleton", () => {
    const xml = exportBcmdSbmlCoreXml(processBcmdModel("@output x\nx' = -x\nx := 1"));

    expect(xml).toContain("listOfCompartments");
    expect(xml).toContain("listOfSpecies");
  });
});
