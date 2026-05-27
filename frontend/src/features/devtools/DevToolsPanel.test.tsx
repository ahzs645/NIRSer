// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { DevToolsPanel } from "./DevToolsPanel";

afterEach(() => {
  cleanup();
});

describe("DevToolsPanel", () => {
  it("opens BRUNO by default and switches to BCMD and Source Audit", () => {
    render(<DevToolsPanel />);

    expect(screen.getByRole("heading", { name: "BRUNO Input Tables" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "BCMD" }));
    expect(screen.getByRole("heading", { name: "BCMD model" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Graphing" }));
    expect(screen.getByRole("heading", { name: "Inverse hemoglobin summary" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Source Audit" }));
    expect(screen.getByRole("heading", { name: "Source audit" })).toBeInTheDocument();
    expect(screen.getByText("No source folder selected.")).toBeInTheDocument();
  });
});
