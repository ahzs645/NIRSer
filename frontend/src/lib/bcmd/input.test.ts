import { describe, expect, it } from "vitest";
import { parseBcmdInput, writeBcmdInput } from "./input";

const mixedInput = [
  "@ 5",
  ">>> 3 t CBF CMRO2",
  "!",
  "!!",
  "!!!",
  "!0",
  ": 2 PaCO2 FIO2",
  "= 0 0 40 0.21",
  "+ 10 45 0.30",
  "* 3 5 1 -0.01",
].join("\n");

describe("BCMD input utilities", () => {
  it("parses output streams, header controls, sections, and expanded steps", () => {
    const input = parseBcmdInput(mixedInput);

    expect(input.stepCount).toBe(5);
    expect(input.outputs).toEqual([{ line: 2, stream: "both", fields: ["t", "CBF", "CMRO2"] }]);
    expect(input.headers.map(({ stream, enabled }) => ({ stream, enabled }))).toEqual([
      { stream: "coarse", enabled: true },
      { stream: "detail", enabled: true },
      { stream: "both", enabled: true },
      { stream: "both", enabled: false },
    ]);
    expect(input.fields).toEqual([{ line: 7, fields: ["PaCO2", "FIO2"] }]);
    expect(input.steps.map(({ start, end, assignments }) => ({ start, end, assignments }))).toEqual([
      { start: 0, end: 0, assignments: { PaCO2: 40, FIO2: 0.21 } },
      { start: 0, end: 10, assignments: { PaCO2: 45, FIO2: 0.3 } },
      { start: 10, end: 15, assignments: { PaCO2: 46, FIO2: 0.29 } },
      { start: 15, end: 20, assignments: { PaCO2: 47, FIO2: 0.28 } },
      { start: 20, end: 25, assignments: { PaCO2: 48, FIO2: 0.27 } },
    ]);
    expect(input.diagnostics).toEqual([]);
  });

  it("writes canonical .input text with field declarations and output options", () => {
    const parsed = parseBcmdInput(mixedInput);
    const exported = writeBcmdInput(parsed.steps, {
      outputSections: parsed.outputs,
      headerControls: parsed.headers,
    });

    expect(exported).toBe(
      [
        "@ 5",
        ">>> 3 t CBF CMRO2",
        "!",
        "!!",
        "!!!",
        "!0",
        ": 2 PaCO2 FIO2",
        "= 0 0 40 0.21",
        "= 0 10 45 0.3",
        "= 10 15 46 0.29",
        "= 15 20 47 0.28",
        "= 20 25 48 0.27",
        "",
      ].join("\n"),
    );
  });

  it("keeps malformed input non-fatal through diagnostics", () => {
    const input = parseBcmdInput(["@ nope", ": 1 V", "+ bad 1", "ignored"].join("\n"));

    expect(input.steps).toEqual([]);
    expect(input.diagnostics.map((item) => item.message)).toEqual([
      "Input header must contain a non-negative step count.",
      "Relative steps require a numeric duration.",
      "Ignored unrecognized BCMD input line.",
    ]);
  });
});

