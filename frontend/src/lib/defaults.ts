import type { AppSettings, Section } from "../types/nirs";
import { randomId } from "./utils";

export const defaultSettings: AppSettings = {
  deviceKind: "pathonix",
  useToi: false,
  nirsTimePerPacket: 0.0277777777777778,
  loadCellTimePerPacket: 0.04,
  nirsFrameRate: 9,
  loadCellFrameRate: 9,
  loadCellSerialNumber: "680844",
  loadCellPointsPerSecond: 25,
};

export function defaultSections(): Section[] {
  return [
    { id: randomId(), name: "baseline", initialTime: 0, endTime: 8 },
    { id: randomId(), name: "contraction", initialTime: 8, endTime: 20 },
  ];
}

function positiveNumber(value: unknown, fallback: number) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback;
}

export function normalizeSettings(value: unknown): AppSettings {
  const input = typeof value === "object" && value !== null ? value as Partial<AppSettings> : {};
  const loadCellPointsPerSecond = positiveNumber(input.loadCellPointsPerSecond, defaultSettings.loadCellPointsPerSecond);
  return {
    deviceKind: input.deviceKind === "unbc" ? "unbc" : defaultSettings.deviceKind,
    useToi: input.useToi === true,
    nirsTimePerPacket: positiveNumber(input.nirsTimePerPacket, defaultSettings.nirsTimePerPacket),
    loadCellTimePerPacket: positiveNumber(input.loadCellTimePerPacket, 1 / loadCellPointsPerSecond),
    nirsFrameRate: positiveNumber(input.nirsFrameRate, defaultSettings.nirsFrameRate),
    loadCellFrameRate: positiveNumber(input.loadCellFrameRate, defaultSettings.loadCellFrameRate),
    loadCellSerialNumber: typeof input.loadCellSerialNumber === "string" && input.loadCellSerialNumber.trim()
      ? input.loadCellSerialNumber.trim()
      : defaultSettings.loadCellSerialNumber,
    loadCellPointsPerSecond,
  };
}
