import { legacySessionFilenames } from "./sessionFiles";

type SessionBundleEntry = {
  filename: string;
  contents: string;
};

export type SessionBundle = {
  format: "nirser-session-bundle";
  version: 1;
  baseName: string;
  createdAt: string;
  files: SessionBundleEntry[];
};

export function createSessionBundle(
  baseName: string,
  contents: {
    nirs: string;
    loadCell: string;
    marks: string;
    sections: string;
    settings?: string;
    calculatedValues?: string;
    hbValues?: string;
    serialLog?: string;
  },
): SessionBundle {
  const filenames = legacySessionFilenames(baseName);
  const files: SessionBundleEntry[] = [
    { filename: filenames.nirs, contents: contents.nirs },
    { filename: filenames.loadCell, contents: contents.loadCell },
    { filename: filenames.marks, contents: contents.marks },
    { filename: filenames.sections, contents: contents.sections },
  ];
  if (contents.settings) {
    files.push({ filename: `${filenames.nirs.replace(/\.csv$/, "")}Settings.json`, contents: contents.settings });
  }
  if (contents.calculatedValues) {
    files.push({ filename: `${filenames.nirs.replace(/\.csv$/, "")}CalculatedValues.csv`, contents: contents.calculatedValues });
  }
  if (contents.hbValues) {
    files.push({ filename: `${filenames.nirs.replace(/\.csv$/, "")}HbValues.csv`, contents: contents.hbValues });
  }
  if (contents.serialLog) {
    files.push({ filename: `${filenames.nirs.replace(/\.csv$/, "")}SerialLog.csv`, contents: contents.serialLog });
  }
  return {
    format: "nirser-session-bundle",
    version: 1,
    baseName,
    createdAt: new Date().toISOString(),
    files,
  };
}

export function serializeSessionBundle(bundle: SessionBundle) {
  return JSON.stringify(bundle, null, 2);
}

export function parseSessionBundle(text: string): SessionBundle {
  const parsed = JSON.parse(text) as Partial<SessionBundle>;
  if (parsed.format !== "nirser-session-bundle" || parsed.version !== 1 || !Array.isArray(parsed.files)) {
    throw new Error("Unsupported NIRSer session bundle");
  }
  return parsed as SessionBundle;
}

export function bundleFiles(bundle: SessionBundle) {
  return bundle.files.map((entry) => new File([entry.contents], entry.filename, { type: "text/plain" }));
}
