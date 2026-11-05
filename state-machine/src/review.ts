import { assert } from "./assert.ts";
import { FINDING_KINDS, type Finding, type Item, type Row } from "./model.ts";

export type ReviewRow = Omit<Row, "req">;

export type ReviewMachine = {
  name: string;
  initial: string;
  final: string[];
  states: string[];
  events: string[];
  rows: ReviewRow[];
  simplify: Finding[];
};

type ReviewProposal = ReviewMachine & { reason: string };

export type ReviewItem = Omit<Item, "line">;

export type ReviewData = {
  title: string;
  file: string;
  intro: string[];
  reqs: ReviewItem[];
  bugs: ReviewItem[];
  machines: ReviewMachine[];
  proposals: ReviewProposal[];
  hidden: { name: string; reason: string }[];
  checks: Finding[];
};

type Reader<T> = (v: unknown, at: string) => T;

export function fail(at: string, want: string): never {
  assert(at !== "", "a failure names where it is");
  assert(want !== "", "a failure names what it wants");
  throw new Error(`${at} is not ${want}`);
}

export function record(v: unknown, at: string): Record<string, unknown> {
  assert(at !== "", "a record is read from a named place");
  if (typeof v !== "object" || v === null || Array.isArray(v)) return fail(at, "an object");
  const entries = Object.entries(v);
  assert(Array.isArray(entries), "entries are an array");
  return Object.fromEntries(entries);
}

export function str(v: unknown, at: string): string {
  assert(at !== "", "a string is read from a named place");
  assert(typeof at === "string", "the place is text");
  return typeof v === "string" ? v : fail(at, "a string");
}

export function num(v: unknown, at: string): number {
  assert(at !== "", "a number is read from a named place");
  assert(typeof at === "string", "the place is text");
  return typeof v === "number" ? v : fail(at, "a number");
}

function list<T>(read: Reader<T>, v: unknown, at: string): T[] {
  assert(typeof read === "function", "a list needs a reader");
  assert(at !== "", "a list is read from a named place");
  if (!Array.isArray(v)) return fail(at, "an array");
  const out: T[] = [];
  for (let i = 0; i < v.length; i++) out.push(read(v[i], `${at}[${i}]`));
  assert(out.length === v.length, "each element is read");
  return out;
}

function strings(v: unknown, at: string): string[] {
  assert(at !== "", "strings are read from a named place");
  assert(typeof at === "string", "the place is text");
  return list(str, v, at);
}

function finding(v: unknown, at: string): Finding {
  const o = record(v, at);
  const kind = FINDING_KINDS.find((k) => k === o.kind);
  assert(at !== "", "a finding is read from a named place");
  if (!kind) return fail(`${at}.kind`, "a finding kind");
  return {
    kind,
    machine: str(o.machine, `${at}.machine`),
    at: str(o.at, `${at}.at`),
    line: num(o.line, `${at}.line`),
    detail: str(o.detail, `${at}.detail`),
  };
}

function row(v: unknown, at: string): ReviewRow {
  assert(at !== "", "a row is read from a named place");
  assert(typeof at === "string", "the place is text");
  const o = record(v, at);
  return {
    line: num(o.line, `${at}.line`),
    state: str(o.state, `${at}.state`),
    event: str(o.event, `${at}.event`),
    guard: str(o.guard, `${at}.guard`),
    next: str(o.next, `${at}.next`),
    reqs: strings(o.reqs, `${at}.reqs`),
    source: str(o.source, `${at}.source`),
  };
}

function machine(v: unknown, at: string): ReviewMachine {
  assert(at !== "", "a machine is read from a named place");
  assert(typeof at === "string", "the place is text");
  const o = record(v, at);
  return {
    name: str(o.name, `${at}.name`),
    initial: str(o.initial, `${at}.initial`),
    final: strings(o.final, `${at}.final`),
    states: strings(o.states, `${at}.states`),
    events: strings(o.events, `${at}.events`),
    rows: list(row, o.rows, `${at}.rows`),
    simplify: list(finding, o.simplify, `${at}.simplify`),
  };
}

function proposal(v: unknown, at: string): ReviewProposal {
  assert(at !== "", "a proposal is read from a named place");
  assert(typeof at === "string", "the place is text");
  return { ...machine(v, at), reason: str(record(v, at).reason, `${at}.reason`) };
}

function item(v: unknown, at: string): ReviewItem {
  assert(at !== "", "an item is read from a named place");
  assert(typeof at === "string", "the place is text");
  const o = record(v, at);
  return { id: str(o.id, `${at}.id`), text: str(o.text, `${at}.text`), source: str(o.source, `${at}.source`) };
}

function hiddenProposal(v: unknown, at: string): { name: string; reason: string } {
  assert(at !== "", "a hidden proposal is read from a named place");
  assert(typeof at === "string", "the place is text");
  const r = record(v, at);
  return { name: str(r.name, `${at}.name`), reason: str(r.reason, `${at}.reason`) };
}

export function decodeReview(v: unknown): ReviewData {
  const o = record(v, "data");
  assert(typeof o === "object", "the data is an object");
  const data = {
    title: str(o.title, "data.title"),
    file: str(o.file, "data.file"),
    intro: strings(o.intro, "data.intro"),
    reqs: list(item, o.reqs, "data.reqs"),
    bugs: list(item, o.bugs, "data.bugs"),
    machines: list(machine, o.machines, "data.machines"),
    proposals: list(proposal, o.proposals, "data.proposals"),
    hidden: list(hiddenProposal, o.hidden, "data.hidden"),
    checks: list(finding, o.checks, "data.checks"),
  };
  assert(data.file !== "", "the review names its file");
  return data;
}
