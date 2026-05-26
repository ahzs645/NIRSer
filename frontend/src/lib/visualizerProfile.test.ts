import { describe, expect, it } from "vitest";
import { builtInVisualizerProfile, parseVisualizerProfile, visualizerProfileToChannels } from "./visualizerProfile";

describe("visualizer contraction profiles", () => {
  it("parses active-vein counts directly when values are in the 1-20 range", () => {
    expect(parseVisualizerProfile("1, 10, 20, 21")).toEqual([1, 10, 20, 4]);
  });

  it("maps percentage-like values to the 1-20 vein range", () => {
    expect(parseVisualizerProfile("0\n25\n50\n100\n150")).toEqual([1, 5, 10, 20, 20]);
  });

  it("ignores nonnumeric entries", () => {
    expect(parseVisualizerProfile("bad, 7, no")).toEqual([7]);
  });

  it("derives full visualizer profiles from row-based raw NIRS packet files", () => {
    const text = [
      "35000,35000,35000,35000,35000,35000,35000,35000",
      "34000,35000,35000,35000,34000,34000,35000,35000",
      "32000,35000,35000,35000,32000,32000,35000,35000",
    ].join("\n");

    const profile = parseVisualizerProfile(text);

    expect(profile).toHaveLength(3);
    expect(profile[0]).toBe(10);
    expect(profile[1]).toBeGreaterThanOrEqual(profile[0]);
    expect(profile[2]).toBeGreaterThanOrEqual(profile[1]);
  });

  it("provides deterministic built-in forearm and neck contraction profiles", () => {
    const forearm = builtInVisualizerProfile("forearm");
    const neck = builtInVisualizerProfile("neck");

    expect(forearm).toHaveLength(120);
    expect(neck).toHaveLength(90);
    expect(Math.max(...forearm)).toBeGreaterThan(Math.max(...neck) - 4);
    expect(Math.min(...forearm)).toBeGreaterThanOrEqual(1);
    expect(Math.max(...forearm)).toBeLessThanOrEqual(20);
  });

  it("converts visualizer frames into channel chart points", () => {
    const channels = visualizerProfileToChannels([1, 10, 20], 0.5);

    expect(channels.channel1).toHaveLength(3);
    expect(channels.channel2).toHaveLength(3);
    expect(channels.channel1[1].time).toBe(0.5);
    expect(channels.channel1[2].o2hb).toBeGreaterThan(channels.channel1[0].o2hb);
    expect(channels.channel1[2].hbdiff).toBeGreaterThan(channels.channel1[0].hbdiff);
  });

  it("sanitizes malformed profile values and invalid frame intervals", () => {
    const channels = visualizerProfileToChannels([0, Number.NaN, 25], Number.NaN);

    expect(channels.channel1).toHaveLength(2);
    expect(channels.channel2).toHaveLength(2);
    expect(channels.channel1[0].time).toBe(0);
    expect(channels.channel1[1].time).toBe(0.1);
    expect(channels.channel1[0].o2hb).toBeGreaterThan(0);
    expect(channels.channel1[1].o2hb).toBe(12);
  });
});
