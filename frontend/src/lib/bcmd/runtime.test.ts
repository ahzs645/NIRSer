import { describe, expect, it } from "vitest";
import { processBcmdModel } from "./model";
import { compileBcmdRuntimeModel } from "./runtime";

describe("BCMD runtime compiler", () => {
  it("compiles simple parsed differential equations into client-side simulation callbacks", () => {
    const model = processBcmdModel("@output x\nx' = -k * x\nx := 1\nk := 1");
    const runtime = compileBcmdRuntimeModel(model);
    const points = runtime.simulate({ start: 0, end: 1, step: 0.1 });

    expect(runtime.diagnostics).toEqual([]);
    expect(points.at(-1)?.state.x).toBeCloseTo(Math.exp(-1), 5);
  });
});
