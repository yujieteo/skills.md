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

export const fail = (at: string, want: string): never => {
  throw new Error(`${at} is not ${want}`);
};

export const record = (v: unknown, at: string): Record<string, unknown> => {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return fail(at, "an object");
  return Object.fromEntries(Object.entries(v));
};
export const str: Reader<string> = (v, at) => (typeof v === "string" ? v : fail(at, "a string"));
export const num: Reader<number> = (v, at) => (typeof v === "number" ? v : fail(at, "a number"));
const list =
  <T>(read: Reader<T>): Reader<T[]> =>
  (v, at) => {
    if (!Array.isArray(v)) return fail(at, "an array");
    return v.map((x: unknown, i) => read(x, `${at}[${i}]`));
  };
const strings = list(str);

const finding: Reader<Finding> = (v, at) => {
  const o = record(v, at);
  const kind = FINDING_KINDS.find((k) => k === o.kind);
  if (!kind) return fail(`${at}.kind`, "a finding kind");
  return {
    kind,
    machine: str(o.machine, `${at}.machine`),
    at: str(o.at, `${at}.at`),
    line: num(o.line, `${at}.line`),
    detail: str(o.detail, `${at}.detail`),
  };
};

const row: Reader<ReviewRow> = (v, at) => {
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
};

const machine: Reader<ReviewMachine> = (v, at) => {
  const o = record(v, at);
  return {
    name: str(o.name, `${at}.name`),
    initial: str(o.initial, `${at}.initial`),
    final: strings(o.final, `${at}.final`),
    states: strings(o.states, `${at}.states`),
    events: strings(o.events, `${at}.events`),
    rows: list(row)(o.rows, `${at}.rows`),
    simplify: list(finding)(o.simplify, `${at}.simplify`),
  };
};

const proposal: Reader<ReviewProposal> = (v, at) => ({ ...machine(v, at), reason: str(record(v, at).reason, `${at}.reason`) });

const item: Reader<ReviewItem> = (v, at) => {
  const o = record(v, at);
  return { id: str(o.id, `${at}.id`), text: str(o.text, `${at}.text`), source: str(o.source, `${at}.source`) };
};

export function decodeReview(v: unknown): ReviewData {
  const o = record(v, "data");
  return {
    title: str(o.title, "data.title"),
    file: str(o.file, "data.file"),
    intro: strings(o.intro, "data.intro"),
    reqs: list(item)(o.reqs, "data.reqs"),
    bugs: list(item)(o.bugs, "data.bugs"),
    machines: list(machine)(o.machines, "data.machines"),
    proposals: list(proposal)(o.proposals, "data.proposals"),
    hidden: list((h, at) => {
      const r = record(h, at);
      return { name: str(r.name, `${at}.name`), reason: str(r.reason, `${at}.reason`) };
    })(o.hidden, "data.hidden"),
    checks: list(finding)(o.checks, "data.checks"),
  };
}
