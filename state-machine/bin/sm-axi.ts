#!/usr/bin/env bun
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parse, run, type Doc, type Finding } from "../src/model.ts";
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

const out = (text: string): void => {
  process.stdout.write(text);
};

function fail(msg: string): never {
  out(`error: ${q(msg)}\n${USAGE}\n`);
  process.exit(2);
}

function reasonOf(e: unknown): string {
  if (e instanceof Error && "code" in e && typeof e.code === "string" && e.code) return e.code;
  return e instanceof Error ? e.message : String(e);
}

function load(file: string | undefined): Doc {
  if (!file) return fail("missing <file.sm.md>");
  let text: string;
  try {
    text = readFileSync(file, "utf8");
  } catch (e) {
    return fail(`cannot read ${file}: ${reasonOf(e)}`);
  }
  const doc = parse(text, file);
  if (doc.errors.length) {
    out(
      `error: ${q(path.basename(file))} does not parse\n` +
        table("errors", ["at"], doc.errors.map((e) => ({ at: e }))) +
        "\n" +
        help(["Fix each error; the format is in references/format.md"]) +
        "\n",
    );
    process.exit(2);
  }
  return doc;
}

const withLine = (f: Finding): Record<string, string | number> => ({ ...f, line: f.line ? `L${f.line}` : "-" });

function check(file: string | undefined): number {
  const doc = load(file);
  const name = path.basename(doc.file);
  const { res, checks, proposals } = run(doc);
  const ratio = (a: Analysis): string => (doc.reqs.length ? (a.rows / Math.max(1, a.cited.size)).toFixed(1) : "-");
  const lines = [`file: ${q(name)}`];
  lines.push(
    table(
      "machines",
      ["name", "states", "events", "rows", "reqs", "rows_per_req"],
      res.map(({ m, a }) => ({ name: m.name, states: a.states.length, events: a.events.length, rows: a.rows, reqs: a.cited.size, rows_per_req: ratio(a) })),
    ),
  );
  const simplify = res.flatMap((x) => x.a.simplify);
  if (doc.bugs.length) lines.push(table("bugs", ["id", "proof"], doc.bugs.map((b) => ({ id: b.id, proof: b.source }))));
  lines.push(table("simplify", ["kind", "machine", "at", "line", "detail"], simplify.map(withLine)));
  lines.push(table("checks", ["kind", "machine", "at", "line", "detail"], checks.map(withLine)));
  if (proposals.length)
    lines.push(
      table(
        "proposals",
        ["machine", "rows", "current_rows", "status", "reason"],
        proposals.map((x) => ({ machine: x.p.name, rows: x.a.rows, current_rows: x.cur, status: x.status, reason: x.reason })),
      ),
    );
  const h: string[] = [];
  if (checks.length) h.push(`Fix each check finding in ${name}, or ask the owner to reject its row; then run \`sm-axi check ${doc.file}\` again`);
  if (simplify.length) h.push('Write a simpler design as "## Proposal <machine>"; it shows only if it keeps each requirement, has fewer rows and passes the checks');
  h.push(`Run \`sm-axi render ${doc.file}\` to write the review page`);
  lines.push(help(h));
  out(lines.join("\n") + "\n");
  return checks.length ? 1 : 0;
}

const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c);

async function pageScript(): Promise<string> {
  const built = await Bun.build({ entrypoints: [path.join(import.meta.dir, "../src/page.ts")], target: "browser", format: "esm" });
  const first = built.outputs[0];
  if (!built.success || !first) throw new Error(`the page script did not build: ${built.logs.map(String).join("\n")}`);
  return first.text();
}

async function render(file: string | undefined, outPath: string): Promise<number> {
  const doc = load(file);
  const { res, checks, proposals } = run(doc);
  const pack = (m: Machine, a: Analysis): ReviewMachine => ({
    name: m.name,
    initial: m.initial,
    final: m.final,
    states: a.states,
    events: a.events,
    rows: m.rows.map((r) => ({ line: r.line, state: r.state, event: r.event, guard: r.guard, next: r.next, reqs: r.reqs, source: r.source })),
    simplify: a.simplify,
  });
  const item = ({ id, text, source }: ReviewItem): ReviewItem => ({ id, text, source });
  const data: ReviewData = {
    title: doc.title || path.basename(doc.file),
    file: path.basename(doc.file),
    intro: doc.intro,
    reqs: doc.reqs.map(item),
    bugs: doc.bugs.map(item),
    machines: res.map(({ m, a }) => pack(m, a)),
    proposals: proposals.filter((x) => x.status === "shown").map((x) => ({ ...pack(x.p, x.a), reason: x.reason })),
    hidden: proposals.filter((x) => x.status !== "shown").map((x) => ({ name: x.p.name, reason: x.reason })),
    checks,
  };
  const target = outPath || doc.file.replace(/(\.sm)?\.md$/, "") + ".html";
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  const template = readFileSync(path.join(import.meta.dir, "../src/page.html"), "utf8");
  const script = await pageScript();
  mkdirSync(path.dirname(path.resolve(target)), { recursive: true });
  writeFileSync(
    target,
    template.replace(/__(DATA|SCRIPT|TITLE)__/g, (_, key: string) => (key === "DATA" ? json : key === "SCRIPT" ? script : esc(data.title))),
  );
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

const argv = process.argv.slice(2);
if (!argv.length || argv.includes("--help") || argv.includes("-h")) {
  out(USAGE + "\n");
  process.exit(0);
}
const [cmd, file] = argv;
const outIndex = argv.indexOf("--out");
if (cmd === "check") process.exit(check(file));
else if (cmd === "render") process.exit(await render(file, outIndex > 0 ? (argv[outIndex + 1] ?? "") : ""));
else fail(`unknown command ${cmd}`);
