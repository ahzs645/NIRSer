import type { BcmdAssignmentNode, BcmdConstraintNode, BcmdDifferentialEquationNode, BcmdProcessedModel } from "./ast";
import { evaluateBcmdExpression, parseBcmdExpression } from "./expressions";
import { simulateAdaptiveOde, simulateOde, type SimulationPoint } from "./solver";
import type { BcmdInputDocument } from "./input";

export interface BcmdRuntimeModel {
  roots: string[];
  parameters: Record<string, number>;
  initialState: Record<string, number>;
  diagnostics: string[];
  simulate: (options?: BcmdRuntimeSimulationOptions) => Array<SimulationPoint<Record<string, number>>>;
}

export interface BcmdRuntimeSimulationOptions {
  start?: number;
  end?: number;
  step?: number;
  parameters?: Record<string, number>;
  input?: BcmdInputDocument;
  method?: "euler" | "rk4" | "adaptive";
}

function inputScopeAt(input: BcmdInputDocument | undefined, t: number) {
  if (!input) return {};
  const scope: Record<string, number> = {};
  for (const step of input.steps) {
    if (step.start <= t + Number.EPSILON) Object.assign(scope, step.assignments);
    if (step.end > t) break;
  }
  return scope;
}

export function compileBcmdRuntimeModel(model: BcmdProcessedModel): BcmdRuntimeModel {
  const assignments = model.nodes.filter((node): node is BcmdAssignmentNode => node.kind === "assignment");
  const differentials = model.nodes.filter((node): node is BcmdDifferentialEquationNode => node.kind === "differentialEquation");
  const constraints = model.nodes.filter((node): node is BcmdConstraintNode => node.kind === "constraint");
  const diagnostics: string[] = [];
  const scope: Record<string, number> = { [model.independent]: 0 };
  const rootSet = new Set(model.roots);
  const inputSet = new Set(model.inputs);
  const initialState: Record<string, number> = {};
  const parameters: Record<string, number> = {};
  const compiledAssignments: Array<{ node: BcmdAssignmentNode; expression: ReturnType<typeof parseBcmdExpression> }> = [];

  for (const node of assignments) {
    try {
      const expression = parseBcmdExpression(node.expression);
      const value = evaluateBcmdExpression(expression, scope);
      scope[node.target] = value;
      if (rootSet.has(node.target)) initialState[node.target] = value;
      else if (!inputSet.has(node.target)) parameters[node.target] = value;
      compiledAssignments.push({ node, expression });
    } catch (error) {
      diagnostics.push(`Line ${node.startLine}: ${error instanceof Error ? error.message : "assignment failed"}`);
    }
  }

  for (const root of model.roots) {
    if (!(root in initialState)) initialState[root] = scope[root] ?? 0;
  }

  const compiledDifferentials = differentials.map((node) => {
    try {
      return { node, expression: parseBcmdExpression(node.expression) };
    } catch (error) {
      diagnostics.push(`Line ${node.startLine}: ${error instanceof Error ? error.message : "differential parse failed"}`);
      return null;
    }
  }).filter((item): item is { node: BcmdDifferentialEquationNode; expression: ReturnType<typeof parseBcmdExpression> } => item !== null);

  const compiledConstraints = constraints.map((node) => {
    try {
      return { node, expression: parseBcmdExpression(node.rightExpression) };
    } catch (error) {
      diagnostics.push(`Line ${node.startLine}: ${error instanceof Error ? error.message : "constraint parse failed"}`);
      return null;
    }
  }).filter((item): item is { node: BcmdConstraintNode; expression: ReturnType<typeof parseBcmdExpression> } => item !== null);

  const evaluateScope = (t: number, state: Record<string, number>, runtimeParameters: Record<string, number>, input?: BcmdInputDocument) => {
    const runtimeScope = { ...parameters, ...runtimeParameters, ...inputScopeAt(input, t), ...state, [model.independent]: t };
    for (const { node, expression } of compiledAssignments) {
      if (!rootSet.has(node.target)) runtimeScope[node.target] = evaluateBcmdExpression(expression, runtimeScope);
    }
    return runtimeScope;
  };

  const applyConstraints = (state: Record<string, number>, scope: Record<string, number>) => {
    const constrained = { ...state };
    for (const { node, expression } of compiledConstraints) {
      if (!node.target || !(node.target in constrained)) continue;
      const bound = evaluateBcmdExpression(expression, scope);
      if (!Number.isFinite(bound)) continue;
      if (node.operator === "<" || node.operator === "<=") constrained[node.target] = Math.min(constrained[node.target], bound);
      if (node.operator === ">" || node.operator === ">=") constrained[node.target] = Math.max(constrained[node.target], bound);
    }
    return constrained;
  };

  return {
    roots: model.roots,
    parameters,
    initialState,
    diagnostics,
    simulate: (options = {}) => {
      const common = {
        initialState,
        parameters: { ...parameters, ...options.parameters },
        start: options.start ?? 0,
        end: options.end ?? 10,
        derivative: ({ t, state, parameters: runtimeParameters }: { t: number; state: Record<string, number>; parameters: Record<string, number> }) => {
        const runtimeScope = evaluateScope(t, state, runtimeParameters, options.input);
        const derivative = Object.fromEntries(
          compiledDifferentials.map(({ node, expression }) => [node.target, evaluateBcmdExpression(expression, runtimeScope)]),
        );
        for (const reaction of model.reactions) {
          const rate = evaluateBcmdExpression(parseBcmdExpression(reaction.rate || "0"), runtimeScope);
          for (const [name, delta] of Object.entries(reaction.delta)) {
            if (rootSet.has(name)) derivative[name] = (derivative[name] ?? 0) + delta * rate;
          }
        }
        return derivative;
      },
        project: ({ t, state, parameters: runtimeParameters }: { t: number; state: Record<string, number>; parameters: Record<string, number> }) =>
        applyConstraints(state, evaluateScope(t, state, runtimeParameters, options.input)),
        output: ({ t, state, parameters: runtimeParameters }: { t: number; state: Record<string, number>; parameters: Record<string, number> }) => {
        const runtimeScope = evaluateScope(t, state, runtimeParameters, options.input);
        return Object.fromEntries(model.outputs.map((name) => [name, runtimeScope[name] ?? 0]));
      },
      };
      return options.method === "adaptive"
        ? simulateAdaptiveOde({ ...common, initialStep: options.step ?? 0.1 })
        : simulateOde({ ...common, step: options.step ?? 0.1, method: options.method });
    },
  };
}
