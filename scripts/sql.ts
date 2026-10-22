/** A SQL literal for seed files: NULL, a number, or a single-quoted string. */
export const sql = (value: string | number | null) =>
  value === null
    ? "NULL"
    : typeof value === "number"
      ? String(value)
      : `'${value.replaceAll("'", "''")}'`;
