import type {
  CalculatedValuesSnapshot,
  ChannelStats,
  DataInfo,
  NirsPoint,
  Point,
  ProcessedNirsSample,
  Section,
  SerialEvent,
} from "../types/nirs";
import { calculateToi, packetsFromNumbers, processPacket } from "./formulas";
import { parseLoadCellLine } from "./serial";
import type { AppSettings } from "../types/nirs";
import { parseCsvLine, parseCsvNumbers, randomId } from "./utils";

export function importRawCsv(text: string, settings: AppSettings) {
  return packetsFromNumbers(parseCsvNumbers(text)).map((packet, index) =>
    processPacket(packet, index * settings.nirsTimePerPacket, settings.deviceKind),
  );
}

function makeTextPoint(time: number, data: number[], offset: number): NirsPoint {
  const o2hb = data[offset + 1] ?? 0;
  const hhb = data[offset + 2] ?? 0;
  const thb = data[offset] ?? o2hb + hhb;
  return {
    time,
    o2hb,
    hhb,
    thb,
    hbdiff: o2hb - hhb,
    toi: 0, // filled in once both channels are known (TOI depends on both)
  };
}

export function importNirsText(text: string, timePerPacket = 0.02): ProcessedNirsSample[] {
  const rows = text
    .split(/\r?\n/)
    .slice(3)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split(/\t+/).map(Number));
  return importNirsTextRows(rows, timePerPacket);
}

export function importNirsTextRows(rows: number[][], timePerPacket = 0.02): ProcessedNirsSample[] {
  return rows
    .filter((data) => data.some(Number.isFinite))
    .map((data, index) => {
      const time = index * timePerPacket;
      const channel1 = makeTextPoint(time, data, 3);
      const channel2 = makeTextPoint(time, data, 7);
      const toi = calculateToi(channel1.o2hb, channel1.hhb, channel2.o2hb, channel2.hhb);
      channel1.toi = toi;
      channel2.toi = toi;
      return {
        time,
        channel1,
        channel2,
        raw: data.slice(0, 8).concat(Array(8).fill(0)).slice(0, 8) as [
          number,
          number,
          number,
          number,
          number,
          number,
          number,
          number,
        ],
        sourceValues: data,
      };
    });
}

export function importLegacyTextMarks(text: string) {
  const hasLegacyMark = text
    .split(/\r?\n/)
    .slice(3)
    .some((line) => Number(line.trim().split(/\t+/)[10]) === 1);
  return hasLegacyMark ? [1] : [];
}

export function importLoadCellCsv(text: string, timePerPacket: number): Point[] {
  const interval = Number.isFinite(timePerPacket) && timePerPacket > 0 ? timePerPacket : 0.04;
  const values = /[A-Za-z]/.test(text)
    ? text
        .split(/\r?\n/)
        .map(parseLoadCellLine)
        .filter((value): value is number => value !== undefined)
    : parseCsvNumbers(text);
  return values.map((value, index) => ({ time: index * interval, value }));
}

export function importMarksText(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(Number)
    .filter((mark) => Number.isFinite(mark) && mark >= 0);
}

export function importSectionsText(text: string): Section[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(/\s+/);
      const maybeInitialTime = Number(parts.at(-2));
      const maybeEndTime = Number(parts.at(-1));
      const hasTimes = parts.length >= 3 && Number.isFinite(maybeInitialTime) && Number.isFinite(maybeEndTime);
      return {
        id: randomId(),
        name: hasTimes ? parts.slice(0, -2).join(" ") : parts.join(" "),
        initialTime: hasTimes ? maybeInitialTime : 0,
        endTime: hasTimes ? maybeEndTime : 0,
      };
    })
    .filter((section) => section.name && section.endTime > section.initialTime);
}

const emptyDataInfo = (): DataInfo => ({
  min: { time: 0, value: 0 },
  max: { time: 0, value: 0 },
  average: 0,
  slope: 0,
  r: 0,
  intercept: 0,
});

const emptyChannelStats = (): ChannelStats => ({
  o2hb: emptyDataInfo(),
  hhb: emptyDataInfo(),
  thb: emptyDataInfo(),
  hbdiff: emptyDataInfo(),
  toi: emptyDataInfo(),
});

function dataInfoFromColumns(columns: string[]): DataInfo {
  return {
    min: { value: Number(columns[9]) || 0, time: Number(columns[10]) || 0 },
    max: { value: Number(columns[11]) || 0, time: Number(columns[12]) || 0 },
    average: Number(columns[13]) || 0,
    slope: Number(columns[14]) || 0,
    r: Number(columns[15]) || 0,
    intercept: 0,
  };
}

export function importCalculatedValuesCsv(text: string): CalculatedValuesSnapshot[] {
  const snapshots = new Map<string, CalculatedValuesSnapshot>();
  for (const line of text.split(/\r?\n/).slice(1)) {
    const columns = parseCsvLine(line).map((column) => column.trim());
    if (columns.length < 16) continue;
    const [calculatedAt, sectionName, initialTime, endTime, filterPasses, filterOrder, filterCutoff, source, metric] = columns;
    if (!calculatedAt || !sectionName) continue;
    const key = [calculatedAt, sectionName, initialTime, endTime, filterPasses, filterOrder, filterCutoff].join("|");
    const snapshot =
      snapshots.get(key) ??
      {
        id: randomId(),
        calculatedAt,
        sectionName,
        initialTime: Number(initialTime) || 0,
        endTime: Number(endTime) || 0,
        filterPasses: Number(filterPasses) || 0,
        filterOrder: Number(filterOrder) || 0,
        filterCutoff: Number(filterCutoff) || 0,
        stats: {
          channel1: emptyChannelStats(),
          channel2: emptyChannelStats(),
          loadCell: emptyDataInfo(),
        },
      };
    const dataInfo = dataInfoFromColumns(columns);
    if ((source === "channel1" || source === "channel2") && ["o2hb", "hhb", "thb", "hbdiff"].includes(metric)) {
      snapshot.stats[source][metric as keyof ChannelStats] = dataInfo;
    } else if (source === "loadCell") {
      snapshot.stats.loadCell = dataInfo;
    }
    snapshots.set(key, snapshot);
  }
  return Array.from(snapshots.values());
}

export function importSerialEventsCsv(text: string): SerialEvent[] {
  return text
    .split(/\r?\n/)
    .slice(1)
    .map((line) => parseCsvLine(line).map((column) => column.trim()))
    .filter((columns) => columns.length >= 4 && columns[0])
    .map(([timestamp, source, event, ...detail]) => ({
      timestamp,
      source: source === "load-cell" || source === "extra-device" ? source : "nirs",
      event,
      detail: detail.join(","),
    }));
}

export function sidecarStem(filename: string) {
  return filename.replace(/\.[^.]+$/, "");
}
