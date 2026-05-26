import type { BcmdProcessedModel } from "./ast";
import type { BcmdInputStep } from "./input";

function csvEscape(value: string | number) {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function exportBcmdModelSummaryCsv(model: BcmdProcessedModel) {
  const rows = [["Name", "Role", "Dependencies", "Tags", "Units", "Latex"]];
  for (const symbol of model.symbols) {
    rows.push([
      symbol.name,
      symbol.role,
      symbol.dependencies.join(" "),
      symbol.tags.join(" "),
      symbol.units ?? "",
      symbol.latex ?? "",
    ]);
  }
  return `${rows.map((row) => row.map(csvEscape).join(",")).join("\n")}\n`;
}

export function exportBcmdInputStepsCsv(steps: readonly BcmdInputStep[]) {
  const fields = Array.from(new Set(steps.flatMap((step) => step.fields)));
  const rows: Array<Array<string | number>> = [["Start", "End", "Duration", ...fields]];
  for (const step of steps) {
    rows.push([
      step.start,
      step.end,
      step.duration,
      ...fields.map((field) => step.assignments[field] ?? ""),
    ]);
  }
  return `${rows.map((row) => row.map(csvEscape).join(",")).join("\n")}\n`;
}

export function exportBcmdDependencyDot(model: BcmdProcessedModel) {
  const lines = ["digraph bcmd {", "  rankdir=LR;"];
  for (const symbol of model.symbols) {
    lines.push(`  "${symbol.name}" [label="${symbol.name}\\n${symbol.role}"];`);
    for (const dependency of symbol.dependencies) {
      lines.push(`  "${dependency}" -> "${symbol.name}";`);
    }
  }
  lines.push("}");
  return `${lines.join("\n")}\n`;
}

export function exportBcmdTextReport(model: BcmdProcessedModel) {
  return [
    `Independent: ${model.independent}`,
    `Inputs: ${model.inputs.join(", ") || "none"}`,
    `Outputs: ${model.outputs.join(", ") || "none"}`,
    `Roots: ${model.roots.join(", ") || "none"}`,
    `Reactions: ${model.reactions.length}`,
    `Diagnostics: ${model.diagnostics.length}`,
    "",
    "Symbols:",
    ...model.symbols.map((symbol) => `- ${symbol.name} (${symbol.role}) <- ${symbol.dependencies.join(", ") || "none"}`),
    "",
  ].join("\n");
}

export function exportBcmdHtmlReport(model: BcmdProcessedModel) {
  const rows = model.symbols
    .map(
      (symbol) =>
        `<tr><td>${symbol.name}</td><td>${symbol.role}</td><td>${symbol.dependencies.join(", ")}</td><td>${symbol.units ?? ""}</td></tr>`,
    )
    .join("");
  return `<!doctype html><html><body><h1>BCMD Model</h1><table><thead><tr><th>Name</th><th>Role</th><th>Dependencies</th><th>Units</th></tr></thead><tbody>${rows}</tbody></table></body></html>`;
}

export function exportBcmdLatexReport(model: BcmdProcessedModel) {
  return [
    "\\section*{BCMD Model}",
    "\\begin{tabular}{lll}",
    "Name & Role & Dependencies \\\\",
    ...model.symbols.map((symbol) => `${symbol.latex ?? symbol.name} & ${symbol.role} & ${symbol.dependencies.join(", ")} \\\\`),
    "\\end{tabular}",
    "",
  ].join("\n");
}
