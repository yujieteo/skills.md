import { createHash } from "node:crypto";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import type { Figure, Library, Rect, SvgNode } from "../schematic-emil/style.ts";
import type { FigureExport } from "../schematic-emil/tokens.ts";
import { fail, num, record, str } from "../state-machine/src/review.ts";

export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

export type SmInput = { tool: "sm-axi"; name: string; command: "check" | "render"; text: string };
export type ElementSpec = { tag: string; attrs: Record<string, string> };
export type StyleInput = {
  tool: "style";
  name: string;
  venue: string;
  theme: boolean;
  animate: boolean;
  elements: ElementSpec[];
  sheetBoxY: number;
  sight: Rect | null;
  widthMM: number;
  heightMM: number;
};
export type PatentInput = { tool: "patent-figure"; name: string; base: Record<string, string>; colour: boolean };
export type ReplayInput = SmInput | StyleInput | PatentInput;

export type StyleApi = {
  useEmil(F: Figure, L: Library, venue: string): unknown;
  emilTheme(F: Figure, options: { animate: boolean }): unknown;
  patentFigure(base: FigureExport, colour: boolean): unknown;
};

export const cacheDir = (): string => process.env.SKILLS_REPLAY_CACHE ?? path.join(homedir(), ".cache", "skills-md-replay");

export function capture(input: ReplayInput): void {
  if (!process.env.SKILLS_REPLAY_CAPTURE) return;
  const text = JSON.stringify(input);
  const dir = cacheDir();
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, createHash("sha256").update(text).digest("hex").slice(0, 16) + ".json"), text);
}

const bool = (v: unknown, at: string): boolean => (typeof v === "boolean" ? v : fail(at, "a boolean"));
const strings = (v: unknown, at: string): Record<string, string> =>
  Object.fromEntries(Object.entries(record(v, at)).map(([k, x]) => [k, str(x, `${at}.${k}`)]));
const rect = (v: unknown, at: string): Rect => {
  const o = record(v, at);
  return { x: num(o.x, `${at}.x`), y: num(o.y, `${at}.y`), w: num(o.w, `${at}.w`), h: num(o.h, `${at}.h`) };
};

export function decodeInput(v: unknown): ReplayInput {
  const o = record(v, "input");
  const tool = str(o.tool, "input.tool");
  const name = str(o.name, "input.name");
  if (tool === "sm-axi") {
    const command = str(o.command, "input.command");
    if (command !== "check" && command !== "render") return fail("input.command", "check or render");
    return { tool, name, command, text: str(o.text, "input.text") };
  }
  if (tool === "patent-figure") return { tool, name, base: strings(o.base, "input.base"), colour: bool(o.colour, "input.colour") };
  if (tool === "style") {
    const elements = o.elements;
    if (!Array.isArray(elements)) return fail("input.elements", "an array");
    return {
      tool,
      name,
      venue: str(o.venue, "input.venue"),
      theme: bool(o.theme, "input.theme"),
      animate: bool(o.animate, "input.animate"),
      elements: elements.map((e: unknown, i) => {
        const r = record(e, `input.elements[${i}]`);
        return { tag: str(r.tag, `input.elements[${i}].tag`), attrs: strings(r.attrs, `input.elements[${i}].attrs`) };
      }),
      sheetBoxY: num(o.sheetBoxY, "input.sheetBoxY"),
      sight: o.sight === null ? null : rect(o.sight, "input.sight"),
      widthMM: num(o.widthMM, "input.widthMM"),
      heightMM: num(o.heightMM, "input.heightMM"),
    };
  }
  return fail("input.tool", "a known tool");
}

export type StoredInput = { file: string; input: ReplayInput };

export function loadCaptured(): StoredInput[] {
  const dir = cacheDir();
  let files: string[];
  try {
    files = readdirSync(dir).filter((f) => f.endsWith(".json")).sort();
  } catch {
    return [];
  }
  return files.map((file) => {
    const parsed: unknown = JSON.parse(readFileSync(path.join(dir, file), "utf8"));
    return { file, input: decodeInput(parsed) };
  });
}

class FakeStyle {
  fontFeatureSettings = "";
  animationDelay = "";
  properties: Record<string, string> = {};
  setProperty(name: string, value: string): void {
    this.properties[name] = value;
  }
}

class FakeNode implements SvgNode {
  readonly attrs = new Map<string, string>();
  readonly style = new FakeStyle();
  readonly children: FakeNode[] = [];
  readonly inserted: { textContent: string | null }[] = [];
  firstChild: unknown = null;
  constructor(
    readonly tag: string,
    attrs: Record<string, string>,
    private readonly boxY: number,
  ) {
    for (const [k, v] of Object.entries(attrs)) this.attrs.set(k, v);
  }
  getAttribute(name: string): string | null {
    return this.attrs.get(name) ?? null;
  }
  setAttribute(name: string, value: string): void {
    this.attrs.set(name, value);
  }
  getBBox(): { y: number } {
    return { y: this.boxY };
  }
  querySelectorAll(selector: string): FakeNode[] {
    return selector === "*" ? this.children : this.children.filter((c) => c.matches(selector));
  }
  querySelector(selector: string): FakeNode | null {
    return this.querySelectorAll(selector)[0] ?? null;
  }
  insertBefore(node: { textContent: string | null }, _before: unknown): void {
    this.inserted.push(node);
  }
  matches(selector: string): boolean {
    const m = /^(\w+)?\[([\w-]+)(?:=([\w-]+))?\]$/.exec(selector);
    if (!m) return false;
    const [, tag, attr, value] = m;
    if (tag && tag !== this.tag) return false;
    const have = this.attrs.get(attr ?? "");
    return value === undefined ? have !== undefined : have === value;
  }
  snapshot(): Json {
    return {
      tag: this.tag,
      attrs: Object.fromEntries(this.attrs),
      style: { ...this.style.properties, fontFeatureSettings: this.style.fontFeatureSettings, animationDelay: this.style.animationDelay },
    };
  }
}

export function installDomStubs(): void {
  class FontFaceStub {
    constructor(
      readonly family: string,
      readonly source: string,
      readonly descriptors: object,
    ) {}
    load(): Promise<this> {
      return Promise.resolve(this);
    }
  }
  const stubs = {
    FontFace: FontFaceStub,
    document: {
      fonts: { add: (): void => undefined },
      createElementNS: (): { textContent: string | null } => ({ textContent: null }),
    },
  };
  for (const [name, value] of Object.entries(stubs)) Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
}

const fakeLibrary = (): Library => ({
  STYLE: {
    font: { family: "Arial, sans-serif", math: "Arial, sans-serif" },
    color: {},
    text: {},
    line: {},
    arrow: {},
  },
  PATENT: {
    text: { fig: 10, legend: 9, numeral: 8 },
    line: { hair: 0.3, thin: 0.4, normal: 0.5, bold: 0.7 },
    arrow: { head: 2, width: 0.4 },
    margin: { left: 25.4, top: 25.4, right: 15.2, bottom: 15.2 },
  },
  mm: (value) => value * 3.7795275591,
  el: (_parent, tag, attrs) => ({ tag, attrs }),
});

export function toJson(v: unknown): Json {
  if (v === null || v === undefined) return null;
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return v;
  if (Array.isArray(v)) return v.map(toJson);
  if (typeof v === "object") return Object.fromEntries(Object.entries(v).filter(([, x]) => x !== undefined).map(([k, x]) => [k, toJson(x)]));
  throw new Error(`replay output: cannot turn a ${typeof v} into JSON`);
}

const errorMark = (): Json => ({ error: true });

export function evaluateStyle(api: StyleApi, input: StyleInput): Json {
  const root = new FakeNode("svg", {}, input.sheetBoxY);
  for (const e of input.elements) root.children.push(new FakeNode(e.tag, e.attrs, input.sheetBoxY));
  const figure: Figure = { svg: root, root: null, widthMM: input.widthMM, heightMM: input.heightMM };
  if (input.sight) figure.sight = input.sight;
  const lib = fakeLibrary();
  let look: Json;
  try {
    look = toJson(api.useEmil(figure, lib, input.venue));
    if (input.theme) api.emilTheme(figure, { animate: input.animate });
  } catch {
    return errorMark();
  }
  return {
    look,
    style: toJson(lib.STYLE),
    sight: toJson(figure.sight ?? null),
    sightMM: toJson(figure.sightMM ?? null),
    drawing: toJson(figure.drawing ?? null),
    root: root.snapshot(),
    elements: root.children.map((c) => c.snapshot()),
    inserted: root.inserted.map((n) => n.textContent),
  };
}

export function evaluatePatent(api: StyleApi, input: PatentInput): Json {
  try {
    return toJson(api.patentFigure(input.base, input.colour));
  } catch {
    return errorMark();
  }
}
