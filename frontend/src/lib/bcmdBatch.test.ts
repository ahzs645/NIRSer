import { describe, expect, it } from "vitest";
import { buildBcmdBatchHeatmap, buildBcmdBestFitTables, parseBcmdBatchTable } from "./bcmdBatch";

describe("BCMD batch table utilities", () => {
  it("builds heatmap data from aggregate tables", () => {
    const table = parseBcmdBatchTable("input Param Species dist_L1\nrc R Vc 0.5\nrc C Vc 0.2\nbs R Vc 0.8");
    const heatmap = buildBcmdBatchHeatmap(table);

    expect(heatmap.rows).toEqual(["rc", "bs"]);
    expect(heatmap.columns).toEqual(["R", "C"]);
    expect(heatmap.values[0]).toEqual([0.5, 0.2]);
  });

  it("extracts measured and best-fit traces from results/distances tables", () => {
    const results = [
      "job species t0 t1 t2",
      "NA Vc 0 1 2",
      "NA Vc 0 1 0",
      "0 Vc 0 0.8 0.1",
      "1 Vc 0 0.5 0.5",
    ].join("\n");
    const distances = "job dist_L1\n0 0.1\n1 0.5";

    const best = buildBcmdBestFitTables(results, distances);

    expect(best.times).toEqual([0, 1, 2]);
    expect(best.measured).toEqual([0, 1, 0]);
    expect(best.traces[0]).toMatchObject({ score: 0.1, values: [0, 0.8, 0.1] });
  });
});
