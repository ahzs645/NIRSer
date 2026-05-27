export type BcmdBatchTable = {
  headers: string[];
  rows: Array<Record<string, string>>;
};

export type BcmdBatchHeatmap = {
  rows: string[];
  columns: string[];
  values: number[][];
  field: string;
};

export type BcmdBestFitTables = {
  times: number[];
  measured: number[];
  measuredName: string;
  traces: Array<{ name: string; values: number[]; score: number }>;
};

function splitLine(line: string) {
  return line.trim().split(/[,\t ]+/).filter(Boolean);
}

export function parseBcmdBatchTable(text: string): BcmdBatchTable {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = splitLine(lines[0]);
  const rows = lines.slice(1).map((line) => {
    const values = splitLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  });
  return { headers, rows };
}

export function buildBcmdBatchHeatmap(
  table: BcmdBatchTable,
  options: { field?: string; row?: string; column?: string } = {},
): BcmdBatchHeatmap {
  const field = options.field ?? table.headers.find((header) => /^dist_/i.test(header)) ?? table.headers.at(-1) ?? "";
  const rowKey = options.row ?? (table.headers.includes("input") ? "input" : table.headers[0]);
  const colKey = options.column ?? (table.headers.includes("Param") ? "Param" : table.headers[1] ?? table.headers[0]);
  const rows = Array.from(new Set(table.rows.map((row) => row[rowKey]).filter(Boolean)));
  const columns = Array.from(new Set(table.rows.map((row) => row[colKey]).filter(Boolean)));
  const values = rows.map((rowName) =>
    columns.map((columnName) => {
      const match = table.rows.find((row) => row[rowKey] === rowName && row[colKey] === columnName);
      const value = Number(match?.[field]);
      return Number.isFinite(value) ? value : Number.NaN;
    }),
  );
  return { rows, columns, values, field };
}

export function buildBcmdBestFitTables(resultsText: string, distancesText: string): BcmdBestFitTables {
  const results = parseBcmdBatchTable(resultsText);
  const distances = parseBcmdBatchTable(distancesText);
  const timeHeaders = results.headers.filter((header) => /^t\d+/i.test(header));
  const firstDataRow = results.rows.findIndex((row) => Number.isFinite(Number(row.job)));
  if (timeHeaders.length === 0 || firstDataRow < 1) throw new Error("BCMD results table is missing time-series rows.");
  const times = timeHeaders.map((header) => Number(results.rows[0][header])).filter(Number.isFinite);
  const measuredRow = results.rows[firstDataRow - 1];
  const measured = timeHeaders.map((header) => Number(measuredRow[header]));
  const measuredName = measuredRow.species || "Measured";
  const distanceField = distances.headers.find((header) => /^dist_/i.test(header)) ?? distances.headers.at(-1) ?? "";
  const ranked = distances.rows
    .map((row, index) => ({ index, score: Number(row[distanceField]) }))
    .filter((item) => Number.isFinite(item.score))
    .sort((a, b) => a.score - b.score)
    .slice(0, 3);
  const traces = ranked.flatMap((item) => {
    const row = results.rows[firstDataRow + item.index];
    return row ? [{ name: `${distanceField} ${item.score.toFixed(3)}`, score: item.score, values: timeHeaders.map((header) => Number(row[header])) }] : [];
  });
  return { times, measured, measuredName, traces };
}
