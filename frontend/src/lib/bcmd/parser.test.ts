import { describe, expect, it } from "vitest";
import { parseBcmdProgram, parseBcmdStatement, extractExpressionSymbols } from "./parser";

describe("modular BCMD parser", () => {
  it("parses directives and doc comments while preserving source locations", () => {
    const program = parseBcmdProgram(`
## RC circuit model
@input Vin
@output Vc Vin
`);

    expect(program.statements[0]).toMatchObject({
      kind: "docComment",
      text: "RC circuit model",
      startLine: 2,
    });
    expect(program.directives).toEqual([
      expect.objectContaining({ kind: "directive", name: "input", args: ["Vin"], startLine: 3 }),
      expect.objectContaining({ kind: "directive", name: "output", args: ["Vc", "Vin"], startLine: 4 }),
    ]);
  });

  it("parses assignments, differential equations, algebraic equations, and constraints", () => {
    expect(parseBcmdStatement("R := 10")).toMatchObject({
      kind: "assignment",
      target: "R",
      expression: "10",
      initialOnly: true,
      dependencies: [],
    });
    expect(parseBcmdStatement("Vc' = (Vin - Vc) / (R * C)")).toMatchObject({
      kind: "differentialEquation",
      target: "Vc",
      dependencies: ["Vin", "R", "C"],
    });
    expect(parseBcmdStatement("balance: inflow + stored = outflow")).toMatchObject({
      kind: "algebraicEquation",
      target: "balance",
      leftExpression: "inflow + stored",
      rightExpression: "outflow",
      dependencies: ["inflow", "stored", "outflow"],
    });
    expect(parseBcmdStatement("~ Vc >= Vmin")).toMatchObject({
      kind: "constraint",
      target: "Vc",
      operator: ">=",
      dependencies: ["Vc", "Vmin"],
    });
  });

  it("parses irreversible and reversible chemical reactions", () => {
    expect(parseBcmdStatement("2 H + O -> H2O ; k_forward * H * O")).toMatchObject({
      kind: "reaction",
      reversible: false,
      reactants: [
        { species: "H", coefficient: 2 },
        { species: "O" },
      ],
      products: [{ species: "H2O" }],
      rateExpression: "k_forward * H * O",
      dependencies: ["k_forward"],
    });
    expect(parseBcmdStatement("A <-> B ; k1 * A - k2 * B")).toMatchObject({
      kind: "reaction",
      reversible: true,
      dependencies: ["k1", "k2"],
    });
  });

  it("groups embedded blocks and extracts referenced symbols", () => {
    const program = parseBcmdProgram(`
[**
double helper(double x) {
  return gain * x + offset;
}
**]
`);

    expect(program.statements).toHaveLength(1);
    expect(program.statements[0]).toMatchObject({
      kind: "embeddedBlock",
      startLine: 2,
      endLine: 6,
      dependencies: ["double", "helper", "x", "gain", "offset"],
    });
  });

  it("extracts expression symbols without math functions, keywords, duplicates, or comments", () => {
    const program = parseBcmdProgram(`
rate = sqrt(Vc) + pow(R, 2) + R + input_signal # ignored_symbol
label = "quoted # value"
`);

    expect(extractExpressionSymbols("if sqrt(Vc) > 0 and pow(R, 2) else false")).toEqual(["Vc", "R"]);
    expect(program.symbols).toEqual(["Vc", "R", "input_signal"]);
  });
});
