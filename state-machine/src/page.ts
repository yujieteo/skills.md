import type { FindingKind } from "./model.ts";
import { decodeReview, type ReviewMachine, type ReviewRow } from "./review.ts";

declare const DATA: unknown;

type AttrValue = string | number | boolean | null | undefined;
type Attrs = Record<string, AttrValue>;
type Box = { x: number; y: number; w: number; h: number };
type Names = Partial<Record<FindingKind, string>>;

const data = decodeReview(DATA);
const SVG_NS = "http://www.w3.org/2000/svg";

function applyAttrs(e: Element, attrs: Attrs): void {
  for (const [k, v] of Object.entries(attrs)) {
    if (v === false || v === null || v === undefined) continue;
    if (k === "text") e.textContent = String(v);
    else e.setAttribute(k, v === true ? "" : String(v));
  }
}

const $ = <K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, ...kids: (Node | string)[]): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  applyAttrs(e, attrs);
  e.append(...kids);
  return e;
};

const S = <K extends keyof SVGElementTagNameMap>(tag: K, attrs: Attrs = {}): SVGElementTagNameMap[K] => {
  const e = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== false && v !== null && v !== undefined) e.setAttribute(k, v === true ? "" : String(v));
  return e;
};

const byId = (id: string): HTMLElement => {
  const e = document.getElementById(id);
  if (!e) throw new Error(`the page has no element #${id}`);
  return e;
};

const rich = (t: string): Node[] => t.split("`").map((x, i) => (i % 2 ? $("code", { text: x }) : document.createTextNode(x)));
const reduce = matchMedia("(prefers-reduced-motion: reduce)");
const BUGS: Names = {
  unreachable: "unreachable state",
  "dead-end": "dead end",
  unhandled: "unhandled events",
  "two-transitions": "two transitions on one state and event",
  "guard-gap": "guards do not cover all cases",
  "row-no-req": "row with no requirement",
  "req-no-row": "requirement with no row",
};
const SIMP: Names = {
  "merge-states": "equivalent states",
  "pass-through": "pass-through state",
  "global-event": "global event",
  "flag-guard": "flag in guards",
  "flag-states": "flag explosion",
  function: "a plain function?",
};
const app = byId("app");
const rowId = (m: string, r: ReviewRow): string => m + "-L" + r.line;
const lineFinds = <T extends { machine: string; line: number; at: string }>(list: T[], m: string, r: ReviewRow): T[] =>
  list.filter((f) => f.machine === m && (f.line ? f.line === r.line : f.at === r.state + "/" + r.event));
const boxOf = (pos: Map<string, Box>, s: string): Box => {
  const b = pos.get(s);
  if (!b) throw new Error(`no box for state ${s}`);
  return b;
};

function head(): void {
  const bugs = data.checks.length;
  const simp = data.machines.reduce((n, m) => n + m.simplify.length, 0);
  const rows = data.machines.reduce((n, m) => n + m.rows.length, 0);
  app.append(
    $("h1", { text: data.title }),
    $("p", { class: "muted", text: data.file + " · " + data.machines.length + " machine(s) · " + rows + " rows · " + data.reqs.length + " requirements" }),
  );
  const v = $("ul", { class: "verdict" });
  if (data.bugs.length) v.append($("li", { "data-bad": true, text: data.bugs.length + " proven bug" + (data.bugs.length === 1 ? "" : "s") }));
  v.append(
    $("li", { "data-bad": bugs > 0, text: bugs + " check finding" + (bugs === 1 ? "" : "s") }),
    $("li", { text: simp + " simplification" + (simp === 1 ? "" : "s") }),
  );
  for (const m of data.machines)
    v.append($("li", { text: m.name + ": " + (m.rows.length / Math.max(1, new Set(m.rows.flatMap((r) => r.reqs)).size)).toFixed(1) + " rows per requirement" }));
  if (data.proposals.length) v.append($("li", { text: "simpler design below" }));
  app.append(v);
  for (const t of data.intro) app.append($("p", { class: "muted" }, ...rich(t)));
  if (data.bugs.length) {
    app.append($("h2", { text: "Proven bugs" }));
    const ul = $("ul", { class: "finds" });
    for (const b of data.bugs) ul.append($("li", { "data-bug": true }, $("b", { text: b.id }), ...rich(b.text + " Proof: "), $("code", { text: b.source })));
    app.append(ul, $("p", { class: "muted", text: "No fix lands before you approve the bug's row here." }));
  }
}

function findings(): void {
  const isReqFinding = (kind: FindingKind): boolean => kind === "row-no-req" || kind === "req-no-row";
  const steps: [string, typeof data.checks, Names][] = [
    ["1. Question the requirements", data.checks.filter((f) => isReqFinding(f.kind)), BUGS],
    ["3. Simplify", data.machines.flatMap((m) => m.simplify), SIMP],
    ["4. Kill bugs", data.checks.filter((f) => !isReqFinding(f.kind)), BUGS],
  ];
  app.append($("h2", { text: "Findings" }));
  for (const [title, list, names] of steps) {
    app.append($("h3", { text: title + " (" + list.length + ")" }));
    const ul = $("ul", { class: "finds" });
    if (!list.length) ul.append($("li", { class: "muted", text: "None." }));
    for (const f of list) {
      const li = $("li", {}, $("b", { text: names[f.kind] || f.kind }));
      const where = f.machine === "-" ? f.at : f.machine + " · " + f.at;
      if (f.line && f.machine !== "-") li.append($("a", { href: "#" + f.machine + "-L" + f.line, text: where }));
      else li.append(document.createTextNode(where));
      li.append(document.createTextNode(" — " + f.detail));
      ul.append(li);
    }
    app.append(ul);
  }
  for (const h of data.hidden) app.append($("p", { class: "muted", text: "Proposal " + h.name + " is not shown: " + h.reason + "." }));
}

function layout(m: ReviewMachine): { pos: Map<string, Box>; W: number; H: number } {
  const depth = new Map<string, number>([[m.initial, 0]]);
  const order = [m.initial];
  for (let i = 0; i < order.length; i++)
    for (const r of m.rows) {
      const from = order[i] ?? "";
      if ((r.state === from || r.state === "*") && r.next !== "-" && !depth.has(r.next)) {
        depth.set(r.next, (depth.get(from) ?? 0) + 1);
        order.push(r.next);
      }
    }
  const max = Math.max(0, ...depth.values());
  for (const s of m.states)
    if (!depth.has(s)) {
      depth.set(s, max + 1);
      order.push(s);
    }
  const cols: string[][] = [];
  for (const s of order) {
    const d = depth.get(s) ?? 0;
    const col = cols[d] ?? [];
    col.push(s);
    cols[d] = col;
  }
  const pos = new Map<string, Box>();
  let x = 24;
  let H = 40;
  for (const col of cols) {
    const w = Math.max(...col.map((s) => s.length * 7.6 + 28));
    col.forEach((s, i) => pos.set(s, { x, y: 64 + i * 110, w: s.length * 7.6 + 28, h: 36 }));
    x += w + 170;
    H = Math.max(H, 64 + col.length * 110);
  }
  return { pos, W: x - 140, H: H + 70 };
}

function edgePath(a: Box, b: Box, bend = 0): string {
  if (a.x === b.x && a !== b) {
    const x = a.x + a.w;
    const y1 = a.y + a.h / 2;
    const y2 = b.y + b.h / 2;
    const out = 40 + Math.abs(y2 - y1) * 0.2;
    return "M" + x + "," + y1 + " C" + (x + out) + "," + y1 + " " + (b.x + b.w + out) + "," + y2 + " " + (b.x + b.w) + "," + y2;
  }
  if (a === b) {
    const x = a.x + a.w / 2;
    const y = a.y;
    return "M" + (x - 10) + "," + y + " C" + (x - 30) + "," + (y - 46) + " " + (x + 30) + "," + (y - 46) + " " + (x + 10) + "," + y;
  }
  if (b.x > a.x) {
    const x1 = a.x + a.w;
    const y1 = a.y + a.h / 2 + bend;
    const x2 = b.x;
    const y2 = b.y + b.h / 2 + bend;
    const dx = (x2 - x1) / 2;
    return "M" + x1 + "," + y1 + " C" + (x1 + dx) + "," + y1 + " " + (x2 - dx) + "," + y2 + " " + x2 + "," + y2;
  }
  const x1 = a.x + a.w / 2;
  const y1 = a.y + a.h;
  const x2 = b.x + b.w / 2;
  const y2 = b.y + b.h;
  const drop = 50 + Math.abs(x1 - x2) * 0.15 + bend;
  return "M" + x1 + "," + y1 + " C" + x1 + "," + (y1 + drop) + " " + x2 + "," + (y2 + drop) + " " + x2 + "," + y2;
}

function machine(m: ReviewMachine, host: HTMLElement, bad: Set<string>): void {
  const { pos, W, H } = layout(m);
  const svg = S("svg", {
    viewBox: "0 0 " + W + " " + H,
    style: "max-width:" + W + "px;min-width:" + Math.min(W, 520) + "px",
    role: "img",
    "aria-label": "State diagram of " + m.name,
  });
  const defs = S("defs");
  defs.innerHTML =
    '<marker id="arrow-' + m.name + '" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#bcbbb5"/></marker>';
  svg.append(defs);
  const pairs = new Map<string, ReviewRow[]>();
  for (const r of m.rows) {
    if (r.next === "-" || r.state === "*") continue;
    const k = r.state + ">" + r.next;
    pairs.set(k, [...(pairs.get(k) ?? []), r]);
  }
  const labels: [SVGPathElement, string][] = [];
  for (const [k, rs] of pairs) {
    const [s, n] = k.split(">");
    const p = S("path", { class: "edge", d: edgePath(boxOf(pos, s ?? ""), boxOf(pos, n ?? "")), "marker-end": "url(#arrow-" + m.name + ")" });
    svg.append(p);
    labels.push([p, rs.map((r) => r.event + (r.guard ? " [" + r.guard + "]" : "")).join(", ")]);
  }
  const nodes = new Map<string, SVGGElement>();
  for (const s of m.states) {
    const b = boxOf(pos, s);
    const g = S("g", { class: "node", "data-final": m.final.includes(s), "data-bad": bad.has(s) });
    g.append(S("rect", { x: b.x, y: b.y, width: b.w, height: b.h, rx: 8 }));
    const t = S("text", { x: b.x + b.w / 2, y: b.y + 23, "text-anchor": "middle" });
    t.textContent = s;
    g.append(t);
    if (s === m.initial) svg.append(S("circle", { cx: b.x - 10, cy: b.y + b.h / 2, r: 4, fill: "#63635e" }));
    svg.append(g);
    nodes.set(s, g);
  }
  const marker = S("circle", { class: "marker", r: 5, cx: 0, cy: 0 });
  svg.append(marker);
  host.append($("div", { class: "graph" }, svg));
  requestAnimationFrame(() => {
    for (const [p, text] of labels) {
      const pt = p.getPointAtLength(p.getTotalLength() / 2);
      const t = S("text", { class: "elabel", x: pt.x, y: pt.y - 4, "text-anchor": "middle" });
      t.textContent = text.length > 46 ? text.slice(0, 44) + "…" : text;
      const title = S("title");
      title.textContent = text;
      t.append(title);
      svg.insertBefore(t, nodes.values().next().value ?? null);
    }
  });
  simulator(m, host, pos, nodes, marker, svg);
}

function simulator(
  m: ReviewMachine,
  host: HTMLElement,
  pos: Map<string, Box>,
  nodes: Map<string, SVGGElement>,
  marker: SVGCircleElement,
  svg: SVGSVGElement,
): void {
  let cur = m.initial;
  let anim: Animation | null = null;
  const trail = $("div", { class: "trail", "aria-live": "polite" });
  const bar = $("div", { class: "sim" });
  const place = (s: string): void => {
    const b = boxOf(pos, s);
    marker.style.transform = "translate(" + (b.x + b.w - 8) + "px," + (b.y + 8) + "px)";
  };
  const mark = (): void => {
    for (const [s, g] of nodes) g.toggleAttribute("data-current", s === cur);
  };
  const rowsFor = (s: string): ReviewRow[] => {
    const own = m.rows.filter((r) => r.state === s);
    return own.concat(
      m.final.includes(s) ? [] : m.rows.filter((r) => r.state === "*" && !own.some((o) => o.event === r.event && (!r.guard || o.guard.trim() === r.guard.trim()))),
    );
  };
  function fire(r: ReviewRow, e: MouseEvent): void {
    host.querySelectorAll("tr[data-fired]").forEach((t) => t.removeAttribute("data-fired"));
    document.getElementById(rowId(m.name, r))?.setAttribute("data-fired", "");
    const from = cur;
    const to = r.next === "-" ? cur : r.next;
    trail.textContent = (trail.textContent ? trail.textContent + " → " : "") + r.event + (r.next === "-" ? " (ignored)" : "");
    cur = to;
    mark();
    buttons();
    if (anim) anim.finish();
    const keyboard = e.detail === 0;
    if (from === to || reduce.matches || keyboard) {
      place(to);
      return;
    }
    const p = S("path", { d: edgePath(boxOf(pos, from), boxOf(pos, to)) });
    svg.append(p);
    const L = p.getTotalLength();
    const frames: Keyframe[] = [];
    for (let i = 0; i <= 24; i++) {
      const q = p.getPointAtLength((L * i) / 24);
      frames.push({ transform: "translate(" + q.x + "px," + q.y + "px)" });
    }
    p.remove();
    const b = boxOf(pos, to);
    frames.push({ transform: "translate(" + (b.x + b.w - 8) + "px," + (b.y + 8) + "px)" });
    place(to);
    anim = marker.animate(frames, { duration: 200, easing: "cubic-bezier(0.23, 1, 0.32, 1)" });
  }
  function buttons(): void {
    bar.replaceChildren($("span", { class: "now", text: "Fire an event in " + cur + ":" }));
    const rs = rowsFor(cur);
    if (!rs.length) bar.append($("span", { class: "muted", text: m.final.includes(cur) ? "final state" : "no event leaves this state" }));
    for (const r of rs) {
      const b = $("button", { class: "button", type: "button", "data-ignored": r.next === "-" }, r.event);
      if (r.guard) b.append($("small", { text: "[" + r.guard + "]" }));
      b.addEventListener("click", (e) => fire(r, e));
      bar.append(b);
    }
    const reset = $("button", { class: "button", type: "button" }, "Reset");
    reset.addEventListener("click", () => {
      cur = m.initial;
      trail.textContent = "";
      if (anim) anim.finish();
      place(cur);
      mark();
      buttons();
    });
    bar.append(reset);
  }
  place(cur);
  mark();
  buttons();
  host.append(bar, trail);
}

function decide(id: string, kind: string): HTMLTableCellElement {
  return $(
    "td",
    { class: "dcell" },
    $(
      "div",
      { class: "decide" },
      $("label", {}, $("input", { type: "radio", name: id, value: "approve", "data-kind": kind }), "Approve"),
      $("label", {}, $("input", { type: "radio", name: id, value: "reject", "data-kind": kind }), "Reject"),
      $("input", { type: "text", name: id + ":comment", placeholder: "Comment", "aria-label": "Comment on " + id }),
    ),
  );
}

function rowsTable(m: ReviewMachine, review: boolean): HTMLElement {
  const t = $("table");
  t.append(
    $(
      "tr",
      {},
      ...["state", "event", "guard", "next", "req", "source", "findings"].concat(review ? ["review"] : []).map((h) => $("th", { text: h })),
    ),
  );
  for (const r of m.rows) {
    const id = rowId(m.name, r);
    const tr = $("tr", { id, "data-item": id });
    const tags = $("td");
    for (const f of lineFinds(data.checks, m.name, r)) tags.append($("span", { class: "tag", text: BUGS[f.kind] }));
    for (const f of lineFinds(m.simplify, m.name, r)) tags.append($("span", { class: "tag", "data-kind": "simplify", text: SIMP[f.kind] }));
    tr.append(
      $("td", { text: r.state }),
      $("td", { text: r.event }),
      $("td", { text: r.guard }),
      $("td", { text: r.next === "-" ? "— (ignored)" : r.next }),
      $("td", { class: "mono", text: r.reqs.join(" ") || "—" }),
      $("td", { class: "src", text: r.source }),
      tags,
    );
    if (review) tr.append(decide(id, "row"));
    t.append(tr);
  }
  return $("div", { class: "rows" }, t);
}

function main(): void {
  head();
  findings();
  for (const m of data.machines) {
    const prop = data.proposals.find((p) => p.name === m.name);
    app.append($("h2", { text: "Machine " + m.name }));
    const pair = $("div", { class: "pair", "data-two": !!prop });
    const bad = new Set(
      data.checks.filter((f) => f.machine === m.name && ["unreachable", "dead-end", "unhandled"].includes(f.kind)).map((f) => f.at),
    );
    const a = $("div", { class: "card" }, $("h3", { text: prop ? "Current" : "Diagram" }));
    pair.append(a);
    app.append(pair);
    machine(m, a, bad);
    if (prop) {
      const b = $("div", { class: "card" }, $("h3", { text: "Simpler: " + prop.rows.length + " rows, not " + m.rows.length }), $("p", { class: "muted", text: prop.reason }));
      pair.append(b);
      machine(prop, b, new Set());
    }
    app.append($("h3", { text: "Rows" }), rowsTable(m, true));
    if (prop) app.append($("h3", { text: "Rows of the simpler design" }), rowsTable(prop, false));
  }
  app.append($("h2", { text: "Requirements" }));
  const t = $("table", { class: "reqs" });
  t.append($("tr", {}, ...["id", "requirement", "source", "review"].map((h) => $("th", { text: h }))));
  for (const r of data.reqs)
    t.append($("tr", { "data-item": r.id }, $("td", { text: r.id }), $("td", {}, ...rich(r.text)), $("td", { class: "src", text: r.source }), decide(r.id, "requirement")));
  app.append($("div", { class: "rows" }, t));
  app.append($("p", { class: "muted", text: "A rejected row is deleted with its requirement. A found bug gets a failing test; no fix lands before you approve it here." }));
}

type Decision = { id: string; decision: string; comment: string };

function items(): Decision[] {
  const out: Decision[] = [];
  for (const tr of document.querySelectorAll<HTMLElement>("tr[data-item]")) {
    const id = tr.dataset.item ?? "";
    const d = tr.querySelector<HTMLInputElement>("input[type=radio]:checked");
    const c = tr.querySelector<HTMLInputElement>("input[type=text]")?.value.trim();
    tr.dataset.decision = d ? d.value : "";
    if (d || c) out.push({ id, decision: d ? d.value : "comment", comment: c || "" });
  }
  return out;
}

type Lavish = { queuePrompt: unknown };

function lavishOf(): Lavish | null {
  const found: unknown = Reflect.get(window, "lavish");
  return typeof found === "object" && found !== null && "queuePrompt" in found ? found : null;
}

function bar(): void {
  const form = byId("bar");
  const count = byId("count");
  const status = byId("status");
  document.addEventListener("input", (e) => {
    if (e.target instanceof Element && e.target.closest("main")) {
      const n = items().length;
      count.textContent = n ? n + " item(s) decided" : "No decisions yet.";
    }
  });
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const list = items();
    if (!list.length) {
      status.textContent = "Decide on a row first.";
      return;
    }
    const text = "State machine review of " + data.file + ":\n" + list.map((i) => i.id + ": " + i.decision + (i.comment ? " — " + i.comment : "")).join("\n");
    const lavish = lavishOf();
    if (lavish && typeof lavish.queuePrompt === "function") {
      const prompt =
        "Apply this state machine review of " +
        data.file +
        ". Delete each rejected row and its requirement, keep each approved row, answer each comment, then run sm-axi check and render again. Account for every submitted ID.";
      Reflect.apply(lavish.queuePrompt, lavish, [prompt, { tag: "tracked-batch", text: "Review: " + list.length + " items", element: form, data: { items: list } }]);
      status.textContent = "Queued. Press Send to agent.";
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      status.textContent = "Copied the review. Paste it to the agent.";
    } catch {
      form.querySelector("textarea")?.remove();
      const ta = $("textarea", { rows: 6, readonly: true, "aria-label": "Review to copy" });
      ta.value = text;
      form.append(ta);
      ta.select();
      status.textContent = "Copy the review below.";
    }
  });
  addEventListener("load", () => {
    const button = form.querySelector("button");
    if (!lavishOf() && button) button.textContent = "Copy the review";
  });
}

main();
bar();
