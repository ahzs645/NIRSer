import { describe, expect, it } from "vitest";
import { simulateOde } from "./solver";

describe("BCMD ODE solver", () => {
  it("simulates a first-order decay with RK4", () => {
    const points = simulateOde({
      initialState: { x: 1 },
      parameters: { k: 1 },
      start: 0,
      end: 1,
      step: 0.1,
      derivative: ({ state, parameters }) => ({ x: -parameters.k * state.x }),
      output: ({ state }) => ({ y: state.x * 2 }),
    });

    expect(points).toHaveLength(11);
    expect(points.at(-1)?.state.x).toBeCloseTo(Math.exp(-1), 5);
    expect(points.at(-1)?.output.y).toBeCloseTo(2 * Math.exp(-1), 5);
  });

  it("supports Euler for simple deterministic callback models", () => {
    const points = simulateOde({
      initialState: { x: 0 },
      start: 0,
      end: 1,
      step: 0.25,
      method: "euler",
      derivative: () => ({ x: 2 }),
    });

    expect(points.map((point) => point.state.x)).toEqual([0, 0.5, 1, 1.5, 2]);
  });
});
