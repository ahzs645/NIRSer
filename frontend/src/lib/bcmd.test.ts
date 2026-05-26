import { describe, expect, it } from "vitest";
import rcInput from "./__fixtures__/bcmd/rc.input?raw";
import rcJob from "./__fixtures__/bcmd/rc_example.dsimjob?raw";
import rcModel from "./__fixtures__/bcmd/rc.modeldef?raw";
import {
  applyBcmdPosthoc,
  bcmdAngularDistance,
  bcmdCosineDistance,
  bcmdEuclideanDistance,
  bcmdGaussianNegativeLogLikelihood,
  bcmdManhattanDistance,
  bcmdMeanDistance,
  extractBcmdSymbols,
  parseBcmdInput,
  parseBcmdJob,
  parseBcmdModel,
  summarizeBcmdModel,
} from "./bcmd";

describe("BCMD utilities", () => {
  it("parses bundled BCMD model definitions into modular summaries", () => {
    const model = parseBcmdModel(rcModel);

    expect(model.inputs).toEqual(["V"]);
    expect(model.outputs).toEqual(["Vc", "V"]);
    expect(model.roots).toEqual(["Vc"]);
    expect(model.parameters).toEqual(["V", "Vc", "R", "C"]);
    expect(model.unknown).toEqual([]);
    expect(model.statements.find((statement) => statement.kind === "differential")).toMatchObject({
      name: "Vc",
      dependencies: ["V", "R", "C"],
    });
    expect(summarizeBcmdModel(model)).toMatchObject({
      inputs: 1,
      outputs: 2,
      roots: 1,
      parameters: 4,
      equations: 1,
      unknown: 0,
    });
  });

  it("extracts expression symbols without treating math functions as dependencies", () => {
    expect(extractBcmdSymbols("sqrt(Vc) + pow(R, 2) - C_input")).toEqual(["Vc", "R", "C_input"]);
  });

  it("parses included BCMD input time-series data", () => {
    const input = parseBcmdInput(rcInput);

    expect(input.defaultStep).toBe(5);
    expect(input.declarations).toEqual([{ name: "V", initial: 1, line: 3 }]);
    expect(input.series).toEqual([
      {
        name: "V",
        initial: 1,
        points: [
          { time: 0, value: 1 },
          { time: 0, value: 5 },
          { time: 5, value: 0 },
          { time: 10, value: -1 },
          { time: 15, value: 0 },
          { time: 20, value: 1 },
        ],
      },
    ]);
  });

  it("parses included BCMD job files as keyed configuration entries", () => {
    const job = parseBcmdJob(rcJob);

    expect(job.find((entry) => entry.key === "model")?.values).toEqual(["rc"]);
    expect(job.filter((entry) => entry.key === "param").map((entry) => entry.values)).toEqual([
      ["C", "uniform", "1e-6", "100"],
      ["R", "uniform", "1", "10000"],
    ]);
    expect(job.find((entry) => entry.key === "nbatch")?.values).toEqual(["8"]);
  });

  it("provides BCMD-style distance metrics as pure utilities", () => {
    expect(bcmdEuclideanDistance([1, 2, 3], [2, 4, 6])).toBeCloseTo(Math.sqrt(14));
    expect(bcmdMeanDistance([1, 2, 3], [2, 4, 6])).toBeCloseTo(Math.sqrt(14 / 3));
    expect(bcmdManhattanDistance([1, 2, 3], [2, 4, 6])).toBe(6);
    expect(bcmdCosineDistance([1, 0], [0, 1])).toBeCloseTo(0.5);
    expect(bcmdAngularDistance([1, 0], [0, 1])).toBeCloseTo(0.5);
    expect(bcmdGaussianNegativeLogLikelihood([1, 2], [1, 4], 2)).toBeCloseTo(
      (2 * Math.log(2 * Math.PI * 4)) / 2 + 4 / 8,
    );
  });

  it("applies BCMD posthoc transforms without coupling to the old batch runner", () => {
    expect(applyBcmdPosthoc([2, 4, 6], ["zero"])).toEqual([0, 2, 4]);
    expect(applyBcmdPosthoc([2, 4, 6], ["centre"])).toEqual([-2, 0, 2]);
    expect(applyBcmdPosthoc([2, 4, 6], ["offset", 1])).toEqual([3, 5, 7]);
    expect(applyBcmdPosthoc([2, 4, 6], ["scale", 2])).toEqual([4, 8, 12]);
    expect(applyBcmdPosthoc([2, 4, 6], ["norm"])).toEqual([
      -1.224744871391589,
      0,
      1.224744871391589,
    ]);
  });
});
