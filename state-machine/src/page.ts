import { assert } from "./assert.ts";
import type { FindingKind } from "./model.ts";
import { decodeReview, type ReviewMachine, type ReviewRow } from "./review.ts";

declare const DATA: unknown;

type AttrValue = string | number | boolean | null | undefined;
type Attrs = Record<string, AttrValue>;
type Box = { x: number; y: number; w: number; h: number };
type Names = Partial<Record<FindingKind, string>>;
type Layout = { pos: Map<string, Box>; W: number; H: number };

const data = decodeReview(DATA);
const SVG_NS = "http://www.w3.org/2000/svg";
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
const MAX_STATES = 10_000;

function setAttrs(e: Element, attrs: Attrs, text: boolean): void {
  assert(e instanceof Element, "attributes go on an element");
  assert(typeof attrs === "object", "attributes are an object");
  for (const [k, v] of Object.entries(attrs)) {
    if (v === false || v === null || v === undefined) continue;
    if (text && k === "text") e.textContent = String(v);
    else e.setAttribute(k, v === true ? "" : String(v));
  }
}

function $<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, ...kids: (Node | string)[]): HTMLElementTagNameMap[K] {
  assert(tag.length > 0, "an element has a tag");
  assert(Array.isArray(kids), "children are a list");
  const e = document.createElement(tag);
  setAttrs(e, attrs, true);
  e.append(...kids);
  assert(e.childNodes.length >= kids.length, "each child is added");
  return e;
}

function S<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Attrs = {}): SVGElementTagNameMap[K] {
  assert(tag.length > 0, "an element has a tag");
  assert(SVG_NS.startsWith("http"), "the SVG namespace is a URL");
  const e = document.createElementNS(SVG_NS, tag);
  setAttrs(e, attrs, false);
  assert(e.namespaceURI === SVG_NS, "the element is in the SVG namespace");
  return e;
}

function byId(id: string): HTMLElement {
  assert(id !== "", "an id is not empty");
  const e = document.getElementById(id);
  if (!e) throw new Error(`the page has no element #${id}`);
  assert(e.id === id, "the element has the id asked for");
  return e;
}

function rich(t: string): Node[] {
  assert(typeof t === "string", "rich text is a string");
  const parts = t.split("`");
  const out: Node[] = [];
  for (let i = 0; i < parts.length; i++) out.push(i % 2 ? $("code", { text: parts[i] }) : document.createTextNode(parts[i] ?? ""));
  assert(out.length === parts.length, "one node for each part");
  assert(parts.length >= 1, "a split gives a part");
  return out;
}

const app = byId("app");

function rowId(m: string, r: ReviewRow): string {
  assert(m !== "", "a machine has a name");
  assert(r.line >= 0, "a row has a line");
  return m + "-L" + r.line;
}

function lineFinds<T extends { machine: string; line: number; at: string }>(list: T[], m: string, r: ReviewRow): T[] {
  assert(m !== "", "a machine has a name");
  assert(Array.isArray(list), "findings are a list");
  const out: T[] = [];
  for (const f of list) if (f.machine === m && (f.line ? f.line === r.line : f.at === r.state + "/" + r.event)) out.push(f);
  assert(out.length <= list.length, "a row has no more findings than the list");
  return out;
}

function boxOf(pos: Map<string, Box>, s: string): Box {
  assert(pos.size > 0, "there are boxes");
  assert(s !== "", "a state has a name");
  const b = pos.get(s);
  if (!b) throw new Error(`no box for state ${s}`);
  assert(b.w > 0 && b.h > 0, "a box has a size");
  return b;
}

function plural(n: number, word: string): string {
  assert(n >= 0, "a count is not negative");
  assert(word !== "", "a word is not empty");
  const text = n + " " + word + (n === 1 ? "" : "s");
  assert(text.startsWith(String(n)), "the text starts with the count");
  return text;
}

function ratioText(m: ReviewMachine): string {
  assert(m.rows.length >= 0, "a machine has rows");
  assert(m.name !== "", "a machine has a name");
  const cited = new Set<string>();
  for (const r of m.rows) for (const id of r.reqs) cited.add(id);
  const ratio = m.rows.length / Math.max(1, cited.size);
  assert(ratio >= 0, "a ratio is not negative");
  return m.name + ": " + ratio.toFixed(1) + " rows per requirement";
}

function verdict(): HTMLElement {
  assert(data.machines.length >= 0, "the data has machines");
  const v = $("ul", { class: "verdict" });
  let simp = 0;
  for (const m of data.machines) simp += m.simplify.length;
  if (data.bugs.length) v.append($("li", { "data-bad": true, text: plural(data.bugs.length, "proven bug") }));
  v.append(
    $("li", { "data-bad": data.checks.length > 0, text: plural(data.checks.length, "check finding") }),
    $("li", { text: plural(simp, "simplification") }),
  );
  for (const m of data.machines) v.append($("li", { text: ratioText(m) }));
  if (data.proposals.length) v.append($("li", { text: "simpler design below" }));
  assert(v.children.length >= 2, "the verdict has its two counts");
  return v;
}

function head(): void {
  assert(data.title !== "", "the review has a title");
  let rows = 0;
  for (const m of data.machines) rows += m.rows.length;
  app.append(
    $("h1", { text: data.title }),
    $("p", { class: "muted", text: data.file + " · " + data.machines.length + " machine(s) · " + rows + " rows · " + data.reqs.length + " requirements" }),
    verdict(),
  );
  for (const t of data.intro) app.append($("p", { class: "muted" }, ...rich(t)));
  if (!data.bugs.length) return;
  app.append($("h2", { text: "Proven bugs" }));
  const ul = $("ul", { class: "finds" });
  for (const b of data.bugs) ul.append($("li", { "data-bug": true }, $("b", { text: b.id }), ...rich(b.text + " Proof: "), $("code", { text: b.source })));
  app.append(ul, $("p", { class: "muted", text: "No fix lands before you approve the bug's row here." }));
  assert(ul.children.length === data.bugs.length, "one line for each bug");
}

function isReqFinding(kind: FindingKind): boolean {
  assert(typeof kind === "string", "a finding kind is text");
  assert(kind !== "function" || BUGS[kind] === undefined, "a function finding is a simplification");
  return kind === "row-no-req" || kind === "req-no-row";
}

function findingList(list: typeof data.checks, names: Names): HTMLElement {
  assert(Array.isArray(list), "findings are a list");
  assert(typeof names === "object", "names are an object");
  const ul = $("ul", { class: "finds" });
  if (!list.length) ul.append($("li", { class: "muted", text: "None." }));
  for (const f of list) {
    const li = $("li", {}, $("b", { text: names[f.kind] ?? f.kind }));
    const where = f.machine === "-" ? f.at : f.machine + " · " + f.at;
    if (f.line && f.machine !== "-") li.append($("a", { href: "#" + f.machine + "-L" + f.line, text: where }));
    else li.append(document.createTextNode(where));
    li.append(document.createTextNode(" — " + f.detail));
    ul.append(li);
  }
  assert(ul.children.length === Math.max(1, list.length), "one line for each finding");
  return ul;
}

function findings(): void {
  const reqChecks = data.checks.filter((f) => isReqFinding(f.kind));
  const bugChecks = data.checks.filter((f) => !isReqFinding(f.kind));
  assert(reqChecks.length + bugChecks.length === data.checks.length, "each check is in one step");
  const simplify: typeof data.checks = [];
  for (const m of data.machines) simplify.push(...m.simplify);
  const steps: [string, typeof data.checks, Names][] = [
    ["1. Question the requirements", reqChecks, BUGS],
    ["3. Simplify", simplify, SIMP],
    ["4. Kill bugs", bugChecks, BUGS],
  ];
  app.append($("h2", { text: "Findings" }));
  for (const [title, list, names] of steps) app.append($("h3", { text: title + " (" + list.length + ")" }), findingList(list, names));
  assert(steps.length === 3, "there are three steps");
  for (const h of data.hidden) app.append($("p", { class: "muted", text: "Proposal " + h.name + " is not shown: " + h.reason + "." }));
}

function depths(m: ReviewMachine): { depth: Map<string, number>; order: string[] } {
  assert(m.initial !== "", "a machine has an initial state");
  assert(m.states.length <= MAX_STATES, "a machine has a bounded number of states");
  const depth = new Map<string, number>([[m.initial, 0]]);
  const order = [m.initial];
  for (let i = 0; i < order.length && i < MAX_STATES; i++)
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
  assert(order.length === depth.size, "each ordered state has a depth");
  return { depth, order };
}

function width(s: string): number {
  assert(typeof s === "string", "a state name is text");
  assert(s.length >= 0, "a name has a length");
  return s.length * 7.6 + 28;
}

function layout(m: ReviewMachine): Layout {
  const { depth, order } = depths(m);
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
    let w = 0;
    for (const s of col) w = Math.max(w, width(s));
    for (let i = 0; i < col.length; i++) pos.set(col[i] ?? "", { x, y: 64 + i * 110, w: width(col[i] ?? ""), h: 36 });
    x += w + 170;
    H = Math.max(H, 64 + col.length * 110);
  }
  assert(pos.size === order.length, "each state has a box");
  assert(x > 24 || order.length === 0, "the columns advance");
  return { pos, W: x - 140, H: H + 70 };
}

function sideEdge(a: Box, b: Box): string {
  assert(a.x === b.x && a !== b, "the boxes share a column");
  assert(a.w > 0 && b.w > 0, "boxes have a width");
  const x = a.x + a.w;
  const y1 = a.y + a.h / 2;
  const y2 = b.y + b.h / 2;
  const out = 40 + Math.abs(y2 - y1) * 0.2;
  assert(out >= 40, "the curve bows out");
  return "M" + x + "," + y1 + " C" + (x + out) + "," + y1 + " " + (b.x + b.w + out) + "," + y2 + " " + (b.x + b.w) + "," + y2;
}

function loopEdge(a: Box): string {
  assert(a.w > 0, "a box has a width");
  assert(a.h > 0, "a box has a height");
  const x = a.x + a.w / 2;
  const y = a.y;
  assert(x > a.x, "the loop sits inside the box width");
  return "M" + (x - 10) + "," + y + " C" + (x - 30) + "," + (y - 46) + " " + (x + 30) + "," + (y - 46) + " " + (x + 10) + "," + y;
}

function forwardEdge(a: Box, b: Box, bend: number): string {
  assert(b.x > a.x, "the edge goes forward");
  assert(Number.isFinite(bend), "the bend is a number");
  const x1 = a.x + a.w;
  const y1 = a.y + a.h / 2 + bend;
  const x2 = b.x;
  const y2 = b.y + b.h / 2 + bend;
  const dx = (x2 - x1) / 2;
  assert(Number.isFinite(dx), "the curve is finite");
  return "M" + x1 + "," + y1 + " C" + (x1 + dx) + "," + y1 + " " + (x2 - dx) + "," + y2 + " " + x2 + "," + y2;
}

function backEdge(a: Box, b: Box, bend: number): string {
  assert(b.x <= a.x, "the edge goes back");
  assert(Number.isFinite(bend), "the bend is a number");
  const x1 = a.x + a.w / 2;
  const y1 = a.y + a.h;
  const x2 = b.x + b.w / 2;
  const y2 = b.y + b.h;
  const drop = 50 + Math.abs(x1 - x2) * 0.15 + bend;
  assert(Number.isFinite(drop), "the curve is finite");
  return "M" + x1 + "," + y1 + " C" + x1 + "," + (y1 + drop) + " " + x2 + "," + (y2 + drop) + " " + x2 + "," + y2;
}

function edgePath(a: Box, b: Box, bend = 0): string {
  assert(a.w > 0 && b.w > 0, "boxes have a width");
  assert(Number.isFinite(bend), "the bend is a number");
  if (a.x === b.x && a !== b) return sideEdge(a, b);
  if (a === b) return loopEdge(a);
  const d = b.x > a.x ? forwardEdge(a, b, bend) : backEdge(a, b, bend);
  assert(d.startsWith("M"), "a path starts with a move");
  return d;
}

function svgFor(m: ReviewMachine, W: number, H: number): SVGSVGElement {
  assert(W > 0 && H > 0, "the drawing has a size");
  assert(m.name !== "", "a machine has a name");
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
  assert(svg.children.length === 1, "the drawing starts with its defs");
  return svg;
}

function drawEdges(m: ReviewMachine, pos: Map<string, Box>, svg: SVGSVGElement): [SVGPathElement, string][] {
  assert(pos.size > 0, "there are boxes");
  assert(svg.namespaceURI === SVG_NS, "the drawing is an SVG element");
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
    const events: string[] = [];
    for (const r of rs) events.push(r.event + (r.guard ? " [" + r.guard + "]" : ""));
    labels.push([p, events.join(", ")]);
  }
  assert(labels.length === pairs.size, "one label for each pair");
  return labels;
}

function drawNodes(m: ReviewMachine, pos: Map<string, Box>, svg: SVGSVGElement, bad: Set<string>): Map<string, SVGGElement> {
  assert(pos.size > 0, "there are boxes");
  assert(m.states.length === pos.size, "each state has a box");
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
  assert(nodes.size === m.states.length, "one node for each state");
  assert(svg.children.length >= nodes.size, "each node is drawn");
  return nodes;
}

function drawLabels(svg: SVGSVGElement, labels: [SVGPathElement, string][], nodes: Map<string, SVGGElement>): void {
  assert(labels.length >= 0, "labels are a list");
  assert(nodes.size >= 0, "nodes are a map");
  for (const [p, text] of labels) {
    const pt = p.getPointAtLength(p.getTotalLength() / 2);
    const t = S("text", { class: "elabel", x: pt.x, y: pt.y - 4, "text-anchor": "middle" });
    t.textContent = text.length > 46 ? text.slice(0, 44) + "…" : text;
    const title = S("title");
    title.textContent = text;
    t.append(title);
    svg.insertBefore(t, nodes.values().next().value ?? null);
  }
  assert(svg.querySelectorAll(".elabel").length >= labels.length, "each label is drawn");
}

function machine(m: ReviewMachine, host: HTMLElement, bad: Set<string>): void {
  const { pos, W, H } = layout(m);
  assert(pos.size === m.states.length, "each state has a box");
  const svg = svgFor(m, W, H);
  const labels = drawEdges(m, pos, svg);
  const nodes = drawNodes(m, pos, svg, bad);
  const marker = S("circle", { class: "marker", r: 5, cx: 0, cy: 0 });
  svg.append(marker);
  host.append($("div", { class: "graph" }, svg));
  requestAnimationFrame(() => drawLabels(svg, labels, nodes));
  assert(nodes.size === pos.size, "each box has a node");
  simulator(m, host, { pos, nodes, marker, svg });
}

type Sim = {
  m: ReviewMachine;
  host: HTMLElement;
  pos: Map<string, Box>;
  nodes: Map<string, SVGGElement>;
  marker: SVGCircleElement;
  svg: SVGSVGElement;
  cur: string;
  anim: Animation | null;
  trail: HTMLElement;
  bar: HTMLElement;
};

function place(sim: Sim, s: string): void {
  assert(sim.pos.has(s), "the state has a box");
  assert(s !== "", "a state has a name");
  const b = boxOf(sim.pos, s);
  sim.marker.style.transform = "translate(" + (b.x + b.w - 8) + "px," + (b.y + 8) + "px)";
}

function mark(sim: Sim): void {
  assert(sim.nodes.has(sim.cur), "the current state has a node");
  assert(sim.nodes.size > 0, "there are nodes");
  for (const [s, g] of sim.nodes) g.toggleAttribute("data-current", s === sim.cur);
}

function rowsFor(sim: Sim, s: string): ReviewRow[] {
  assert(sim.pos.has(s), "the state has a box");
  assert(sim.m.rows.length >= 0, "a machine has rows");
  const own = sim.m.rows.filter((r) => r.state === s);
  const global: ReviewRow[] = [];
  if (!sim.m.final.includes(s))
    for (const r of sim.m.rows) if (r.state === "*" && !own.some((o) => o.event === r.event && (!r.guard || o.guard.trim() === r.guard.trim()))) global.push(r);
  assert(global.length === 0 || !sim.m.final.includes(s), "a final state has no global rows");
  return own.concat(global);
}

function slide(sim: Sim, from: string, to: string): void {
  assert(from !== to, "a slide moves between two states");
  assert(sim.pos.has(from) && sim.pos.has(to), "both states have boxes");
  const p = S("path", { d: edgePath(boxOf(sim.pos, from), boxOf(sim.pos, to)) });
  sim.svg.append(p);
  const L = p.getTotalLength();
  const frames: Keyframe[] = [];
  for (let i = 0; i <= 24; i++) {
    const q = p.getPointAtLength((L * i) / 24);
    frames.push({ transform: "translate(" + q.x + "px," + q.y + "px)" });
  }
  p.remove();
  const b = boxOf(sim.pos, to);
  frames.push({ transform: "translate(" + (b.x + b.w - 8) + "px," + (b.y + 8) + "px)" });
  place(sim, to);
  assert(frames.length === 26, "a slide has twenty-six frames");
  sim.anim = sim.marker.animate(frames, { duration: 200, easing: "cubic-bezier(0.23, 1, 0.32, 1)" });
}

function fire(sim: Sim, r: ReviewRow, e: MouseEvent): void {
  assert(sim.nodes.has(sim.cur), "the current state has a node");
  assert(r.event !== "", "a fired row has an event");
  sim.host.querySelectorAll("tr[data-fired]").forEach((t) => t.removeAttribute("data-fired"));
  document.getElementById(rowId(sim.m.name, r))?.setAttribute("data-fired", "");
  const from = sim.cur;
  const to = r.next === "-" ? sim.cur : r.next;
  sim.trail.textContent = (sim.trail.textContent ? sim.trail.textContent + " → " : "") + r.event + (r.next === "-" ? " (ignored)" : "");
  sim.cur = to;
  mark(sim);
  buttons(sim);
  if (sim.anim) sim.anim.finish();
  if (from === to || reduce.matches || e.detail === 0) place(sim, to);
  else slide(sim, from, to);
  assert(sim.cur === to, "the machine is in the next state");
}

function reset(sim: Sim): void {
  assert(sim.m.initial !== "", "a machine has an initial state");
  assert(sim.nodes.has(sim.m.initial), "the initial state has a node");
  sim.cur = sim.m.initial;
  sim.trail.textContent = "";
  if (sim.anim) sim.anim.finish();
  place(sim, sim.cur);
  mark(sim);
  buttons(sim);
  assert(sim.trail.textContent === "", "the trail is empty after a reset");
}

function buttons(sim: Sim): void {
  assert(sim.nodes.has(sim.cur), "the current state has a node");
  assert(sim.bar instanceof HTMLElement, "the bar is an element");
  sim.bar.replaceChildren($("span", { class: "now", text: "Fire an event in " + sim.cur + ":" }));
  const rs = rowsFor(sim, sim.cur);
  if (!rs.length) sim.bar.append($("span", { class: "muted", text: sim.m.final.includes(sim.cur) ? "final state" : "no event leaves this state" }));
  for (const r of rs) {
    const b = $("button", { class: "button", type: "button", "data-ignored": r.next === "-" }, r.event);
    if (r.guard) b.append($("small", { text: "[" + r.guard + "]" }));
    b.addEventListener("click", (e) => fire(sim, r, e));
    sim.bar.append(b);
  }
  const again = $("button", { class: "button", type: "button" }, "Reset");
  again.addEventListener("click", () => reset(sim));
  sim.bar.append(again);
  assert(sim.bar.children.length >= 2, "the bar has a label and a reset");
}

function simulator(m: ReviewMachine, host: HTMLElement, parts: Pick<Sim, "pos" | "nodes" | "marker" | "svg">): void {
  assert(m.initial !== "", "a machine has an initial state");
  assert(parts.nodes.has(m.initial), "the initial state has a node");
  const trail = $("div", { class: "trail", "aria-live": "polite" });
  const bar = $("div", { class: "sim" });
  const sim: Sim = { m, host, ...parts, cur: m.initial, anim: null, trail, bar };
  place(sim, sim.cur);
  mark(sim);
  buttons(sim);
  host.append(bar, trail);
  assert(bar.children.length >= 2, "the bar has buttons");
}

function decide(id: string, kind: string): HTMLTableCellElement {
  assert(id !== "", "a decision has an id");
  assert(kind === "row" || kind === "requirement", "a decision is on a row or a requirement");
  const cell = $(
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
  assert(cell.querySelectorAll("input").length === 3, "a decision has three inputs");
  return cell;
}

function rowTags(m: ReviewMachine, r: ReviewRow): HTMLElement {
  assert(m.name !== "", "a machine has a name");
  assert(r.line >= 0, "a row has a line");
  const tags = $("td");
  for (const f of lineFinds(data.checks, m.name, r)) tags.append($("span", { class: "tag", text: BUGS[f.kind] }));
  for (const f of lineFinds(m.simplify, m.name, r)) tags.append($("span", { class: "tag", "data-kind": "simplify", text: SIMP[f.kind] }));
  assert(tags.tagName === "TD", "tags are a cell");
  return tags;
}

function rowsTable(m: ReviewMachine, review: boolean): HTMLElement {
  assert(m.name !== "", "a machine has a name");
  assert(typeof review === "boolean", "review is a flag");
  const t = $("table");
  const heads = ["state", "event", "guard", "next", "req", "source", "findings"].concat(review ? ["review"] : []);
  const th: HTMLElement[] = [];
  for (const h of heads) th.push($("th", { text: h }));
  t.append($("tr", {}, ...th));
  for (const r of m.rows) {
    const id = rowId(m.name, r);
    const tr = $("tr", { id, "data-item": id });
    tr.append(
      $("td", { text: r.state }),
      $("td", { text: r.event }),
      $("td", { text: r.guard }),
      $("td", { text: r.next === "-" ? "— (ignored)" : r.next }),
      $("td", { class: "mono", text: r.reqs.join(" ") || "—" }),
      $("td", { class: "src", text: r.source }),
      rowTags(m, r),
    );
    if (review) tr.append(decide(id, "row"));
    t.append(tr);
  }
  assert(t.rows.length === m.rows.length + 1, "a header and one line for each row");
  return $("div", { class: "rows" }, t);
}

function badStates(name: string): Set<string> {
  assert(name !== "", "a machine has a name");
  assert(Array.isArray(data.checks), "checks are a list");
  const bad = new Set<string>();
  for (const f of data.checks) if (f.machine === name && ["unreachable", "dead-end", "unhandled"].includes(f.kind)) bad.add(f.at);
  assert(bad.size <= data.checks.length, "no more bad states than checks");
  return bad;
}

function machineSection(m: ReviewMachine): void {
  assert(m.name !== "", "a machine has a name");
  const prop = data.proposals.find((p) => p.name === m.name);
  app.append($("h2", { text: "Machine " + m.name }));
  const pair = $("div", { class: "pair", "data-two": !!prop });
  const a = $("div", { class: "card" }, $("h3", { text: prop ? "Current" : "Diagram" }));
  pair.append(a);
  app.append(pair);
  machine(m, a, badStates(m.name));
  if (prop) {
    const b = $("div", { class: "card" }, $("h3", { text: "Simpler: " + prop.rows.length + " rows, not " + m.rows.length }), $("p", { class: "muted", text: prop.reason }));
    pair.append(b);
    machine(prop, b, new Set());
  }
  app.append($("h3", { text: "Rows" }), rowsTable(m, true));
  if (prop) app.append($("h3", { text: "Rows of the simpler design" }), rowsTable(prop, false));
  assert(pair.children.length === (prop ? 2 : 1), "one card for each design");
}

function requirements(): void {
  assert(Array.isArray(data.reqs), "requirements are a list");
  assert(data.file !== "", "the review names its file");
  app.append($("h2", { text: "Requirements" }));
  const t = $("table", { class: "reqs" });
  const th: HTMLElement[] = [];
  for (const h of ["id", "requirement", "source", "review"]) th.push($("th", { text: h }));
  t.append($("tr", {}, ...th));
  for (const r of data.reqs)
    t.append($("tr", { "data-item": r.id }, $("td", { text: r.id }), $("td", {}, ...rich(r.text)), $("td", { class: "src", text: r.source }), decide(r.id, "requirement")));
  app.append($("div", { class: "rows" }, t));
  assert(t.rows.length === data.reqs.length + 1, "a header and one line for each requirement");
  app.append($("p", { class: "muted", text: "A rejected row is deleted with its requirement. A found bug gets a failing test; no fix lands before you approve it here." }));
}

function main(): void {
  assert(app.isConnected, "the app element is on the page");
  assert(data.machines.length > 0, "the review has a machine");
  head();
  findings();
  for (const m of data.machines) machineSection(m);
  requirements();
  assert(app.children.length > 0, "the page has content");
}

type Decision = { id: string; decision: string; comment: string };

function items(): Decision[] {
  assert(document.readyState.length > 0, "the page has a load state");
  assert(document.title.length < 10 ** 6, "the title is short");
  const out: Decision[] = [];
  for (const tr of document.querySelectorAll<HTMLElement>("tr[data-item]")) {
    const id = tr.dataset.item ?? "";
    const d = tr.querySelector<HTMLInputElement>("input[type=radio]:checked");
    const c = tr.querySelector<HTMLInputElement>("input[type=text]")?.value.trim();
    tr.dataset.decision = d ? d.value : "";
    if (d || c) out.push({ id, decision: d ? d.value : "comment", comment: c ?? "" });
  }
  assert(out.length <= document.querySelectorAll("tr[data-item]").length, "no more decisions than items");
  return out;
}

type Lavish = { queuePrompt: (...args: unknown[]) => unknown };

function lavishOf(): Lavish | null {
  assert(typeof window === "object", "the page has a window");
  assert(window.length >= 0, "the window counts its frames");
  if (!("lavish" in window)) return null;
  const found: unknown = window.lavish;
  if (typeof found !== "object" || found === null || !("queuePrompt" in found)) return null;
  const queue = found.queuePrompt;
  if (typeof queue !== "function") return null;
  return { queuePrompt: (...args: unknown[]): unknown => queue.apply(found, args) };
}

async function copyReview(form: HTMLElement, status: HTMLElement, text: string): Promise<void> {
  assert(text !== "", "there is a review to copy");
  assert(form.isConnected, "the form is on the page");
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
  assert(status.textContent !== "", "the status says what happened");
}

async function submit(form: HTMLElement, status: HTMLElement): Promise<void> {
  assert(form.isConnected, "the form is on the page");
  assert(status.isConnected, "the status is on the page");
  const list = items();
  if (!list.length) {
    status.textContent = "Decide on a row first.";
    return;
  }
  const lines: string[] = [];
  for (const i of list) lines.push(i.id + ": " + i.decision + (i.comment ? " — " + i.comment : ""));
  const text = "State machine review of " + data.file + ":\n" + lines.join("\n");
  const lavish = lavishOf();
  if (!lavish) {
    await copyReview(form, status, text);
    return;
  }
  const prompt =
    "Apply this state machine review of " +
    data.file +
    ". Delete each rejected row and its requirement, keep each approved row, answer each comment, then run sm-axi check and render again. Account for every submitted ID.";
  lavish.queuePrompt(prompt, { tag: "tracked-batch", text: "Review: " + list.length + " items", element: form, data: { items: list } });
  status.textContent = "Queued. Press Send to agent.";
  assert(list.length > 0, "something was queued");
}

function bar(): void {
  const form = byId("bar");
  const count = byId("count");
  const status = byId("status");
  assert(form.isConnected, "the form is on the page");
  assert(count.isConnected && status.isConnected, "the count and status are on the page");
  document.addEventListener("input", (e) => {
    if (e.target instanceof Element && e.target.closest("main")) {
      const n = items().length;
      count.textContent = n ? n + " item(s) decided" : "No decisions yet.";
    }
  });
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    void submit(form, status);
  });
  addEventListener("load", () => {
    const button = form.querySelector("button");
    if (!lavishOf() && button) button.textContent = "Copy the review";
  });
}

main();
bar();
