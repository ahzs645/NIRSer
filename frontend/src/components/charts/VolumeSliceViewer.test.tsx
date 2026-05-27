// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { VolumeSliceViewer } from "./VolumeSliceViewer";

afterEach(() => cleanup());

describe("VolumeSliceViewer", () => {
  it("renders a selectable NIfTI slice", () => {
    render(
      <VolumeSliceViewer
        image={{
          dims: [2, 2, 2],
          pixdim: [1, 1, 1],
          datatype: 16,
          voxOffset: 352,
          values: [0, 1, 2, 3, 4, 5, 6, 7],
        }}
      />,
    );

    expect(screen.getByRole("img", { name: "MRI slice z slice" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "X" }));
    expect(screen.getByRole("img", { name: "MRI slice x slice" })).toBeInTheDocument();
  });
});
