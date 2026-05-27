// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { BcmdBestFitChart, BcmdSensitivityHeatmap } from "./BcmdAnalysisCharts";
import { BcmdBatchBestFitChart, BcmdBatchHeatmapChart } from "./BcmdBatchCharts";

afterEach(() => cleanup());

describe("BcmdAnalysisCharts", () => {
  it("renders sensitivity heat map and best-fit trace", () => {
    render(
      <>
        <BcmdSensitivityHeatmap
          sensitivity={[
            { name: "R", effectMean: 1, effectAbsMean: 1, effectStdDev: 0.2, correlation: 0.5, varianceShare: 0.25 },
            { name: "C", effectMean: -2, effectAbsMean: 2, effectStdDev: 0.4, correlation: 0.2, varianceShare: 0.04 },
          ]}
        />
        <BcmdBestFitChart
          result={{
            best: { R: 10 },
            score: 0.1,
            history: [
              { iteration: 0, parameters: { R: 1 }, score: 9 },
              { iteration: 1, parameters: { R: 10 }, score: 0.1 },
            ],
          }}
        />
      </>,
    );

    expect(screen.getByRole("img", { name: "BCMD sensitivity heat map" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "BCMD best fit trace" })).toBeInTheDocument();
  });

  it("renders imported BCMD batch charts", () => {
    render(
      <>
        <BcmdBatchHeatmapChart heatmap={{ rows: ["rc"], columns: ["R"], values: [[0.2]], field: "dist_L1" }} />
        <BcmdBatchBestFitChart data={{ times: [0, 1], measuredName: "Vc", measured: [0, 1], traces: [{ name: "best", score: 0.1, values: [0, 0.8] }] }} />
      </>,
    );

    expect(screen.getByRole("img", { name: "BCMD batch heat map" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "BCMD batch best fit" })).toBeInTheDocument();
  });
});
