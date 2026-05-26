import { describe, expect, it } from "vitest";
import { parseBcmdInput } from "./input";
import { processBcmdModel } from "./model";
import { aliasesFromBcmdJob, posthocFromBcmdJob, weightedBcmdObjective, weightsFromBcmdJob } from "./objective";
import { nelderMeadSearch, particleSwarmSearch } from "./optimizer";
import { parseBcmdJob } from "./jobs";
import { compileBcmdRuntimeModel } from "./runtime";
import { exportBcmdModeldef, exportBcmdRuntimeModule, exportBcmdSbmlLikeXml } from "./sbml";
import { simulateAdaptiveOde } from "./solver";

describe("BCMD parity utilities", () => {
  it("plays input steps, recomputes intermediates, and applies constraints during runtime simulation", () => {
    const model = processBcmdModel("@input u\n@output x y\nx' = y\ny = gain * u - x\nx := 0\ngain := 2\nx <= 3");
    const input = parseBcmdInput("@ 2\n: 1 u\n= 0 1 1\n= 1 2 2");
    const runtime = compileBcmdRuntimeModel(model);
    const points = runtime.simulate({ input, end: 2, step: 0.1, parameters: { gain: 3 } });

    expect(points.at(-1)?.state.x).toBeLessThanOrEqual(3);
    expect(points.at(-1)?.output.y).toBeGreaterThan(0);
  });

  it("adds reaction rates to root derivatives", () => {
    const model = processBcmdModel("A' = 0\nB' = 0\nA := 1\nB := 0\nk := 1\n[A] -> [B] {k * A}");
    const points = compileBcmdRuntimeModel(model).simulate({ end: 0.2, step: 0.1 });

    expect(points.at(-1)?.state.A).toBeLessThan(1);
    expect(points.at(-1)?.state.B).toBeGreaterThan(0);
  });

  it("provides adaptive solving and additional optimizers", () => {
    const adaptive = simulateAdaptiveOde({
      initialState: { x: 1 },
      start: 0,
      end: 1,
      initialStep: 0.2,
      derivative: ({ state }) => ({ x: -state.x }),
    });
    const nelder = nelderMeadSearch(({ x }) => (x - 2) ** 2, [{ name: "x", min: -5, max: 5 }], { iterations: 40 });
    const swarm = particleSwarmSearch(({ x }) => (x + 1) ** 2, [{ name: "x", min: -5, max: 5 }], { iterations: 40, seed: 2 });

    expect(adaptive.at(-1)?.state.x).toBeCloseTo(Math.exp(-1), 3);
    expect(nelder.best.x).toBeCloseTo(2, 1);
    expect(swarm.best.x).toBeCloseTo(-1, 1);
  });

  it("builds objectives and job aliases/weights/posthoc transforms", () => {
    const job = parseBcmdJob("alias: t, time\nweight: CCO, 2\npost: CCO, zero\npost: CCO, scale, 2", "fit.optjob");

    expect(aliasesFromBcmdJob(job)).toEqual({ t: "time" });
    expect(weightsFromBcmdJob(job)).toEqual({ CCO: 2 });
    expect(posthocFromBcmdJob(job)).toEqual({ CCO: [["zero"], ["scale", 2]] });
    expect(weightedBcmdObjective([{ name: "CCO", observed: [1, 2], predicted: [1, 3], weight: 2 }], "manhattan")).toBe(2);
  });

  it("exports SBML-ish XML, modeldef, and runtime module text", () => {
    const model = processBcmdModel("@output x\nx' = -x\nx := 1");

    expect(exportBcmdSbmlLikeXml(model)).toContain("<sbml");
    expect(exportBcmdModeldef(model)).toContain("x' = -x");
    expect(exportBcmdRuntimeModule(model)).toContain("compileBcmdRuntimeModel");
  });
});
