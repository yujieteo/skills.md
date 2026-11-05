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

const group = (m: RegExpMatchArray, i: number): string => m[i] ?? "";

function cells(line: string): string[] {
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
  return out.map((c) => c.replace(/^`(.*)`$/, "$1"));
}

type Section = { kind: "reqs" } | { kind: "bugs" } | Machine;

export function parse(text: string, file: string): Doc {
  const lines = text.split(/\r?\n/);
  const doc: Doc = { file, title: "", intro: [], reqs: [], bugs: [], machines: [], proposals: [], errors: [] };
  let sec: Section | null = null;
  let head: string[] | null = null;
  for (let i = 0; i < lines.length; i++) {
    const n = i + 1;
    const line = (lines[i] ?? "").trim();
    let m: RegExpMatchArray | null;
    if ((m = line.match(/^#\s+(.+)$/))) {
      doc.title = group(m, 1);
      continue;
    }
    if ((m = line.match(/^##\s+(.+)$/))) {
      head = null;
      const h = group(m, 1).trim();
      if (/^requirements$/i.test(h)) sec = { kind: "reqs" };
      else if (/^bugs$/i.test(h)) sec = { kind: "bugs" };
      else if ((m = h.match(/^(machine|proposal)\s+([\w.-]+)$/i))) {
        const kind = group(m, 1).toLowerCase() === "machine" ? "machine" : "proposal";
        const created: Machine = { kind, name: group(m, 2), initial: "", final: [], rows: [], line: n };
        sec = created;
        (kind === "machine" ? doc.machines : doc.proposals).push(created);
      } else sec = null;
      continue;
    }
    if (!sec) {
      if (doc.title && line && !doc.machines.length) doc.intro.push(line);
      continue;
    }
    if (sec.kind === "reqs" || sec.kind === "bugs") {
      if ((m = line.match(/^[-*]\s+([A-Za-z][\w.-]*)\s*:\s*(.+)$/))) {
        const parts = group(m, 2).split(/\s+(?:—|--)\s+/);
        const isReq = sec.kind === "reqs";
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
      continue;
    }
    if ((m = line.match(/^initial\s*:\s*(.*)$/i))) {
      sec.initial = group(m, 1).trim();
      continue;
    }
    if ((m = line.match(/^final\s*:\s*(.*)$/i))) {
      sec.final = group(m, 1)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      continue;
    }
    if (!line.startsWith("|")) continue;
    const c = cells(line);
    if (!head) {
      head = c.map((x) => x.toLowerCase());
      continue;
    }
    if (c.every((x) => /^:?-+:?$/.test(x))) continue;
    const columns = head;
    const col = (k: string): string => {
      const j = columns.indexOf(k);
      return j < 0 ? "" : c[j] || "";
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
  }
  for (const mc of [...doc.machines, ...doc.proposals]) {
    if (!mc.initial) doc.errors.push(`L${mc.line}: ${mc.kind} ${mc.name} has no "initial:" line`);
  }
  if (!doc.machines.length) doc.errors.push('no "## Machine <name>" section');
  return doc;
}

const norm = (g: string): string => g.replace(/\s+/g, " ").trim();
const neg = (g: string): string | null => {
  const x = norm(g);
  const m = x.match(/^(?:!|not )\s*\(?(.+?)\)?$/);
  return m ? group(m, 1) : null;
};

function analyse(mc: Machine, reqIds: Set<string>): Analysis {
  const finals = new Set(mc.final);
  const states: string[] = [];
  const add = (s: string): void => {
    if (s && s !== "*" && s !== "-" && !states.includes(s)) states.push(s);
  };
  add(mc.initial);
  for (const r of mc.rows) {
    add(r.state);
    add(r.next);
  }
  mc.final.forEach(add);
  const live = states.filter((s) => !finals.has(s));
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
  const events = [...new Set(mc.rows.map((r) => r.event))];
  const out = (s: string): Row[] => eff.filter((r) => r.state === s);
  const checks: Finding[] = [];
  const simplify: Finding[] = [];
  const at = (r: Row): string => `${r.state}/${r.event}`;
  const find = (list: Finding[], kind: FindingKind, where: string, line: number, detail: string): void => {
    list.push({ kind, machine: mc.name, at: where, line, detail });
  };

  const seen = new Set<string>();
  const queue = mc.initial ? [mc.initial] : [];
  for (let s = queue.shift(); s !== undefined; s = queue.shift()) {
    if (seen.has(s)) continue;
    seen.add(s);
    for (const r of out(s)) if (r.next !== "-") queue.push(r.next);
  }
  for (const s of states) if (!seen.has(s)) find(checks, "unreachable", s, 0, "no path from the initial state");
  for (const s of live) {
    if (!seen.has(s)) continue;
    if (!out(s).some((r) => r.next !== "-" && r.next !== s)) find(checks, "dead-end", s, 0, "no exit and not final");
    const miss = events.filter((e) => !out(s).some((r) => r.event === e));
    if (miss.length) find(checks, "unhandled", s, 0, `events: ${miss.join(" ")}`);
  }
  const groups = new Map<string, Row[]>();
  for (const r of eff) {
    const k = at(r);
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  for (const [k, g] of groups) {
    const first = g[0];
    if (!first) continue;
    if (g.length < 2) {
      if (first.guard && norm(first.guard) !== "else")
        find(checks, "guard-gap", k, first.line, `only "${first.guard}": add an else row`);
      continue;
    }
    const gs = g.map((r) => norm(r.guard));
    const dup = gs.some((x, i) => gs.indexOf(x) !== i) || gs.includes("");
    if (dup) {
      find(checks, "two-transitions", k, g[1]?.line ?? 0, `${g.length} rows with overlapping guards`);
      continue;
    }
    const g0 = gs[0] ?? "";
    const g1 = gs[1] ?? "";
    const covered = gs.includes("else") || (gs.length === 2 && (neg(g0) === g1 || neg(g1) === g0));
    if (!covered) find(checks, "guard-gap", k, first.line, `guards ${gs.join(" | ")} do not show full cover: add an else row`);
  }
  for (const r of mc.rows) {
    const bad = r.reqs.filter((id) => !reqIds.has(id));
    if (!r.reqs.length) find(checks, "row-no-req", at(r), r.line, "no requirement");
    else if (bad.length) find(checks, "row-no-req", at(r), r.line, `unknown requirement ${bad.join(" ")}`);
  }

  let cls = new Map<string, string>(states.map((s) => [s, finals.has(s) ? "F" : "N"]));
  for (let round = 0; round <= states.length; round++) {
    const sig = new Map<string, string>(
      states.map((s) => [
        s,
        cls.get(s) +
          "|" +
          out(s)
            .map((r) => `${r.event}[${norm(r.guard)}]${r.next === "-" ? "~" : ">" + cls.get(r.next)}`)
            .sort()
            .join(","),
      ]),
    );
    const ids = new Map<string, string>();
    const next = new Map<string, string>(
      states.map((s) => {
        const k = sig.get(s) ?? "";
        if (!ids.has(k)) ids.set(k, String(ids.size));
        return [s, ids.get(k) ?? ""];
      }),
    );
    const stable = new Set(next.values()).size === new Set(cls.values()).size;
    cls = next;
    if (stable) break;
  }
  const byCls = new Map<string, string[]>();
  for (const s of states) {
    const c = cls.get(s) ?? "";
    byCls.set(c, [...(byCls.get(c) ?? []), s]);
  }
  for (const g of byCls.values()) if (g.length > 1) find(simplify, "merge-states", g.join("+"), 0, "same rows to the same states");
  for (const s of states) {
    if (s === mc.initial || finals.has(s)) continue;
    const ins = eff.filter((r) => r.next === s && r.state !== s);
    const outs = mc.rows.filter((r) => r.state === s && r.next !== "-" && r.next !== s);
    const inRow = ins[0];
    const outRow = outs[0];
    if (ins.length !== 1 || outs.length !== 1 || !inRow || !outRow || outRow.guard) continue;
    if (outRow.reqs.every((id) => inRow.reqs.includes(id)))
      find(simplify, "pass-through", s, outRow.line, `${inRow.state} -> ${s} -> ${outRow.next}: delete ${s}`);
  }
  const glob = new Map<string, Row[]>();
  for (const r of mc.rows) {
    if (r.state === "*") continue;
    const k = `${r.event}|${norm(r.guard)}|${r.next}`;
    glob.set(k, [...(glob.get(k) ?? []), r]);
  }
  for (const [k, g] of glob) {
    const ss = [...new Set(g.map((r) => r.state))];
    if (ss.length >= 3) {
      const [e, , n] = k.split("|");
      find(simplify, "global-event", e ?? "", g[0]?.line ?? 0, `${ss.length} rows (${ss.join(" ")}) -> ${n}: write one * row`);
    }
  }
  const atoms = new Map<string, { rows: number; states: Set<string>; line: number }>();
  for (const r of mc.rows) {
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
  for (const [a, v] of atoms)
    if (v.rows >= 3 && v.states.size >= 2) find(simplify, "flag-guard", a, v.line, `${v.rows} rows in ${v.states.size} states test it: a hidden state?`);
  const tok = (s: string): string[] => s.split(/[_+-]/).filter(Boolean);
  const count = new Map<string, number>();
  for (const s of states) for (const t of tok(s)) count.set(t, (count.get(t) ?? 0) + 1);
  const combos = states.filter((s) => tok(s).length >= 2 && tok(s).every((t) => (count.get(t) ?? 0) >= 2));
  if (combos.length >= 3) find(simplify, "flag-states", combos.join(" "), 0, "state names combine flags: one machine for each flag?");
  const edges = new Map<string, string[]>(
    states.map((s) => [s, [...new Set(out(s).filter((r) => r.next !== "-" && r.next !== s).map((r) => r.next))]]),
  );
  const branchless = [...edges.values()].every((e) => e.length <= 1);
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
  if (states.length <= 2 || (branchless && !cyclic)) find(simplify, "function", mc.name, 0, "no branch and no loop: is a plain function better?");

  const cited = new Set(mc.rows.flatMap((r) => r.reqs).filter((id) => reqIds.has(id)));
  return { states, events, eff, checks, simplify, cited, rows: mc.rows.length };
}

export function run(doc: Doc): RunResult {
  const reqIds = new Set(doc.reqs.map((r) => r.id));
  const res = doc.machines.map((m) => ({ m, a: analyse(m, reqIds) }));
  const checks = res.flatMap((x) => x.a.checks);
  const cited = new Set(res.flatMap((x) => [...x.a.cited]));
  for (const r of doc.reqs)
    if (!cited.has(r.id)) checks.push({ kind: "req-no-row", machine: "-", at: r.id, line: r.line, detail: "no row cites it" });
  const proposals = doc.proposals.map((p): ProposalResult => {
    const cur = res.find((x) => x.m.name === p.name);
    const a = analyse(p, reqIds);
    let reason = "";
    if (!cur) reason = `no machine ${p.name}`;
    else {
      const lost = [...cur.a.cited].filter((id) => !a.cited.has(id));
      if (lost.length) reason = `drops ${lost.join(" ")}`;
      else if (a.rows >= cur.a.rows) reason = `${a.rows} rows, not fewer than ${cur.a.rows}`;
      else if (a.checks.length) reason = `${a.checks.length} check findings`;
    }
    return {
      p,
      a,
      cur: cur ? cur.a.rows : 0,
      status: reason ? "hidden" : "shown",
      reason: reason || "keeps each requirement, fewer rows, passes the checks",
    };
  });
  return { res, checks, proposals };
}
