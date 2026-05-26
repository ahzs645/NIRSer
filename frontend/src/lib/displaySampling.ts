export function sampleByDisplayRate<T extends { time: number }>(items: T[], packetsPerSecond: number) {
  const rate = Math.max(1, Math.floor(packetsPerSecond));
  const interval = 1 / rate;
  const selected: T[] = [];
  let nextTime = items[0]?.time ?? 0;

  for (const item of items) {
    if (item.time + Number.EPSILON >= nextTime) {
      selected.push(item);
      nextTime = item.time + interval;
    }
  }

  return selected;
}
