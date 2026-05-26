import type { BrunoResult } from "./bruno";

export function brunoResultCsv(result: BrunoResult) {
  const rows = [
    ["metric", "value"],
    ["StO2", result.sto2],
    ["waterFraction", result.coefficients.waterFraction],
    ["HHb", result.coefficients.hhb],
    ["HbO2", result.coefficients.hbo2],
    ["scatteringA", result.coefficients.scatteringA],
    ["scatteringB", result.coefficients.scatteringB],
    ["sumResidual", result.sumResidual],
    ["sumNormalizedResidual", result.sumNormalizedResidual],
    ["score", result.score],
    [],
    ["wavelength", "slopeDerivative", "modelDerivative", "residual", "normalizedResidual"],
    ...result.wavelengths.map((wavelength, index) => [
      wavelength,
      result.slopeDerivative[index],
      result.modelDerivative[index],
      result.residuals[index],
      result.normalizedResiduals[index],
    ]),
  ];
  return rows.map((row) => row.join(",")).join("\n");
}
