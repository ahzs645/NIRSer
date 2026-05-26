import { clamp, parseCsvNumbers } from "./utils";
import { processPacket } from "./formulas";
import type { NirsPacket, NirsPoint } from "../types/nirs";

export type VisualizerProfileKind = "forearm" | "neck";

function activeVeinsFromThb(thb: number, baseThb: number) {
  const increase = ((thb - baseThb) / Math.max(Math.abs(baseThb), 0.001)) * 100;
  return Math.round(clamp(10 + Math.floor(increase / 5), 1, 20));
}

function parsePacketRows(text: string) {
  const rows = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split(/[\s,]+/).map(Number).filter(Number.isFinite))
    .filter((values) => values.length >= 8);
  if (rows.length === 0) return [];

  const samples = rows.map((values, index) => {
    const packet = values.slice(0, 8) as NirsPacket;
    return processPacket(packet, index * 0.1, "pathonix");
  });
  const baseThb = samples[0]?.channel1.thb ?? 1;
  return samples.map((sample) => activeVeinsFromThb(sample.channel1.thb, baseThb));
}

export function parseVisualizerProfile(text: string) {
  const packetProfile = parsePacketRows(text);
  if (packetProfile.length > 0) return packetProfile;

  return parseCsvNumbers(text).map((value) => {
    if (value <= 20) return Math.round(clamp(value, 1, 20));
    return Math.round(clamp(value, 0, 100) / 5) || 1;
  });
}

export function builtInVisualizerProfile(kind: VisualizerProfileKind) {
  const length = kind === "neck" ? 90 : 120;
  const base = kind === "neck" ? 6 : 4;
  const amplitude = kind === "neck" ? 13 : 16;
  return Array.from({ length }, (_, index) => {
    const phase = (index / (length - 1)) * Math.PI;
    const pulse = Math.sin(phase);
    const secondaryPulse = kind === "neck" ? Math.sin(phase * 3) * 0.12 : Math.sin(phase * 2) * 0.08;
    return Math.round(clamp(base + amplitude * Math.max(0, pulse + secondaryPulse), 1, 20));
  });
}

export function visualizerProfileToChannels(profile: number[], timePerFrame = 0.1) {
  const interval = Number.isFinite(timePerFrame) && timePerFrame > 0 ? timePerFrame : 0.1;
  const sanitizedProfile = profile
    .filter(Number.isFinite)
    .map((activeVeins) => Math.round(clamp(activeVeins, 1, 20)));
  const channel1: NirsPoint[] = sanitizedProfile.map((activeVeins, index) => {
    const normalized = activeVeins / 20;
    const o2hb = normalized * 12;
    const hhb = (1 - normalized) * -4;
    return {
      time: index * interval,
      o2hb,
      hhb,
      thb: o2hb + hhb,
      hbdiff: o2hb - hhb,
      toi: 0,
    };
  });
  const channel2: NirsPoint[] = sanitizedProfile.map((activeVeins, index) => {
    const normalized = activeVeins / 20;
    const o2hb = normalized * 10.5;
    const hhb = (1 - normalized) * -3.5;
    return {
      time: index * interval,
      o2hb,
      hhb,
      thb: o2hb + hhb,
      hbdiff: o2hb - hhb,
      toi: 0,
    };
  });
  return { channel1, channel2 };
}
