export function sanitizeSessionBaseName(value: string) {
  const cleaned = value
    .trim()
    .replace(/\.(csv|txt|json|nirser)$/i, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned || "nirs-data";
}

export function legacySessionFilenames(baseName: string) {
  const base = sanitizeSessionBaseName(baseName);
  return {
    nirs: `${base}.csv`,
    loadCell: `${base}LoadCellCommunicator.csv`,
    marks: `${base}Marks.txt`,
    sections: `${base}Sections.txt`,
  };
}
