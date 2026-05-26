import { describe, expect, it } from "vitest";
import rcJob from "../__fixtures__/bcmd/rc_example.dsimjob?raw";
import {
  allBcmdJobValues,
  bcmdJobDistributions,
  firstBcmdJobValue,
  parseBcmdDistribution,
  parseBcmdJob,
} from "./jobs";

describe("BCMD job utilities", () => {
  it("parses .dsimjob files into keyed entries while preserving repeated keys", () => {
    const job = parseBcmdJob(rcJob, "rc_example.dsimjob");

    expect(job.kind).toBe("dsim");
    expect(firstBcmdJobValue(job, "model")).toEqual(["rc"]);
    expect(allBcmdJobValues(job, "param")).toEqual([
      ["C", "uniform", "1e-6", "100"],
      ["R", "uniform", "1", "10000"],
    ]);
    expect(firstBcmdJobValue(job, "job mode")).toEqual(["fast"]);
  });

  it("recognizes optjob and abcjob extensions without changing keyed parsing", () => {
    const opt = parseBcmdJob("model: BrainSignals\npost: CCO, zero\npost: CCO, scale, 1e-3", "fit.optjob");
    const abc = parseBcmdJob("model: BrainSignals\nthreshold: 0.25", "fit.abcjob");

    expect(opt.kind).toBe("opt");
    expect(abc.kind).toBe("abc");
    expect(allBcmdJobValues(opt, "post")).toEqual([
      ["CCO", "zero"],
      ["CCO", "scale", "1e-3"],
    ]);
    expect(firstBcmdJobValue(abc, "threshold")).toEqual(["0.25"]);
  });

  it("normalizes distribution entries used by var, input, and param keys", () => {
    const job = parseBcmdJob(
      [
        "var: CBF, normal, 0.01, 0.002",
        "input: PaCO2, constant, 40",
        "param: gain, lognormal, -1, 0.25",
      ].join("\n"),
      "batch.dsimjob",
    );

    expect(bcmdJobDistributions(job, "var")).toEqual([
      expect.objectContaining({ name: "CBF", kind: "normal", parameters: [0.01, 0.002], defaultValue: 0.01 }),
    ]);
    expect(bcmdJobDistributions(job, "input")).toEqual([
      expect.objectContaining({ name: "PaCO2", kind: "constant", parameters: [40], defaultValue: 40 }),
    ]);
    expect(parseBcmdDistribution(job.byKey.param[0])).toEqual(
      expect.objectContaining({ name: "gain", kind: "lognormal", defaultValue: Math.exp(-1) }),
    );
  });
});

