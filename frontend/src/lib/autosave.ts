import type { AppSettings, CalculatedValuesSnapshot, Point, ProcessedNirsSample, Section } from "../types/nirs";
import {
  exportCalculatedValuesCsv,
  exportHbValuesCsv,
  exportLoadCellCsv,
  exportMarks,
  exportRawNirsCsv,
  exportSections,
  exportSerialEventsCsv,
  exportSourceValuesCsv,
} from "./exporters";
import type { SerialEvent } from "../types/nirs";

export const AUTOSAVE_KEY = "nirser.realtimeSaveSnapshot";

export type AutosaveSnapshot = {
  savedAt: string;
  nirsFormat: "raw-packets" | "source-values";
  nirsCsv: string;
  loadCellCsv: string;
  marksText: string;
  sectionsText: string;
  sessionBaseName?: string;
  settingsJson?: string;
  calculatedValuesCsv?: string;
  hbValuesCsv?: string;
  serialLogCsv?: string;
};

export function createAutosaveSnapshot({
  samples,
  loadCell,
  marks,
  sections,
  preferSourceValues,
  sessionBaseName,
  settings,
  calculatedValues,
  serialEvents,
}: {
  samples: ProcessedNirsSample[];
  loadCell: Point[];
  marks: number[];
  sections: Section[];
  preferSourceValues: boolean;
  sessionBaseName?: string;
  settings?: AppSettings;
  calculatedValues?: CalculatedValuesSnapshot[];
  serialEvents?: SerialEvent[];
}): AutosaveSnapshot {
  return {
    savedAt: new Date().toISOString(),
    nirsFormat: preferSourceValues ? "source-values" : "raw-packets",
    nirsCsv: preferSourceValues ? exportSourceValuesCsv(samples) : exportRawNirsCsv(samples.map((sample) => sample.raw)),
    loadCellCsv: exportLoadCellCsv(loadCell),
    marksText: exportMarks(marks),
    sectionsText: exportSections(sections),
    sessionBaseName,
    settingsJson: settings ? JSON.stringify(settings, null, 2) : undefined,
    calculatedValuesCsv: calculatedValues && calculatedValues.length > 0 ? exportCalculatedValuesCsv(calculatedValues) : undefined,
    hbValuesCsv: settings ? exportHbValuesCsv(samples.map((sample) => sample.raw), settings, marks, preferSourceValues ? samples : undefined) : undefined,
    serialLogCsv: serialEvents && serialEvents.length > 0 ? exportSerialEventsCsv(serialEvents) : undefined,
  };
}

export function getAutosaveStorage() {
  return typeof localStorage === "undefined" ? null : localStorage;
}

export function saveAutosaveSnapshot(snapshot: AutosaveSnapshot, storage: Pick<Storage, "setItem"> | null = getAutosaveStorage()) {
  if (!storage) return false;
  storage.setItem(AUTOSAVE_KEY, JSON.stringify(snapshot));
  return true;
}

export function loadAutosaveSnapshot(storage: Pick<Storage, "getItem"> | null = getAutosaveStorage()) {
  if (!storage) return null;
  const raw = storage.getItem(AUTOSAVE_KEY);
  if (!raw) return null;
  const snapshot = JSON.parse(raw) as AutosaveSnapshot;
  return snapshot.nirsFormat ? snapshot : { ...snapshot, nirsFormat: "raw-packets" as const };
}

export function clearAutosaveSnapshot(storage: Pick<Storage, "removeItem"> | null = getAutosaveStorage()) {
  if (!storage) return false;
  storage.removeItem(AUTOSAVE_KEY);
  return true;
}
