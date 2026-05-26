import type {
  AnalysisStats,
  AppSettings,
  CalculatedValuesSnapshot,
  NirsPacket,
  Point,
  ProcessedNirsSample,
  Section,
  SerialEvent,
} from "../types/nirs";
import { processPacket } from "./formulas";
import { csvEscape, formatNumber } from "./utils";

export function exportRawNirsCsv(packets: NirsPacket[]) {
  return packets.map((packet) => packet.join(",")).join(",");
}

export function exportSourceValuesCsv(samples: ProcessedNirsSample[]) {
  return samples.map((sample) => (sample.sourceValues ?? sample.raw).join(",")).join("\n");
}

export function exportLoadCellCsv(points: Point[]) {
  return points
    .map((point) => point.value)
    .filter(Number.isFinite)
    .join(",");
}

export function exportMarks(marks: number[]) {
  return marks
    .filter((mark) => Number.isFinite(mark) && mark >= 0)
    .sort((a, b) => a - b)
    .map((mark) => formatNumber(mark, 2))
    .join("\n");
}

export function exportSections(sections: Section[]) {
  return sections
    .filter((section) =>
      section.name.trim() &&
      Number.isFinite(section.initialTime) &&
      Number.isFinite(section.endTime) &&
      section.endTime > section.initialTime
    )
    .map((section) => `${section.name} ${section.initialTime} ${section.endTime}`)
    .join("\n");
}

const sectionMetricLabels = {
  o2hb: "O2Hb",
  hhb: "HHb",
  thb: "THb",
  hbdiff: "HbDif",
} as const;

function dataInfoRows(info: AnalysisStats["loadCell"]) {
  return [
    `Min,${formatNumber(info.min.value)},${formatNumber(info.min.time)}s`,
    `Max,${formatNumber(info.max.value)},${formatNumber(info.max.time)}s`,
    `Avg,${formatNumber(info.average, 5)}`,
    `Slope,${formatNumber(info.slope, 5)}`,
    `R,${formatNumber(info.r, 5)}`,
  ];
}

function statRows(section: Section, stats: AnalysisStats) {
  const rows = [`${section.name},${section.initialTime},${section.endTime}`];
  for (const [channelLabel, channelStats] of [
    ["Channel 1", stats.channel1],
    ["Channel 2", stats.channel2],
  ] as const) {
    rows.push(channelLabel);
    for (const metric of ["o2hb", "hhb", "thb", "hbdiff"] as const) {
      rows.push(sectionMetricLabels[metric]);
      rows.push(...dataInfoRows(channelStats[metric]));
    }
  }
  rows.push("Load Cell");
  rows.push(...dataInfoRows(stats.loadCell));
  return rows;
}

export function exportSectionStatsCsv(entries: Array<{ section: Section; stats: AnalysisStats }>) {
  return entries.flatMap((entry) => statRows(entry.section, entry.stats)).join("\n");
}

export function exportSectionStatsWithFilterCsv(
  entries: Array<{ section: Section; stats: AnalysisStats }>,
  filter: { passes: number; order: number; cutoff: number },
) {
  return [
    `Filter times applied:,${filter.passes}`,
    `Filter order:,${filter.order}`,
    `Filter cutoff:,${filter.cutoff}`,
    exportSectionStatsCsv(entries),
  ].join("\n");
}

export function exportCalculatedValuesCsv(snapshots: CalculatedValuesSnapshot[]) {
  const rows = [
    "CalculatedAt,Section,InitialTime,EndTime,FilterPasses,FilterOrder,FilterCutoff,Source,Metric,Min,MinTime,Max,MaxTime,Average,Slope,R",
  ];
  const pushDataInfo = (
    snapshot: CalculatedValuesSnapshot,
    source: string,
    metric: string,
    info: AnalysisStats["loadCell"],
  ) => {
    rows.push(
      [
        snapshot.calculatedAt,
        snapshot.sectionName,
        snapshot.initialTime,
        snapshot.endTime,
        snapshot.filterPasses,
        snapshot.filterOrder,
        snapshot.filterCutoff,
        source,
        metric,
        info.min.value,
        info.min.time,
        info.max.value,
        info.max.time,
        info.average,
        info.slope,
        info.r,
      ]
        .map(csvEscape)
        .join(","),
    );
  };
  for (const snapshot of snapshots) {
    for (const metric of ["o2hb", "hhb", "thb", "hbdiff"] as const) {
      pushDataInfo(snapshot, "channel1", metric, snapshot.stats.channel1[metric]);
      pushDataInfo(snapshot, "channel2", metric, snapshot.stats.channel2[metric]);
    }
    pushDataInfo(snapshot, "loadCell", "value", snapshot.stats.loadCell);
  }
  return rows.join("\n");
}

export function exportSerialEventsCsv(events: SerialEvent[]) {
  return [
    "Timestamp,Source,Event,Detail",
    ...events.map((item) => [item.timestamp, item.source, item.event, item.detail].map(csvEscape).join(",")),
  ].join("\n");
}

function hasMark(currentTime: number, marks: number[], timePerPacket: number) {
  const roundedCurrentTime = Number(currentTime.toFixed(2));
  const tolerance = timePerPacket - 0.0077777777777778;
  return marks.some((mark) => mark > roundedCurrentTime - tolerance && mark < roundedCurrentTime + tolerance) ? 1 : 0;
}

export function exportHbValuesCsv(
  packets: NirsPacket[],
  settings: AppSettings,
  marks: number[],
  fallbackSamples?: ProcessedNirsSample[],
) {
  const rows = ["Time,Ch1O2Hb,Ch1HHb,Ch1THb,Ch2O2Hb,Ch2HHb,Ch2THb"];
  const sourceSamples =
    fallbackSamples ??
    packets.map((packet, index) =>
      processPacket(packet, index * settings.nirsTimePerPacket, settings.deviceKind),
    );
  const rowCount = fallbackSamples
    ? sourceSamples.length
    : Math.max(0, Math.min(sourceSamples.length, packets.length - 1));
  for (let index = 0; index < rowCount; index += 1) {
    const sample = sourceSamples[index];
    rows.push(
      [
        sample.time,
        sample.channel1.o2hb,
        sample.channel1.hhb,
        sample.channel1.thb,
        sample.channel2.o2hb,
        sample.channel2.hhb,
        sample.channel2.thb,
        hasMark(sample.time, marks, settings.nirsTimePerPacket),
      ]
        .map(String)
        .join(","),
    );
  }
  return rows.join("\n");
}
