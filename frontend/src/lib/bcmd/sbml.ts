import type { BcmdProcessedModel } from "./ast";
import { bcmdEquationLabel } from "./graph";

function xmlEscape(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function exportBcmdSbmlLikeXml(model: BcmdProcessedModel) {
  const species = model.symbols
    .map((symbol) => `      <species id="${xmlEscape(symbol.name)}" name="${xmlEscape(symbol.name)}" bcmd:role="${symbol.role}" />`)
    .join("\n");
  const reactions = model.reactions
    .map((reaction) => `      <reaction id="${xmlEscape(reaction.name)}"><notes>${xmlEscape(reaction.rate)}</notes></reaction>`)
    .join("\n");
  const rules = model.nodes
    .filter((node) => ["assignment", "differentialEquation", "algebraicEquation", "constraint"].includes(node.kind))
    .map((node) => `      <bcmd:rule line="${node.startLine}">${xmlEscape(bcmdEquationLabel(node))}</bcmd:rule>`)
    .join("\n");
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<sbml level="3" version="2" xmlns="http://www.sbml.org/sbml/level3/version2/core" xmlns:bcmd="https://nirser.local/bcmd">',
    '  <model id="bcmd_model">',
    "    <listOfSpecies>",
    species,
    "    </listOfSpecies>",
    "    <listOfReactions>",
    reactions,
    "    </listOfReactions>",
    "    <bcmd:listOfRules>",
    rules,
    "    </bcmd:listOfRules>",
    "  </model>",
    "</sbml>",
    "",
  ].join("\n");
}

export function exportBcmdModeldef(model: BcmdProcessedModel) {
  return `${model.nodes.map((node) => node.source).join("\n")}\n`;
}

export function exportBcmdRuntimeModule(model: BcmdProcessedModel) {
  return [
    "import { processBcmdModel, compileBcmdRuntimeModel } from './bcmd';",
    "",
    `const modeldef = ${JSON.stringify(exportBcmdModeldef(model))};`,
    "export const model = processBcmdModel(modeldef);",
    "export const runtime = compileBcmdRuntimeModel(model);",
    "",
  ].join("\n");
}
