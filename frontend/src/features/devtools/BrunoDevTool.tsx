import { useMemo, useState } from "react";
import { Calculator, Download, Play, Upload } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Input, Label, Select } from "../../components/ui/field";
import {
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
import { downloadText, formatNumber } from "../../lib/utils";

const defaultBounds: BrunoFitBounds = {
  start: [0.75, 0.01, 0.04, 1, 1],
  lower: [0, 0, 0, 0.01, 0],
  upper: [1, 1, 1, 10, 4],
};

const sampleSlope = Array.from({ length: 191 }, (_, index) => {
  const wavelength = 710 + index;
  const slope = 0.09 + 0.00022 * (wavelength - 710) + 0.003 * Math.sin(index / 18);
  return `${wavelength},${slope.toFixed(8)}`;
}).join("\n");

const sampleExtinction = Array.from({ length: 191 }, (_, index) => {
  const wavelength = 710 + index;
  const hhb = 0.0015 + 0.0009 * Math.exp(-(((wavelength - 760) / 18) ** 2));
  const hbo2 = 0.0012 + 0.0007 * Math.exp(-(((wavelength - 850) / 32) ** 2));
  const water = 0.0002 + 0.00035 * Math.exp(-(((wavelength - 835) / 22) ** 2));
  return `${wavelength},${hhb.toExponential(8)},${hbo2.toExponential(8)},${water.toExponential(8)}`;
}).join("\n");

function parseVector(value: string, fallback: [number, number, number, number, number]) {
  const parsed = value.split(/[,\s]+/).map(Number).filter(Number.isFinite);
  return parsed.length === 5 ? parsed as [number, number, number, number, number] : fallback;
}

function resultCsv(result: BrunoResult) {
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

async function readFirstFile(fileList: FileList | null, setter: (value: string) => void) {
  const file = fileList?.[0];
  if (!file) return;
  setter(await file.text());
}

export function BrunoDevTool() {
  const [slopeText, setSlopeText] = useState(sampleSlope);
  const [extinctionText, setExtinctionText] = useState(sampleExtinction);
  const [boundaryConditions, setBoundaryConditions] = useState<BrunoBoundaryConditions>("ZBC");
  const [separationMode, setSeparationMode] = useState<BrunoSeparationMode>("close");
  const [distance, setDistance] = useState("22.5");
  const [distanceMax, setDistanceMax] = useState("30");
  const [waveStart, setWaveStart] = useState("710");
  const [waveEnd, setWaveEnd] = useState("900");
  const [maxIterations, setMaxIterations] = useState("1200");
  const [startBounds, setStartBounds] = useState(defaultBounds.start.join(", "));
  const [lowerBounds, setLowerBounds] = useState(defaultBounds.lower.join(", "));
  const [upperBounds, setUpperBounds] = useState(defaultBounds.upper.join(", "));
  const [result, setResult] = useState<BrunoResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const parsedPreview = useMemo(() => {
    try {
      const slope = parseSlopeTable(slopeText);
      const extinction = parseExtinctionTable(extinctionText);
      return { slopeRows: slope.slope.length, extinctionRows: extinction.length };
    } catch {
      return { slopeRows: 0, extinctionRows: 0 };
    }
  }, [slopeText, extinctionText]);

  function runFit() {
    setError(null);
    try {
      const slopeInput = parseSlopeTable(slopeText);
      const extinction = parseExtinctionTable(extinctionText);
      const extinctionByWavelength = new Map(extinction.map((row) => [row.wavelength, row]));
      const alignedExtinction: ExtinctionRow[] = slopeInput.wavelengths.map((wavelength) => {
        const row = extinctionByWavelength.get(wavelength);
        if (!row) throw new Error(`Missing extinction row for wavelength ${wavelength}.`);
        return row;
      });
      const bounds: BrunoFitBounds = {
        start: parseVector(startBounds, defaultBounds.start),
        lower: parseVector(lowerBounds, defaultBounds.lower),
        upper: parseVector(upperBounds, defaultBounds.upper),
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
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle>BRUNO Input Tables</CardTitle>
            <div className="flex gap-2">
              <label className="inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-800 hover:bg-slate-50">
                <Upload size={15} /> Slope
                <input className="hidden" type="file" accept=".csv,.txt,.tsv" onChange={(event) => void readFirstFile(event.target.files, setSlopeText)} />
              </label>
              <label className="inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-800 hover:bg-slate-50">
                <Upload size={15} /> Extinction
                <input className="hidden" type="file" accept=".csv,.txt,.tsv" onChange={(event) => void readFirstFile(event.target.files, setExtinctionText)} />
              </label>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-2">
            <label className="space-y-2">
              <Label>Slope table: wavelength, slope</Label>
              <textarea className="min-h-96 w-full rounded-md border border-slate-200 p-3 font-mono text-xs outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100" value={slopeText} onChange={(event) => setSlopeText(event.target.value)} />
            </label>
            <label className="space-y-2">
              <Label>Extinction table: wavelength, HHb, HbO2, water</Label>
              <textarea className="min-h-96 w-full rounded-md border border-slate-200 p-3 font-mono text-xs outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100" value={extinctionText} onChange={(event) => setExtinctionText(event.target.value)} />
            </label>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Fit Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-1">
                <Label>Boundary</Label>
                <Select value={boundaryConditions} onChange={(event) => setBoundaryConditions(event.target.value as BrunoBoundaryConditions)}>
                  <option value="ZBC">ZBC</option>
                  <option value="EBC">EBC</option>
                </Select>
              </label>
              <label className="space-y-1">
                <Label>Separation</Label>
                <Select value={separationMode} onChange={(event) => setSeparationMode(event.target.value as BrunoSeparationMode)}>
                  <option value="close">Close</option>
                  <option value="far">Far</option>
                </Select>
              </label>
              <label className="space-y-1">
                <Label>Distance</Label>
                <Input value={distance} onChange={(event) => setDistance(event.target.value)} />
              </label>
              <label className="space-y-1">
                <Label>Max distance</Label>
                <Input value={distanceMax} onChange={(event) => setDistanceMax(event.target.value)} disabled={separationMode === "close"} />
              </label>
              <label className="space-y-1">
                <Label>Wave start</Label>
                <Input value={waveStart} onChange={(event) => setWaveStart(event.target.value)} />
              </label>
              <label className="space-y-1">
                <Label>Wave end</Label>
                <Input value={waveEnd} onChange={(event) => setWaveEnd(event.target.value)} />
              </label>
            </div>
            <label className="space-y-1">
              <Label>Start: water, HHb, HbO2, a, b</Label>
              <Input value={startBounds} onChange={(event) => setStartBounds(event.target.value)} />
            </label>
            <label className="space-y-1">
              <Label>Lower bounds</Label>
              <Input value={lowerBounds} onChange={(event) => setLowerBounds(event.target.value)} />
            </label>
            <label className="space-y-1">
              <Label>Upper bounds</Label>
              <Input value={upperBounds} onChange={(event) => setUpperBounds(event.target.value)} />
            </label>
            <label className="space-y-1">
              <Label>Max iterations</Label>
              <Input value={maxIterations} onChange={(event) => setMaxIterations(event.target.value)} />
            </label>
            <div className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">
              Parsed {parsedPreview.slopeRows} slope rows and {parsedPreview.extinctionRows} extinction rows.
            </div>
            {error && <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}
            <Button className="w-full" variant="primary" onClick={runFit}>
              <Play size={16} /> Run BRUNO Fit
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Result</CardTitle>
            <Calculator size={16} className="text-slate-500" />
          </CardHeader>
          <CardContent className="space-y-3">
            {result ? (
              <>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-md bg-teal-50 p-3">
                    <div className="text-xs text-teal-700">StO2</div>
                    <div className="text-xl font-semibold text-teal-900">{formatNumber(result.sto2)}%</div>
                  </div>
                  <div className="rounded-md bg-slate-50 p-3">
                    <div className="text-xs text-slate-500">Score</div>
                    <div className="text-xl font-semibold">{result.score.toExponential(3)}</div>
                  </div>
                </div>
                <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                  {Object.entries(result.coefficients).map(([key, value]) => (
                    <div key={key} className="border-b border-slate-100 pb-1">
                      <dt className="text-xs text-slate-500">{key}</dt>
                      <dd className="font-mono">{Number(value).toPrecision(6)}</dd>
                    </div>
                  ))}
                  <div className="border-b border-slate-100 pb-1">
                    <dt className="text-xs text-slate-500">sumResidual</dt>
                    <dd className="font-mono">{result.sumResidual.toExponential(4)}</dd>
                  </div>
                  <div className="border-b border-slate-100 pb-1">
                    <dt className="text-xs text-slate-500">sumNormResidual</dt>
                    <dd className="font-mono">{result.sumNormalizedResidual.toExponential(4)}</dd>
                  </div>
                </dl>
                <Button className="w-full" onClick={() => downloadText("bruno-fit-result.csv", resultCsv(result))}>
                  <Download size={16} /> Export result CSV
                </Button>
              </>
            ) : (
              <p className="text-sm text-slate-500">Run a fit to calculate StO2, coefficients, residuals, and score.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
