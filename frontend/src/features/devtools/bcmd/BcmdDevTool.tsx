import { useMemo, useState } from "react";
import { Download, FileUp, Play, RefreshCw } from "lucide-react";
import {
  bcmdInputStepSeries,
  buildBcmdGraph,
  compileBcmdRuntimeModel,
  euclideanDistance,
  exportBcmdDependencyDot,
  exportBcmdModeldef,
  exportBcmdInputStepsCsv,
  exportBcmdModelSummaryCsv,
  exportBcmdRuntimeModule,
  exportBcmdSbmlLikeXml,
  exportBcmdTextReport,
  parseBcmdInput,
  parseBcmdJob,
  processBcmdModel,
  simulateOde,
  summarizeBcmdProcessedModel,
  summarizeSensitivity,
  randomSearch,
  type BcmdEquationFilter,
  type BcmdGraphView,
} from "../../../lib/bcmd/index";
import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { Label } from "../../../components/ui/field";
import { downloadText } from "../../../lib/utils";
import { readFirstTextFile } from "../brunoUiUtils";
import { BcmdDependencyGraph } from "./BcmdDependencyGraph";
import { BcmdEquationBrowser } from "./BcmdEquationBrowser";
import { BcmdSeriesChart } from "./BcmdSeriesChart";
import { BcmdBestFitChart, BcmdSensitivityHeatmap } from "./BcmdAnalysisCharts";

const sampleModel = [
  "@input V",
  "@output Vc",
  "## + electrical demo",
  "## ~ volts",
  "Vc' = (V - Vc) / (R * C)",
  "V := 1",
  "Vc := 0",
  "R := 10",
  "C := 0.1",
  "[A] -> [B] {k * A}",
].join("\n");

const sampleInput = ["@ 3", ">>> 3 t V Vc", "!", ": 1 V", "= 0 0 1", "+ 5 0", "+ 5 1"].join("\n");
const sampleJob = ["model: rc", "param: R, uniform, 1, 100", "param: C, uniform, 0.01, 1", "job_mode: fast"].join("\n");

export function BcmdDevTool() {
  const [modelText, setModelText] = useState(sampleModel);
  const [inputText, setInputText] = useState(sampleInput);
  const [jobText, setJobText] = useState(sampleJob);
  const [graphView, setGraphView] = useState<BcmdGraphView>("symbols");
  const [equationFilter, setEquationFilter] = useState<BcmdEquationFilter>("all");
  const [simulationEnd, setSimulationEnd] = useState("5");
  const [simulationStep, setSimulationStep] = useState("0.1");
  const [simulationMethod, setSimulationMethod] = useState<"rk4" | "euler" | "adaptive">("rk4");
  const [parameterText, setParameterText] = useState("");

  const parsed = useMemo(() => {
    try {
      const model = processBcmdModel(modelText);
      const input = parseBcmdInput(inputText);
      const job = parseBcmdJob(jobText, "batch.dsimjob");
      const runtime = compileBcmdRuntimeModel(model);
      const parameterOverrides = Object.fromEntries(parameterText.split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean).flatMap((item) => {
        const [name, value] = item.split(/\s*=\s*/);
        const number = Number(value);
        return name && Number.isFinite(number) ? [[name, number]] : [];
      }));
      const simulation = runtime.roots.length > 0
        ? runtime.simulate({
            start: 0,
            end: Math.max(0.1, Number(simulationEnd) || 5),
            step: Math.max(0.001, Number(simulationStep) || 0.1),
            method: simulationMethod,
            input,
            parameters: parameterOverrides,
          })
        : simulateOde<Record<string, number>, Record<string, number>>({
            initialState: { Vc: 0 },
            parameters: { R: 10, C: 0.1, V: 1 },
            start: 0,
            end: 5,
            step: 0.25,
            derivative: ({ state, parameters }) => ({ Vc: (parameters.V - state.Vc) / (parameters.R * parameters.C) }),
            output: ({ state }) => ({ Vc: state.Vc }),
          });
      const inputSeries = bcmdInputStepSeries(input);
      const simulationSeries = runtime.roots.map((name) => ({
        name,
        points: simulation.map((point) => ({ time: point.t, value: point.state[name] ?? 0 })),
      }));
      const sensitivity = summarizeSensitivity(
        ({ R, C }) => 1 / (R * C),
        [
          { name: "R", min: 1, max: 100, distribution: { type: "uniform", min: 1, max: 100 } },
          { name: "C", min: 0.01, max: 1, distribution: { type: "uniform", min: 0.01, max: 1 } },
        ],
        { samples: 40, seed: 4 },
      );
      const fit = randomSearch(({ R }) => euclideanDistance([R], [10]), [{ name: "R", min: 1, max: 100 }], {
        iterations: 60,
        seed: 8,
      });
      return { model, input, job, runtime, simulation, inputSeries, simulationSeries, sensitivity, fit, parameterOverrides, error: null };
    } catch (parseError) {
      return {
        model: null,
        input: null,
        job: null,
        runtime: null,
        simulation: [],
        inputSeries: [],
        simulationSeries: [],
        sensitivity: [],
        fit: null,
        parameterOverrides: {},
        error: parseError instanceof Error ? parseError.message : "BCMD parse failed.",
      };
    }
  }, [modelText, inputText, jobText, simulationEnd, simulationStep, simulationMethod, parameterText]);

  async function importText(files: FileList | null, setter: (value: string) => void) {
    const text = await readFirstTextFile(files);
    if (text !== null) setter(text);
  }

  const summary = parsed.model ? summarizeBcmdProcessedModel(parsed.model) : null;
  const finalSimulation = parsed?.simulation.at(-1);
  const graph = parsed.model ? buildBcmdGraph(parsed.model, graphView) : { nodes: [], edges: [] };

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>BCMD model</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-800 hover:bg-slate-50">
                <FileUp size={15} /> Model
                <input className="hidden" type="file" accept=".modeldef,.txt" onChange={(event) => void importText(event.target.files, setModelText)} />
              </label>
              <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-800 hover:bg-slate-50">
                <FileUp size={15} /> Input
                <input className="hidden" type="file" accept=".input,.txt" onChange={(event) => void importText(event.target.files, setInputText)} />
              </label>
              <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-800 hover:bg-slate-50">
                <FileUp size={15} /> Job
                <input className="hidden" type="file" accept=".dsimjob,.optjob,.abcjob,.txt" onChange={(event) => void importText(event.target.files, setJobText)} />
              </label>
              <Button type="button" size="sm" onClick={() => { setModelText(sampleModel); setInputText(sampleInput); setJobText(sampleJob); }}>
                <RefreshCw size={15} /> Reset
              </Button>
            </div>
            <Label htmlFor="bcmd-model-text">Model definition</Label>
            <textarea
              id="bcmd-model-text"
              className="min-h-64 w-full rounded-md border border-slate-200 p-3 font-mono text-xs outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
              value={modelText}
              onChange={(event) => setModelText(event.target.value)}
            />
          </CardContent>
        </Card>

        {parsed.model && (
          <Card>
            <CardHeader>
              <CardTitle>Dependency graph</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {(["symbols", "equations", "reactions", "io"] as BcmdGraphView[]).map((view) => (
                  <button
                    key={view}
                    type="button"
                    className={`rounded-md border px-2 py-1 text-xs ${graphView === view ? "border-teal-700 bg-teal-700 text-white" : "border-slate-200 bg-white text-slate-700"}`}
                    onClick={() => setGraphView(view)}
                  >
                    {view}
                  </button>
                ))}
              </div>
              <BcmdDependencyGraph nodes={graph.nodes} edges={graph.edges} />
            </CardContent>
          </Card>
        )}

        {parsed.model && (
          <Card>
            <CardHeader>
              <CardTitle>Equation browser</CardTitle>
            </CardHeader>
            <CardContent>
              <BcmdEquationBrowser model={parsed.model} filter={equationFilter} onFilterChange={setEquationFilter} />
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>BCMD input and job</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            <div>
              <Label htmlFor="bcmd-input-text">Input steps</Label>
              <textarea
                id="bcmd-input-text"
                className="mt-1 min-h-48 w-full rounded-md border border-slate-200 p-3 font-mono text-xs outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                value={inputText}
                onChange={(event) => setInputText(event.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="bcmd-job-text">Job config</Label>
              <textarea
                id="bcmd-job-text"
                className="mt-1 min-h-48 w-full rounded-md border border-slate-200 p-3 font-mono text-xs outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                value={jobText}
                onChange={(event) => setJobText(event.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {parsed.inputSeries.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Input step chart</CardTitle>
            </CardHeader>
            <CardContent>
              <BcmdSeriesChart series={parsed.inputSeries} />
            </CardContent>
          </Card>
        )}
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {parsed.error && <div className="rounded-md border border-rose-200 bg-rose-50 p-2 text-rose-700">{parsed.error}</div>}
            {summary && (
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(summary).map(([key, value]) => (
                  <div key={key} className="rounded-md border border-slate-200 p-2">
                    <div className="text-xs capitalize text-slate-500">{key}</div>
                    <div className="font-semibold">{value}</div>
                  </div>
                ))}
              </div>
            )}
            {parsed.job && parsed.input && (
              <>
                <div className="rounded-md border border-slate-200 p-2">
                  <div className="text-xs text-slate-500">Job entries</div>
                  <div className="font-semibold">{parsed.job.entries.length}</div>
                </div>
                <div className="rounded-md border border-slate-200 p-2">
                  <div className="text-xs text-slate-500">Input steps</div>
                  <div className="font-semibold">{parsed.input.steps.length}</div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Client-side run</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <label className="space-y-1">
                <span className="text-xs font-medium text-slate-600">End</span>
                <input className="h-9 w-full rounded-md border border-slate-200 px-2 text-sm" value={simulationEnd} onChange={(event) => setSimulationEnd(event.target.value)} />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-slate-600">Step</span>
                <input className="h-9 w-full rounded-md border border-slate-200 px-2 text-sm" value={simulationStep} onChange={(event) => setSimulationStep(event.target.value)} />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-slate-600">Method</span>
                <select className="h-9 w-full rounded-md border border-slate-200 px-2 text-sm" value={simulationMethod} onChange={(event) => setSimulationMethod(event.target.value as typeof simulationMethod)}>
                  <option value="rk4">RK4</option>
                  <option value="euler">Euler</option>
                  <option value="adaptive">Adaptive RK4</option>
                </select>
              </label>
            </div>
            <label className="space-y-1">
              <span className="text-xs font-medium text-slate-600">Parameter overrides</span>
              <textarea className="min-h-20 w-full rounded-md border border-slate-200 p-2 font-mono text-xs" placeholder="R=10, C=0.1" value={parameterText} onChange={(event) => setParameterText(event.target.value)} />
            </label>
            <div className="flex items-center gap-2 text-slate-700">
              <Play size={15} /> RK4 final state: <span className="font-semibold">{finalSimulation ? Object.entries(finalSimulation.state).map(([key, value]) => `${key}=${value.toFixed(4)}`).join(", ") : "none"}</span>
            </div>
            {parsed.runtime?.diagnostics.length ? (
              <div className="rounded border border-amber-200 bg-amber-50 p-2 text-amber-800">{parsed.runtime.diagnostics.join("; ")}</div>
            ) : null}
            {parsed.simulationSeries.length > 0 && <BcmdSeriesChart series={parsed.simulationSeries} height={190} />}
            <div className="text-slate-600">Best R from random search: {parsed.fit?.best.R.toFixed(3) ?? "0.000"}</div>
            {parsed.fit && <BcmdBestFitChart result={parsed.fit} />}
            {parsed.sensitivity.length > 0 && <BcmdSensitivityHeatmap sensitivity={parsed.sensitivity} />}
            <div className="space-y-1">
              {parsed?.sensitivity.map((item) => (
                <div key={item.name} className="flex justify-between rounded border border-slate-200 px-2 py-1">
                  <span>{item.name}</span>
                  <span>{item.effectAbsMean.toFixed(3)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Exports</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
              <Button type="button" disabled={!parsed.model} onClick={() => parsed.model && downloadText("bcmd-symbols.csv", exportBcmdModelSummaryCsv(parsed.model))}>
              <Download size={15} /> Symbols CSV
            </Button>
            <Button type="button" disabled={!parsed.input} onClick={() => parsed.input && downloadText("bcmd-input.csv", exportBcmdInputStepsCsv(parsed.input.steps))}>
              <Download size={15} /> Input CSV
            </Button>
            <Button type="button" disabled={!parsed.model} onClick={() => parsed.model && downloadText("bcmd-dependencies.dot", exportBcmdDependencyDot(parsed.model))}>
              <Download size={15} /> Dependency DOT
            </Button>
            <Button type="button" disabled={!parsed.model} onClick={() => parsed.model && downloadText("bcmd-report.txt", exportBcmdTextReport(parsed.model))}>
              <Download size={15} /> Text report
            </Button>
            <Button type="button" disabled={!parsed.model} onClick={() => parsed.model && downloadText("bcmd.sbml.xml", exportBcmdSbmlLikeXml(parsed.model))}>
              <Download size={15} /> SBML-ish XML
            </Button>
            <Button type="button" disabled={!parsed.model} onClick={() => parsed.model && downloadText("model.modeldef", exportBcmdModeldef(parsed.model))}>
              <Download size={15} /> Modeldef
            </Button>
            <Button type="button" disabled={!parsed.model} onClick={() => parsed.model && downloadText("bcmd-runtime.ts", exportBcmdRuntimeModule(parsed.model))}>
              <Download size={15} /> Runtime TS
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
