import type {
  BcmdAssignmentNode,
  BcmdDirectiveNode,
  BcmdProcessedModel,
  BcmdProcessedSymbol,
  BcmdReactionNode,
  BcmdStatementNode,
} from "./ast";
import { parseBcmdProgram } from "./parser";

function unique(values: string[]) {
  return Array.from(new Set(values));
}

function directiveValues(directives: BcmdDirectiveNode[], name: string) {
  return unique(directives.filter((directive) => directive.name === name).flatMap((directive) => directive.args));
}

function dependenciesOf(statement: BcmdStatementNode) {
  return "dependencies" in statement ? statement.dependencies : [];
}

function targetOf(statement: BcmdStatementNode) {
  if (
    statement.kind === "assignment" ||
    statement.kind === "differentialEquation" ||
    statement.kind === "algebraicEquation" ||
    statement.kind === "constraint"
  ) {
    return statement.target;
  }
  return undefined;
}

function docsBefore(statements: BcmdStatementNode[], target: BcmdStatementNode) {
  const index = statements.indexOf(target);
  const docs: string[] = [];
  for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
    const previous = statements[cursor];
    if (previous.kind !== "docComment") break;
    docs.unshift(previous.text);
  }
  return docs;
}

function docMeta(docs: string[]) {
  const tags: string[] = [];
  let latex: string | undefined;
  let units: string | undefined;
  for (const doc of docs) {
    const trimmed = doc.trim();
    if (trimmed.startsWith("+")) tags.push(...trimmed.slice(1).trim().split(/\s+/).filter(Boolean));
    if (trimmed.startsWith("$")) latex = trimmed.slice(1).trim();
    if (trimmed.startsWith("~")) units = trimmed.slice(1).trim();
  }
  return { tags: unique(tags), latex, units };
}

function dependencyOrder(nodes: BcmdStatementNode[]) {
  const graph = new Map<string, Set<string>>();
  for (const node of nodes) {
    const target = targetOf(node);
    if (!target) continue;
    graph.set(target, new Set(dependenciesOf(node).filter((dependency) => dependency !== target)));
  }
  const result: string[] = [];
  const temporary = new Set<string>();
  const permanent = new Set<string>();
  const visit = (name: string) => {
    if (permanent.has(name) || temporary.has(name)) return;
    temporary.add(name);
    for (const dependency of graph.get(name) ?? []) visit(dependency);
    temporary.delete(name);
    permanent.add(name);
    if (graph.has(name)) result.push(name);
  };
  for (const name of graph.keys()) visit(name);
  return result;
}

function reactionDelta(reaction: BcmdReactionNode) {
  const delta: Record<string, number> = {};
  for (const reactant of reaction.reactants) delta[reactant.species] = (delta[reactant.species] ?? 0) - (reactant.coefficient ?? 1);
  for (const product of reaction.products) delta[product.species] = (delta[product.species] ?? 0) + (product.coefficient ?? 1);
  return delta;
}

export function mergeBcmdImports(
  rootText: string,
  resolver: (name: string) => string | undefined,
  seen = new Set<string>(),
) {
  const program = parseBcmdProgram(rootText);
  const imports = directiveValues(program.directives, "import");
  const chunks: string[] = [];
  for (const name of imports) {
    if (seen.has(name)) continue;
    seen.add(name);
    const imported = resolver(name);
    if (imported) chunks.push(mergeBcmdImports(imported, resolver, seen));
  }
  chunks.push(rootText);
  return chunks.join("\n");
}

export function processBcmdModel(text: string, options: { importResolver?: (name: string) => string | undefined } = {}): BcmdProcessedModel {
  const merged = options.importResolver ? mergeBcmdImports(text, options.importResolver) : text;
  const program = parseBcmdProgram(merged);
  const imports = directiveValues(program.directives, "import");
  const inputs = directiveValues(program.directives, "input");
  const outputs = directiveValues(program.directives, "output");
  const externs = directiveValues(program.directives, "extern");
  const independent = directiveValues(program.directives, "independent")[0] ?? "t";
  const roots = unique(program.statements
    .filter((node) => node.kind === "differentialEquation")
    .flatMap((node) => [node.target, ...node.auxiliaries.map((auxiliary) => auxiliary.name)]));
  const rootSet = new Set(roots);
  const inputSet = new Set(inputs);
  const outputSet = new Set(outputs);
  const externSet = new Set(externs);
  const assignmentNodes = program.statements.filter((node): node is BcmdAssignmentNode => node.kind === "assignment");
  const assignmentTargets = unique(assignmentNodes.map((node) => node.target));
  const symbols = new Map<string, BcmdProcessedSymbol>();

  const ensureSymbol = (name: string): BcmdProcessedSymbol => {
    const existing = symbols.get(name);
    if (existing) return existing;
    const role =
      name === independent ? "independent"
        : rootSet.has(name) ? "root"
        : inputSet.has(name) ? "input"
        : outputSet.has(name) ? "output"
        : externSet.has(name) ? "external"
        : assignmentTargets.includes(name) ? "parameter"
        : "unknown";
    const symbol: BcmdProcessedSymbol = { name, role, dependencies: [], docs: [], tags: [] };
    symbols.set(name, symbol);
    return symbol;
  };

  ensureSymbol(independent);
  [...roots, ...inputs, ...outputs, ...externs, ...assignmentTargets, ...program.symbols].forEach(ensureSymbol);

  for (const node of program.statements) {
    const target = targetOf(node);
    if (!target) continue;
    const symbol = ensureSymbol(target);
    symbol.dependencies = unique([...symbol.dependencies, ...dependenciesOf(node).filter((dependency) => dependency !== target)]);
    const docs = docsBefore(program.statements, node);
    if (docs.length) {
      symbol.docs = docs;
      Object.assign(symbol, docMeta(docs));
    }
  }

  for (const assignment of assignmentNodes) {
    const symbol = ensureSymbol(assignment.target);
    if (symbol.role !== "parameter") continue;
    if (assignment.dependencies.some((dependency) => rootSet.has(dependency) || inputSet.has(dependency))) {
      symbol.role = "intermediate";
    }
  }

  const reactionNodes = program.statements.filter((node): node is BcmdReactionNode => node.kind === "reaction");
  return {
    nodes: program.statements,
    diagnostics: program.statements
      .filter((node) => node.kind === "unknown")
      .map((node) => ({ line: node.startLine, source: node.source, message: "Unrecognized BCMD statement." })),
    independent,
    imports,
    symbols: Array.from(symbols.values()),
    roots,
    inputs,
    outputs,
    externs,
    dependencyOrder: dependencyOrder(program.statements),
    reactions: reactionNodes.map((reaction, index) => ({
      name: `reaction_${index + 1}`,
      delta: reactionDelta(reaction),
      rate: reaction.rateExpression ?? "",
    })),
  };
}

export function summarizeBcmdProcessedModel(model: BcmdProcessedModel) {
  return {
    symbols: model.symbols.length,
    roots: model.roots.length,
    inputs: model.inputs.length,
    outputs: model.outputs.length,
    externs: model.externs.length,
    reactions: model.reactions.length,
    diagnostics: model.diagnostics.length,
  };
}
