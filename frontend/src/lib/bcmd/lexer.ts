export interface BcmdLexedLine {
  line: number;
  raw: string;
  text: string;
}

export interface BcmdSourceRecord {
  startLine: number;
  endLine: number;
  source: string;
}

export function stripBcmdInlineComment(line: string) {
  if (line.trimStart().startsWith("##")) return line.trim();

  let quote: '"' | "'" | undefined;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const previous = line[index - 1];

    if ((char === '"' || char === "'") && previous !== "\\") {
      quote = quote === char ? undefined : quote ?? char;
      continue;
    }

    if (char === "#" && quote === undefined) {
      return line.slice(0, index).trim();
    }
  }

  return line.trim();
}

export function lexBcmdLines(text: string): BcmdLexedLine[] {
  return text
    .split(/\r?\n/)
    .map((raw, index) => ({ line: index + 1, raw, text: stripBcmdInlineComment(raw) }))
    .filter((line) => line.text.length > 0);
}

export function collectBcmdSourceRecords(text: string): BcmdSourceRecord[] {
  const lines = lexBcmdLines(text);
  const records: BcmdSourceRecord[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const current = lines[index];

    if (current.text.startsWith("[**") && !current.text.includes("**]")) {
      const block = [current.text];
      let endLine = current.line;

      while (index + 1 < lines.length) {
        index += 1;
        block.push(lines[index].text);
        endLine = lines[index].line;
        if (lines[index].text.includes("**]")) break;
      }

      records.push({ startLine: current.line, endLine, source: block.join("\n") });
      continue;
    }

    records.push({ startLine: current.line, endLine: current.line, source: current.text });
  }

  return records;
}
