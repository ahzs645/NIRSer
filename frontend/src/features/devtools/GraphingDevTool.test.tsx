// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { GraphingDevTool } from "./GraphingDevTool";

afterEach(() => cleanup());

describe("GraphingDevTool", () => {
  it("renders inverse graphing import controls", () => {
    render(<GraphingDevTool />);

    expect(screen.getByRole("heading", { name: "Inverse hemoglobin summary" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "MRI slice viewer" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Jacobian sensitivity map" })).toBeInTheDocument();
    expect(screen.getByText(/Load the MATLAB summary file/i)).toBeInTheDocument();
    expect(screen.getByText(/Load an MRI volume/i)).toBeInTheDocument();
    expect(screen.getByText(/Load JAC690/i)).toBeInTheDocument();
  });
});
