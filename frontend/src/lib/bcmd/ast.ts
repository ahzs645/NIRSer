export type BcmdExpression =
  | { type: "number"; value: number }
  | { type: "symbol"; name: string }
  | { type: "unary"; operator: "-"; argument: BcmdExpression }
  | { type: "binary"; operator: "+" | "-" | "*" | "/" | "^"; left: BcmdExpression; right: BcmdExpression }
  | { type: "call"; name: string; args: BcmdExpression[] }
  | { type: "conditional"; test: BcmdLogicalExpression; consequent: BcmdExpression; alternate: BcmdExpression };

export type BcmdLogicalExpression = {
  type: "logical";
  operator: "<" | "<=" | ">" | ">=" | "==" | "!=";
  left: BcmdExpression;
  right: BcmdExpression;
};

export type BcmdModelNode =
  | { type: "directive"; directive: string; values: string[]; line: number; source: string }
  | { type: "doc"; body: string; line: number; source: string }
  | { type: "embedded"; code: string; line: number; source: string }
  | { type: "assignment"; name: string; expression: BcmdExpression; initialOnly: boolean; label?: string; line: number; source: string }
  | { type: "differential"; name: string; expression: BcmdExpression; auxiliaries: BcmdAuxiliaryDerivative[]; label?: string; line: number; source: string }
  | { type: "algebraic"; name: string; left: BcmdExpression; right: BcmdExpression; normalized: BcmdExpression; label?: string; line: number; source: string }
  | { type: "constraint"; soft: boolean; name: string; operator: "<" | "<=" | ">" | ">="; expression: BcmdExpression; label?: string; line: number; source: string }
  | { type: "reaction"; reversible: boolean; left: BcmdChemicalTerm[]; right: BcmdChemicalTerm[]; rates: BcmdExpression[]; label?: string; line: number; source: string }
  | { type: "unknown"; line: number; source: string; message: string };

export type BcmdAuxiliaryDerivative = {
  sign: 1 | -1;
  coefficient: number;
  name: string;
};

export type BcmdChemicalTerm = {
  coefficient: BcmdExpression;
  chemical: string;
  compartment?: string;
};

export type BcmdModelDocument = {
  nodes: BcmdModelNode[];
  diagnostics: BcmdDiagnostic[];
};

export type BcmdDiagnostic = {
  line: number;
  message: string;
  source?: string;
};

export type BcmdProcessedSymbol = {
  name: string;
  role: "independent" | "root" | "input" | "output" | "parameter" | "intermediate" | "external" | "unknown";
  dependencies: string[];
  docs: string[];
  tags: string[];
  latex?: string;
  units?: string;
};

export type BcmdProcessedModel = {
  nodes: BcmdModelNode[];
  diagnostics: BcmdDiagnostic[];
  independent: string;
  imports: string[];
  symbols: BcmdProcessedSymbol[];
  roots: string[];
  inputs: string[];
  outputs: string[];
  externs: string[];
  dependencyOrder: string[];
  reactions: Array<{ name: string; delta: Record<string, number>; rate: string }>;
};

export interface BcmdSourceSpan {
  startLine: number;
  endLine: number;
  source: string;
}

export type BcmdDirectiveNode = BcmdSourceSpan & {
  kind: "directive";
  name: string;
  args: string[];
};

export type BcmdDocCommentNode = BcmdSourceSpan & {
  kind: "docComment";
  text: string;
};

export type BcmdEmbeddedBlockNode = BcmdSourceSpan & {
  kind: "embeddedBlock";
  body: string;
  dependencies: string[];
};

export type BcmdAssignmentNode = BcmdSourceSpan & {
  kind: "assignment";
  target: string;
  operator: ":=" | "=";
  expression: string;
  dependencies: string[];
  initialOnly: boolean;
};

export type BcmdDifferentialEquationNode = BcmdSourceSpan & {
  kind: "differentialEquation";
  target: string;
  expression: string;
  dependencies: string[];
};

export type BcmdAlgebraicEquationNode = BcmdSourceSpan & {
  kind: "algebraicEquation";
  target: string;
  leftExpression: string;
  rightExpression: string;
  dependencies: string[];
};

export type BcmdConstraintNode = BcmdSourceSpan & {
  kind: "constraint";
  target?: string;
  operator: "<" | "<=" | ">" | ">=" | "==" | "!=";
  leftExpression: string;
  rightExpression: string;
  dependencies: string[];
};

export type BcmdReactionParticipant = {
  species: string;
  coefficient?: number;
};

export type BcmdReactionNode = BcmdSourceSpan & {
  kind: "reaction";
  reversible: boolean;
  reactants: BcmdReactionParticipant[];
  products: BcmdReactionParticipant[];
  rateExpression?: string;
  dependencies: string[];
};

export type BcmdUnknownNode = BcmdSourceSpan & {
  kind: "unknown";
  dependencies: string[];
};

export type BcmdStatementNode =
  | BcmdDirectiveNode
  | BcmdDocCommentNode
  | BcmdEmbeddedBlockNode
  | BcmdAssignmentNode
  | BcmdDifferentialEquationNode
  | BcmdAlgebraicEquationNode
  | BcmdConstraintNode
  | BcmdReactionNode
  | BcmdUnknownNode;

export interface BcmdProgram {
  statements: BcmdStatementNode[];
  directives: BcmdDirectiveNode[];
  symbols: string[];
}
