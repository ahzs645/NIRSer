import { describe, expect, it } from "vitest";
import { createSessionBundle, parseSessionBundle, serializeSessionBundle } from "./sessionBundle";

describe("NIRSer session bundles", () => {
  it("stores legacy sidecar filenames in a single client-side artifact", () => {
    const bundle = createSessionBundle("trial.v1", {
      nirs: "1,2,3,4",
      loadCell: "5,6",
      marks: "1.25",
      sections: "baseline 0 5",
      settings: "{}",
      calculatedValues: "CalculatedAt,Section",
      hbValues: "Time,Ch1O2Hb",
      serialLog: "Timestamp,Source,Event,Detail",
    });

    expect(bundle.files.map((file) => file.filename)).toEqual([
      "trial.v1.csv",
      "trial.v1LoadCellCommunicator.csv",
      "trial.v1Marks.txt",
      "trial.v1Sections.txt",
      "trial.v1Settings.json",
      "trial.v1CalculatedValues.csv",
      "trial.v1HbValues.csv",
      "trial.v1SerialLog.csv",
    ]);
    expect(parseSessionBundle(serializeSessionBundle(bundle))).toMatchObject({
      format: "nirser-session-bundle",
      version: 1,
      baseName: "trial.v1",
    });
  });

  it("rejects unknown bundle formats", () => {
    expect(() => parseSessionBundle("{}")).toThrow("Unsupported NIRSer session bundle");
  });
});
