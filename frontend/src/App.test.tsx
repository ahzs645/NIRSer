// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import App from "./App";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  window.localStorage.clear();
});

beforeEach(() => {
  window.localStorage.clear();
});

/** First match wins — nav links are duplicated in the sidebar and the toolbar. */
function nav(name: RegExp) {
  return screen.getAllByRole("button", { name })[0];
}

describe("App shell & navigation", () => {
  it("boots on the acquisition view with the core cards rendered", () => {
    render(<App />);
    expect(screen.getByRole("heading", { level: 2, name: /acquisition/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Device" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Chart Controls" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Marks" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Sections" })).toBeInTheDocument();
    // Three chart panes render as labelled images.
    expect(screen.getByRole("img", { name: "Channel 1" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Channel 2" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Load Cell" })).toBeInTheDocument();
  });

  it("switches to the Analysis view", () => {
    render(<App />);
    fireEvent.click(nav(/^Analysis$/));
    // The view heading renders the lowercase view id; "Analysis Filter" is a separate card title.
    expect(screen.getByRole("heading", { level: 2, name: "analysis" })).toBeInTheDocument();
  });

  it("switches to the Visualizer view and shows the veins readout", () => {
    render(<App />);
    fireEvent.click(nav(/^Visualizer$/));
    expect(screen.getByText(/Active veins:/i)).toBeInTheDocument();
  });
});

describe("Marks", () => {
  it("adds a mark at a typed time and deletes it again", () => {
    render(<App />);
    const before = screen.getAllByRole("button", { name: /^Delete mark/ }).length;
    expect(before).toBe(3); // default marks: 5, 12, 20

    fireEvent.change(screen.getByPlaceholderText(/Mark time/i), { target: { value: "7.5" } });
    fireEvent.click(screen.getByRole("button", { name: /Add Mark at Typed Time/i }));

    expect(screen.getAllByRole("button", { name: /^Delete mark/ }).length).toBe(before + 1);

    fireEvent.click(screen.getAllByRole("button", { name: /^Delete mark/ })[0]);
    expect(screen.getAllByRole("button", { name: /^Delete mark/ }).length).toBe(before);
  });
});

describe("Sections", () => {
  it("creates a new section once the draft is valid", () => {
    render(<App />);
    const sectionSelect = screen
      .getAllByRole("combobox")
      .find((combo) => within(combo).queryByRole("option", { name: /baseline/i }));
    expect(sectionSelect).toBeTruthy();
    expect(within(sectionSelect!).getAllByRole("option")).toHaveLength(2);

    fireEvent.change(screen.getByPlaceholderText("Name"), { target: { value: "recovery" } });
    const create = screen.getByRole("button", { name: /Create New Section/i });
    expect(create).toBeEnabled();
    fireEvent.click(create);

    expect(within(sectionSelect!).getAllByRole("option")).toHaveLength(3);
  });
});

describe("Analysis filter", () => {
  it("counts applied passes and resets them", () => {
    render(<App />);
    expect(screen.getByText(/Applied 0 times\./)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Apply filter/i }));
    expect(screen.getByText(/Applied 1 times\./)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Apply filter/i }));
    expect(screen.getByText(/Applied 2 times\./)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Reset$/i }));
    expect(screen.getByText(/Applied 0 times\./)).toBeInTheDocument();
  });
});

describe("Bias & chart controls", () => {
  it("toggles the bias button label", () => {
    render(<App />);
    const bias = screen.getByRole("button", { name: /^Bias$/ });
    fireEvent.click(bias);
    expect(screen.getByRole("button", { name: /Clear Bias/i })).toBeInTheDocument();
  });

  it("toggles a chart series checkbox off", () => {
    render(<App />);
    const o2 = screen.getByRole("checkbox", { name: /^O2Hb$/ });
    expect(o2).toBeChecked();
    fireEvent.click(o2);
    expect(o2).not.toBeChecked();
  });
});

describe("Acquisition streaming", () => {
  it("enables Pause when a demo run starts and disables it on stop", () => {
    vi.useFakeTimers();
    render(<App />);
    const pause = screen.getByRole("button", { name: /^Pause$/ });
    expect(pause).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: /Start Demo/i }));
    expect(screen.getByRole("button", { name: /^Pause$/ })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: /^Stop$/ }));
    expect(screen.getByRole("button", { name: /^Pause$/ })).toBeDisabled();
  });
});

describe("Analysis chart overlays", () => {
  it("draws min/max markers on the chart only in the analysis view", () => {
    render(<App />);
    // Acquisition view: the NIRS chart has no stat-overlay circles.
    expect(screen.getByRole("img", { name: "Channel 1" }).querySelectorAll("circle").length).toBe(0);
    fireEvent.click(nav(/^Analysis$/));
    // Analysis view: min/max markers appear for the visible series.
    expect(screen.getByRole("img", { name: "Channel 1" }).querySelectorAll("circle").length).toBeGreaterThan(0);
  });
});

describe("Unsaved-work guard", () => {
  it("prevents unload only after the session has unsaved changes", () => {
    render(<App />);

    const clean = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(clean);
    expect(clean.defaultPrevented).toBe(false); // untouched demo is clean

    fireEvent.change(screen.getByPlaceholderText(/Mark time/i), { target: { value: "9" } });
    fireEvent.click(screen.getByRole("button", { name: /Add Mark at Typed Time/i }));

    const dirty = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(dirty);
    expect(dirty.defaultPrevented).toBe(true);
  });
});

describe("Marks context menu & keyboard shortcuts", () => {
  it("deletes a mark from the right-click context menu", () => {
    render(<App />);
    const before = screen.getAllByRole("button", { name: /^Delete mark/ }).length;
    const row = screen.getByRole("textbox", { name: "Mark 1" }).closest("div")!;
    fireEvent.contextMenu(row);
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete" }));
    expect(screen.getAllByRole("button", { name: /^Delete mark/ }).length).toBe(before - 1);
  });

  it("adds a mark with the Ctrl+M accelerator", () => {
    render(<App />);
    const before = screen.getAllByRole("button", { name: /^Delete mark/ }).length;
    fireEvent.keyDown(window, { key: "m", ctrlKey: true });
    expect(screen.getAllByRole("button", { name: /^Delete mark/ }).length).toBe(before + 1);
  });
});
