// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { HemoglobinSummaryChart } from "./HemoglobinSummaryChart";
import type { HemoglobinErrorSeries } from "../../lib/hemoglobinGraphing";

afterEach(() => cleanup());

const scalp: HemoglobinErrorSeries = {
  id: "scalp",
  label: "Scalp",
  available: true,
  points: [
    { time: 0.5, mean: 0.1, sem: 0.02, subjectCount: 2 },
    { time: 1, mean: 0.2, sem: 0.03, subjectCount: 2 },
  ],
};

const brain: HemoglobinErrorSeries = {
  id: "brain",
  label: "Brain",
  available: true,
  points: [
    { time: 0.5, mean: -0.1, sem: 0.01, subjectCount: 2 },
    { time: 1, mean: -0.2, sem: 0.02, subjectCount: 2 },
  ],
};

describe("HemoglobinSummaryChart", () => {
  it("renders lines and error bars for available scalp/brain series", () => {
    render(<HemoglobinSummaryChart title="O2Hb" yLabel="O2Hb (microM)" series={[scalp, brain]} />);

    const chart = screen.getByRole("img", { name: "O2Hb hemoglobin summary" });
    expect(chart.querySelectorAll("path").length).toBeGreaterThanOrEqual(2);
    expect(chart.querySelectorAll("line").length).toBeGreaterThan(8);
    expect(screen.queryByText(/Unavailable:/)).not.toBeInTheDocument();
  });

  it("reports unavailable series instead of drawing their empty data", () => {
    render(
      <HemoglobinSummaryChart
        title="HHb"
        yLabel="HHb (microM)"
        series={[{ ...scalp, available: false, points: scalp.points.map((point) => ({ ...point, mean: Number.NaN, sem: Number.NaN })) }, brain]}
      />,
    );

    expect(screen.getByText("Unavailable: Scalp")).toBeInTheDocument();
    const chart = screen.getByRole("img", { name: "HHb hemoglobin summary" });
    expect(chart.querySelectorAll("path").length).toBeGreaterThanOrEqual(1);
  });
});
