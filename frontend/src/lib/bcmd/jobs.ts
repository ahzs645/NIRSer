export type BcmdJobKind = "dsim" | "opt" | "abc" | "unknown";

export interface BcmdJobEntry {
  key: string;
  rawKey: string;
  values: string[];
  line: number;
}

export interface BcmdDistribution {
  name: string;
  kind: "constant" | "uniform" | "normal" | "lognormal" | "unknown";
  parameters: number[];
  defaultValue?: number;
  source: BcmdJobEntry;
}

export interface BcmdJobFile {
  kind: BcmdJobKind;
  entries: BcmdJobEntry[];
  byKey: Record<string, BcmdJobEntry[]>;
}

const extensionKinds: Record<string, BcmdJobKind> = {
  dsimjob: "dsim",
  optjob: "opt",
  abcjob: "abc",
};

function stripComment(rawLine: string) {
  let quoted = false;
  for (let index = 0; index < rawLine.length; index += 1) {
    const char = rawLine[index];
    if (char === '"') quoted = !quoted;
    if (char === "#" && !quoted) return rawLine.slice(0, index).trim();
  }
  return rawLine.trim();
}

function splitCommaValues(valueText: string) {
  const values: string[] = [];
  let quoted = false;
  let value = "";
  for (let index = 0; index < valueText.length; index += 1) {
    const char = valueText[index];
    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    if (char === "," && !quoted) {
      values.push(value.trim());
      value = "";
      continue;
    }
    value += char;
  }
  values.push(value.trim());
  return values.filter(Boolean);
}

function normalizeKey(key: string) {
  return key.trim().toLowerCase().replace(/\s+/g, "_");
}

function kindFromName(fileName?: string): BcmdJobKind {
  const extension = fileName?.split(".").pop()?.toLowerCase() ?? "";
  return extensionKinds[extension] ?? "unknown";
}

export function parseBcmdJob(text: string, fileName?: string): BcmdJobFile {
  const entries = text
    .split(/\r?\n/)
    .map((rawLine, index) => ({ source: stripComment(rawLine), line: index + 1 }))
    .filter(({ source }) => Boolean(source))
    .flatMap(({ source, line }) => {
      const colonIndex = source.indexOf(":");
      if (colonIndex < 0) return [];
      const rawKey = source.slice(0, colonIndex).trim();
      const key = normalizeKey(rawKey);
      if (!key) return [];
      return [{ key, rawKey, values: splitCommaValues(source.slice(colonIndex + 1)), line }];
    });

  const byKey: Record<string, BcmdJobEntry[]> = {};
  for (const entry of entries) {
    byKey[entry.key] ??= [];
    byKey[entry.key].push(entry);
  }

  return { kind: kindFromName(fileName), entries, byKey };
}

export function firstBcmdJobValue(job: BcmdJobFile, key: string) {
  return job.byKey[normalizeKey(key)]?.[0]?.values;
}

export function allBcmdJobValues(job: BcmdJobFile, key: string) {
  return job.byKey[normalizeKey(key)]?.map((entry) => entry.values) ?? [];
}

export function parseBcmdDistribution(entry: BcmdJobEntry): BcmdDistribution | undefined {
  const [name, kindToken = "constant", ...rest] = entry.values;
  if (!name) return undefined;
  const kind = ["constant", "uniform", "normal", "lognormal"].includes(kindToken)
    ? (kindToken as BcmdDistribution["kind"])
    : "unknown";
  const numbers = rest.map(Number).filter(Number.isFinite);
  const defaultValue =
    kind === "uniform" && numbers.length >= 2
      ? (numbers[0] + numbers[1]) / 2
      : kind === "normal" && numbers.length >= 1
        ? numbers[0]
        : kind === "lognormal" && numbers.length >= 1
          ? Math.exp(numbers[0])
          : numbers[0];

  return { name, kind, parameters: numbers, defaultValue, source: entry };
}

export function bcmdJobDistributions(job: BcmdJobFile, key: "var" | "input" | "param") {
  return (job.byKey[key] ?? []).map(parseBcmdDistribution).filter((item): item is BcmdDistribution => Boolean(item));
}

