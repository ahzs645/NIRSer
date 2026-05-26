import type { BcmdInputDocument } from "./input";
import type { BcmdProcessedModel, BcmdStatementNode } from "./ast";

export type BcmdGraphView = "symbols" | "equations" | "reactions" | "io";
export type BcmdEquationFilter = "all" | "roots" | "parameters" | "inputs" | "outputs" | "unknown" | "constraints" | "reactions";

export interface BcmdGraphNode {
  id: string;
  label: string;
  kind: string;
  group: number;
}

export interface BcmdGraphEdge {
  source: string;
  target: string;
  kind: string;
  label?: string;
}

export interface BcmdStepSeries {
  name: string;
  points: Array<{ time: number; value: number }>;
}

function unique<T>(values: T[]) {
  return Array.from(new Set(values));
}

function pushNode(nodes: Map<string, BcmdGraphNode>, node: BcmdGraphNode) {
  if (!nodes.has(node.id)) nodes.set(node.id, node);
}

function symbolGroup(kind: string) {
  if (kind === "input") return 1;
  if (kind === "output") return 2;
  if (kind === "root") return 3;
  if (kind === "parameter") return 4;
  if (kind === "intermediate") return 5;
  if (kind === "external") return 6;
  return 7;
}

export function buildBcmdGraph(model: BcmdProcessedModel, view: BcmdGraphView = "symbols") {
  const nodes = new Map<string, BcmdGraphNode>();
  const edges: BcmdGraphEdge[] = [];

  if (view === "reactions") {
    for (const reaction of model.reactions) {
      pushNode(nodes, { id: reaction.name, label: reaction.name, kind: "reaction", group: 8 });
      for (const [species, delta] of Object.entries(reaction.delta)) {
        pushNode(nodes, { id: species, label: species, kind: "species", group: delta < 0 ? 9 : 10 });
        edges.push(delta < 0
          ? { source: species, target: reaction.name, kind: "reactant", label: String(Math.abs(delta)) }
          : { source: reaction.name, target: species, kind: "product", label: String(delta) });
      }
    }
    return { nodes: Array.from(nodes.values()), edges };
  }

  const visible =
    view === "io"
      ? new Set([...model.inputs, ...model.outputs, ...model.roots])
      : new Set(model.symbols.map((symbol) => symbol.name));

  for (const symbol of model.symbols) {
    if (!visible.has(symbol.name)) continue;
    pushNode(nodes, { id: symbol.name, label: symbol.name, kind: symbol.role, group: symbolGroup(symbol.role) });
    for (const dependency of symbol.dependencies) {
      if (view === "io" && !visible.has(dependency)) continue;
      pushNode(nodes, { id: dependency, label: dependency, kind: model.symbols.find((item) => item.name === dependency)?.role ?? "unknown", group: 7 });
      edges.push({ source: dependency, target: symbol.name, kind: "dependency" });
    }
  }

  if (view === "equations") {
    for (const node of model.nodes) {
      if (!("dependencies" in node)) continue;
      const target = "target" in node ? node.target : undefined;
      if (!target) continue;
      const equationId = `${node.kind}:${target}:${node.startLine}`;
      pushNode(nodes, { id: equationId, label: `${node.kind}\n${target}`, kind: "equation", group: 11 });
      edges.push({ source: equationId, target, kind: "defines" });
      for (const dependency of node.dependencies) edges.push({ source: dependency, target: equationId, kind: "uses" });
    }
  }

  return { nodes: Array.from(nodes.values()), edges };
}

export function filterBcmdEquations(model: BcmdProcessedModel, filter: BcmdEquationFilter) {
  const roots = new Set(model.roots);
  const inputs = new Set(model.inputs);
  const outputs = new Set(model.outputs);
  const roleByName = new Map(model.symbols.map((symbol) => [symbol.name, symbol.role]));

  return model.nodes.filter((node) => {
    if (filter === "all") return true;
    if (filter === "constraints") return node.kind === "constraint";
    if (filter === "reactions") return node.kind === "reaction";
    if (filter === "unknown") return node.kind === "unknown";
    if (!("target" in node) || node.kind === "constraint") return false;
    if (filter === "roots") return roots.has(node.target);
    if (filter === "inputs") return inputs.has(node.target);
    if (filter === "outputs") return outputs.has(node.target);
    if (filter === "parameters") return roleByName.get(node.target) === "parameter";
    return true;
  });
}

export function bcmdEquationLabel(node: BcmdStatementNode) {
  if (node.kind === "assignment") return `${node.target} ${node.operator} ${node.expression}`;
  if (node.kind === "differentialEquation") return `${node.target}' = ${node.expression}`;
  if (node.kind === "algebraicEquation") return `${node.target}: ${node.leftExpression} = ${node.rightExpression}`;
  if (node.kind === "constraint") return `${node.leftExpression} ${node.operator} ${node.rightExpression}`;
  if (node.kind === "reaction") {
    const fmt = (items: typeof node.reactants) => items.map((item) => `${item.coefficient ?? ""}${item.species}`).join(" + ");
    return `${fmt(node.reactants)} ${node.reversible ? "<->" : "->"} ${fmt(node.products)}${node.rateExpression ? ` ; ${node.rateExpression}` : ""}`;
  }
  if (node.kind === "directive") return `@${node.name} ${node.args.join(" ")}`.trim();
  if (node.kind === "docComment") return `## ${node.text}`;
  if (node.kind === "embeddedBlock") return "[** embedded block **]";
  return node.source;
}

export function bcmdInputStepSeries(input: BcmdInputDocument): BcmdStepSeries[] {
  const fields = unique(input.steps.flatMap((step) => step.fields));
  return fields.map((name) => {
    const points: Array<{ time: number; value: number }> = [];
    let previous: number | undefined;
    for (const step of input.steps) {
      const value = step.assignments[name] ?? previous;
      if (value === undefined) continue;
      if (previous !== undefined && step.start !== points.at(-1)?.time) points.push({ time: step.start, value: previous });
      points.push({ time: step.start, value });
      points.push({ time: step.end, value });
      previous = value;
    }
    return { name, points };
  });
}
