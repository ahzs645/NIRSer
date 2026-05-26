export type BcmdOutputStream = "coarse" | "detail" | "both";

export interface BcmdInputDiagnostic {
  line: number;
  message: string;
  source: string;
}

export interface BcmdFieldSection {
  line: number;
  fields: string[];
}

export interface BcmdOutputSection {
  line: number;
  stream: BcmdOutputStream;
  fields: string[] | "default";
}

export interface BcmdHeaderControl {
  line: number;
  stream: BcmdOutputStream;
  enabled: boolean;
}

export interface BcmdInputStep {
  line: number;
  kind: "absolute" | "relative" | "repeat";
  start: number;
  end: number;
  duration: number;
  fields: string[];
  values: number[];
  assignments: Record<string, number>;
  repetition?: number;
}

export interface BcmdInputDocument {
  stepCount?: number;
  fields: BcmdFieldSection[];
  outputs: BcmdOutputSection[];
  headers: BcmdHeaderControl[];
  steps: BcmdInputStep[];
  diagnostics: BcmdInputDiagnostic[];
}

export interface WriteBcmdInputOptions {
  includeHeader?: boolean;
  outputSections?: BcmdOutputSection[];
  headerControls?: BcmdHeaderControl[];
}

const numberPattern = "[-+]?(?:\\d+\\.?\\d*|\\.\\d+)(?:[eE][-+]?\\d+)?";
const numberOnly = new RegExp(`^${numberPattern}$`);

function stripComment(rawLine: string) {
  let quoted = false;
  for (let index = 0; index < rawLine.length; index += 1) {
    const char = rawLine[index];
    if (char === '"') quoted = !quoted;
    if (char === "#" && !quoted) return rawLine.slice(0, index).trim();
  }
  return rawLine.trim();
}

function streamFromMark(mark: string): BcmdOutputStream {
  if (mark.length === 1) return "coarse";
  if (mark.length === 2) return "detail";
  return "both";
}

function asFiniteNumber(token: string) {
  if (!numberOnly.test(token)) return undefined;
  const value = Number(token);
  return Number.isFinite(value) ? value : undefined;
}

function splitTokens(source: string) {
  return source.split(/\s+/).filter(Boolean);
}

function parseCountedNames(tokens: string[]) {
  const count = asFiniteNumber(tokens[0] ?? "");
  if (count === undefined) return tokens;
  return tokens.slice(1, 1 + Math.max(0, Math.trunc(count)));
}

function zipAssignments(fields: string[], values: number[]) {
  return Object.fromEntries(fields.map((field, index) => [field, values[index] ?? 0]));
}

function stableNumber(value: number) {
  return Number(value.toPrecision(12));
}

function diagnostic(line: number, source: string, message: string): BcmdInputDiagnostic {
  return { line, source, message };
}

function numericTail(tokens: string[], startIndex: number, line: number, source: string, diagnostics: BcmdInputDiagnostic[]) {
  const values: number[] = [];
  for (const token of tokens.slice(startIndex)) {
    const value = asFiniteNumber(token);
    if (value === undefined) {
      diagnostics.push(diagnostic(line, source, `Ignored non-numeric step token "${token}".`));
      continue;
    }
    values.push(value);
  }
  return values;
}

export function parseBcmdInput(text: string): BcmdInputDocument {
  const document: BcmdInputDocument = { fields: [], outputs: [], headers: [], steps: [], diagnostics: [] };
  let activeFields: string[] = [];
  let currentTime = 0;
  let currentValues: Record<string, number> = {};

  text.split(/\r?\n/).forEach((rawLine, index) => {
    const line = index + 1;
    const source = stripComment(rawLine);
    if (!source) return;

    if (source.startsWith("@")) {
      const stepCount = asFiniteNumber(source.slice(1).trim());
      if (stepCount === undefined || stepCount < 0) {
        document.diagnostics.push(diagnostic(line, source, "Input header must contain a non-negative step count."));
      } else {
        document.stepCount = Math.trunc(stepCount);
      }
      return;
    }

    const outputMatch = source.match(/^(>{1,3})\s*(.*)$/);
    if (outputMatch) {
      const tokens = splitTokens(outputMatch[2]);
      const first = tokens[0];
      const fields = first === "*" ? "default" : parseCountedNames(tokens);
      document.outputs.push({ line, stream: streamFromMark(outputMatch[1]), fields });
      return;
    }

    if (source === "!0") {
      document.headers.push({ line, stream: "both", enabled: false });
      return;
    }

    const headerMatch = source.match(/^(!{1,3})$/);
    if (headerMatch) {
      document.headers.push({ line, stream: streamFromMark(headerMatch[1]), enabled: true });
      return;
    }

    if (source.startsWith(":")) {
      activeFields = parseCountedNames(splitTokens(source.slice(1)));
      document.fields.push({ line, fields: activeFields });
      return;
    }

    if (source.startsWith("=")) {
      const tokens = splitTokens(source);
      const start = asFiniteNumber(tokens[1] ?? "");
      const end = asFiniteNumber(tokens[2] ?? "");
      if (start === undefined || end === undefined) {
        document.diagnostics.push(diagnostic(line, source, "Absolute steps require numeric start and end times."));
        return;
      }
      const values = numericTail(tokens, 3, line, source, document.diagnostics);
      const assignments = zipAssignments(activeFields, values);
      currentTime = end;
      currentValues = { ...currentValues, ...assignments };
      document.steps.push({
        line,
        kind: "absolute",
        start,
        end,
        duration: end - start,
        fields: activeFields,
        values,
        assignments,
      });
      return;
    }

    if (source.startsWith("+")) {
      const tokens = splitTokens(source);
      const duration = asFiniteNumber(tokens[1] ?? "");
      if (duration === undefined) {
        document.diagnostics.push(diagnostic(line, source, "Relative steps require a numeric duration."));
        return;
      }
      const values = numericTail(tokens, 2, line, source, document.diagnostics);
      const assignments = zipAssignments(activeFields, values);
      const start = currentTime;
      const end = start + duration;
      currentTime = end;
      currentValues = { ...currentValues, ...assignments };
      document.steps.push({ line, kind: "relative", start, end, duration, fields: activeFields, values, assignments });
      return;
    }

    if (source.startsWith("*")) {
      const tokens = splitTokens(source);
      const repetitions = asFiniteNumber(tokens[1] ?? "");
      const duration = asFiniteNumber(tokens[2] ?? "");
      if (repetitions === undefined || repetitions < 1 || duration === undefined) {
        document.diagnostics.push(diagnostic(line, source, "Repeated steps require a positive count and numeric duration."));
        return;
      }
      const deltas = numericTail(tokens, 3, line, source, document.diagnostics);
      for (let repetition = 0; repetition < Math.trunc(repetitions); repetition += 1) {
        const values = activeFields.map((field, valueIndex) => stableNumber((currentValues[field] ?? 0) + (deltas[valueIndex] ?? 0)));
        const assignments = zipAssignments(activeFields, values);
        const start = currentTime;
        const end = start + duration;
        currentTime = end;
        currentValues = { ...currentValues, ...assignments };
        document.steps.push({
          line,
          kind: "repeat",
          start,
          end,
          duration,
          fields: activeFields,
          values,
          assignments,
          repetition,
        });
      }
      return;
    }

    document.diagnostics.push(diagnostic(line, source, "Ignored unrecognized BCMD input line."));
  });

  if (document.stepCount !== undefined && document.stepCount !== document.steps.length) {
    document.diagnostics.push(
      diagnostic(0, "", `Header declares ${document.stepCount} steps but ${document.steps.length} steps were parsed.`),
    );
  }

  return document;
}

function formatNumber(value: number) {
  if (Object.is(value, -0)) return "0";
  return Number.isInteger(value) ? String(value) : String(Number(value.toPrecision(12)));
}

function formatOutputSection(section: BcmdOutputSection) {
  const mark = section.stream === "coarse" ? ">" : section.stream === "detail" ? ">>" : ">>>";
  if (section.fields === "default") return `${mark} *`;
  return `${mark} ${section.fields.length} ${section.fields.join(" ")}`.trim();
}

function formatHeaderControl(control: BcmdHeaderControl) {
  if (!control.enabled) return "!0";
  return control.stream === "coarse" ? "!" : control.stream === "detail" ? "!!" : "!!!";
}

export function writeBcmdInput(steps: BcmdInputStep[], options: WriteBcmdInputOptions = {}) {
  const rows: string[] = [];
  if (options.includeHeader !== false) rows.push(`@ ${steps.length}`);
  for (const section of options.outputSections ?? []) rows.push(formatOutputSection(section));
  for (const control of options.headerControls ?? []) rows.push(formatHeaderControl(control));

  let previousFields: string[] | undefined;
  for (const step of steps) {
    const fieldsChanged =
      !previousFields ||
      previousFields.length !== step.fields.length ||
      previousFields.some((field, index) => field !== step.fields[index]);
    if (fieldsChanged) {
      rows.push(`: ${step.fields.length} ${step.fields.join(" ")}`.trim());
      previousFields = step.fields;
    }
    rows.push(`= ${formatNumber(step.start)} ${formatNumber(step.end)} ${step.values.map(formatNumber).join(" ")}`.trim());
  }

  return `${rows.join("\n")}\n`;
}
