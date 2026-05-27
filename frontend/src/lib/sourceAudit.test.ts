import { describe, expect, it } from "vitest";
import { auditSourceFiles, formatBytes, type SourceAuditFile } from "./sourceAudit";

function file(path: string, size = 10): SourceAuditFile {
  return { name: path.split("/").at(-1) ?? path, size, webkitRelativePath: `New Folder With Items 2/${path}` };
}

describe("source audit", () => {
  it("detects complete inverse and BRUNO folders from a browser directory upload", () => {
    const summary = auditSourceFiles([
      file("25866682/AnalysisInverse.m"),
      file("25866682/VoXelize.m"),
      file("25866682/AverageHemoglobinScalpBrain.mat"),
      file("25866682/dataChannelSpace.mat"),
      file("25866682/JAC690.jac"),
      file("25866682/JAC830.jac"),
      file("25866682/MPRAGE_R.nii"),
      file("25866682/m_MPRAGE_R.nii"),
      file("25866682/c1MPRAGE_R.nii"),
      file("25866682/c2MPRAGE_R.nii"),
      file("25866682/c3MPRAGE_R.nii"),
      file("25866682/mesh690.mesh"),
      file("25866682/mesh830.mesh"),
      file("BRoadband_mUltidistaNce_Oximetry-master/Analyse_example_data.m"),
      file("BRoadband_mUltidistaNce_Oximetry-master/BRUNO_calc.m"),
      file("BRoadband_mUltidistaNce_Oximetry-master/BRUNO_derivative_fit.m"),
      file("BRoadband_mUltidistaNce_Oximetry-master/BRUNO_plot.m"),
      file("BRoadband_mUltidistaNce_Oximetry-master/generate_model.m"),
      file("BRoadband_mUltidistaNce_Oximetry-master/example_data.mat"),
      file("BRoadband_mUltidistaNce_Oximetry-master/LICENSE"),
      file("BRoadband_mUltidistaNce_Oximetry-master/README.md"),
    ]);

    expect(summary.fileCount).toBe(21);
    expect(summary.categories.find((category) => category.id === "inverse")?.status).toBe("complete");
    expect(summary.categories.find((category) => category.id === "bruno")?.status).toBe("complete");
    expect(summary.categories.find((category) => category.id === "bcmd")?.status).toBe("missing");
    expect(summary.missingCritical).toEqual([]);
  });

  it("reports partial upstream folders and extra files", () => {
    const summary = auditSourceFiles([
      file("BCMD-master/examples/rc.modeldef"),
      file("BCMD-master/examples/extra.modeldef"),
      file("25866682/MPRAGE_R.nii"),
    ]);

    expect(summary.categories.find((category) => category.id === "bcmd")?.status).toBe("partial");
    expect(summary.categories.find((category) => category.id === "bcmd")?.extra).toEqual([
      "New Folder With Items 2/BCMD-master/examples/extra.modeldef",
    ]);
    expect(summary.missingCritical).toContain("25866682/JAC830.jac");
  });

  it("formats byte totals for display", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2.00 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.00 MB");
  });
});
