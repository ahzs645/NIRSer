export type BcmdStatementKind =
  | "assignment"
  | "differential"
  | "algebraic"
  | "constraint"
  | "reaction"
  | "embedded"
  | "directive"
  | "doc"
  | "unknown";

export interface BcmdDirective {
  name: string;
  values: string[];
  line: number;
}

export interface BcmdStatement {
  kind: BcmdStatementKind;
  line: number;
  source: string;
  name?: string;
  operator?: string;
  expression?: string;
  variables: string[];
  dependencies: string[];
  initialOnly?: boolean;
}

export interface BcmdModel {
  directives: BcmdDirective[];
  statements: BcmdStatement[];
  inputs: string[];
  outputs: string[];
  externs: string[];
  independent: string;
  roots: string[];
  parameters: string[];
  intermediates: string[];
  assigned: string[];
  unknown: BcmdStatement[];
}

export interface BcmdInputSeries {
  name: string;
  initial: number;
  points: Array<{ time: number; value: number }>;
}

export interface BcmdInputFile {
  defaultStep?: number;
  declarations: Array<{ name: string; initial: number; line: number }>;
  series: BcmdInputSeries[];
}

export interface BcmdJobEntry {
  key: string;
  values: string[];
  line: number;
}

export type BcmdPosthocSpec = ["zero"] | ["centre"] | ["norm"] | ["offset", number] | ["scale", number];

const mathFunctionNames = new Set([
  "abs",
  "acos",
  "asin",
  "atan",
  "atan2",
  "ceil",
  "cos",
  "cosh",
  "exp",
  "fabs",
  "floor",
  "fmod",
  "frexp",
  "ldexp",
  "log",
  "log10",
  "max",
  "min",
  "modf",
  "pow",
  "sin",
  "sinh",
  "sqrt",
  "tan",
  "tanh",
]);

const reservedWords = new Set(["if", "else", "true", "false"]);

function stripInlineComment(line: string) {
  let inQuote = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') inQuote = !inQuote;
    if (char === "#" && !inQuote) return line.slice(0, index).trim();
  }
  return line.trim();
}

function unique(values: string[]) {
  return Array.from(new Set(values));
}

export function extractBcmdSymbols(expression = "") {
  const symbols = expression.match(/[A-Za-z_][A-Za-z0-9_]*/g) ?? [];
  return unique(symbols.filter((symbol) => !mathFunctionNames.has(symbol) && !reservedWords.has(symbol)));
}

function parseDirective(line: string, lineNumber: number): BcmdDirective | undefined {
  const match = line.match(/^@([A-Za-z_][A-Za-z0-9_]*)\s*(.*)$/);
  if (!match) return undefined;
  return {
    name: match[1],
    values: match[2] ? match[2].split(/\s+/).filter(Boolean) : [],
    line: lineNumber,
  };
}

function parseStatement(source: string, line: number): BcmdStatement {
  const directive = parseDirective(source, line);
  if (directive) {
    return {
      kind: "directive",
      line,
      source,
      name: directive.name,
      variables: directive.values,
      dependencies: [],
    };
  }

  if (source.startsWith("##")) {
    return { kind: "doc", line, source, variables: [], dependencies: [] };
  }

  if (source.startsWith("[**") || source.endsWith("**]")) {
    return { kind: "embedded", line, source, variables: [], dependencies: extractBcmdSymbols(source) };
  }

  const differential = source.match(/^([A-Za-z_][A-Za-z0-9_]*)'\s*(?:[-+]\s*(?:\d+(?:\.\d+)?)?\s*[A-Za-z_][A-Za-z0-9_]*'\s*)*=\s*(.+)$/);
  if (differential) {
    return {
      kind: "differential",
      line,
      source,
      name: differential[1],
      operator: "=",
      expression: differential[2].trim(),
      variables: [differential[1]],
      dependencies: extractBcmdSymbols(differential[2]).filter((symbol) => symbol !== differential[1]),
    };
  }

  const algebraic = source.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.+?)\s*=\s*(.+)$/);
  if (algebraic) {
    const expression = `${algebraic[2]} ${algebraic[3]}`;
    return {
      kind: "algebraic",
      line,
      source,
      name: algebraic[1],
      operator: "=",
      expression,
      variables: [algebraic[1]],
      dependencies: extractBcmdSymbols(expression).filter((symbol) => symbol !== algebraic[1]),
    };
  }

  const assignment = source.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*(:=|=)\s*(.+)$/);
  if (assignment) {
    return {
      kind: "assignment",
      line,
      source,
      name: assignment[1],
      operator: assignment[2],
      expression: assignment[3].trim(),
      variables: [assignment[1]],
      dependencies: extractBcmdSymbols(assignment[3]).filter((symbol) => symbol !== assignment[1]),
      initialOnly: assignment[2] === ":=",
    };
  }

  const constraint = source.match(/^~?\s*([A-Za-z_][A-Za-z0-9_]*)\s*(<=|>=|<|>)\s*(.+)$/);
  if (constraint) {
    return {
      kind: "constraint",
      line,
      source,
      name: constraint[1],
      operator: constraint[2],
      expression: constraint[3].trim(),
      variables: [constraint[1]],
      dependencies: extractBcmdSymbols(constraint[3]).filter((symbol) => symbol !== constraint[1]),
    };
  }

  if (source.includes("->") || source.includes("<->")) {
    return { kind: "reaction", line, source, variables: extractBcmdSymbols(source), dependencies: extractBcmdSymbols(source) };
  }

  return { kind: "unknown", line, source, variables: extractBcmdSymbols(source), dependencies: extractBcmdSymbols(source) };
}

export function parseBcmdModel(text: string, independentDefault = "t"): BcmdModel {
  const directives: BcmdDirective[] = [];
  const statements: BcmdStatement[] = [];

  text.split(/\r?\n/).forEach((rawLine, index) => {
    const source = stripInlineComment(rawLine);
    if (!source) return;
    const line = index + 1;
    const directive = parseDirective(source, line);
    if (directive) directives.push(directive);
    statements.push(parseStatement(source, line));
  });

  const inputs = directives.filter((item) => item.name === "input").flatMap((item) => item.values);
  const outputs = directives.filter((item) => item.name === "output").flatMap((item) => item.values);
  const externs = directives.filter((item) => item.name === "extern").flatMap((item) => item.values);
  const independent = directives.find((item) => item.name === "independent")?.values[0] ?? independentDefault;
  const roots = unique(statements.filter((item) => item.kind === "differential" && item.name).map((item) => item.name as string));
  const assigned = unique(statements.filter((item) => item.kind === "assignment" && item.name).map((item) => item.name as string));
  const assignedSet = new Set(assigned);
  const rootSet = new Set(roots);
  const inputSet = new Set(inputs);
  const intermediates = assigned.filter((name) => {
    const statement = statements.find((item) => item.kind === "assignment" && item.name === name);
    return Boolean(statement?.dependencies.some((dependency) => rootSet.has(dependency) || inputSet.has(dependency)));
  });
  const parameters = assigned.filter((name) => !intermediates.includes(name));

  for (const statement of statements) {
    for (const dependency of statement.dependencies) {
      if (!assignedSet.has(dependency) && !rootSet.has(dependency) && !inputSet.has(dependency) && dependency !== independent) {
        assignedSet.add(dependency);
      }
    }
  }

  return {
    directives,
    statements,
    inputs: unique(inputs),
    outputs: unique(outputs),
    externs: unique(externs),
    independent,
    roots,
    parameters,
    intermediates,
    assigned,
    unknown: statements.filter((item) => item.kind === "unknown"),
  };
}

export function parseBcmdInput(text: string): BcmdInputFile {
  const declarations: BcmdInputFile["declarations"] = [];
  let defaultStep: number | undefined;
  const current = new Map<string, BcmdInputSeries>();
  let elapsed = 0;

  text.split(/\r?\n/).forEach((rawLine, index) => {
    const source = stripInlineComment(rawLine);
    if (!source) return;
    const line = index + 1;
    const stepMatch = source.match(/^@(.+)$/);
    if (stepMatch) {
      const step = Number(stepMatch[1].trim());
      if (Number.isFinite(step)) defaultStep = step;
      return;
    }
    const declaration = source.match(/^:\s*([-+]?\d*\.?\d+(?:e[-+]?\d+)?)\s+([A-Za-z_][A-Za-z0-9_]*)$/i);
    if (declaration) {
      const initial = Number(declaration[1]);
      const name = declaration[2];
      declarations.push({ name, initial, line });
      current.set(name, { name, initial, points: [{ time: 0, value: initial }] });
      return;
    }
    const absolute = source.match(/^=\s*([-+]?\d*\.?\d+(?:e[-+]?\d+)?)\s+([-+]?\d*\.?\d+(?:e[-+]?\d+)?)\s+([A-Za-z_][A-Za-z0-9_]*)$/i);
    if (absolute) {
      elapsed = Number(absolute[1]);
      const value = Number(absolute[2]);
      const name = absolute[3];
      const series = current.get(name) ?? { name, initial: value, points: [] };
      series.points.push({ time: elapsed, value });
      current.set(name, series);
      return;
    }
    const relative = source.match(/^\+\s*([-+]?\d*\.?\d+(?:e[-+]?\d+)?)\s+([-+]?\d*\.?\d+(?:e[-+]?\d+)?)$/i);
    if (relative) {
      elapsed += Number(relative[1]);
      const value = Number(relative[2]);
      for (const series of current.values()) series.points.push({ time: elapsed, value });
    }
  });

  return { defaultStep, declarations, series: Array.from(current.values()) };
}

function assertSameLength(left: readonly number[], right: readonly number[]) {
  if (left.length !== right.length) {
    throw new Error(`Expected arrays with the same length, received ${left.length} and ${right.length}`);
  }
}

function substituteFinite(value: number, fallback = Number.NaN) {
  return Number.isFinite(value) ? value : fallback;
}

export function bcmdEuclideanDistance(left: readonly number[], right: readonly number[]) {
  assertSameLength(left, right);
  return substituteFinite(Math.sqrt(left.reduce((sum, value, index) => sum + (value - right[index]) ** 2, 0)));
}

export function bcmdMeanDistance(left: readonly number[], right: readonly number[]) {
  assertSameLength(left, right);
  return substituteFinite(Math.sqrt(left.reduce((sum, value, index) => sum + (value - right[index]) ** 2, 0) / left.length));
}

export function bcmdManhattanDistance(left: readonly number[], right: readonly number[]) {
  assertSameLength(left, right);
  return substituteFinite(left.reduce((sum, value, index) => sum + Math.abs(value - right[index]), 0));
}

function dot(left: readonly number[], right: readonly number[]) {
  return left.reduce((sum, value, index) => sum + value * right[index], 0);
}

function norm(values: readonly number[]) {
  return Math.sqrt(values.reduce((sum, value) => sum + value * value, 0));
}

export function bcmdCosineDistance(left: readonly number[], right: readonly number[]) {
  assertSameLength(left, right);
  const denominator = norm(left) * norm(right);
  if (denominator === 0) return Number.NaN;
  const similarity = Math.max(-1, Math.min(1, dot(left, right) / denominator));
  return substituteFinite((1 - similarity) / 2);
}

export function bcmdAngularDistance(left: readonly number[], right: readonly number[]) {
  assertSameLength(left, right);
  const denominator = norm(left) * norm(right);
  if (denominator === 0) return Number.NaN;
  const similarity = Math.max(-1, Math.min(1, dot(left, right) / denominator));
  return substituteFinite(Math.acos(similarity) / Math.PI);
}

export function bcmdGaussianNegativeLogLikelihood(left: readonly number[], right: readonly number[], sigma?: number) {
  assertSameLength(left, right);
  const residuals = left.map((value, index) => value - right[index]);
  const resolvedSigma =
    sigma ??
    Math.sqrt(residuals.reduce((sum, value) => sum + (value - residuals.reduce((innerSum, item) => innerSum + item, 0) / residuals.length) ** 2, 0) / residuals.length);
  if (!Number.isFinite(resolvedSigma) || resolvedSigma <= 0) return Number.NaN;
  const squaredError = residuals.reduce((sum, value) => sum + value * value, 0);
  return substituteFinite((left.length * Math.log(2 * Math.PI * resolvedSigma * resolvedSigma)) / 2 + squaredError / (2 * resolvedSigma * resolvedSigma));
}

export function applyBcmdPosthoc(values: readonly number[], spec: BcmdPosthocSpec) {
  if (values.length === 0) return [];
  if (spec[0] === "zero") return values.map((value) => value - values[0]);
  if (spec[0] === "centre") {
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    return values.map((value) => value - mean);
  }
  if (spec[0] === "norm") {
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    const deviation = Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length);
    return deviation === 0 ? values.map(() => Number.NaN) : values.map((value) => (value - mean) / deviation);
  }
  if (spec[0] === "offset") return values.map((value) => value + spec[1]);
  return values.map((value) => value * spec[1]);
}

export function parseBcmdJob(text: string): BcmdJobEntry[] {
  return text
    .split(/\r?\n/)
    .map((rawLine, index) => ({ source: stripInlineComment(rawLine), line: index + 1 }))
    .filter(({ source }) => Boolean(source))
    .map(({ source, line }) => {
      const [key = "", ...rest] = source.split(":");
      return {
        key: key.trim(),
        values: rest.join(":").split(",").map((value) => value.trim()).filter(Boolean),
        line,
      };
    })
    .filter((entry) => Boolean(entry.key));
}

export function summarizeBcmdModel(model: BcmdModel) {
  return {
    inputs: model.inputs.length,
    outputs: model.outputs.length,
    roots: model.roots.length,
    parameters: model.parameters.length,
    intermediates: model.intermediates.length,
    assignments: model.assigned.length,
    equations: model.statements.filter((item) => item.kind === "differential" || item.kind === "algebraic").length,
    unknown: model.unknown.length,
  };
}
