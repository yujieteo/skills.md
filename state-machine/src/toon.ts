import { assert } from "./assert.ts";

export type Cell = string | number;
export type Row = Record<string, Cell>;

export function q(v: Cell): string {
  assert(typeof v === "string" || typeof v === "number", "a cell is a string or a number");
  const s = String(v);
  const needsQuotes = s === "" || /[,:"\n]|^\s|\s$/.test(s);
  assert(needsQuotes || s === s.trim(), "an unquoted cell has no edge space");
  if (!needsQuotes) return s;
  const quoted = `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n")}"`;
  assert(quoted.length >= s.length + 2, "quoting only adds characters");
  return quoted;
}

export function table(name: string, keys: string[], list: Row[]): string {
  assert(name !== "", "a table has a name");
  assert(keys.length > 0, "a table has columns");
  if (!list.length) return `${name}: []`;
  const lines: string[] = [];
  for (const o of list) {
    const cells: string[] = [];
    for (const k of keys) cells.push(q(o[k] ?? ""));
    lines.push("  " + cells.join(","));
  }
  assert(lines.length === list.length, "one line for each row");
  return `${name}[${list.length}]{${keys.join(",")}}:\n` + lines.join("\n");
}

export function help(lines: string[]): string {
  assert(lines.length > 0, "help has a line");
  const body = lines.map(indent);
  assert(body.length === lines.length, "one line out for each line in");
  return `help[${lines.length}]:\n` + body.join("\n");
}

function indent(line: string): string {
  assert(typeof line === "string", "a help line is text");
  assert(!line.includes("\n"), "a help line is one line");
  return "  " + line;
}
