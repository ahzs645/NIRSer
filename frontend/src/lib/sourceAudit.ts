export type SourceAuditFile = {
  name: string;
  size: number;
  webkitRelativePath?: string;
};

export type SourceAuditStatus = "complete" | "partial" | "missing";

export type SourceAuditCategory = {
  id: string;
  label: string;
  description: string;
  expected: string[];
  present: string[];
  missing: string[];
  extra: string[];
  status: SourceAuditStatus;
};

export type SourceAuditSummary = {
  fileCount: number;
  totalBytes: number;
  categories: SourceAuditCategory[];
  missingCritical: string[];
  matchedExpectedCount: number;
  expectedCount: number;
};

const inverseExpected = [
  "25866682/AnalysisInverse.m",
  "25866682/VoXelize.m",
  "25866682/AverageHemoglobinScalpBrain.mat",
  "25866682/dataChannelSpace.mat",
  "25866682/JAC690.jac",
  "25866682/JAC830.jac",
  "25866682/MPRAGE_R.nii",
  "25866682/m_MPRAGE_R.nii",
  "25866682/c1MPRAGE_R.nii",
  "25866682/c2MPRAGE_R.nii",
  "25866682/c3MPRAGE_R.nii",
  "25866682/mesh690.mesh",
  "25866682/mesh830.mesh",
];

const brunoExpected = [
  "BRoadband_mUltidistaNce_Oximetry-master/Analyse_example_data.m",
  "BRoadband_mUltidistaNce_Oximetry-master/BRUNO_calc.m",
  "BRoadband_mUltidistaNce_Oximetry-master/BRUNO_derivative_fit.m",
  "BRoadband_mUltidistaNce_Oximetry-master/BRUNO_plot.m",
  "BRoadband_mUltidistaNce_Oximetry-master/generate_model.m",
  "BRoadband_mUltidistaNce_Oximetry-master/example_data.mat",
  "BRoadband_mUltidistaNce_Oximetry-master/LICENSE",
  "BRoadband_mUltidistaNce_Oximetry-master/README.md",
];

const bcmdKeyExpected = [
  "BCMD-master/README.md",
  "BCMD-master/LICENSE.txt",
  "BCMD-master/doc/manual.pdf",
  "BCMD-master/doc/windows.pdf",
  "BCMD-master/bparser/bcmd.py",
  "BCMD-master/bparser/bcmd_lex.py",
  "BCMD-master/bparser/bcmd_yacc.py",
  "BCMD-master/batch/dsim.py",
  "BCMD-master/batch/optim.py",
  "BCMD-master/batch/posthoc.py",
  "BCMD-master/examples/rc.modeldef",
  "BCMD-master/examples/rc.input",
  "BCMD-master/batch/rc_example.dsimjob",
  "BCMD-master/src/radau/radau5.f",
  "BCMD-master/src/radauwrap/radau5_interface.c",
];

const categoryDefinitions = [
  {
    id: "inverse",
    label: "Inverse imaging data",
    description: "MRI, Jacobian, mesh, MAT, and MATLAB inverse-analysis source files used by the NIfTI, mesh, and hemoglobin tests.",
    expected: inverseExpected,
    prefix: "25866682/",
  },
  {
    id: "bruno",
    label: "BRUNO upstream",
    description: "Original broadband multidistance oximetry MATLAB source, example data, and license.",
    expected: brunoExpected,
    prefix: "BRoadband_mUltidistaNce_Oximetry-master/",
  },
  {
    id: "bcmd",
    label: "BCMD upstream",
    description: "Representative original BCMD docs, parser, batch tools, examples, and Radau solver sources.",
    expected: bcmdKeyExpected,
    prefix: "BCMD-master/",
  },
];

function normalizePath(path: string) {
  return path.replace(/\\/g, "/").replace(/^\/+/, "");
}

function relativePath(file: SourceAuditFile) {
  return normalizePath(file.webkitRelativePath || file.name);
}

function pathEndsWith(path: string, suffix: string) {
  return path === suffix || path.endsWith(`/${suffix}`);
}

export function auditSourceFiles(files: Iterable<SourceAuditFile>): SourceAuditSummary {
  const items = Array.from(files);
  const paths = items.map(relativePath);
  const totalBytes = items.reduce((sum, file) => sum + file.size, 0);
  let matchedExpectedCount = 0;

  const categories = categoryDefinitions.map((definition) => {
    const present = definition.expected.filter((expected) => paths.some((path) => pathEndsWith(path, expected)));
    const missing = definition.expected.filter((expected) => !present.includes(expected));
    const extra = paths
      .filter((path) => path.includes(definition.prefix))
      .filter((path) => !definition.expected.some((expected) => pathEndsWith(path, expected)));
    matchedExpectedCount += present.length;

    return {
      id: definition.id,
      label: definition.label,
      description: definition.description,
      expected: definition.expected,
      present,
      missing,
      extra,
      status: missing.length === 0 ? "complete" : present.length > 0 ? "partial" : "missing",
    } satisfies SourceAuditCategory;
  });

  return {
    fileCount: items.length,
    totalBytes,
    categories,
    missingCritical: inverseExpected.filter((expected) => !paths.some((path) => pathEndsWith(path, expected))),
    matchedExpectedCount,
    expectedCount: categoryDefinitions.reduce((sum, definition) => sum + definition.expected.length, 0),
  };
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = units[0];
  for (let index = 1; value >= 1024 && index < units.length; index += 1) {
    value /= 1024;
    unit = units[index];
  }
  return `${value.toFixed(value >= 10 ? 1 : 2)} ${unit}`;
}
