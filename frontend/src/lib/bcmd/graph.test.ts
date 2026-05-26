import { describe, expect, it } from "vitest";
import { bcmdEquationLabel, bcmdInputStepSeries, buildBcmdGraph, filterBcmdEquations } from "./graph";
import { parseBcmdInput } from "./input";
import { processBcmdModel } from "./model";

describe("BCMD graph and browser utilities", () => {
  it("builds dependency, equation, reaction, and IO graph views", () => {
    const model = processBcmdModel("@input V\n@output Vc\nVc' = V - Vc\nR := 10\n[A] -> [B] {k * A}");

    expect(buildBcmdGraph(model, "symbols").edges).toContainEqual({ source: "V", target: "Vc", kind: "dependency" });
    expect(buildBcmdGraph(model, "equations").nodes.some((node) => node.kind === "equation")).toBe(true);
    expect(buildBcmdGraph(model, "reactions").edges).toContainEqual({ source: "A", target: "reaction_1", kind: "reactant", label: "1" });
    expect(buildBcmdGraph(model, "io").nodes.map((node) => node.id).sort()).toEqual(["V", "Vc"]);
  });

  it("filters equations and generates labels", () => {
    const model = processBcmdModel("@input V\n@output Vc\nVc' = V - Vc\nVc >= 0\n[A] -> [B] {k * A}");
    expect(filterBcmdEquations(model, "roots").map(bcmdEquationLabel)).toEqual(["Vc' = V - Vc"]);
    expect(filterBcmdEquations(model, "constraints").map(bcmdEquationLabel)).toEqual(["Vc >= 0"]);
    expect(filterBcmdEquations(model, "reactions").map(bcmdEquationLabel)).toEqual(["A -> B ; k * A"]);
  });

  it("converts BCMD input steps into chartable step series", () => {
    const input = parseBcmdInput("@ 2\n: 1 V\n= 0 5 1\n+ 5 0");
    expect(bcmdInputStepSeries(input)).toEqual([
      { name: "V", points: [{ time: 0, value: 1 }, { time: 5, value: 1 }, { time: 5, value: 0 }, { time: 10, value: 0 }] },
    ]);
  });
});
