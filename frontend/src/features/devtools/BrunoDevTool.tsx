import { useMemo, useState } from "react";
import {
  brunoMatToInputs,
  fitSlopeFromAttenuation,
  parseAttenuationTable,
  parseExtinctionTable,
  parseSlopeTable,
  runBrunoFit,
  type BrunoBoundaryConditions,
  type BrunoFitBounds,
  type BrunoOptions,
  type BrunoResult,
  type BrunoSeparationMode,
  type ExtinctionRow,
} from "../../lib/bruno";
import { parseMatFile } from "../../lib/mat";
import { BrunoFitChart } from "./BrunoFitChart";
import { BrunoFitSettingsCard } from "./BrunoFitSettingsCard";
import { BrunoInputCard, type BrunoInputMode } from "./BrunoInputCard";
import { BrunoResultCard } from "./BrunoResultCard";
import { defaultBrunoBounds, sampleBrunoExtinction, sampleBrunoSlope } from "./brunoDefaults";
import { parseFiveValueVector, readFirstTextFile } from "./brunoUiUtils";

export function BrunoDevTool() {
  const [inputMode, setInputMode] = useState<BrunoInputMode>("slope");
  const [slopeText, setSlopeText] = useState(sampleBrunoSlope);
  const [attenuationText, setAttenuationText] = useState("");
  const [extinctionText, setExtinctionText] = useState(sampleBrunoExtinction);
  const [boundaryConditions, setBoundaryConditions] = useState<BrunoBoundaryConditions>("ZBC");
  const [separationMode, setSeparationMode] = useState<BrunoSeparationMode>("close");
  const [distance, setDistance] = useState("22.5");
  const [distanceMax, setDistanceMax] = useState("30");
  const [waveStart, setWaveStart] = useState("710");
  const [waveEnd, setWaveEnd] = useState("900");
  const [maxIterations, setMaxIterations] = useState("1200");
  const [startBounds, setStartBounds] = useState(defaultBrunoBounds.start.join(", "));
  const [lowerBounds, setLowerBounds] = useState(defaultBrunoBounds.lower.join(", "));
  const [upperBounds, setUpperBounds] = useState(defaultBrunoBounds.upper.join(", "));
  const [result, setResult] = useState<BrunoResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const parsedPreview = useMemo(() => {
    try {
      const slopeRows = inputMode === "attenuation"
        ? parseAttenuationTable(attenuationText).attenuation.length
        : parseSlopeTable(slopeText).slope.length;
      return { slopeRows, extinctionRows: parseExtinctionTable(extinctionText).length };
    } catch {
      return { slopeRows: 0, extinctionRows: 0 };
    }
  }, [inputMode, slopeText, attenuationText, extinctionText]);

  async function importMatFile(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) return;
    setError(null);
    try {
      const data = brunoMatToInputs(parseMatFile(await file.arrayBuffer()));
      if (data.slope && data.wavelengths) {
        setSlopeText(data.wavelengths.map((wavelength, index) => `${wavelength},${data.slope?.[index] ?? 0}`).join("\n"));
        setInputMode("slope");
      }
      if (data.extinction) {
        setExtinctionText(data.extinction.map((row) => `${row.wavelength},${row.hhb},${row.hbo2},${row.water}`).join("\n"));
      }
      if (data.bounds) {
        setStartBounds(data.bounds.start.join(", "));
        setLowerBounds(data.bounds.lower.join(", "));
        setUpperBounds(data.bounds.upper.join(", "));
      }
      if (data.distances && data.distances.length > 0) {
        setDistance(String(data.distances.reduce((sum, value) => sum + value, 0) / data.distances.length));
        setDistanceMax(String(Math.max(...data.distances)));
      }
    } catch (matError) {
      setError(matError instanceof Error ? matError.message : "MAT import failed.");
    }
  }

  async function importTextFile(fileList: FileList | null, setter: (value: string) => void) {
    const text = await readFirstTextFile(fileList);
    if (text !== null) setter(text);
  }

  function activeSlopeInput() {
    if (inputMode === "attenuation") {
      const attenuationInput = parseAttenuationTable(attenuationText);
      return {
        wavelengths: attenuationInput.wavelengths,
        slope: fitSlopeFromAttenuation(attenuationInput.attenuation, attenuationInput.distances),
      };
    }
    return parseSlopeTable(slopeText);
  }

  function runFit() {
    setError(null);
    try {
      const slopeInput = activeSlopeInput();
      const extinctionByWavelength = new Map(parseExtinctionTable(extinctionText).map((row) => [row.wavelength, row]));
      const alignedExtinction: ExtinctionRow[] = slopeInput.wavelengths.map((wavelength) => {
        const row = extinctionByWavelength.get(wavelength);
        if (!row) throw new Error(`Missing extinction row for wavelength ${wavelength}.`);
        return row;
      });
      const bounds: BrunoFitBounds = {
        start: parseFiveValueVector(startBounds, defaultBrunoBounds.start),
        lower: parseFiveValueVector(lowerBounds, defaultBrunoBounds.lower),
        upper: parseFiveValueVector(upperBounds, defaultBrunoBounds.upper),
      };
      const options: BrunoOptions = {
        boundaryConditions,
        separationMode,
        distance: Number(distance),
        distanceMax: Number(distanceMax),
        waveStart: Number(waveStart),
        waveEnd: Number(waveEnd),
        maxIterations: Math.max(50, Math.floor(Number(maxIterations) || 1200)),
      };
      setResult(runBrunoFit(slopeInput.slope, alignedExtinction, bounds, options));
    } catch (fitError) {
      setResult(null);
      setError(fitError instanceof Error ? fitError.message : "BRUNO fit failed.");
    }
  }

  return (
    <div className="grid gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-4">
        <BrunoInputCard
          inputMode={inputMode}
          setInputMode={setInputMode}
          slopeText={slopeText}
          setSlopeText={setSlopeText}
          attenuationText={attenuationText}
          setAttenuationText={setAttenuationText}
          extinctionText={extinctionText}
          setExtinctionText={setExtinctionText}
          onImportMat={(files) => void importMatFile(files)}
          onImportSlope={(files) => void importTextFile(files, setSlopeText)}
          onImportExtinction={(files) => void importTextFile(files, setExtinctionText)}
        >
          {result && <BrunoFitChart result={result} />}
        </BrunoInputCard>
      </div>

      <div className="space-y-4">
        <BrunoFitSettingsCard
          boundaryConditions={boundaryConditions}
          setBoundaryConditions={setBoundaryConditions}
          separationMode={separationMode}
          setSeparationMode={setSeparationMode}
          distance={distance}
          setDistance={setDistance}
          distanceMax={distanceMax}
          setDistanceMax={setDistanceMax}
          waveStart={waveStart}
          setWaveStart={setWaveStart}
          waveEnd={waveEnd}
          setWaveEnd={setWaveEnd}
          maxIterations={maxIterations}
          setMaxIterations={setMaxIterations}
          startBounds={startBounds}
          setStartBounds={setStartBounds}
          lowerBounds={lowerBounds}
          setLowerBounds={setLowerBounds}
          upperBounds={upperBounds}
          setUpperBounds={setUpperBounds}
          slopeRows={parsedPreview.slopeRows}
          extinctionRows={parsedPreview.extinctionRows}
          error={error}
          onRunFit={runFit}
        />
        <BrunoResultCard result={result} />
      </div>
    </div>
  );
}
