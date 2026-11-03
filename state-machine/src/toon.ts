export type Cell = string | number;
export type Row = Record<string, Cell>;

export const q = (v: Cell): string => {
  const s = String(v);
  return s === "" || /[,:"\n]|^\s|\s$/.test(s) ? `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n")}"` : s;
};

export function table(name: string, keys: string[], list: Row[]): string {
  if (!list.length) return `${name}: []`;
  return `${name}[${list.length}]{${keys.join(",")}}:\n` + list.map((o) => "  " + keys.map((k) => q(o[k] ?? "")).join(",")).join("\n");
}

export function help(lines: string[]): string {
  return `help[${lines.length}]:\n` + lines.map((l) => "  " + l).join("\n");
}
