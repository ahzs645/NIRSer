import { describe, expect, it } from "vitest";
import { legacySessionFilenames, sanitizeSessionBaseName } from "./sessionFiles";

describe("legacy session file names", () => {
  it("keeps sidecar files coupled to the selected session stem", () => {
    expect(legacySessionFilenames("trial.v1.csv")).toEqual({
      nirs: "trial.v1.csv",
      loadCell: "trial.v1LoadCellCommunicator.csv",
      marks: "trial.v1Marks.txt",
      sections: "trial.v1Sections.txt",
    });
  });

  it("sanitizes unsafe or empty names", () => {
    expect(sanitizeSessionBaseName(" arm trial 01 ")).toBe("arm-trial-01");
    expect(sanitizeSessionBaseName("")).toBe("nirs-data");
  });
});
