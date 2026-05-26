import { describe, expect, it } from "vitest";
import { exportBcmdDependencyDot, exportBcmdInputStepsCsv, exportBcmdModelSummaryCsv, exportBcmdTextReport } from "./exporters";
import { parseBcmdInput } from "./input";
import { processBcmdModel, summarizeBcmdProcessedModel } from "./model";

describe("BCMD processed model utilities", () => {
  it("merges imports, classifies symbols, extracts docs, and expands reactions", () => {
    const model = processBcmdModel(
      [
        "@import base",
        "@input V",
        "@output Vc",
        "## + electrical fitted",
        "## ~ volts",
        "Vc' = (V - Vc) / (R * C)",
        "[A] -> [B] {k * A}",
      ].join("\n"),
      { importResolver: (name) => (name === "base" ? "R := 10\nC := 0.1\nk := 2\nA := 1\nB := 0" : undefined) },
    );

    expect(model.imports).toEqual(["base"]);
    expect(model.roots).toEqual(["Vc"]);
    expect(model.reactions[0]).toEqual({ name: "reaction_1", delta: { A: -1, B: 1 }, rate: "k * A" });
    expect(model.symbols.find((symbol) => symbol.name === "Vc")).toMatchObject({
      role: "root",
      dependencies: ["V", "R", "C"],
      tags: ["electrical", "fitted"],
      units: "volts",
    });
    expect(summarizeBcmdProcessedModel(model)).toMatchObject({ roots: 1, inputs: 1, outputs: 1, reactions: 1 });
  });

  it("exports summary, dependency, text, and input-step reports", () => {
    const model = processBcmdModel("@input V\n@output Vc\nVc' = V - Vc\nV := 1");
    const input = parseBcmdInput("@ 1\n: 1 V\n= 0 5 1");

    expect(exportBcmdModelSummaryCsv(model)).toContain("Vc,root");
    expect(exportBcmdDependencyDot(model)).toContain('"V" -> "Vc"');
    expect(exportBcmdTextReport(model)).toContain("Independent: t");
    expect(exportBcmdInputStepsCsv(input.steps)).toContain("Start,End,Duration,V");
  });
});
