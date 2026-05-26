import type {
  BcmdAlgebraicEquationNode,
  BcmdAssignmentNode,
  BcmdConstraintNode,
  BcmdDifferentialEquationNode,
  BcmdDirectiveNode,
  BcmdDocCommentNode,
  BcmdEmbeddedBlockNode,
  BcmdProgram,
  BcmdReactionNode,
  BcmdReactionParticipant,
  BcmdSourceSpan,
  BcmdStatementNode,
  BcmdUnknownNode,
} from "./ast";
import { collectBcmdSourceRecords } from "./lexer";

const identifierPattern = "[A-Za-z_][A-Za-z0-9_]*";
const identifierOnly = new RegExp(`^${identifierPattern}$`);
const mathFunctions = new Set([
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
const reservedWords = new Set(["and", "else", "false", "if", "or", "return", "true"]);

function unique(values: string[]) {
  return Array.from(new Set(values));
}

function without(values: string[], omitted: string[]) {
  const omittedSet = new Set(omitted);
  return values.filter((value) => !omittedSet.has(value));
}

export function extractExpressionSymbols(expression = "") {
  const expressionWithoutStrings = expression.replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, " ");
  const matches = expressionWithoutStrings.match(new RegExp(identifierPattern, "g")) ?? [];
  return unique(matches.filter((symbol) => !mathFunctions.has(symbol) && !reservedWords.has(symbol)));
}

function sourceSpan(source: string, startLine: number, endLine = startLine): BcmdSourceSpan {
  return { startLine, endLine, source };
}

function parseDirective(source: string, startLine: number, endLine: number): BcmdDirectiveNode | undefined {
  const match = source.match(new RegExp(`^@(${identifierPattern})(?:\\s+(.*))?$`));
  if (!match) return undefined;
  return {
    ...sourceSpan(source, startLine, endLine),
    kind: "directive",
    name: match[1],
    args: match[2]?.split(/\s+/).filter(Boolean) ?? [],
  };
}

function parseDocComment(source: string, startLine: number, endLine: number): BcmdDocCommentNode | undefined {
  if (!source.startsWith("##")) return undefined;
  return {
    ...sourceSpan(source, startLine, endLine),
    kind: "docComment",
    text: source.replace(/^##\s?/, ""),
  };
}

function parseEmbeddedBlock(source: string, startLine: number, endLine: number): BcmdEmbeddedBlockNode | undefined {
  if (!source.startsWith("[**") && !source.endsWith("**]")) return undefined;
  const body = source.replace(/^\[\*\*\s?/, "").replace(/\s?\*\*\]$/, "");
  return {
    ...sourceSpan(source, startLine, endLine),
    kind: "embeddedBlock",
    body,
    dependencies: extractExpressionSymbols(body),
  };
}

function parseDifferentialEquation(
  source: string,
  startLine: number,
  endLine: number,
): BcmdDifferentialEquationNode | undefined {
  const match = source.match(new RegExp(`^(${identifierPattern})'\\s*=\\s*(.+)$`));
  if (!match) return undefined;
  return {
    ...sourceSpan(source, startLine, endLine),
    kind: "differentialEquation",
    target: match[1],
    expression: match[2].trim(),
    dependencies: without(extractExpressionSymbols(match[2]), [match[1]]),
  };
}

function parseAlgebraicEquation(
  source: string,
  startLine: number,
  endLine: number,
): BcmdAlgebraicEquationNode | undefined {
  const match = source.match(new RegExp(`^(${identifierPattern})\\s*:\\s*(.+?)\\s*=\\s*(.+)$`));
  if (!match) return undefined;
  const leftExpression = match[2].trim();
  const rightExpression = match[3].trim();
  return {
    ...sourceSpan(source, startLine, endLine),
    kind: "algebraicEquation",
    target: match[1],
    leftExpression,
    rightExpression,
    dependencies: without(extractExpressionSymbols(`${leftExpression} ${rightExpression}`), [match[1]]),
  };
}

function parseAssignment(source: string, startLine: number, endLine: number): BcmdAssignmentNode | undefined {
  const match = source.match(new RegExp(`^(${identifierPattern})\\s*(:=|=)\\s*(.+)$`));
  if (!match) return undefined;
  return {
    ...sourceSpan(source, startLine, endLine),
    kind: "assignment",
    target: match[1],
    operator: match[2] as BcmdAssignmentNode["operator"],
    expression: match[3].trim(),
    dependencies: without(extractExpressionSymbols(match[3]), [match[1]]),
    initialOnly: match[2] === ":=",
  };
}

function parseConstraint(source: string, startLine: number, endLine: number): BcmdConstraintNode | undefined {
  const match = source.match(/^~?\s*(.+?)\s*(<=|>=|==|!=|<|>)\s*(.+)$/);
  if (!match) return undefined;
  const leftExpression = match[1].trim();
  const rightExpression = match[3].trim();
  const leftSymbols = extractExpressionSymbols(leftExpression);
  const target = leftSymbols.length === 1 && identifierOnly.test(leftExpression) ? leftExpression : undefined;
  return {
    ...sourceSpan(source, startLine, endLine),
    kind: "constraint",
    target,
    operator: match[2] as BcmdConstraintNode["operator"],
    leftExpression,
    rightExpression,
    dependencies: unique([...leftSymbols, ...extractExpressionSymbols(rightExpression)]),
  };
}

function parseParticipantList(source: string): BcmdReactionParticipant[] {
  return source
    .split("+")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const bracketed = part.match(new RegExp(`^(?:(\\d*\\.?\\d+)\\s*)?\\[(${identifierPattern})(?:\\s*,\\s*${identifierPattern})?\\]$`));
      if (bracketed) return { species: bracketed[2], coefficient: bracketed[1] ? Number(bracketed[1]) : undefined };
      const match = part.match(new RegExp(`^(?:(\\d*\\.?\\d+)\\s*)?(${identifierPattern})$`));
      return match ? { species: match[2], coefficient: match[1] ? Number(match[1]) : undefined } : { species: part };
    });
}

function parseReaction(source: string, startLine: number, endLine: number): BcmdReactionNode | undefined {
  const arrow = source.includes("<->") ? "<->" : source.includes("->") ? "->" : undefined;
  if (!arrow) return undefined;
  const [left, rightAndRate] = source.split(arrow);
  if (!rightAndRate) return undefined;
  const braceRate = rightAndRate.match(/^(.*?)\s*\{(.*)\}\s*$/);
  const [right, rateExpression] = braceRate ? [braceRate[1], braceRate[2]] : rightAndRate.split(/\s*;\s*/, 2);
  const reactants = parseParticipantList(left);
  const products = parseParticipantList(right);
  const species = [...reactants, ...products].map((participant) => participant.species);
  return {
    ...sourceSpan(source, startLine, endLine),
    kind: "reaction",
    reversible: arrow === "<->",
    reactants,
    products,
    rateExpression: rateExpression?.trim() || undefined,
    dependencies: without(extractExpressionSymbols(source), species),
  };
}

function parseUnknown(source: string, startLine: number, endLine: number): BcmdUnknownNode {
  return {
    ...sourceSpan(source, startLine, endLine),
    kind: "unknown",
    dependencies: extractExpressionSymbols(source),
  };
}

export function parseBcmdStatement(source: string, startLine = 1, endLine = startLine): BcmdStatementNode {
  return (
    parseDirective(source, startLine, endLine) ??
    parseDocComment(source, startLine, endLine) ??
    parseEmbeddedBlock(source, startLine, endLine) ??
    parseReaction(source, startLine, endLine) ??
    parseDifferentialEquation(source, startLine, endLine) ??
    parseAlgebraicEquation(source, startLine, endLine) ??
    parseAssignment(source, startLine, endLine) ??
    parseConstraint(source, startLine, endLine) ??
    parseUnknown(source, startLine, endLine)
  );
}

export function parseBcmdProgram(text: string): BcmdProgram {
  const statements = collectBcmdSourceRecords(text).map((record) =>
    parseBcmdStatement(record.source, record.startLine, record.endLine),
  );
  return {
    statements,
    directives: statements.filter((statement): statement is BcmdDirectiveNode => statement.kind === "directive"),
    symbols: unique(statements.flatMap((statement) => ("dependencies" in statement ? statement.dependencies : []))),
  };
}
