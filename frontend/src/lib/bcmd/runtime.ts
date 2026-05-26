import type { BcmdAssignmentNode, BcmdDifferentialEquationNode, BcmdProcessedModel } from "./ast";
import { evaluateBcmdExpression, parseBcmdExpression } from "./expressions";
import { simulateOde, type SimulationPoint } from "./solver";

export interface BcmdRuntimeModel {
  roots: string[];
  parameters: Record<string, number>;
  initialState: Record<string, number>;
  diagnostics: string[];
  simulate: (options?: Partial<{ start: number; end: number; step: number }>) => Array<SimulationPoint<Record<string, number>>>;
}

function assignmentValue(node: BcmdAssignmentNode, scope: Record<string, number>) {
  return evaluateBcmdExpression(parseBcmdExpression(node.expression), scope);
}

export function compileBcmdRuntimeModel(model: BcmdProcessedModel): BcmdRuntimeModel {
  const assignments = model.nodes.filter((node): node is BcmdAssignmentNode => node.kind === "assignment");
  const differentials = model.nodes.filter((node): node is BcmdDifferentialEquationNode => node.kind === "differentialEquation");
  const diagnostics: string[] = [];
  const scope: Record<string, number> = { [model.independent]: 0 };
  const rootSet = new Set(model.roots);
  const initialState: Record<string, number> = {};
  const parameters: Record<string, number> = {};

  for (const node of assignments) {
    try {
      const value = assignmentValue(node, scope);
      scope[node.target] = value;
      if (rootSet.has(node.target)) initialState[node.target] = value;
      else parameters[node.target] = value;
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

  return {
    roots: model.roots,
    parameters,
    initialState,
    diagnostics,
    simulate: (options = {}) => simulateOde({
      initialState,
      parameters,
      start: options.start ?? 0,
      end: options.end ?? 10,
      step: options.step ?? 0.1,
      derivative: ({ t, state, parameters: runtimeParameters }) => {
        const runtimeScope = { ...parameters, ...runtimeParameters, ...state, [model.independent]: t };
        return Object.fromEntries(
          compiledDifferentials.map(({ node, expression }) => [node.target, evaluateBcmdExpression(expression, runtimeScope)]),
        );
      },
      output: ({ state }) => Object.fromEntries(model.outputs.map((name) => [name, state[name] ?? parameters[name] ?? 0])),
    }),
  };
}
