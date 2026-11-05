#!/usr/bin/env bun
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { assert } from "../src/assert.ts";
import { parse, run, type Doc, type Finding, type RunResult } from "../src/model.ts";
import type { ReviewData, ReviewItem, ReviewMachine } from "../src/review.ts";
import { help, q, table } from "../src/toon.ts";
import type { Analysis, Machine } from "../src/model.ts";

const USAGE = `usage: sm-axi <command> <file.sm.md> [flags]
commands[2]:
  check=run the simplify findings and the 7 checks (exit 1 when a check finds a fault)
  render=write the review page (default: <file>.html)
flags[2]:
  --out <file.html> (render), --help
examples:
  sm-axi check chat.sm.md
  sm-axi render chat.sm.md --out review/chat.html`;

function out(text: string): void {
  assert(typeof text === "string", "output is text");
  assert(text.length > 0, "output is not empty");
  process.stdout.write(text);
}

function fail(msg: string): never {
  assert(typeof msg === "string", "an error message is text");
  assert(msg !== "", "an error says what went wrong");
  out(`error: ${q(msg)}\n${USAGE}\n`);
  process.exit(2);
}

function reasonOf(e: unknown): string {
  assert(e !== undefined, "a failure carries a reason");
  assert(e !== null, "a failure is not null");
  if (e instanceof Error && "code" in e && typeof e.code === "string" && e.code) return e.code;
  return e instanceof Error ? e.message : "unknown error";
}

function load(file: string | undefined): Doc {
  if (!file) return fail("missing <file.sm.md>");
  let text: string;
  try {
    text = readFileSync(file, "utf8");
  } catch (e) {
    return fail(`cannot read ${file}: ${reasonOf(e)}`);
  }
  assert(text.length >= 0, "the file was read");
  const doc = parse(text, file);
  assert(doc.file === file, "the document keeps its file name");
  assert(Array.isArray(doc.errors), "parse reports errors as a list");
  if (doc.errors.length) {
    const rows: Record<string, string>[] = [];
    for (const e of doc.errors) rows.push({ at: e });
    out(
      `error: ${q(path.basename(file))} does not parse\n` +
        table("errors", ["at"], rows) +
        "\n" +
        help(["Fix each error; the format is in references/format.md"]) +
        "\n",
    );
    process.exit(2);
  }
  return doc;
}

function withLine(f: Finding): Record<string, string | number> {
  assert(f.line >= 0, "a finding line is not negative");
  assert(f.machine !== "", "a finding names its machine");
  return { ...f, line: f.line ? `L${f.line}` : "-" };
}

function ratio(doc: Doc, a: Analysis): string {
  assert(a.rows >= 0, "a machine has a row count");
  assert(a.cited.size <= doc.reqs.length, "a machine cites only known requirements");
  return doc.reqs.length ? (a.rows / Math.max(1, a.cited.size)).toFixed(1) : "-";
}

function machineTable(doc: Doc, res: { m: Machine; a: Analysis }[]): string {
  assert(res.length === doc.machines.length, "one analysis for each machine");
  assert(res.length > 0, "a document has a machine");
  const rows: Record<string, string | number>[] = [];
  for (const { m, a } of res) rows.push({ name: m.name, states: a.states.length, events: a.events.length, rows: a.rows, reqs: a.cited.size, rows_per_req: ratio(doc, a) });
  return table("machines", ["name", "states", "events", "rows", "reqs", "rows_per_req"], rows);
}

function proposalTable(proposals: RunResult["proposals"]): string {
  assert(proposals.length > 0, "there is a proposal to show");
  const rows: Record<string, string | number>[] = [];
  for (const x of proposals) rows.push({ machine: x.p.name, rows: x.a.rows, current_rows: x.cur, status: x.status, reason: x.reason });
  assert(rows.length === proposals.length, "one row for each proposal");
  return table("proposals", ["machine", "rows", "current_rows", "status", "reason"], rows);
}

function checkHelp(doc: Doc, checks: Finding[], simplify: Finding[]): string {
  assert(doc.file !== "", "the document has a file");
  const name = path.basename(doc.file);
  const h: string[] = [];
  if (checks.length) h.push(`Fix each check finding in ${name}, or ask the owner to reject its row; then run \`sm-axi check ${doc.file}\` again`);
  if (simplify.length) h.push('Write a simpler design as "## Proposal <machine>"; it shows only if it keeps each requirement, has fewer rows and passes the checks');
  h.push(`Run \`sm-axi render ${doc.file}\` to write the review page`);
  assert(h.length >= 1, "help always has the render line");
  return help(h);
}

function check(file: string | undefined): number {
  const doc = load(file);
  const { res, checks, proposals } = run(doc);
  assert(res.length === doc.machines.length, "one analysis for each machine");
  const lines = [`file: ${q(path.basename(doc.file))}`, machineTable(doc, res)];
  const simplify: Finding[] = [];
  for (const x of res) simplify.push(...x.a.simplify);
  if (doc.bugs.length) {
    const bugs: Record<string, string>[] = [];
    for (const b of doc.bugs) bugs.push({ id: b.id, proof: b.source });
    lines.push(table("bugs", ["id", "proof"], bugs));
  }
  lines.push(table("simplify", ["kind", "machine", "at", "line", "detail"], simplify.map(withLine)));
  lines.push(table("checks", ["kind", "machine", "at", "line", "detail"], checks.map(withLine)));
  if (proposals.length) lines.push(proposalTable(proposals));
  lines.push(checkHelp(doc, checks, simplify));
  assert(lines.length >= 5, "a check prints its tables and help");
  assert(proposals.length === doc.proposals.length, "one result for each proposal");
  out(lines.join("\n") + "\n");
  return checks.length ? 1 : 0;
}

const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };

function esc(s: string): string {
  assert(typeof s === "string", "only text is escaped");
  const escaped = s.replace(/[&<>"]/g, (c) => ESCAPES[c] ?? c);
  assert(!/[<>"]/.test(escaped), "no markup characters remain");
  return escaped;
}

async function pageScript(): Promise<string> {
  const entry = path.join(import.meta.dir, "../src/page.ts");
  assert(existsSync(entry), "the page source exists");
  const built = await Bun.build({ entrypoints: [entry], target: "browser", format: "esm", minify: { whitespace: true } });
  const first = built.outputs[0];
  assert(Array.isArray(built.outputs), "the build lists its outputs");
  if (!built.success || !first) throw new Error(`the page script did not build: ${built.logs.map(String).join("\n")}`);
  return first.text();
}

function pack(m: Machine, a: Analysis): ReviewMachine {
  assert(a.rows === m.rows.length, "the analysis is of this machine");
  assert(m.name !== "", "a machine has a name");
  const rows: ReviewMachine["rows"] = [];
  for (const r of m.rows) rows.push({ line: r.line, state: r.state, event: r.event, guard: r.guard, next: r.next, reqs: r.reqs, source: r.source });
  return { name: m.name, initial: m.initial, final: m.final, states: a.states, events: a.events, rows, simplify: a.simplify };
}

function itemOf({ id, text, source }: ReviewItem): ReviewItem {
  assert(id !== "", "an item has an id");
  assert(typeof text === "string", "an item has text");
  return { id, text, source };
}

function reviewData(doc: Doc): ReviewData {
  const { res, checks, proposals } = run(doc);
  assert(res.length === doc.machines.length, "one analysis for each machine");
  assert(proposals.length === doc.proposals.length, "one result for each proposal");
  const shown = [];
  const hidden = [];
  for (const x of proposals) {
    if (x.status === "shown") shown.push({ ...pack(x.p, x.a), reason: x.reason });
    else hidden.push({ name: x.p.name, reason: x.reason });
  }
  const machines = [];
  for (const { m, a } of res) machines.push(pack(m, a));
  assert(shown.length + hidden.length === proposals.length, "each proposal is shown or hidden");
  assert(machines.length === res.length, "each machine is packed");
  return {
    title: doc.title || path.basename(doc.file),
    file: path.basename(doc.file),
    intro: doc.intro,
    reqs: doc.reqs.map(itemOf),
    bugs: doc.bugs.map(itemOf),
    machines,
    proposals: shown,
    hidden,
    checks,
  };
}

function fill(template: string, data: ReviewData, script: string): string {
  assert(template.includes("__DATA__"), "the template has a data slot");
  assert(template.includes("__SCRIPT__"), "the template has a script slot");
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  assert(!json.includes("<"), "the data holds no raw tag");
  const values: Record<string, string> = { DATA: json, SCRIPT: script, TITLE: esc(data.title) };
  return template.replace(/__(DATA|SCRIPT|TITLE)__/g, (_, key: string) => values[key] ?? "");
}

async function render(file: string | undefined, outPath: string): Promise<number> {
  const doc = load(file);
  const data = reviewData(doc);
  assert(data.machines.length > 0, "a review has a machine");
  const target = outPath || doc.file.replace(/(\.sm)?\.md$/, "") + ".html";
  const template = readFileSync(path.join(import.meta.dir, "../src/page.html"), "utf8");
  const page = fill(template, data, await pageScript());
  assert(page.length > template.length - 40, "the page holds the template");
  mkdirSync(path.dirname(path.resolve(target)), { recursive: true });
  writeFileSync(target, page);
  out(
    `wrote: ${q(target)}\n` +
      help([
        `Run \`lavish-axi ${target}\` to open the review board; approve, reject or comment on each row there`,
        'Without lavish-axi, open the file in a browser; "Copy the review" puts the decisions on the clipboard',
      ]) +
      "\n",
  );
  return 0;
}

async function main(argv: string[]): Promise<number> {
  assert(Array.isArray(argv), "arguments are a list");
  if (!argv.length || argv.includes("--help") || argv.includes("-h")) {
    out(USAGE + "\n");
    return 0;
  }
  const [cmd, file] = argv;
  const outIndex = argv.indexOf("--out");
  assert(outIndex < argv.length, "the out flag is inside the arguments");
  if (cmd === "check") return check(file);
  if (cmd === "render") return render(file, outIndex > 0 ? (argv[outIndex + 1] ?? "") : "");
  assert(cmd !== "check" && cmd !== "render", "known commands returned above");
  return fail(`unknown command ${cmd}`);
}

process.exit(await main(process.argv.slice(2)));
