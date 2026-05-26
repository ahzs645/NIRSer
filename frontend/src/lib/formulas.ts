import type { DeviceKind, NirsPacket, NirsPoint, ProcessedNirsSample } from "../types/nirs";
import { clamp } from "./utils";

type HbPair = {
  o2hb: number;
  hhb: number;
};

const TWO_16 = 2 ** 16;

function convertDataPoint(dataPoint: number) {
  return Math.log(Math.max(dataPoint, 1) / TWO_16);
}

function pathonixHb(redRaw: number, irRaw: number): HbPair {
  const red = convertDataPoint(redRaw);
  const ir = convertDataPoint(irRaw);
  return {
    o2hb: -((5.4643 * red + -2.542 * ir) * 10),
    hhb: -((-2.11503 * red + 3.57124 * ir) * 10),
  };
}

function unbcHb(redRaw: number, irRaw: number): HbPair {
  const red = convertDataPoint(redRaw);
  const ir = convertDataPoint(irRaw);
  return {
    o2hb: -((-2.7976 * red + 3.9303 * ir) * 10),
    hhb: -((5.4894 * red + -2.1503 * ir) * 10),
  };
}

export function calculateHbPair(deviceKind: DeviceKind, red: number, ir: number) {
  return deviceKind === "unbc" ? unbcHb(red, ir) : pathonixHb(red, ir);
}

export function calculateToi(ch1O2Hb: number, ch1HHb: number, ch2O2Hb: number, ch2HHb: number) {
  const k = 11;
  const h = 4.6e-4;
  const lambda1 = 760;
  const lambda2 = 850;
  const d2 = 4;
  const d1 = 3.5;
  const us760 = k * (1 - h * lambda1);
  const kr760 = Math.log((d2 ** 2 * ch2HHb) / (d1 ** 2 * ch1HHb)) / (d2 - d1);
  const ua760 = ((-3 * us760) + Math.sqrt(9 * us760 ** 2 + 12 * kr760 ** 2)) / 6;
  const us850 = k * (1 - h * lambda2);
  const kr850 = Math.log((d2 ** 2 * ch2O2Hb) / (d1 ** 2 * ch1O2Hb)) / (d2 - d1);
  const ua850 = ((-3 * us850) + Math.sqrt(9 * us850 ** 2 + 12 * kr850 ** 2)) / 6;
  const cof = -5.60581e-4 * ua760 + 0.00125567 * ua850;
  const cdf = 8.57916e-4 * ua760 + -4.75179e-4 * ua850;
  return clamp(100 * (cof / (cof + cdf)), 0, 100);
}

export function processPacket(
  packet: NirsPacket,
  time: number,
  deviceKind: DeviceKind,
): ProcessedNirsSample {
  const ch1 =
    deviceKind === "unbc"
      ? calculateHbPair(deviceKind, packet[0], packet[1])
      : calculateHbPair(deviceKind, packet[5], packet[2]);
  const ch2 =
    deviceKind === "unbc"
      ? calculateHbPair(deviceKind, packet[2], packet[3])
      : calculateHbPair(deviceKind, packet[4], packet[1]);
  // TOI is a tissue-pair index (depends on both channels), so it is identical on both points.
  // HbDiff is always O2Hb - HHb; TOI lives in its own field and is selected for display separately.
  const toi = calculateToi(ch1.o2hb, ch1.hhb, ch2.o2hb, ch2.hhb);
  const makePoint = (pair: HbPair): NirsPoint => ({
    time,
    o2hb: pair.o2hb,
    hhb: pair.hhb,
    thb: pair.o2hb + pair.hhb,
    hbdiff: pair.o2hb - pair.hhb,
    toi,
  });

  return {
    time,
    channel1: makePoint(ch1),
    channel2: makePoint(ch2),
    raw: packet,
  };
}

export function packetsFromNumbers(numbers: number[]): NirsPacket[] {
  const packets: NirsPacket[] = [];
  for (let i = 0; i <= numbers.length - 8; i += 8) {
    packets.push(numbers.slice(i, i + 8) as NirsPacket);
  }
  return packets;
}
