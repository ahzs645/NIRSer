import { describe, expect, it } from "vitest";
import { numericColumns, parseBcmdCsvNumericTable, parseBraincircDatTable } from "./data";

describe("BCMD data utilities", () => {
  it("parses CSV numeric tables with quoted headers and ragged numeric rows", () => {
    const table = parseBcmdCsvNumericTable(['"time,s",CBF,CMRO2', "0,10,3", "5,12", "bad,row"].join("\n"));

    expect(table.columns).toEqual(["time,s", "CBF", "CMRO2"]);
    expect(table.rows).toEqual([
      [0, 10, 3],
      [5, 12, Number.NaN],
    ]);
    expect(numericColumns(table)).toEqual([
      { name: "time,s", values: [0, 5] },
      { name: "CBF", values: [10, 12] },
      { name: "CMRO2", values: [3] },
    ]);
  });

  it("parses Braincirc-ish .dat whitespace tables with optional row labels", () => {
    const table = parseBraincircDatTable(
      [
        "# simplified Braincirc parameter/value export",
        "parameter baseline stressed",
        "CBF 0.01075 0.012",
        "CMRO2 0.0034 0.0038",
        "0 40 0.21",
      ].join("\n"),
    );

    expect(table.columns).toEqual(["parameter", "baseline", "stressed"]);
    expect(table.rowLabels).toEqual(["CBF", "CMRO2"]);
    expect(table.rows).toEqual([
      [0.01075, 0.012, Number.NaN],
      [0.0034, 0.0038, Number.NaN],
      [0, 40, 0.21],
    ]);
  });

  it("falls back to generated column names for headerless numeric data", () => {
    const table = parseBcmdCsvNumericTable("1,2\n3,4");

    expect(table.columns).toEqual(["col1", "col2"]);
    expect(table.rows).toEqual([
      [1, 2],
      [3, 4],
    ]);
  });
});
