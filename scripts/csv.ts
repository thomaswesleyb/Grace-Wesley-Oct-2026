const CSV_FIELD = /(?:"((?:[^"]|"")*)"|([^",\r\n]*))(,|\r?\n|$)/y;

/** Minimal RFC 4180 parser: quoted fields, doubled quotes, CRLF or LF line endings. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  CSV_FIELD.lastIndex = 0;
  while (CSV_FIELD.lastIndex < text.length) {
    const start = CSV_FIELD.lastIndex;
    const match = CSV_FIELD.exec(text);
    if (match === null)
      throw new Error(
        `CSV is malformed near character ${start + 1} (check for stray or unclosed quotes).`,
      );
    const [, quoted, plain, delimiter] = match;
    row.push(quoted === undefined ? (plain ?? "") : quoted.replaceAll('""', '"'));
    if (delimiter !== ",") {
      rows.push(row);
      row = [];
    }
  }
  if (row.length > 0) rows.push([...row, ""]);
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}
