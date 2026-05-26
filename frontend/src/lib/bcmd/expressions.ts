import type { BcmdExpression, BcmdLogicalExpression } from "./ast";

type Token = { type: "number" | "id" | "op" | "paren" | "comma" | "question" | "colon" | "eof"; value: string };

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
  "log",
  "log10",
  "max",
  "min",
  "pow",
  "sin",
  "sinh",
  "sqrt",
  "tan",
  "tanh",
]);

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;
  while (index < input.length) {
    const rest = input.slice(index);
    const space = rest.match(/^\s+/);
    if (space) {
      index += space[0].length;
      continue;
    }
    const number = rest.match(/^\d+(?:\.\d+)?(?:[eE][-+]?\d+)?|^\.\d+(?:[eE][-+]?\d+)?/);
    if (number) {
      tokens.push({ type: "number", value: number[0] });
      index += number[0].length;
      continue;
    }
    const id = rest.match(/^[A-Za-z_][A-Za-z0-9_]*/);
    if (id) {
      tokens.push({ type: "id", value: id[0] });
      index += id[0].length;
      continue;
    }
    const two = rest.slice(0, 2);
    if (["<=", ">=", "==", "!="].includes(two)) {
      tokens.push({ type: "op", value: two });
      index += 2;
      continue;
    }
    const char = input[index];
    if ("+-*/^<>".includes(char)) tokens.push({ type: "op", value: char });
    else if (char === "(" || char === ")") tokens.push({ type: "paren", value: char });
    else if (char === ",") tokens.push({ type: "comma", value: char });
    else if (char === "?") tokens.push({ type: "question", value: char });
    else if (char === ":") tokens.push({ type: "colon", value: char });
    else throw new Error(`Unexpected expression character '${char}'.`);
    index += 1;
  }
  tokens.push({ type: "eof", value: "" });
  return tokens;
}

class ExpressionParser {
  private index = 0;
  private readonly tokens: Token[];

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  parse(): BcmdExpression {
    const expression = this.parseConditional();
    if (this.peek().type !== "eof") throw new Error(`Unexpected token '${this.peek().value}'.`);
    return expression;
  }

  private peek(offset = 0) {
    return this.tokens[this.index + offset] ?? this.tokens[this.tokens.length - 1];
  }

  private consume(value?: string) {
    const token = this.peek();
    if (value && token.value !== value) throw new Error(`Expected '${value}', received '${token.value}'.`);
    this.index += 1;
    return token;
  }

  private parseConditional(): BcmdExpression {
    const left = this.parseComparisonOperand();
    if (this.peek().type === "question") {
      throw new Error("Conditional expressions require an explicit comparison before '?'.");
    }
    if (this.peek().type === "op" && ["<", "<=", ">", ">=", "==", "!="].includes(this.peek().value)) {
      const operator = this.consume().value as BcmdLogicalExpression["operator"];
      const right = this.parseComparisonOperand();
      const test: BcmdLogicalExpression = { type: "logical", operator, left, right };
      if (this.peek().type === "question") {
        this.consume("?");
        const consequent = this.parseConditional();
        this.consume(":");
        const alternate = this.parseConditional();
        return { type: "conditional", test, consequent, alternate };
      }
      throw new Error("Bare logical expressions are only valid in conditionals.");
    }
    return left;
  }

  private parseComparisonOperand() {
    return this.parseAddSub();
  }

  private parseAddSub(): BcmdExpression {
    let expression = this.parseMulDiv();
    while (this.peek().type === "op" && (this.peek().value === "+" || this.peek().value === "-")) {
      const operator = this.consume().value as "+" | "-";
      expression = { type: "binary", operator, left: expression, right: this.parseMulDiv() };
    }
    return expression;
  }

  private parseMulDiv(): BcmdExpression {
    let expression = this.parsePower();
    while (this.peek().type === "op" && (this.peek().value === "*" || this.peek().value === "/")) {
      const operator = this.consume().value as "*" | "/";
      expression = { type: "binary", operator, left: expression, right: this.parsePower() };
    }
    return expression;
  }

  private parsePower(): BcmdExpression {
    let expression = this.parseUnary();
    if (this.peek().type === "op" && this.peek().value === "^") {
      this.consume("^");
      expression = { type: "binary", operator: "^", left: expression, right: this.parsePower() };
    }
    return expression;
  }

  private parseUnary(): BcmdExpression {
    if (this.peek().type === "op" && this.peek().value === "-") {
      this.consume("-");
      return { type: "unary", operator: "-", argument: this.parseUnary() };
    }
    return this.parsePrimary();
  }

  private parsePrimary(): BcmdExpression {
    const token = this.peek();
    if (token.type === "number") {
      this.consume();
      return { type: "number", value: Number(token.value) };
    }
    if (token.type === "id") {
      this.consume();
      if (this.peek().value === "(") {
        this.consume("(");
        const args: BcmdExpression[] = [];
        if (this.peek().value !== ")") {
          let readingArgs = true;
          while (readingArgs) {
            args.push(this.parseConditional());
            if (this.peek().type === "comma") {
              this.consume(",");
            } else {
              readingArgs = false;
            }
          }
        }
        this.consume(")");
        return { type: "call", name: token.value, args };
      }
      return { type: "symbol", name: token.value };
    }
    if (token.value === "(") {
      this.consume("(");
      const expression = this.parseConditional();
      this.consume(")");
      return expression;
    }
    throw new Error(`Unexpected token '${token.value}'.`);
  }
}

export function parseBcmdExpression(expression: string): BcmdExpression {
  return new ExpressionParser(tokenize(expression)).parse();
}

export function bcmdExpressionSymbols(expression: BcmdExpression): string[] {
  const symbols = new Set<string>();
  const visit = (item: BcmdExpression) => {
    if (item.type === "symbol") symbols.add(item.name);
    else if (item.type === "unary") visit(item.argument);
    else if (item.type === "binary") {
      visit(item.left);
      visit(item.right);
    } else if (item.type === "call") {
      if (!mathFunctions.has(item.name)) symbols.add(item.name);
      item.args.forEach(visit);
    } else if (item.type === "conditional") {
      visit(item.test.left);
      visit(item.test.right);
      visit(item.consequent);
      visit(item.alternate);
    }
  };
  visit(expression);
  return Array.from(symbols);
}

export function formatBcmdExpression(expression: BcmdExpression): string {
  if (expression.type === "number") return String(expression.value);
  if (expression.type === "symbol") return expression.name;
  if (expression.type === "unary") return `-${formatBcmdExpression(expression.argument)}`;
  if (expression.type === "binary") return `(${formatBcmdExpression(expression.left)} ${expression.operator} ${formatBcmdExpression(expression.right)})`;
  if (expression.type === "call") return `${expression.name}(${expression.args.map(formatBcmdExpression).join(", ")})`;
  return `${formatBcmdExpression(expression.test.left)} ${expression.test.operator} ${formatBcmdExpression(expression.test.right)} ? ${formatBcmdExpression(expression.consequent)} : ${formatBcmdExpression(expression.alternate)}`;
}

export function evaluateBcmdExpression(expression: BcmdExpression, scope: Record<string, number>): number {
  if (expression.type === "number") return expression.value;
  if (expression.type === "symbol") return scope[expression.name] ?? Number.NaN;
  if (expression.type === "unary") return -evaluateBcmdExpression(expression.argument, scope);
  if (expression.type === "binary") {
    const left = evaluateBcmdExpression(expression.left, scope);
    const right = evaluateBcmdExpression(expression.right, scope);
    if (expression.operator === "+") return left + right;
    if (expression.operator === "-") return left - right;
    if (expression.operator === "*") return left * right;
    if (expression.operator === "/") return left / right;
    return left ** right;
  }
  if (expression.type === "call") {
    const args = expression.args.map((arg) => evaluateBcmdExpression(arg, scope));
    const fn = Math[expression.name as keyof Math];
    if (typeof fn === "function") return (fn as (...values: number[]) => number)(...args);
    if (expression.name === "min") return Math.min(...args);
    if (expression.name === "max") return Math.max(...args);
    return Number.NaN;
  }
  const left = evaluateBcmdExpression(expression.test.left, scope);
  const right = evaluateBcmdExpression(expression.test.right, scope);
  const passes =
    expression.test.operator === "<" ? left < right
      : expression.test.operator === "<=" ? left <= right
      : expression.test.operator === ">" ? left > right
      : expression.test.operator === ">=" ? left >= right
      : expression.test.operator === "==" ? left === right
      : left !== right;
  return evaluateBcmdExpression(passes ? expression.consequent : expression.alternate, scope);
}
