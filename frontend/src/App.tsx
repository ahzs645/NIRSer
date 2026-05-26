import { useEffect, useMemo, useRef, useState } from "react";
import { AppShell, type AppView } from "./components/layout/AppShell";
import { VisualizerPanel } from "./features/visualizer/VisualizerPanel";
import { MainChartsStack } from "./features/charts/MainChartsStack";
import type { SeriesOverlay } from "./components/charts/NirsChart";
import { ChartControlsCard } from "./features/controls/ChartControlsCard";
import { DeviceCard } from "./features/acquisition/DeviceCard";
import { ExtraDevicePanel } from "./features/acquisition/ExtraDevicePanel";
import { MarksCard } from "./features/analysis/MarksCard";
import { SectionsCard } from "./features/analysis/SectionsCard";
import { AnalysisFilterCard, type FilterOptions } from "./features/analysis/AnalysisFilterCard";
import { ActiveSectionStatsCard } from "./features/analysis/ActiveSectionStatsCard";
import { calculateStats } from "./lib/analysis";
import {
  clearAutosaveSnapshot as clearStoredAutosaveSnapshot,
  createAutosaveSnapshot,
  getAutosaveStorage,
  loadAutosaveSnapshot,
  saveAutosaveSnapshot,
} from "./lib/autosave";
import { defaultSections, defaultSettings, normalizeSettings } from "./lib/defaults";
import { sampleByDisplayRate } from "./lib/displaySampling";
import {
  exportCalculatedValuesCsv,
  exportLoadCellCsv,
  exportHbValuesCsv,
  exportMarks,
  exportRawNirsCsv,
  exportSectionStatsWithFilterCsv,
  exportSections,
  exportSerialEventsCsv,
  exportSourceValuesCsv,
} from "./lib/exporters";
import { packetsFromNumbers } from "./lib/formulas";
import {
  importLegacyTextMarks,
  importCalculatedValuesCsv,
  importLoadCellCsv,
  importMarksText,
  importNirsText,
  importNirsTextRows,
  importSectionsText,
  importSerialEventsCsv,
  sidecarStem,
} from "./lib/importers";
import { BrowserLoadCellSerial, BrowserSerialAcquisition, supportsWebSerial } from "./lib/serial";
import { applyFilterPasses, buildSamples } from "./lib/samples";
import { bundleFiles, createSessionBundle, parseSessionBundle, serializeSessionBundle } from "./lib/sessionBundle";
import { legacySessionFilenames, sanitizeSessionBaseName } from "./lib/sessionFiles";
import { createDemoLoadCell, createDemoPackets } from "./lib/simulator";
import { downloadText, formatNumber, parseCsvNumbers } from "./lib/utils";
import { builtInVisualizerProfile, parseVisualizerProfile, visualizerProfileToChannels } from "./lib/visualizerProfile";
import type { CalculatedValuesSnapshot, ChannelStats, NirsPacket, Point, ProcessedNirsSample, Section, SerialEvent } from "./types/nirs";

type ChartDomain = [number, number] | ["auto", "auto"];
const SETTINGS_STORAGE_KEY = "nirser-web-settings";
const LEGACY_SIDECAR_PATTERN = /(LoadCellCommunicator|Marks|Sections|Settings|CalculatedValues|SerialLog)\./i;

function parseDomain(lowerValue: string, upperValue: string): ChartDomain {
  const lower = Number(lowerValue);
  const upper = Number(upperValue);
  return Number.isFinite(lower) && Number.isFinite(upper) && lower < upper ? [lower, upper] : ["auto", "auto"];
}

export default function App() {
  const [settings, setSettings] = useState(() => {
    try {
      const stored = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
      return stored ? normalizeSettings(JSON.parse(stored)) : defaultSettings;
    } catch {
      return defaultSettings;
    }
  });
  const [packets, setPackets] = useState<NirsPacket[]>(() => createDemoPackets());
  const [importedSamples, setImportedSamples] = useState<ProcessedNirsSample[] | null>(null);
  const [loadCell, setLoadCell] = useState<Point[]>(() => createDemoLoadCell(900, defaultSettings.loadCellTimePerPacket));
  const [marks, setMarks] = useState<number[]>([5, 12, 20]);
  const [sections, setSections] = useState(defaultSections);
  const [activeSectionId, setActiveSectionId] = useState(sections[0]?.id ?? "");
  const [sectionDraft, setSectionDraft] = useState({ name: "", initialTime: "0", endTime: "5" });
  const [view, setView] = useState<AppView>("acquisition");
  const [running, setRunning] = useState(false);
  const [shownSamples, setShownSamples] = useState(240);
  const [maxTimeDraft, setMaxTimeDraft] = useState("30.0");
  const [sessionBaseName, setSessionBaseName] = useState("nirs-data");
  const [biasIndex, setBiasIndex] = useState<number | null>(null);
  const [seriesVisible, setSeriesVisible] = useState(() => ({ o2hb: true, hhb: true, thb: true, hbdiff: true, toi: settings.useToi }));
  const [panesVisible, setPanesVisible] = useState({ channel1: true, channel2: true, loadCell: true });
  const [autoScaleY, setAutoScaleY] = useState(true);
  const [bounds, setBounds] = useState({
    channel1LowerX: "0",
    channel1UpperX: "30",
    channel1Lower: "-15",
    channel1Upper: "15",
    channel2LowerX: "0",
    channel2UpperX: "30",
    channel2Lower: "-15",
    channel2Upper: "15",
  });
  const [boundsDraft, setBoundsDraft] = useState(bounds);
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    method: "butterworth",
    order: "4",
    cutoff: "0.02",
    passes: 0,
  });
  const [calculatedValues, setCalculatedValues] = useState<CalculatedValuesSnapshot[]>([]);
  const [serialStatus, setSerialStatus] = useState("Disconnected");
  const [serialPortLabel, setSerialPortLabel] = useState("None");
  const [serialConnected, setSerialConnected] = useState(false);
  const [serialEvents, setSerialEvents] = useState<SerialEvent[]>([]);
  const [loadCellStatus, setLoadCellStatus] = useState("Disconnected");
  const [realTimeSave, setRealTimeSave] = useState(false);
  const [dirty, setDirty] = useState(false);
  const dirtyInitRef = useRef(true);
  const [autosaveSnapshotVersion, setAutosaveSnapshotVersion] = useState(0);
  const [coordinate, setCoordinate] = useState<{ chart: string; x: number; y: number } | null>(null);
  const [markDraft, setMarkDraft] = useState("");
  const [extraDeviceEnabled, setExtraDeviceEnabled] = useState(false);
  const [extraDeviceStatus, setExtraDeviceStatus] = useState("Disconnected");
  const [extraDevicePort, setExtraDevicePort] = useState("None");
  const [extraDevicePackets, setExtraDevicePackets] = useState<NirsPacket[]>([]);
  const [extraDeviceRealTimeSave, setExtraDeviceRealTimeSave] = useState(false);
  const [contractionType, setContractionType] = useState<"forearm" | "neck">("forearm");
  const [visualizerMode, setVisualizerMode] = useState<"realtime" | "full">("full");
  const [visualizerRunning, setVisualizerRunning] = useState(false);
  const [visualizerProfile, setVisualizerProfile] = useState<number[] | null>(() => builtInVisualizerProfile("forearm"));
  const [visualizerProfileName, setVisualizerProfileName] = useState("forearm.csv");
  const [visualizerFrame, setVisualizerFrame] = useState(0);
  const timerRef = useRef<number | null>(null);
  const visualizerTimerRef = useRef<number | null>(null);
  const serialRef = useRef<BrowserSerialAcquisition | null>(null);
  const extraSerialRef = useRef<BrowserSerialAcquisition | null>(null);
  const loadCellSerialRef = useRef<BrowserLoadCellSerial | null>(null);
  const shortcutsRef = useRef<{ save: () => void; addMark: () => void }>({ save: () => {}, addMark: () => {} });

  const samples = useMemo(() => {
    const baseSamples = importedSamples ?? buildSamples(packets, settings);
    if (biasIndex === null || !baseSamples[biasIndex]) return baseSamples;
    const bias = baseSamples[biasIndex];
    return baseSamples.map((sample) => ({
      ...sample,
      channel1: {
        ...sample.channel1,
        o2hb: sample.channel1.o2hb - bias.channel1.o2hb,
        hhb: sample.channel1.hhb - bias.channel1.hhb,
        thb: sample.channel1.thb - bias.channel1.thb,
        hbdiff: sample.channel1.hbdiff - bias.channel1.hbdiff,
      },
      channel2: {
        ...sample.channel2,
        o2hb: sample.channel2.o2hb - bias.channel2.o2hb,
        hhb: sample.channel2.hhb - bias.channel2.hhb,
        thb: sample.channel2.thb - bias.channel2.thb,
        hbdiff: sample.channel2.hbdiff - bias.channel2.hbdiff,
      },
    }));
  }, [packets, settings, biasIndex, importedSamples]);
  const activeSection = sections.find((section) => section.id === activeSectionId) ?? sections[0];
  const filterOrder = Math.max(1, Math.floor(Number(filterOptions.order) || 1));
  const filterCutoff = Number(filterOptions.cutoff) || 0.02;
  const analysisSamples = useMemo(() => {
    if (filterOptions.passes <= 0) return samples;
    const filteredChannel1 = applyFilterPasses(
      samples.map((sample) => sample.channel1),
      filterOptions.passes,
      filterOrder,
      filterCutoff,
      filterOptions.method,
    );
    const filteredChannel2 = applyFilterPasses(
      samples.map((sample) => sample.channel2),
      filterOptions.passes,
      filterOrder,
      filterCutoff,
      filterOptions.method,
    );
    return samples.map((sample, index) => ({
      ...sample,
      channel1: filteredChannel1[index],
      channel2: filteredChannel2[index],
    }));
  }, [samples, filterOptions.passes, filterOptions.method, filterOrder, filterCutoff]);
  const stats = useMemo(
    () => calculateStats(analysisSamples, loadCell, activeSection?.initialTime ?? 0, activeSection?.endTime ?? Number.POSITIVE_INFINITY),
    [analysisSamples, loadCell, activeSection],
  );
  const plottedSamples = sampleByDisplayRate(samples, settings.nirsFrameRate);
  const plottedAnalysisSamples = sampleByDisplayRate(analysisSamples, settings.nirsFrameRate);
  const visibleSamples = plottedSamples.slice(0, shownSamples);
  const visibleAnalysisSamples = plottedAnalysisSamples.slice(0, shownSamples);
  const displayedSamples = view === "analysis" ? visibleAnalysisSamples : visibleSamples;
  const visualizerChannels = useMemo(
    () => (visualizerProfile ? visualizerProfileToChannels(visualizerProfile) : null),
    [visualizerProfile],
  );
  const channel1 =
    view === "visualizer" && visualizerMode === "full" && visualizerChannels
      ? visualizerChannels.channel1.slice(0, visualizerFrame + 1)
      : displayedSamples.map((sample) => sample.channel1);
  const channel2 =
    view === "visualizer" && visualizerMode === "full" && visualizerChannels
      ? visualizerChannels.channel2.slice(0, visualizerFrame + 1)
      : displayedSamples.map((sample) => sample.channel2);
  const visibleLoadCell = sampleByDisplayRate(loadCell, settings.loadCellFrameRate).slice(0, shownSamples);
  const channel1XDomain = parseDomain(bounds.channel1LowerX, bounds.channel1UpperX);
  const channel2XDomain = parseDomain(bounds.channel2LowerX, bounds.channel2UpperX);
  const channel1Domain: [number, number] | ["auto", "auto"] = autoScaleY
    ? ["auto", "auto"]
    : parseDomain(bounds.channel1Lower, bounds.channel1Upper);
  const channel2Domain: [number, number] | ["auto", "auto"] = autoScaleY
    ? ["auto", "auto"]
    : parseDomain(bounds.channel2Lower, bounds.channel2Upper);
  const loadCellDomain: [number, number] = view === "analysis" ? [-15, 15] : [-2, 2];
  // Analysis view draws min/max markers + a regression line on each chart, over the active section window.
  const analysisOverlayWindow: [number, number] | undefined =
    view === "analysis" && activeSection ? [activeSection.initialTime, activeSection.endTime] : undefined;
  const buildSeriesOverlays = (channel: ChannelStats): SeriesOverlay[] =>
    (["o2hb", "hhb", "thb", "hbdiff", "toi"] as const)
      .filter((key) => seriesVisible[key])
      .map((key) => ({ key, min: channel[key].min, max: channel[key].max, slope: channel[key].slope, intercept: channel[key].intercept }));
  const channel1Overlays = view === "analysis" ? buildSeriesOverlays(stats.channel1) : undefined;
  const channel2Overlays = view === "analysis" ? buildSeriesOverlays(stats.channel2) : undefined;
  const loadCellOverlay =
    view === "analysis"
      ? { min: stats.loadCell.min, max: stats.loadCell.max, slope: stats.loadCell.slope, intercept: stats.loadCell.intercept }
      : undefined;
  const extraDeviceSamples = useMemo(
    () => buildSamples(extraDevicePackets, { ...settings, deviceKind: "pathonix" }),
    [extraDevicePackets, settings],
  );
  const extraDeviceVisibleSamples = extraDeviceSamples.slice(0, shownSamples);
  const extraDeviceChannel1 = extraDeviceVisibleSamples.map((sample) => sample.channel1);
  const extraDeviceChannel2 = extraDeviceVisibleSamples.map((sample) => sample.channel2);
  const autosaveStorageAvailable = getAutosaveStorage() !== null;
  const storedAutosaveSnapshot = autosaveSnapshotVersion >= 0 ? loadAutosaveSnapshot() : null;
  const hasAutosaveSnapshot = autosaveStorageAvailable && (realTimeSave || storedAutosaveSnapshot !== null);
  const sectionDraftInitialTime = Number(sectionDraft.initialTime);
  const sectionDraftEndTime = Number(sectionDraft.endTime);
  const sectionDraftValid =
    sectionDraft.name.trim().length > 0 &&
    Number.isFinite(sectionDraftInitialTime) &&
    Number.isFinite(sectionDraftEndTime) &&
    sectionDraftEndTime > sectionDraftInitialTime;

  function logSerialEvent(source: SerialEvent["source"], event: string, detail: string) {
    setSerialEvents((items) => [
      { timestamp: new Date().toISOString(), source, event, detail },
      ...items,
    ].slice(0, 500));
  }

  function applySections(nextSections: Section[]) {
    setSections(nextSections);
    const nextSection = nextSections[0];
    setActiveSectionId(nextSection?.id ?? "");
    setSectionDraft(
      nextSection
        ? { name: nextSection.name, initialTime: String(nextSection.initialTime), endTime: String(nextSection.endTime) }
        : { name: "", initialTime: "0", endTime: "5" },
    );
  }

  function resetInteractionState() {
    setBiasIndex(null);
    setMarkDraft("");
    setCoordinate(null);
  }

  function applyChannelBounds(channel: "channel1" | "channel2") {
    setBounds((items) => ({
      ...items,
      [`${channel}LowerX`]: boundsDraft[`${channel}LowerX`],
      [`${channel}UpperX`]: boundsDraft[`${channel}UpperX`],
      [`${channel}Lower`]: boundsDraft[`${channel}Lower`],
      [`${channel}Upper`]: boundsDraft[`${channel}Upper`],
    }));
  }

  useEffect(() => {
    try {
      window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    } catch (error) {
      console.error("Settings persistence failed", error);
    }
  }, [settings]);

  useEffect(() => {
    if (!realTimeSave) return;
    try {
      const snapshot = createAutosaveSnapshot({
        samples,
        loadCell,
        marks,
        sections,
        preferSourceValues: Boolean(importedSamples),
        sessionBaseName,
        settings,
        calculatedValues,
        serialEvents,
      });
      saveAutosaveSnapshot(snapshot);
    } catch (error) {
      console.error("Real-time autosave failed", error);
    }
  }, [realTimeSave, samples, loadCell, marks, sections, importedSamples, sessionBaseName, settings, calculatedValues, serialEvents]);

  // Track unsaved work: any change to acquired/edited data marks the session dirty.
  // The very first run (initial demo) and resetDemo are treated as clean.
  useEffect(() => {
    if (dirtyInitRef.current) {
      dirtyInitRef.current = false;
      return;
    }
    setDirty(true);
  }, [packets, importedSamples, loadCell, marks, sections, calculatedValues]);

  // Warn before leaving with unsaved work (real-time save mode keeps data persisted, so it is exempt).
  useEffect(() => {
    if (!dirty || realTimeSave) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty, realTimeSave]);

  // Keyboard accelerators (parity with the JavaFX Ctrl shortcuts). Bound once; calls the latest handlers via a ref.
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
      const key = event.key.toLowerCase();
      if (key === "s") {
        event.preventDefault();
        shortcutsRef.current.save();
      } else if (key === "m") {
        event.preventDefault();
        shortcutsRef.current.addMark();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Keep accelerator actions current without re-binding the keydown listener each render.
  useEffect(() => {
    shortcutsRef.current = {
      save: () => (view === "analysis" ? exportSessionBundle() : exportAll()),
      addMark: () => (view === "acquisition" ? addCurrentMark() : addAnalysisMark()),
    };
  });

  function startSimulator() {
    if (timerRef.current) window.clearInterval(timerRef.current);
    setRunning(true);
    timerRef.current = window.setInterval(() => {
      setShownSamples((value) => (value >= samples.length ? samples.length : value + 2));
    }, 80);
  }

  function stopSimulator() {
    setRunning(false);
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
    if (realTimeSave) exportAll();
  }

  function startAcquisition() {
    if (serialConnected) {
      void startSerial();
      return;
    }
    startSimulator();
  }

  async function stopAcquisition() {
    stopSimulator();
    await loadCellSerialRef.current?.disconnect().catch(() => undefined);
    loadCellSerialRef.current = null;
    if (!serialRef.current) {
      setLoadCellStatus("Disconnected");
      return;
    }
    await serialRef.current.stop().catch(() => undefined);
    if (serialConnected) setSerialStatus(`Stopped (${settings.deviceKind})`);
    setLoadCellStatus("Disconnected");
  }

  function pauseAcquisition() {
    stopSimulator();
    void serialRef.current?.stop();
    void loadCellSerialRef.current?.disconnect();
    loadCellSerialRef.current = null;
    if (serialConnected) setSerialStatus(`Paused (${settings.deviceKind})`);
    setLoadCellStatus("Disconnected");
  }

  async function connectSerial() {
    try {
      const bridge = new BrowserSerialAcquisition(
        settings.deviceKind,
        settings.loadCellTimePerPacket,
        (packet, loadCellPoint) => {
          setPackets((items) => [...items, packet]);
          setImportedSamples(null);
          if (loadCellPoint) setLoadCell((items) => [...items, loadCellPoint]);
          setShownSamples((value) => value + 1);
          logSerialEvent("nirs", "packet", packet.join(" "));
          if (loadCellPoint) logSerialEvent("nirs", "load-cell", `${loadCellPoint.time},${loadCellPoint.value}`);
        },
        (error) => {
          setSerialStatus(`Read error: ${error.message}`);
          logSerialEvent("nirs", "error", error.message);
          setRunning(false);
        },
      );
      await bridge.connect();
      serialRef.current = bridge;
      setSerialConnected(true);
      setSerialPortLabel(bridge.getPortLabel());
      setSerialStatus(`Connected (${settings.deviceKind})`);
      logSerialEvent("nirs", "connected", `${settings.deviceKind} ${bridge.getPortLabel()}`);
    } catch (error) {
      setSerialStatus(error instanceof Error ? error.message : "Connection failed");
      logSerialEvent("nirs", "error", error instanceof Error ? error.message : "Connection failed");
    }
  }

  async function startSerial() {
    try {
      await serialRef.current?.start();
      setRunning(true);
      setSerialStatus(`Streaming (${settings.deviceKind})`);
      logSerialEvent("nirs", "start", settings.deviceKind);
    } catch (error) {
      setSerialStatus(error instanceof Error ? error.message : "Start failed");
      logSerialEvent("nirs", "error", error instanceof Error ? error.message : "Start failed");
    }
  }

  async function disconnectSerial() {
    await serialRef.current?.disconnect();
    await loadCellSerialRef.current?.disconnect().catch(() => undefined);
    loadCellSerialRef.current = null;
    serialRef.current = null;
    setSerialConnected(false);
    setSerialPortLabel("None");
    setSerialStatus("Disconnected");
    setLoadCellStatus("Disconnected");
    logSerialEvent("nirs", "disconnected", settings.deviceKind);
  }

  function setLoadCellPointsPerSecond(pointsPerSecond: number) {
    if (!Number.isFinite(pointsPerSecond) || pointsPerSecond <= 0) return;
    setSettings({
      ...settings,
      loadCellPointsPerSecond: pointsPerSecond,
      loadCellTimePerPacket: 1 / pointsPerSecond,
    });
    setLoadCell((points) => points.map((point, index) => ({ ...point, time: index / pointsPerSecond })));
  }

  async function connectLoadCell() {
    if (!supportsWebSerial()) {
      setLoadCellStatus(`Web Serial unavailable; using imported/demo load-cell data for ${settings.loadCellSerialNumber}`);
      return;
    }
    try {
      await loadCellSerialRef.current?.disconnect();
      const bridge = new BrowserLoadCellSerial(
        settings.loadCellTimePerPacket,
        (point) => {
          setLoadCell((items) => [...items, point]);
          logSerialEvent("load-cell", "point", `${point.time},${point.value}`);
        },
        (error) => {
          setLoadCellStatus(`Read error: ${error.message}`);
          logSerialEvent("load-cell", "error", error.message);
        },
      );
      await bridge.connect();
      await bridge.start();
      loadCellSerialRef.current = bridge;
      setLoadCell([]);
      setLoadCellStatus(`Streaming ${settings.loadCellSerialNumber} from ${bridge.getPortLabel()} at ${settings.loadCellPointsPerSecond} points/s`);
      logSerialEvent("load-cell", "connected", `${settings.loadCellSerialNumber} ${bridge.getPortLabel()}`);
    } catch (error) {
      setLoadCellStatus(error instanceof Error ? error.message : "Load-cell connection failed");
      logSerialEvent("load-cell", "error", error instanceof Error ? error.message : "Load-cell connection failed");
    }
  }

  async function disconnectLoadCell() {
    await loadCellSerialRef.current?.disconnect();
    loadCellSerialRef.current = null;
    setLoadCellStatus("Disconnected");
    logSerialEvent("load-cell", "disconnected", settings.loadCellSerialNumber);
  }

  function resetDemo() {
    stopSimulator();
    setPackets(createDemoPackets());
    setImportedSamples(null);
    setLoadCell(createDemoLoadCell(900, settings.loadCellTimePerPacket));
    setMarks([5, 12, 20]);
    applySections(defaultSections());
    setCalculatedValues([]);
    setSerialEvents([]);
    setShownSamples(240);
    resetInteractionState();
    setSessionBaseName("nirs-demo");
    setFilterOptions({ ...filterOptions, passes: 0 });
    if (extraDeviceEnabled) {
      setExtraDevicePackets(createDemoPackets(700).map((packet) => packet.map((value) => value + 220) as NirsPacket));
      setExtraDeviceStatus("Demo connected");
    }
    // A freshly regenerated demo is a clean baseline, like the initial load.
    dirtyInitRef.current = true;
    setDirty(false);
  }

  async function importNirsFile(file: File | null) {
    if (!file) return;
    const text = await file.text();
    setSessionBaseName(sidecarStem(file.name));
    setLoadCell([]);
    applySections([]);
    setCalculatedValues([]);
    setSerialEvents([]);
    resetInteractionState();
    if (file.name.toLowerCase().endsWith(".txt")) {
      const parsedSamples = importNirsText(text);
      setImportedSamples(parsedSamples);
      setPackets(parsedSamples.map((sample) => sample.raw));
      setMarks(importLegacyTextMarks(text));
      setShownSamples(Math.min(240, parsedSamples.length));
    } else {
      const numbers = parseCsvNumbers(text);
      setImportedSamples(null);
      setPackets(packetsFromNumbers(numbers));
      setMarks([]);
      setShownSamples(Math.min(240, Math.floor(numbers.length / 8)));
    }
  }

  async function importLoadCellFile(file: File | null) {
    if (!file) return;
    setLoadCell(importLoadCellCsv(await file.text(), settings.loadCellTimePerPacket));
  }

  async function importSettingsFile(file: File | null) {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      setSettings(normalizeSettings(parsed));
    } catch (error) {
      setSerialStatus(error instanceof Error ? `Settings import failed: ${error.message}` : "Settings import failed");
    }
  }

  function restoreAutosaveSnapshot() {
    const snapshot = loadAutosaveSnapshot();
    if (!snapshot) return;
    let restoredSettings = settings;
    if (snapshot.settingsJson) {
      try {
        restoredSettings = normalizeSettings(JSON.parse(snapshot.settingsJson));
      } catch (error) {
        console.error("Autosave settings restore failed", error);
      }
    }
    if (snapshot.nirsFormat === "source-values") {
      const rows = snapshot.nirsCsv
        .split(/\r?\n/)
        .filter(Boolean)
        .map((line) => line.split(",").map(Number));
      const restoredSamples = importNirsTextRows(rows);
      setImportedSamples(restoredSamples);
      setPackets(restoredSamples.map((sample) => sample.raw));
      setShownSamples(Math.min(240, restoredSamples.length));
    } else {
      const numbers = parseCsvNumbers(snapshot.nirsCsv);
      setImportedSamples(null);
      setPackets(packetsFromNumbers(numbers));
      setShownSamples(Math.min(240, Math.floor(numbers.length / 8)));
    }
    setLoadCell(importLoadCellCsv(snapshot.loadCellCsv, restoredSettings.loadCellTimePerPacket));
    setMarks(importMarksText(snapshot.marksText));
    if (snapshot.sessionBaseName) setSessionBaseName(snapshot.sessionBaseName);
    if (snapshot.settingsJson) setSettings(restoredSettings);
    setCalculatedValues(snapshot.calculatedValuesCsv ? importCalculatedValuesCsv(snapshot.calculatedValuesCsv) : []);
    setSerialEvents(snapshot.serialLogCsv ? importSerialEventsCsv(snapshot.serialLogCsv) : []);
    const restoredSections = importSectionsText(snapshot.sectionsText);
    if (restoredSections.length > 0) {
      applySections(restoredSections);
    } else {
      applySections([]);
    }
    resetInteractionState();
  }

  function clearAutosaveSnapshot() {
    if (clearStoredAutosaveSnapshot()) {
      setAutosaveSnapshotVersion((version) => version + 1);
    }
  }

  async function importDataBundle(fileList: FileList | File[] | null) {
    const files = Array.from(fileList ?? []);
    const sessionBundleFile = files.find((file) => /\.nirser\.json$/i.test(file.name));
    if (sessionBundleFile) {
      try {
        const bundle = parseSessionBundle(await sessionBundleFile.text());
        setSessionBaseName(bundle.baseName);
        await importDataBundle(bundleFiles(bundle));
      } catch (error) {
        setSerialStatus(error instanceof Error ? `Session bundle import failed: ${error.message}` : "Session bundle import failed");
      }
      return;
    }
    const nirsFile =
      files.find((file) => /\.(csv|txt)$/i.test(file.name) && !LEGACY_SIDECAR_PATTERN.test(file.name)) ??
      files.find((file) => /\.(csv|txt)$/i.test(file.name));
    if (!nirsFile) return;
    setSessionBaseName(sidecarStem(nirsFile.name));
    await importNirsFile(nirsFile);

    const stem = sidecarStem(nirsFile.name);
    const sidecar = (suffix: string) =>
      files.find((file) => file.name === `${stem}${suffix}`) ??
      files.find((file) => file.name.toLowerCase().endsWith(suffix.toLowerCase()));

    const loadCellFile = sidecar("LoadCellCommunicator.csv");
    const marksFile = sidecar("Marks.txt");
    const sectionsFile = sidecar("Sections.txt");
    const settingsFile = sidecar("Settings.json");
    const calculatedValuesFile = sidecar("CalculatedValues.csv");
    const serialLogFile = sidecar("SerialLog.csv");
    let restoredSettings = settings;

    if (settingsFile) {
      try {
        restoredSettings = normalizeSettings(JSON.parse(await settingsFile.text()));
        setSettings(restoredSettings);
      } catch (error) {
        setSerialStatus(error instanceof Error ? `Settings import failed: ${error.message}` : "Settings import failed");
      }
    }

    if (loadCellFile) {
      setLoadCell(importLoadCellCsv(await loadCellFile.text(), restoredSettings.loadCellTimePerPacket));
    } else {
      setLoadCell([]);
    }
    if (marksFile) {
      setMarks(importMarksText(await marksFile.text()));
    } else if (nirsFile.name.toLowerCase().endsWith(".txt")) {
      setMarks(importLegacyTextMarks(await nirsFile.text()));
    } else {
      setMarks([]);
    }
    if (sectionsFile) {
      const importedSections = importSectionsText(await sectionsFile.text());
      applySections(importedSections);
    } else {
      applySections([]);
    }
    if (calculatedValuesFile) {
      setCalculatedValues(importCalculatedValuesCsv(await calculatedValuesFile.text()));
    } else {
      setCalculatedValues([]);
    }
    if (serialLogFile) {
      setSerialEvents(importSerialEventsCsv(await serialLogFile.text()));
    } else {
      setSerialEvents([]);
    }
    resetInteractionState();
  }

  function addMark(preferredTime?: number) {
    const fallbackTime = preferredTime ?? visibleSamples.at(-1)?.time ?? 0;
    const time = Number(markDraft || fallbackTime);
    if (!Number.isFinite(time) || time < 0) return;
    setMarks((items) => [...items, Number(time.toFixed(2))].sort((a, b) => a - b));
    setMarkDraft("");
  }

  function addCurrentMark() {
    addMark(visibleSamples.at(-1)?.time ?? 0);
  }

  function addAnalysisMark() {
    addMark(coordinate?.x);
  }

  function updateMark(index: number, value: string) {
    const nextValue = Number(value);
    if (!Number.isFinite(nextValue) || nextValue < 0) return;
    setMarks((items) => items.map((mark, markIndex) => (markIndex === index ? nextValue : mark)).sort((a, b) => a - b));
  }

  function deleteMark(index: number) {
    setMarks((items) => items.filter((_, markIndex) => markIndex !== index));
  }

  function addExtraDevice() {
    setExtraDeviceEnabled(true);
    setExtraDevicePackets(createDemoPackets(700).map((packet) => packet.map((value) => value + 220) as NirsPacket));
    setExtraDeviceStatus("Demo connected");
  }

  async function selectExtraDevicePort() {
    setExtraDeviceEnabled(true);
    if (!supportsWebSerial()) {
      setExtraDevicePort("Demo port");
      setExtraDeviceStatus("Web Serial unavailable; demo port selected");
      return;
    }
    try {
      const bridge = new BrowserSerialAcquisition(
        "pathonix",
        settings.loadCellTimePerPacket,
        (packet) => {
          setExtraDevicePackets((items) => [...items, packet]);
          logSerialEvent("extra-device", "packet", packet.join(" "));
        },
        (error) => {
          setExtraDeviceStatus(`Read error: ${error.message}`);
          logSerialEvent("extra-device", "error", error.message);
        },
      );
      await bridge.connect();
      await bridge.start();
      extraSerialRef.current = bridge;
      setExtraDevicePort(bridge.getPortLabel());
      setExtraDeviceStatus("Streaming");
      logSerialEvent("extra-device", "connected", bridge.getPortLabel());
    } catch (error) {
      setExtraDeviceStatus(error instanceof Error ? error.message : "Connection failed");
      logSerialEvent("extra-device", "error", error instanceof Error ? error.message : "Connection failed");
    }
  }

  async function disconnectExtraDevice() {
    await extraSerialRef.current?.disconnect();
    extraSerialRef.current = null;
    if (extraDeviceRealTimeSave) saveExtraDeviceData();
    setExtraDeviceStatus("Disconnected");
    logSerialEvent("extra-device", "disconnected", extraDevicePort);
  }

  async function removeExtraDevice() {
    await disconnectExtraDevice();
    setExtraDeviceEnabled(false);
    setExtraDevicePackets([]);
    setExtraDevicePort("None");
    setExtraDeviceRealTimeSave(false);
  }

  function toggleBias() {
    if (biasIndex !== null) {
      setBiasIndex(null);
      return;
    }
    setBiasIndex(Math.max(0, Math.min(shownSamples - 1, packets.length - 1)));
  }

  function openFrameRateSettings() {
    setView("acquisition");
    window.requestAnimationFrame(() => {
      document.getElementById("frame-rate-settings")?.scrollIntoView({ block: "center", behavior: "smooth" });
    });
  }

  function applyMaxTime() {
    const maxTime = Number(maxTimeDraft);
    if (!Number.isFinite(maxTime) || maxTime <= 0) return;
    const sampleCount = plottedSamples.findIndex((sample) => sample.time > maxTime);
    setShownSamples(sampleCount === -1 ? plottedSamples.length : Math.max(1, sampleCount));
  }

  function addSection() {
    const initialTime = sectionDraftInitialTime;
    const endTime = sectionDraftEndTime;
    if (!sectionDraftValid) return;
    const section = { id: crypto.randomUUID(), name: sectionDraft.name.trim(), initialTime, endTime };
    setSections((items) => [...items, section]);
    setActiveSectionId(section.id);
    setSectionDraft({ name: "", initialTime: "0", endTime: "5" });
  }

  function selectSection(id: string) {
    setActiveSectionId(id);
    const section = sections.find((item) => item.id === id);
    if (!section) return;
    setSectionDraft({
      name: section.name,
      initialTime: String(section.initialTime),
      endTime: String(section.endTime),
    });
  }

  function updateActiveSection() {
    if (!activeSection) return;
    const initialTime = sectionDraftInitialTime;
    const endTime = sectionDraftEndTime;
    if (!sectionDraftValid) return;
    setSections((items) =>
      items.map((section) =>
        section.id === activeSection.id
          ? { ...section, name: sectionDraft.name.trim(), initialTime, endTime }
          : section,
      ),
    );
  }

  function calculateValuesSnapshot() {
    setCalculatedValues((items) => [
      {
        id: crypto.randomUUID(),
        sectionName: activeSection?.name ?? "section",
        initialTime: activeSection?.initialTime ?? 0,
        endTime: activeSection?.endTime ?? Number.POSITIVE_INFINITY,
        filterPasses: filterOptions.passes,
        filterOrder,
        filterCutoff,
        calculatedAt: new Date().toISOString(),
        stats,
      },
      ...items,
    ]);
  }

  function deleteActiveSection() {
    if (!activeSection) return;
    const remainingSections = sections.filter((section) => section.id !== activeSection.id);
    setSections(remainingSections);
    const nextSection = remainingSections[0];
    setActiveSectionId(nextSection?.id ?? "");
    setSectionDraft(
      nextSection
        ? { name: nextSection.name, initialTime: String(nextSection.initialTime), endTime: String(nextSection.endTime) }
        : { name: "", initialTime: "0", endTime: "5" },
    );
  }

  function exportAll() {
    const filenames = legacySessionFilenames(sessionBaseName);
    setSessionBaseName(sanitizeSessionBaseName(sessionBaseName));
    downloadText(filenames.nirs, importedSamples ? exportSourceValuesCsv(importedSamples) : exportRawNirsCsv(samples.map((sample) => sample.raw)));
    downloadText(filenames.loadCell, exportLoadCellCsv(loadCell));
    downloadText(filenames.marks, exportMarks(marks));
    downloadText(filenames.sections, exportSections(sections));
    if (serialEvents.length > 0) {
      downloadText(`${sanitizeSessionBaseName(sessionBaseName)}SerialLog.csv`, exportSerialEventsCsv(serialEvents));
    }
    setDirty(false);
  }

  function exportSessionBundle() {
    const cleanBaseName = sanitizeSessionBaseName(sessionBaseName);
    const cleanSettings = normalizeSettings(settings);
    setSessionBaseName(cleanBaseName);
    const bundle = createSessionBundle(cleanBaseName, {
      nirs: importedSamples ? exportSourceValuesCsv(importedSamples) : exportRawNirsCsv(samples.map((sample) => sample.raw)),
      loadCell: exportLoadCellCsv(loadCell),
      marks: exportMarks(marks),
      sections: exportSections(sections),
      settings: JSON.stringify(cleanSettings, null, 2),
      calculatedValues: calculatedValues.length > 0 ? exportCalculatedValuesCsv(calculatedValues) : undefined,
      hbValues: exportHbValuesCsv(packets, cleanSettings, marks, importedSamples ?? undefined),
      serialLog: serialEvents.length > 0 ? exportSerialEventsCsv(serialEvents) : undefined,
    });
    downloadText(`${cleanBaseName}.nirser.json`, serializeSessionBundle(bundle));
    setDirty(false);
  }

  function saveExtraDeviceData() {
    downloadText("extra-device-data.csv", exportRawNirsCsv(extraDevicePackets));
    downloadText("extra-deviceMarks.txt", exportMarks(marks));
  }

  function exportSectionStats() {
    const entries = sections.map((section) => ({
      section,
      stats: calculateStats(analysisSamples, loadCell, section.initialTime, section.endTime),
    }));
    downloadText(
      "section-stats.csv",
      exportSectionStatsWithFilterCsv(entries, {
        passes: filterOptions.passes,
        order: filterOrder,
        cutoff: filterCutoff,
      }),
    );
  }

  function exportHbValues() {
    downloadText("hb-values.csv", exportHbValuesCsv(packets, settings, marks, importedSamples ?? undefined));
  }

  function exportCalculatedValues() {
    downloadText(`${sanitizeSessionBaseName(sessionBaseName)}CalculatedValues.csv`, exportCalculatedValuesCsv(calculatedValues));
  }

  function exportSerialLog() {
    downloadText(`${sanitizeSessionBaseName(sessionBaseName)}SerialLog.csv`, exportSerialEventsCsv(serialEvents));
  }

  async function loadVisualizerProfile(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) return;
    const profile = parseVisualizerProfile(await file.text());
    if (profile.length === 0) return;
    setVisualizerProfile(profile);
    setVisualizerProfileName(file.name);
    setVisualizerFrame(0);
  }

  function selectContractionProfile(type: "forearm" | "neck") {
    setContractionType(type);
    setVisualizerProfile(builtInVisualizerProfile(type));
    setVisualizerProfileName(`${type}.csv`);
    setVisualizerFrame(0);
  }

  function openRealTimeVisualizer() {
    setView("visualizer");
    setVisualizerMode("realtime");
  }

  function openVisualizationDemo() {
    setView("visualizer");
    setVisualizerMode("full");
    selectContractionProfile(contractionType);
    startVisualizerDemo();
  }

  const visualToi = Math.round((stats.channel1.toi.average + stats.channel2.toi.average) / 2);
  const visualPercent = Math.min(90, Math.max(10, Math.round(visualToi / 10) * 10));
  const visualAsset = !settings.useToi || visualPercent === 50
    ? "/nirs-assets/images/50.png"
    : `/nirs-assets/images/${visualPercent}-${100 - visualPercent}.png`;
  const thbBase = samples[60]?.channel1.thb || samples[0]?.channel1.thb || 1;
  const currentThb = visibleSamples.at(-1)?.channel1.thb ?? thbBase;
  const thbIncrease = ((currentThb - thbBase) / Math.max(Math.abs(thbBase), 0.001)) * 100;
  const computedActiveVeins = Math.max(1, Math.min(20, 10 + Math.floor(thbIncrease / 5)));
  const profileIndex = Math.min(Math.max(0, visualizerFrame), (visualizerProfile?.length ?? 1) - 1);
  const activeVeins = visualizerProfile?.[profileIndex] ?? computedActiveVeins;

  function startVisualizerDemo() {
    setVisualizerRunning(true);
    if (visualizerTimerRef.current) window.clearInterval(visualizerTimerRef.current);
    if (visualizerProfile) {
      visualizerTimerRef.current = window.setInterval(() => {
        setVisualizerFrame((value) => (value >= visualizerProfile.length - 1 ? 0 : value + 1));
      }, 100);
    } else {
      startSimulator();
      visualizerTimerRef.current = window.setInterval(() => {
        setShownSamples((value) => (value >= samples.length ? 1 : value + (contractionType === "neck" ? 4 : 2)));
      }, 100);
    }
  }

  function stopVisualizerDemo() {
    setVisualizerRunning(false);
    if (visualizerTimerRef.current) window.clearInterval(visualizerTimerRef.current);
    visualizerTimerRef.current = null;
    if (!visualizerProfile) stopSimulator();
  }

  return (
    <AppShell
      view={view}
      setView={setView}
      nirsSampleCount={samples.length}
      loadCellPointCount={loadCell.length}
      markCount={marks.length}
      running={running}
      biasActive={biasIndex !== null}
      deviceKind={settings.deviceKind}
      deviceKindLocked={serialConnected || running}
      onDeviceKindChange={(deviceKind) => setSettings({ ...settings, deviceKind })}
      onStart={startAcquisition}
      onPause={pauseAcquisition}
      startLabel={serialConnected ? "Start Serial" : "Start Demo"}
      onToggleBias={toggleBias}
      onStop={() => void stopAcquisition()}
      onResetDemo={resetDemo}
      onAddDevice={addExtraDevice}
      onSetFrameRate={openFrameRateSettings}
      onSaveData={exportAll}
      realTimeSave={realTimeSave}
      onToggleRealTimeSave={setRealTimeSave}
      onLoadDataFiles={importDataBundle}
      onOpenRealTimeVisualizer={openRealTimeVisualizer}
      onOpenVisualizationDemo={openVisualizationDemo}
      onSaveAnalysis={exportSessionBundle}
      onExportSectionsCsv={exportSectionStats}
      onExportHbValuesCsv={exportHbValues}
      onAddMark={view === "acquisition" ? addCurrentMark : addAnalysisMark}
      onDeleteSection={deleteActiveSection}
      onLoadVisualizerFiles={loadVisualizerProfile}
    >

        <div className="grid gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-4">
            {view === "visualizer" && (
              <VisualizerPanel
                useToi={settings.useToi}
                visualPercent={visualPercent}
                visualAsset={visualAsset}
                mode={visualizerMode}
                setMode={setVisualizerMode}
                contractionType={contractionType}
                setContractionType={selectContractionProfile}
                activeVeins={activeVeins}
                profileName={visualizerProfileName}
                profileFrame={visualizerProfile ? visualizerFrame + 1 : 0}
                profileLength={visualizerProfile?.length ?? 0}
                running={visualizerRunning}
                onLoadFiles={loadVisualizerProfile}
                onStart={startVisualizerDemo}
                onStop={stopVisualizerDemo}
              />
            )}

            {(view !== "visualizer" || visualizerMode === "full") && (
              <MainChartsStack
                channel1={channel1}
                channel2={channel2}
                loadCell={visibleLoadCell}
                marks={marks}
                seriesVisible={seriesVisible}
                panesVisible={panesVisible}
                channel1XDomain={channel1XDomain}
                channel2XDomain={channel2XDomain}
                channel1Domain={channel1Domain}
                channel2Domain={channel2Domain}
                loadCellDomain={loadCellDomain}
                coordinate={coordinate}
                onCoordinate={setCoordinate}
                channel1Overlays={channel1Overlays}
                channel2Overlays={channel2Overlays}
                loadCellOverlay={loadCellOverlay}
                overlayWindow={analysisOverlayWindow}
              />
            )}
            {extraDeviceEnabled && (
              <ExtraDevicePanel
                channel1={extraDeviceChannel1}
                channel2={extraDeviceChannel2}
                marks={marks}
                status={extraDeviceStatus}
                selectedPort={extraDevicePort}
                realTimeSave={extraDeviceRealTimeSave}
                setRealTimeSave={setExtraDeviceRealTimeSave}
                coordinate={coordinate}
                onCoordinate={setCoordinate}
                onSelectPort={selectExtraDevicePort}
                onConnectDemo={addExtraDevice}
                onDisconnect={disconnectExtraDevice}
                onSaveData={saveExtraDeviceData}
                onRemove={removeExtraDevice}
              />
            )}
          </div>

          <div className="space-y-4">
            <DeviceCard
              settings={settings}
              setSettings={setSettings}
              sessionBaseName={sessionBaseName}
              setSessionBaseName={setSessionBaseName}
              biasLabel={biasIndex === null ? "not set" : `sample ${biasIndex + 1} at ${formatNumber(samples[biasIndex]?.time ?? 0)}s`}
              maxTimeDraft={maxTimeDraft}
              setMaxTimeDraft={setMaxTimeDraft}
              applyMaxTime={applyMaxTime}
              loadCellStatus={loadCellStatus}
              loadCellVisible={panesVisible.loadCell}
              setLoadCellVisible={(loadCellVisible) => setPanesVisible({ ...panesVisible, loadCell: loadCellVisible })}
              realTimeSave={realTimeSave}
              realTimeSaveStatus={
                realTimeSave
                  ? autosaveStorageAvailable
                    ? "On: browser snapshot updates as data changes"
                    : "On: browser storage unavailable; stop will still download files"
                  : "Off"
              }
              hasAutosaveSnapshot={hasAutosaveSnapshot}
              setRealTimeSave={setRealTimeSave}
              restoreAutosaveSnapshot={restoreAutosaveSnapshot}
              clearAutosaveSnapshot={clearAutosaveSnapshot}
              downloadAutosaveSnapshot={exportSessionBundle}
              setLoadCellPointsPerSecond={setLoadCellPointsPerSecond}
              connectLoadCell={connectLoadCell}
              disconnectLoadCell={disconnectLoadCell}
              serialPortLabel={serialPortLabel}
              serialStatus={serialStatus}
              serialEventCount={serialEvents.length}
              serialConnected={serialConnected}
              webSerialSupported={supportsWebSerial()}
              connectSerial={connectSerial}
              disconnectSerial={disconnectSerial}
              exportSerialLog={exportSerialLog}
              importDataBundle={importDataBundle}
              importNirsFile={importNirsFile}
              importLoadCellFile={importLoadCellFile}
              importSettingsFile={importSettingsFile}
              exportSettings={() => downloadText("nirser-settings.json", JSON.stringify(normalizeSettings(settings), null, 2))}
              exportSessionBundle={exportSessionBundle}
            />

            <ChartControlsCard
              seriesVisible={seriesVisible}
              setSeriesVisible={setSeriesVisible}
              panesVisible={panesVisible}
              setPanesVisible={setPanesVisible}
              autoScaleY={autoScaleY}
              setAutoScaleY={setAutoScaleY}
              bounds={boundsDraft}
              setBounds={setBoundsDraft}
              onApplyChannelBounds={applyChannelBounds}
            />

            <AnalysisFilterCard filterOptions={filterOptions} setFilterOptions={setFilterOptions} />

            <MarksCard
              coordinate={coordinate}
              markDraft={markDraft}
              setMarkDraft={setMarkDraft}
              marks={marks}
              onAddMark={addAnalysisMark}
              onUpdateMark={updateMark}
              onDeleteMark={deleteMark}
              onExportMarks={() => downloadText("marks.txt", exportMarks(marks))}
            />

            <SectionsCard
              sections={sections}
              activeSectionId={activeSectionId}
              setActiveSectionId={selectSection}
              sectionDraft={sectionDraft}
              sectionDraftValid={sectionDraftValid}
              setSectionDraft={setSectionDraft}
              onAddSection={addSection}
              onUpdateActiveSection={updateActiveSection}
              onDeleteActiveSection={deleteActiveSection}
              onSaveAnalysis={exportSessionBundle}
              onExportSectionStats={exportSectionStats}
              onExportHbValues={exportHbValues}
            />

            <ActiveSectionStatsCard
              stats={stats}
              showTable={view === "analysis"}
              snapshots={calculatedValues}
              onCalculateValues={calculateValuesSnapshot}
              onClearSnapshots={() => setCalculatedValues([])}
              onExportSnapshots={exportCalculatedValues}
            />
          </div>
        </div>
    </AppShell>
  );
}
