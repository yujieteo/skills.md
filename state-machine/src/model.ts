import { assert } from "./assert.ts";

export type Item = { id: string; text: string; source: string; line: number };

export type Row = {
  line: number;
  state: string;
  event: string;
  guard: string;
  next: string;
  req: string;
  source: string;
  reqs: string[];
};

export type Machine = {
  kind: "machine" | "proposal";
  name: string;
  initial: string;
  final: string[];
  rows: Row[];
  line: number;
};

export type Doc = {
  file: string;
  title: string;
  intro: string[];
  reqs: Item[];
  bugs: Item[];
  machines: Machine[];
  proposals: Machine[];
  errors: string[];
};

export const FINDING_KINDS = [
  "unreachable",
  "dead-end",
  "unhandled",
  "two-transitions",
  "guard-gap",
  "row-no-req",
  "req-no-row",
  "merge-states",
  "pass-through",
  "global-event",
  "flag-guard",
  "flag-states",
  "function",
] as const;

export type FindingKind = (typeof FINDING_KINDS)[number];

export type Finding = { kind: FindingKind; machine: string; at: string; line: number; detail: string };

export type Analysis = {
  states: string[];
  events: string[];
  eff: Row[];
  checks: Finding[];
  simplify: Finding[];
  cited: Set<string>;
  rows: number;
};

type ProposalResult = { p: Machine; a: Analysis; cur: number; status: "shown" | "hidden"; reason: string };

export type RunResult = {
  res: { m: Machine; a: Analysis }[];
  checks: Finding[];
  proposals: ProposalResult[];
};

const group = (m: RegExpMatchArray, i: number): string => {
  assert(i >= 0 && i < m.length, "the group index is inside the match");
  assert(Array.isArray(m), "a match is an array");
  return m[i] ?? "";
};

function cells(line: string): string[] {
  assert(typeof line === "string", "a row line is text");
  assert(line.includes("|"), "a row line has a pipe");
  assert(line.length < 10 ** 6, "a row line is short");
  const out: string[] = [];
  let cur = "";
  const body = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  for (let i = 0; i < body.length; i++) {
    if (body[i] === "\\" && body[i + 1] === "|") {
      cur += "|";
      i++;
    } else if (body[i] === "|") {
      out.push(cur.trim());
      cur = "";
    } else cur += body[i];
  }
  out.push(cur.trim());
  const unquoted: string[] = [];
  for (const c of out) unquoted.push(c.replace(/^`(.*)`$/, "$1"));
  assert(unquoted.length === out.length, "unquoting keeps each cell");
  assert(unquoted.length >= 1, "a line has at least one cell");
  assert(unquoted.length <= out.length, "no cell is added");
  return unquoted;
}

type Section = { kind: "reqs" } | { kind: "bugs" } | Machine;
type ParseState = { doc: Doc; sec: Section | null; head: string[] | null };

function startSection(st: ParseState, h: string, n: number): void {
  assert(typeof st.doc.title === "string", "the document has a title field");
  assert(Array.isArray(st.doc.errors), "the document has errors");
  assert(h.length < 10 ** 4, "a heading is short");
  assert(n >= 1, "line numbers start at 1");
  assert(h === h.trim(), "a heading is trimmed");
  const { doc } = st;
  const m = /^(machine|proposal)\s+([\w.-]+)$/i.exec(h);
  if (/^requirements$/i.test(h)) st.sec = { kind: "reqs" };
  else if (/^bugs$/i.test(h)) st.sec = { kind: "bugs" };
  else if (m) {
    const kind = group(m, 1).toLowerCase() === "machine" ? "machine" : "proposal";
    const created: Machine = { kind, name: group(m, 2), initial: "", final: [], rows: [], line: n };
    st.sec = created;
    (kind === "machine" ? doc.machines : doc.proposals).push(created);
  } else st.sec = null;
  assert(doc.machines.length + doc.proposals.length >= 0, "sections only add machines");
}

function addItem(doc: Doc, kind: "reqs" | "bugs", line: string, n: number): void {
  assert(typeof line === "string", "a line is text");
  assert(Array.isArray(doc.reqs) && Array.isArray(doc.bugs), "the document has lists");
  assert(line.length < 10 ** 6, "a line is short");
  assert(n >= 1, "line numbers start at 1");
  assert(doc.file !== "", "the document has a file name");
  const m = /^[-*]\s+([A-Za-z][\w.-]*)\s*:\s*(.+)$/.exec(line);
  if (!m) return;
  const parts = group(m, 2).split(/\s+(?:—|--)\s+/);
  const isReq = kind === "reqs";
  if (parts.length < 2)
    doc.errors.push(
      `L${n}: ${isReq ? "requirement" : "bug"} ${group(m, 1)} has no ${isReq ? "source" : "proof"} (write "text -- ${isReq ? "source" : "failing test"}")`,
    );
  (isReq ? doc.reqs : doc.bugs).push({
    id: group(m, 1),
    text: (parts[0] ?? "").trim(),
    source: parts.slice(1).join(" — ").trim(),
    line: n,
  });
}

function addRow(doc: Doc, sec: Machine, head: string[], c: string[], n: number): void {
  assert(Array.isArray(c), "cells are a list");
  assert(Array.isArray(sec.rows), "a machine has rows");
  assert(c.length < 10 ** 4, "a row has few cells");
  assert(n >= 1, "line numbers start at 1");
  assert(head.length >= 1, "a table has a header");
  const col = (k: string): string => {
    const j = head.indexOf(k);
    return j < 0 ? "" : c[j] ?? "";
  };
  const req = col("req");
  const guard = col("guard");
  const row: Row = {
    line: n,
    state: col("state"),
    event: col("event"),
    guard: guard === "-" ? "" : guard,
    next: col("next"),
    req,
    source: col("source"),
    reqs: req && req !== "-" ? req.split(/[,\s]+/).filter(Boolean) : [],
  };
  if (!row.state || !row.event || !row.next) doc.errors.push(`L${n}: a row needs state, event and next`);
  sec.rows.push(row);
  assert(sec.rows.at(-1) === row, "the row was appended");
}

function splitList(text: string): string[] {
  assert(typeof text === "string", "a list is text");
  assert(text.length < 10 ** 6, "a list is short");
  const out: string[] = [];
  for (const part of text.split(",")) if (part.trim()) out.push(part.trim());
  assert(out.length <= text.length + 1, "each entry takes at least a comma");
  assert(out.length <= text.split(",").length, "trimming adds no entries");
  return out;
}

function isSeparator(c: string[]): boolean {
  assert(Array.isArray(c), "cells are a list");
  assert(c.length >= 1, "a line has cells");
  for (const x of c) if (!/^:?-+:?$/.test(x)) return false;
  assert(c.length < 10 ** 4, "a row has few cells");
  return true;
}

function parseMachineLine(st: ParseState, sec: Machine, line: string, n: number): void {
  assert(typeof sec.initial === "string", "a machine has an initial field");
  assert(st.head === null || st.head.length >= 1, "a header has cells");
  assert(st.doc.machines.length + st.doc.proposals.length >= 1, "a machine section exists");
  assert(n >= 1, "line numbers start at 1");
  assert(line === line.trim(), "a line is trimmed");
  const init = /^initial\s*:\s*(.*)$/i.exec(line);
  if (init) {
    sec.initial = group(init, 1).trim();
    return;
  }
  const fin = /^final\s*:\s*(.*)$/i.exec(line);
  if (fin) {
    sec.final = splitList(group(fin, 1));
    return;
  }
  if (!line.startsWith("|")) return;
  const c = cells(line);
  if (!st.head) {
    st.head = [];
    for (const x of c) st.head.push(x.toLowerCase());
    return;
  }
  if (isSeparator(c)) return;
  addRow(st.doc, sec, st.head, c, n);
}

function parseLine(st: ParseState, line: string, n: number): void {
  assert(typeof line === "string", "a line is text");
  assert(Array.isArray(st.doc.intro), "the document has an intro");
  assert(line.length < 10 ** 6, "a line is short");
  assert(n >= 1, "line numbers start at 1");
  assert(line === line.trim(), "a line is trimmed");
  const title = /^#\s+(.+)$/.exec(line);
  if (title) {
    st.doc.title = group(title, 1);
    return;
  }
  const heading = /^##\s+(.+)$/.exec(line);
  if (heading) {
    st.head = null;
    startSection(st, group(heading, 1).trim(), n);
    return;
  }
  const sec = st.sec;
  if (!sec) {
    if (st.doc.title && line && !st.doc.machines.length) st.doc.intro.push(line);
    return;
  }
  if (sec.kind === "reqs" || sec.kind === "bugs") addItem(st.doc, sec.kind, line, n);
  else parseMachineLine(st, sec, line, n);
}

export function parse(text: string, file: string): Doc {
  assert(text.length < 10 ** 8, "a document is bounded");
  assert(!file.includes("\n"), "a file name is one line");
  assert(typeof text === "string", "the document is text");
  assert(file !== "", "the document has a file name");
  const lines = text.split(/\r?\n/);
  const doc: Doc = { file, title: "", intro: [], reqs: [], bugs: [], machines: [], proposals: [], errors: [] };
  const st: ParseState = { doc, sec: null, head: null };
  for (let i = 0; i < lines.length; i++) parseLine(st, (lines[i] ?? "").trim(), i + 1);
  for (const mc of [...doc.machines, ...doc.proposals]) {
    if (!mc.initial) doc.errors.push(`L${mc.line}: ${mc.kind} ${mc.name} has no "initial:" line`);
  }
  if (!doc.machines.length) doc.errors.push('no "## Machine <name>" section');
  assert(doc.file === file, "parsing keeps the file name");
  return doc;
}

const norm = (g: string): string => {
  assert(typeof g === "string", "a guard is text");
  assert(g.length < 10 ** 6, "a guard is short");
  return g.replace(/\s+/g, " ").trim();
};
const neg = (g: string): string | null => {
  assert(typeof g === "string", "a guard is text");
  const x = norm(g);
  assert(x === x.trim(), "the guard is normalised");
  const m = /^(?:!|not )\s*\(?(.+?)\)?$/.exec(x);
  return m ? group(m, 1) : null;
};

type Ctx = { mc: Machine; states: string[]; live: string[]; finals: Set<string>; eff: Row[]; events: string[] };

function note(list: Finding[], mc: Machine, kind: FindingKind, where: string, line: number, detail: string): void {
  assert(typeof where === "string", "a place is text");
  assert(typeof detail === "string", "a detail is text");
  assert(mc.name !== "", "a machine has a name");
  assert(line >= 0, "a line number is not negative");
  assert(FINDING_KINDS.includes(kind), "a finding has a known kind");
  list.push({ kind, machine: mc.name, at: where, line, detail });
}

const outOf = (eff: Row[], s: string): Row[] => {
  assert(typeof s === "string", "a state is a name");
  assert(Array.isArray(eff), "rows come as a list");
  return eff.filter((r) => r.state === s);
};

function collectStates(mc: Machine): string[] {
  assert(typeof mc.initial === "string", "an initial state is a name");
  assert(mc.rows.length < 10 ** 6, "rows are bounded");
  assert(Array.isArray(mc.rows), "a machine has rows");
  assert(Array.isArray(mc.final), "a machine has final states");
  const states: string[] = [];
  const add = (s: string): void => {
    assert(typeof s === "string", "a state is a name");
    if (s && s !== "*" && s !== "-" && !states.includes(s)) states.push(s);
  };
  add(mc.initial);
  for (const r of mc.rows) {
    add(r.state);
    add(r.next);
  }
  mc.final.forEach(add);
  assert(new Set(states).size === states.length, "states are unique");
  return states;
}

function expandWildcards(mc: Machine, live: string[]): Row[] {
  assert(mc.rows.length < 10 ** 6, "rows are bounded");
  assert(live.length < 10 ** 6, "states are bounded");
  assert(!live.includes("*"), "no live state is a wildcard");
  assert(Array.isArray(live), "live states come as a list");
  assert(Array.isArray(mc.rows), "a machine has rows");
  const own = (s: string, r: Row): boolean =>
    mc.rows.some((o) => o.state === s && o.event === r.event && (!r.guard || norm(o.guard) === norm(r.guard)));
  const eff: Row[] = [];
  for (const r of mc.rows) {
    if (r.state !== "*") {
      eff.push(r);
      continue;
    }
    for (const s of live) if (!own(s, r)) eff.push({ ...r, state: s });
  }
  assert(eff.length >= 0, "rows are a list");
  return eff;
}

function reachable(mc: Machine, eff: Row[]): Set<string> {
  assert(eff.length < 10 ** 6, "rows are bounded");
  assert(mc.initial !== "*", "the initial state is no wildcard");
  assert(Array.isArray(eff), "rows come as a list");
  assert(typeof mc.initial === "string", "a machine has an initial state");
  const seen = new Set<string>();
  const queue = mc.initial ? [mc.initial] : [];
  for (let s = queue.shift(), steps = 0; s !== undefined && steps <= eff.length * eff.length + 1; s = queue.shift(), steps++) {
    if (seen.has(s)) continue;
    seen.add(s);
    for (const r of outOf(eff, s)) if (r.next !== "-") queue.push(r.next);
  }
  assert(seen.size === 0 || seen.has(mc.initial), "the initial state is reachable");
  return seen;
}

function checkReach(c: Ctx, checks: Finding[]): void {
  assert(Array.isArray(checks), "findings come as a list");
  assert(c.live.length <= c.states.length, "live states are states");
  assert(c.eff.length < 10 ** 6, "rows are bounded");
  assert(c.states.length >= 0, "states are a list");
  assert(c.events.length >= 0, "events are a list");
  const seen = reachable(c.mc, c.eff);
  for (const s of c.states) if (!seen.has(s)) note(checks, c.mc, "unreachable", s, 0, "no path from the initial state");
  for (const s of c.live) {
    if (!seen.has(s)) continue;
    const exits = outOf(c.eff, s);
    if (!exits.some((r) => r.next !== "-" && r.next !== s)) note(checks, c.mc, "dead-end", s, 0, "no exit and not final");
    const miss = c.events.filter((e) => !exits.some((r) => r.event === e));
    if (miss.length) note(checks, c.mc, "unhandled", s, 0, `events: ${miss.join(" ")}`);
  }
}

function checkGroup(c: Ctx, checks: Finding[], k: string, g: Row[]): void {
  assert(Array.isArray(g), "a group is a list");
  assert(g.length >= 1, "a group has a row");
  assert(Array.isArray(checks), "findings come as a list");
  assert(k.includes("/"), "a group key is state/event");
  const first = g[0];
  if (!first) return;
  if (g.length < 2) {
    if (first.guard && norm(first.guard) !== "else")
      note(checks, c.mc, "guard-gap", k, first.line, `only "${first.guard}": add an else row`);
    return;
  }
  const gs = g.map((r) => norm(r.guard));
  const dup = gs.some((x, i) => gs.indexOf(x) !== i) || gs.includes("");
  if (dup) {
    note(checks, c.mc, "two-transitions", k, g[1]?.line ?? 0, `${g.length} rows with overlapping guards`);
    return;
  }
  const g0 = gs[0] ?? "";
  const g1 = gs[1] ?? "";
  const covered = gs.includes("else") || (gs.length === 2 && (neg(g0) === g1 || neg(g1) === g0));
  if (!covered) note(checks, c.mc, "guard-gap", k, first.line, `guards ${gs.join(" | ")} do not show full cover: add an else row`);
}

function checkGuards(c: Ctx, checks: Finding[]): void {
  assert(c.eff.length < 10 ** 6, "rows are bounded");
  assert(c.mc.name !== "", "a machine has a name");
  assert(c.live.length <= c.states.length, "live states are states");
  assert(Array.isArray(c.eff), "rows come as a list");
  assert(Array.isArray(checks), "findings come as a list");
  const groups = new Map<string, Row[]>();
  for (const r of c.eff) {
    const k = `${r.state}/${r.event}`;
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  for (const [k, g] of groups) checkGroup(c, checks, k, g);
}

function checkRowReqs(c: Ctx, reqIds: Set<string>, checks: Finding[]): void {
  assert(c.mc.name !== "", "a machine has a name");
  assert(c.mc.rows.length < 10 ** 6, "rows are bounded");
  assert(c.states.length >= 0, "states are a list");
  assert(reqIds instanceof Set, "requirement ids are a set");
  assert(Array.isArray(checks), "findings come as a list");
  for (const r of c.mc.rows) {
    const bad = r.reqs.filter((id) => !reqIds.has(id));
    const where = `${r.state}/${r.event}`;
    if (!r.reqs.length) note(checks, c.mc, "row-no-req", where, r.line, "no requirement");
    else if (bad.length) note(checks, c.mc, "row-no-req", where, r.line, `unknown requirement ${bad.join(" ")}`);
  }
}

function signatures(c: Ctx, cls: Map<string, string>): Map<string, string> {
  assert(c.eff.length < 10 ** 6, "rows are bounded");
  assert(c.finals instanceof Set, "final states are a set");
  assert(cls.size === c.states.length, "each state has a class");
  assert(c.states.length >= 0, "states are a list");
  return new Map<string, string>(
    c.states.map((s) => [
      s,
      cls.get(s) +
        "|" +
        outOf(c.eff, s)
          .map((r) => `${r.event}[${norm(r.guard)}]${r.next === "-" ? "~" : ">" + cls.get(r.next)}`)
          .sort()
          .join(","),
    ]),
  );
}

function classes(c: Ctx): Map<string, string> {
  assert(c.eff.length < 10 ** 6, "rows are bounded");
  assert(c.live.length <= c.states.length, "live states are states");
  assert(c.mc.name !== "", "a machine has a name");
  assert(c.states.length >= 0, "states are a list");
  assert(c.finals instanceof Set, "final states are a set");
  let cls = new Map<string, string>(c.states.map((s) => [s, c.finals.has(s) ? "F" : "N"]));
  for (let round = 0; round <= c.states.length; round++) {
    const sig = signatures(c, cls);
    const ids = new Map<string, string>();
    const next = new Map<string, string>(
      c.states.map((s) => {
        const k = sig.get(s) ?? "";
        if (!ids.has(k)) ids.set(k, String(ids.size));
        return [s, ids.get(k) ?? ""];
      }),
    );
    const stable = new Set(next.values()).size === new Set(cls.values()).size;
    cls = next;
    if (stable) break;
  }
  assert(cls.size === c.states.length, "each state ends in a class");
  return cls;
}

function simplifyMerge(c: Ctx, simplify: Finding[]): void {
  assert(c.mc.name !== "", "a machine has a name");
  assert(c.eff.length < 10 ** 6, "rows are bounded");
  assert(c.live.length <= c.states.length, "live states are states");
  assert(Array.isArray(simplify), "findings come as a list");
  assert(c.states.length >= 0, "states are a list");
  const cls = classes(c);
  const byCls = new Map<string, string[]>();
  for (const s of c.states) {
    const k = cls.get(s) ?? "";
    byCls.set(k, [...(byCls.get(k) ?? []), s]);
  }
  for (const g of byCls.values()) if (g.length > 1) note(simplify, c.mc, "merge-states", g.join("+"), 0, "same rows to the same states");
}

function simplifyPass(c: Ctx, simplify: Finding[]): void {
  assert(c.mc.name !== "", "a machine has a name");
  assert(c.finals instanceof Set, "final states are a set");
  assert(c.eff.length < 10 ** 6, "rows are bounded");
  assert(Array.isArray(simplify), "findings come as a list");
  assert(Array.isArray(c.mc.rows), "a machine has rows");
  for (const s of c.states) {
    if (s === c.mc.initial || c.finals.has(s)) continue;
    const ins = c.eff.filter((r) => r.next === s && r.state !== s);
    const outs = c.mc.rows.filter((r) => r.state === s && r.next !== "-" && r.next !== s);
    const inRow = ins[0];
    const outRow = outs[0];
    if (ins.length !== 1 || outs.length !== 1 || !inRow || !outRow || outRow.guard) continue;
    if (outRow.reqs.every((id) => inRow.reqs.includes(id)))
      note(simplify, c.mc, "pass-through", s, outRow.line, `${inRow.state} -> ${s} -> ${outRow.next}: delete ${s}`);
  }
}

function simplifyGlobal(c: Ctx, simplify: Finding[]): void {
  assert(c.mc.name !== "", "a machine has a name");
  assert(c.mc.rows.length < 10 ** 6, "rows are bounded");
  assert(c.states.length >= 0, "states are a list");
  assert(Array.isArray(simplify), "findings come as a list");
  assert(Array.isArray(c.mc.rows), "a machine has rows");
  const glob = new Map<string, Row[]>();
  for (const r of c.mc.rows) {
    if (r.state === "*") continue;
    const k = `${r.event}|${norm(r.guard)}|${r.next}`;
    glob.set(k, [...(glob.get(k) ?? []), r]);
  }
  for (const [k, g] of glob) {
    const ss = [...new Set(g.map((r) => r.state))];
    if (ss.length >= 3) {
      const [e, , n] = k.split("|");
      note(simplify, c.mc, "global-event", e ?? "", g[0]?.line ?? 0, `${ss.length} rows (${ss.join(" ")}) -> ${n}: write one * row`);
    }
  }
}

type Atom = { rows: number; states: Set<string>; line: number };

function guardAtoms(rows: Row[]): Map<string, Atom> {
  assert(rows.length < 10 ** 6, "rows are bounded");
  assert(Array.isArray(rows), "rows come as a list");
  assert(rows.length < 10 ** 6, "rows are bounded");
  const atoms = new Map<string, Atom>();
  for (const r of rows) {
    if (!r.guard || norm(r.guard) === "else") continue;
    for (const part of r.guard.split(/&&|\|\||\band\b|\bor\b/)) {
      const a = part
        .trim()
        .replace(/^(!|not\s+)/, "")
        .replace(/^\(|\)$/g, "")
        .trim();
      if (!a) continue;
      const v = atoms.get(a) ?? { rows: 0, states: new Set<string>(), line: r.line };
      v.rows++;
      v.states.add(r.state);
      atoms.set(a, v);
    }
  }
  return atoms;
}

const tokens = (s: string): string[] => {
  assert(typeof s === "string", "a state is a name");
  assert(s.length < 10 ** 4, "a state name is short");
  return s.split(/[_+-]/).filter(Boolean);
};

function simplifyFlags(c: Ctx, simplify: Finding[]): void {
  assert(c.mc.name !== "", "a machine has a name");
  assert(c.states.length < 10 ** 6, "states are bounded");
  assert(c.live.length <= c.states.length, "live states are states");
  assert(Array.isArray(simplify), "findings come as a list");
  assert(Array.isArray(c.mc.rows), "a machine has rows");
  for (const [a, v] of guardAtoms(c.mc.rows))
    if (v.rows >= 3 && v.states.size >= 2) note(simplify, c.mc, "flag-guard", a, v.line, `${v.rows} rows in ${v.states.size} states test it: a hidden state?`);
  const count = new Map<string, number>();
  for (const s of c.states) for (const t of tokens(s)) count.set(t, (count.get(t) ?? 0) + 1);
  const combos = c.states.filter((s) => tokens(s).length >= 2 && tokens(s).every((t) => (count.get(t) ?? 0) >= 2));
  if (combos.length >= 3) note(simplify, c.mc, "flag-states", combos.join(" "), 0, "state names combine flags: one machine for each flag?");
}

function hasCycle(edges: Map<string, string[]>, states: string[]): boolean {
  assert(edges instanceof Map, "edges are a map");
  assert(states.length < 10 ** 6, "states are bounded");
  assert(edges.size === states.length, "each state has its edges");
  assert(states.length >= 0, "states are a list");
  let cyclic = false;
  const mark = new Map<string, number>();
  const dfs = (start: string): void => {
    const stack: { s: string; rest: string[] }[] = [{ s: start, rest: [...(edges.get(start) ?? [])] }];
    mark.set(start, 1);
    for (let top = stack.at(-1); top !== undefined; top = stack.at(-1)) {
      const t = top.rest.shift();
      if (t === undefined) {
        mark.set(top.s, 2);
        stack.pop();
      } else if (mark.get(t) === 1) cyclic = true;
      else if (!mark.get(t)) {
        mark.set(t, 1);
        stack.push({ s: t, rest: [...(edges.get(t) ?? [])] });
      }
    }
  };
  for (const s of states) if (!mark.get(s)) dfs(s);
  return cyclic;
}

function simplifyFunction(c: Ctx, simplify: Finding[]): void {
  assert(c.mc.name !== "", "a machine has a name");
  assert(c.eff.length < 10 ** 6, "rows are bounded");
  assert(c.states.length < 10 ** 6, "states are bounded");
  assert(Array.isArray(simplify), "findings come as a list");
  assert(c.states.length >= 0, "states are a list");
  const edges = new Map<string, string[]>(
    c.states.map((s) => [s, [...new Set(outOf(c.eff, s).filter((r) => r.next !== "-" && r.next !== s).map((r) => r.next))]]),
  );
  const branchless = [...edges.values()].every((e) => e.length <= 1);
  const cyclic = hasCycle(edges, c.states);
  if (c.states.length <= 2 || (branchless && !cyclic)) note(simplify, c.mc, "function", c.mc.name, 0, "no branch and no loop: is a plain function better?");
}

function analyse(mc: Machine, reqIds: Set<string>): Analysis {
  assert(mc.name !== "", "a machine has a name");
  assert(mc.rows.length < 10 ** 6, "rows are bounded");
  assert(Array.isArray(mc.final), "a machine has final states");
  assert(reqIds instanceof Set, "requirement ids are a set");
  assert(Array.isArray(mc.rows), "a machine has rows");
  const finals = new Set(mc.final);
  const states = collectStates(mc);
  const live = states.filter((s) => !finals.has(s));
  const eff = expandWildcards(mc, live);
  const events = [...new Set(mc.rows.map((r) => r.event))];
  const c: Ctx = { mc, states, live, finals, eff, events };
  const checks: Finding[] = [];
  const simplify: Finding[] = [];
  checkReach(c, checks);
  checkGuards(c, checks);
  checkRowReqs(c, reqIds, checks);
  simplifyMerge(c, simplify);
  simplifyPass(c, simplify);
  simplifyGlobal(c, simplify);
  simplifyFlags(c, simplify);
  simplifyFunction(c, simplify);
  const cited = new Set(mc.rows.flatMap((r) => r.reqs).filter((id) => reqIds.has(id)));
  assert(cited.size <= reqIds.size, "cited requirements are known");
  return { states, events, eff, checks, simplify, cited, rows: mc.rows.length };
}

function judge(p: Machine, cur: { m: Machine; a: Analysis } | undefined, reqIds: Set<string>): ProposalResult {
  assert(typeof p.name === "string", "a proposal has a name");
  assert(p.rows.length < 10 ** 6, "rows are bounded");
  assert(cur === undefined || cur.m.name === p.name, "the current machine matches");
  assert(reqIds instanceof Set, "requirement ids are a set");
  assert(p.kind === "proposal", "a proposal is judged");
  const a = analyse(p, reqIds);
  let reason = "";
  if (!cur) reason = `no machine ${p.name}`;
  else {
    const lost = [...cur.a.cited].filter((id) => !a.cited.has(id));
    if (lost.length) reason = `drops ${lost.join(" ")}`;
    else if (a.rows >= cur.a.rows) reason = `${a.rows} rows, not fewer than ${cur.a.rows}`;
    else if (a.checks.length) reason = `${a.checks.length} check findings`;
  }
  assert(reason === "" || cur === undefined || reason.length > 0, "a hidden proposal has a reason");
  return {
    p,
    a,
    cur: cur ? cur.a.rows : 0,
    status: reason ? "hidden" : "shown",
    reason: reason || "keeps each requirement, fewer rows, passes the checks",
  };
}

export function run(doc: Doc): RunResult {
  assert(Array.isArray(doc.proposals), "a document has proposals");
  assert(Array.isArray(doc.reqs), "a document has requirements");
  assert(doc.machines.length < 10 ** 4, "machines are bounded");
  assert(Array.isArray(doc.machines), "a document has machines");
  assert(doc.errors.length === 0, "only a document that parses is run");
  const reqIds = new Set(doc.reqs.map((r) => r.id));
  const res = doc.machines.map((m) => ({ m, a: analyse(m, reqIds) }));
  const checks = res.flatMap((x) => x.a.checks);
  const cited = new Set(res.flatMap((x) => [...x.a.cited]));
  for (const r of doc.reqs)
    if (!cited.has(r.id)) checks.push({ kind: "req-no-row", machine: "-", at: r.id, line: r.line, detail: "no row cites it" });
  const proposals = doc.proposals.map((p) => judge(p, res.find((x) => x.m.name === p.name), reqIds));
  assert(proposals.length === doc.proposals.length, "each proposal is judged");
  return { res, checks, proposals };
}
