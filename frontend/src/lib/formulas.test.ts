import { describe, expect, it } from "vitest";
import { calculateHbPair, calculateToi, packetsFromNumbers, processPacket } from "./formulas";

describe("NIRS formulas", () => {
  it("matches the Pathonix Hb coefficients from the jar", () => {
    const red = 35509;
    const ir = 35352;
    const convertedRed = Math.log(red / 2 ** 16);
    const convertedIr = Math.log(ir / 2 ** 16);
    const expectedO2 = -((5.4643 * convertedRed + -2.542 * convertedIr) * 10);
    const expectedHhb = -((-2.11503 * convertedRed + 3.57124 * convertedIr) * 10);

    expect(calculateHbPair("pathonix", red, ir).o2hb).toBeCloseTo(expectedO2, 10);
    expect(calculateHbPair("pathonix", red, ir).hhb).toBeCloseTo(expectedHhb, 10);
  });

  it("maps Pathonix packet indexes like AnalysisManager", () => {
    const sample = processPacket([1, 35352, 35509, 4, 35136, 34982, 7, 8], 0.5, "pathonix");
    expect(sample.channel1.o2hb).toBeCloseTo(calculateHbPair("pathonix", 34982, 35509).o2hb);
    expect(sample.channel2.hhb).toBeCloseTo(calculateHbPair("pathonix", 35136, 35352).hhb);
    expect(sample.channel1.hbdiff).toBeCloseTo(sample.channel1.o2hb - sample.channel1.hhb);
  });

  it("maps UNBC packet indexes like AnalysisManager", () => {
    const sample = processPacket([35000, 35100, 35200, 35300, 4, 5, 6, 7], 0, "unbc");
    expect(sample.channel1.o2hb).toBeCloseTo(calculateHbPair("unbc", 35000, 35100).o2hb);
    expect(sample.channel2.hhb).toBeCloseTo(calculateHbPair("unbc", 35200, 35300).hhb);
  });

  it("calculates TOI and clamps to a percentage", () => {
    const toi = calculateToi(18.725298456241067, 8.607599620012289, 18.372631930549517, 8.858753895754754);
    expect(toi).toBeGreaterThanOrEqual(0);
    expect(toi).toBeLessThanOrEqual(100);
  });

  it("exposes TOI as its own field computed from both channels' converted Hb values", () => {
    const sample = processPacket([1, 35352, 35509, 4, 35136, 34982, 7, 8], 0.5, "pathonix");
    const expectedToi = calculateToi(
      calculateHbPair("pathonix", 34982, 35509).o2hb,
      calculateHbPair("pathonix", 34982, 35509).hhb,
      calculateHbPair("pathonix", 35136, 35352).o2hb,
      calculateHbPair("pathonix", 35136, 35352).hhb,
    );

    // TOI is a tissue-pair index, so it is identical on both channels.
    expect(sample.channel1.toi).toBeCloseTo(43.30958192172224, 10);
    expect(sample.channel1.toi).toBeCloseTo(expectedToi, 10);
    expect(sample.channel2.toi).toBeCloseTo(expectedToi, 10);
    // HbDiff is always O2Hb - HHb now (no longer overwritten by TOI).
    expect(sample.channel1.hbdiff).toBeCloseTo(sample.channel1.o2hb - sample.channel1.hhb, 10);
    expect(sample.channel1.hbdiff).not.toBeCloseTo(expectedToi, 5);
    // TOI uses the converted Hb values, not the raw red/IR counts.
    expect(sample.channel1.toi).not.toBeCloseTo(calculateToi(34982, 35509, 35136, 35352), 5);
  });

  it("parses flattened raw CSV values into 8-value packets", () => {
    expect(packetsFromNumbers([1, 2, 3, 4, 5, 6, 7, 8, 9])).toEqual([[1, 2, 3, 4, 5, 6, 7, 8]]);
  });
});
