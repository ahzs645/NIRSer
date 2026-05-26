import type { AppSettings, NirsPacket, ProcessedNirsSample } from "../types/nirs";
import { butterworthFilterNirsPoints } from "./butterworth";
import { processPacket } from "./formulas";
import { kalmanFilterNirsPoints } from "./kalman";

export function buildSamples(packets: NirsPacket[], settings: AppSettings) {
  return packets.map((packet, index) =>
    processPacket(packet, index * settings.nirsTimePerPacket, settings.deviceKind),
  );
}

export type AnalysisFilterMethod = "butterworth" | "kalman";

export function applyFilterPasses(
  points: ProcessedNirsSample["channel1"][],
  passes: number,
  order: number,
  cutoff: number,
  method: AnalysisFilterMethod = "butterworth",
) {
  let filtered = points;
  for (let index = 0; index < passes; index += 1) {
    filtered =
      method === "kalman"
        ? kalmanFilterNirsPoints(filtered, { processNoise: cutoff, measurementNoise: order })
        : butterworthFilterNirsPoints(filtered, order, cutoff);
  }
  return filtered;
}
