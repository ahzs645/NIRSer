import { describe, expect, it } from "vitest";
import { parseBraincircDatTable, parseBcmdCsvNumericTable } from "./data";
import { parseBcmdInput } from "./input";
import { processBcmdModel } from "./model";
import { compileBcmdRuntimeModel } from "./runtime";

const lorenzModel = [
  "xx' = sigma * (yy - xx)",
  "yy' = rho * xx - yy - xx * zz",
  "zz' = xx * yy - beta * zz",
  "xx := 1",
  "yy := 1",
  "zz := 1",
  "sigma := 10",
  "rho := 28",
  "beta := 2.6667",
].join("\n");

const huxleyModel = [
  "v' = (-gK * pow(n, 4) * (v-vK) - gNa * pow(m, 3) * h * (v-vNa) - gL * (v-vL) + Iapp)/Cm",
  "m' = am * (1-m) - bm * m",
  "am = 0.1 * (25-v) / (exp((25-v)/10)-1)",
  "bm = 4 * exp(-v/18)",
  "v := 0.804",
  "m := 0.0582",
  "n := 0.33",
  "h := 0.568",
  "gK := 36",
  "vK := -12",
  "gNa := 120",
  "vNa := 115",
  "gL := 0.3",
  "vL := 10.6",
  "Iapp := 1",
  "Cm := 1",
].join("\n");

const brainSignalsInput = [
  "@ 4",
  ": 1 u",
  ">>> 0",
  "!0",
  "= 0 100 1",
  ">>> *",
  "!!!",
  "= 0 100 1",
  "= 100 200 10",
  "= 200 300 1",
].join("\n");

describe("BCMD expanded fixture coverage", () => {
  it("parses and runs a Lorenz-style model fixture", () => {
    const model = processBcmdModel(lorenzModel);
    const runtime = compileBcmdRuntimeModel(model);
    const points = runtime.simulate({ start: 0, end: 0.05, step: 0.01 });

    expect(model.roots).toEqual(["xx", "yy", "zz"]);
    expect(runtime.diagnostics).toEqual([]);
    expect(points).toHaveLength(6);
    expect(points.at(-1)?.state.xx).toBeGreaterThan(1);
  });

  it("parses a Huxley-style model with pow and exp expressions", () => {
    const model = processBcmdModel(huxleyModel);

    expect(model.roots).toEqual(["v", "m"]);
    expect(model.symbols.find((symbol) => symbol.name === "am")).toMatchObject({ role: "intermediate" });
    expect(model.diagnostics).toEqual([]);
  });

  it("parses BrainSignals-style multi-output input controls", () => {
    const input = parseBcmdInput(brainSignalsInput);

    expect(input.outputs).toEqual([
      { line: 3, stream: "both", fields: [] },
      { line: 6, stream: "both", fields: "default" },
    ]);
    expect(input.headers).toEqual([
      { line: 4, stream: "both", enabled: false },
      { line: 7, stream: "both", enabled: true },
    ]);
    expect(input.steps).toHaveLength(4);
  });

  it("parses HX CSV and CO2 DAT table snippets", () => {
    const csv = ['"t","P_a","CBF"', "0,89.84,0.0108", "3.2,92.54,0.0118"].join("\n");
    const dat = ["chosen_param: SaO2sup, Pa_CO2, P_a", "time_step: 1.0", "******", "0.99003 42.773 78.088"].join("\n");

    expect(parseBcmdCsvNumericTable(csv)).toMatchObject({ columns: ["t", "P_a", "CBF"], rows: [[0, 89.84, 0.0108], [3.2, 92.54, 0.0118]] });
    expect(parseBraincircDatTable(dat).rows).toEqual([[1, Number.NaN, Number.NaN], [0.99003, 42.773, 78.088]]);
  });
});
