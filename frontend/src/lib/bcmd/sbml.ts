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

export function exportBcmdSbmlCoreXml(model: BcmdProcessedModel) {
  const compartments = '<compartment id="default" constant="true" size="1"/>';
  const parameters = model.symbols
    .filter((symbol) => symbol.role === "parameter" || symbol.role === "input")
    .map((symbol) => `<parameter id="${xmlEscape(symbol.name)}" constant="${symbol.role === "parameter" ? "true" : "false"}"/>`)
    .join("");
  const species = model.roots
    .map((name) => `<species id="${xmlEscape(name)}" compartment="default" hasOnlySubstanceUnits="false" boundaryCondition="false" constant="false"/>`)
    .join("");
  const reactions = model.reactions.map((reaction) => {
    const reactants = Object.entries(reaction.delta).filter(([, delta]) => delta < 0).map(([name, delta]) => `<speciesReference species="${xmlEscape(name)}" stoichiometry="${Math.abs(delta)}"/>`).join("");
    const products = Object.entries(reaction.delta).filter(([, delta]) => delta > 0).map(([name, delta]) => `<speciesReference species="${xmlEscape(name)}" stoichiometry="${delta}"/>`).join("");
    return `<reaction id="${xmlEscape(reaction.name)}" reversible="false"><listOfReactants>${reactants}</listOfReactants><listOfProducts>${products}</listOfProducts><kineticLaw><math xmlns="http://www.w3.org/1998/Math/MathML"><ci>${xmlEscape(reaction.rate || "0")}</ci></math></kineticLaw></reaction>`;
  }).join("");
  return `<?xml version="1.0" encoding="UTF-8"?><sbml xmlns="http://www.sbml.org/sbml/level3/version2/core" level="3" version="2"><model id="bcmd_model"><listOfCompartments>${compartments}</listOfCompartments><listOfSpecies>${species}</listOfSpecies><listOfParameters>${parameters}</listOfParameters><listOfReactions>${reactions}</listOfReactions></model></sbml>\n`;
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
