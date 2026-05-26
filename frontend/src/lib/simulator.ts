import type { NirsPacket, Point } from "../types/nirs";

export function createDemoPackets(length = 900): NirsPacket[] {
  const packets: NirsPacket[] = [];
  for (let i = 0; i < length; i += 1) {
    const wave = Math.sin(i / 36);
    const slow = Math.cos(i / 95);
    packets.push([
      Math.round(35000 + wave * 700 + slow * 200),
      Math.round(34800 + wave * 580),
      Math.round(35200 + slow * 680),
      Math.round(34950 + wave * 340),
      Math.round(35150 + Math.sin(i / 42) * 720),
      Math.round(35400 + Math.cos(i / 51) * 600),
      Math.round(33000 + Math.sin(i / 17) * 120),
      Math.round(33200 + Math.cos(i / 21) * 140),
    ]);
  }
  return packets;
}

export function createDemoLoadCell(length = 900, timePerPacket = 0.04): Point[] {
  return Array.from({ length }, (_, index) => ({
    time: index * timePerPacket,
    value: Math.sin(index / 28) * 1.4 + Math.max(0, Math.sin(index / 120)) * 0.7,
  }));
}
