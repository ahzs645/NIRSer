export interface NumericTable {
  columns: string[];
  rows: number[][];
  rowLabels: string[];
}

function stripComment(rawLine: string) {
  return rawLine.replace(/#.*/, "").trim();
}

function splitDelimitedLine(line: string, delimiter: "," | "\t") {
  const values: string[] = [];
  let quoted = false;
  let value = "";
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }
    if (char === delimiter && !quoted) {
      values.push(value.trim());
      value = "";
      continue;
    }
    value += char;
  }
  values.push(value.trim());
  return values;
}

function hasNumericValue(tokens: string[]) {
  return tokens.some((token) => Number.isFinite(Number(token)));
}

function numericRow(tokens: string[]) {
  return tokens.map((token) => Number(token)).filter(Number.isFinite);
}

function defaultColumns(width: number) {
  return Array.from({ length: width }, (_, index) => `col${index + 1}`);
}

function alignColumns(columns: string[], width: number) {
  if (columns.length >= width) return columns.slice(0, width);
  return [...columns, ...Array.from({ length: width - columns.length }, (_, index) => `col${columns.length + index + 1}`)];
}

export function parseBcmdCsvNumericTable(text: string): NumericTable {
  const lines = text.split(/\r?\n/).map(stripComment).filter(Boolean);
  const parsed = lines.map((line) => splitDelimitedLine(line, ","));
  const header = parsed.find((tokens) => !hasNumericValue(tokens));
  const dataRows = parsed.filter(hasNumericValue).map(numericRow).filter((row) => row.length > 0);
  const width = Math.max(0, ...dataRows.map((row) => row.length));

  return {
    columns: header ? alignColumns(header, width) : defaultColumns(width),
    rows: dataRows.map((row) => row.concat(Array(Math.max(0, width - row.length)).fill(Number.NaN))),
    rowLabels: [],
  };
}

export function parseBraincircDatTable(text: string): NumericTable {
  const rows: number[][] = [];
  const rowLabels: string[] = [];
  let columns: string[] = [];

  for (const rawLine of text.split(/\r?\n/)) {
    const line = stripComment(rawLine);
    if (!line) continue;
    const tokens = line.split(/\s+/).filter(Boolean);
    if (tokens.length === 0) continue;
    const numbers = numericRow(tokens);
    if (numbers.length === 0) {
      columns = tokens;
      continue;
    }
    const firstNumericIndex = tokens.findIndex((token) => Number.isFinite(Number(token)));
    const label = firstNumericIndex > 0 ? tokens.slice(0, firstNumericIndex).join(" ") : "";
    if (label) rowLabels.push(label);
    rows.push(numbers);
  }

  const width = Math.max(0, ...rows.map((row) => row.length));
  return {
    columns: columns.length > 0 ? alignColumns(columns, width) : defaultColumns(width),
    rows: rows.map((row) => row.concat(Array(Math.max(0, width - row.length)).fill(Number.NaN))),
    rowLabels,
  };
}

export function numericColumns(table: NumericTable) {
  return table.columns.map((column, index) => ({
    name: column,
    values: table.rows.map((row) => row[index]).filter(Number.isFinite),
  }));
}
