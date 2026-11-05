import { assert } from "./assert.ts";

// Values copied from the CSS that https://emilkowal.ski serves (2026-11-03) and from Radix Colors 3.0.0 https://www.radix-ui.com/colors
export const TOKENS = {
  "gray-100": ["#fdfdfc", "#111110"], "gray-200": ["#f9f9f8", "#191918"], "gray-300": ["#f1f0ef", "#222221"],
  "gray-400": ["#e9e9e7", "#2a2a28"], "gray-500": ["#e2e1de", "#31312e"], "gray-600": ["#dad9d6", "#3b3a37"],
  "gray-700": ["#cfceca", "#494844"], "gray-800": ["#bcbbb5", "#62605b"], "gray-900": ["#8d8d86", "#6f6d66"],
  "gray-1000": ["#82827c", "#7c7b74"], "gray-1100": ["#63635e", "#b5b3ad"], "gray-1200": ["#21201c", "#eeeeec"],
  "blue-3": ["#e6f4fe", "#0d2847"], "blue-7": ["#8ec8f6", "#205d9e"], "blue-9": ["#0090ff", "#0090ff"], "blue-11": ["#0d74ce", "#70b8ff"],
  "sky-3": ["#e1f6fd", "#112840"], "sky-7": ["#8dcae3", "#1f6692"], "sky-9": ["#7ce2fe", "#7ce2fe"], "sky-11": ["#00749e", "#75c7f0"],
  "grass-3": ["#e9f6e9", "#1b2a1e"], "grass-7": ["#94ce9a", "#366740"], "grass-9": ["#46a758", "#46a758"], "grass-11": ["#2a7e3b", "#71d083"],
  "amber-3": ["#fff7c2", "#302008"], "amber-7": ["#e9c162", "#714f19"], "amber-9": ["#ffc53d", "#ffc53d"], "amber-11": ["#ab6400", "#ffca16"],
  "orange-3": ["#ffefd6", "#331e0b"], "orange-7": ["#f5ae73", "#7e451d"], "orange-9": ["#f76b15", "#f76b15"], "orange-11": ["#cc4e00", "#ffa057"],
  "tomato-3": ["#feebe7", "#391714"], "tomato-7": ["#f5a898", "#853a2d"], "tomato-9": ["#e54d2e", "#e54d2e"], "tomato-11": ["#d13415", "#ff977d"],
  "violet-3": ["#f4f0fe", "#291f43"], "violet-7": ["#c2b5f5", "#56468b"], "violet-9": ["#6e56cf", "#6e56cf"], "violet-11": ["#6550b9", "#baa7ff"],
} as const satisfies Record<string, readonly [string, string]>;

export type TokenName = keyof typeof TOKENS;
type Rgb = readonly [number, number, number];

function isTokenName(n: string): n is TokenName {
  assert(typeof n === "string", "a token name is text");
  assert(n.length > 0, "a token name is not empty");
  return Object.hasOwn(TOKENS, n);
}
const TOKEN_NAMES: TokenName[] = Object.keys(TOKENS).filter(isTokenName);

export function light(n: TokenName): string {
  assert(isTokenName(n), "light needs a known token");
  assert(TOKENS[n][0].startsWith("#"), "token values are hex colours");
  return TOKENS[n][0];
}

export function dark(n: TokenName): string {
  assert(isTokenName(n), "dark needs a known token");
  assert(TOKENS[n][1].startsWith("#"), "token values are hex colours");
  return TOKENS[n][1];
}

function rgb(h: string): Rgb {
  assert(/^#[0-9a-f]{6}$/.test(h), "rgb needs a six digit hex colour");
  const out: Rgb = [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  assert(out.every((v) => v >= 0 && v <= 255), "channels are bytes");
  return out;
}

export const gray = {
  100: light("gray-100"), 200: light("gray-200"), 300: light("gray-300"), 400: light("gray-400"),
  500: light("gray-500"), 600: light("gray-600"), 700: light("gray-700"), 800: light("gray-800"),
  900: light("gray-900"), 1000: light("gray-1000"), 1100: light("gray-1100"), 1200: light("gray-1200"),
};

type HueName = "blue" | "sky" | "grass" | "amber" | "orange" | "tomato" | "violet";
function steps(h: HueName): { 3: string; 7: string; 9: string; 11: string } {
  assert(typeof h === "string", "a hue is named");
  assert(isTokenName(`${h}-3`), "each hue has a step 3");
  return { 3: light(`${h}-3`), 7: light(`${h}-7`), 9: light(`${h}-9`), 11: light(`${h}-11`) };
}
export const hue = {
  blue: steps("blue"), sky: steps("sky"), grass: steps("grass"), amber: steps("amber"),
  orange: steps("orange"), tomato: steps("tomato"), violet: steps("violet"),
};

const WHITE = "rgb(255, 255, 255)";
const DARK = `rgb(${rgb(light("gray-1200")).join(", ")})`;
export const onSolid = { blue: WHITE, grass: WHITE, orange: WHITE, tomato: WHITE, violet: WHITE, sky: DARK, amber: DARK };

export const PX = { label: 14, small: 12, title: 16, hair: 0.5, thin: 1, normal: 1.5, bold: 2, card: 12, chip: 6, pad: 16, gap: 24 };
export const weight = { name: 500, text: 400, title: 600 };

export function hex(c: string): string | null {
  assert(typeof c === "string", "a colour is text");
  const s = c.trim().toLowerCase();
  assert(s.length < 1000, "a colour is short");
  if (s === "white") return "#ffffff";
  if (s === "black") return "#000000";
  if (/^#[0-9a-f]{3}$/.test(s)) return "#" + Array.from(s.slice(1), (h) => h + h).join("");
  const found = /^#[0-9a-f]{6}$/.test(s) ? s : null;
  assert(found === null || found.length === 7, "a result is seven characters");
  return found;
}

const BY_HEX = new Map<string, TokenName>(TOKEN_NAMES.map((n) => [light(n), n]));

assert(new Set(TOKEN_NAMES.map((n) => light(n))).size === TOKEN_NAMES.length, "token light colours are unique");
assert(TOKEN_NAMES.length === Object.keys(TOKENS).length, "every token name is known");
assert(TOKEN_NAMES.every((n) => /^#[0-9a-f]{6}$/.test(dark(n))), "each token has a dark hex colour");
assert(Object.keys(gray).length === 12, "gray has twelve steps");
assert(Object.keys(hue).length === 7, "there are seven hues");
assert(Object.keys(onSolid).length === 7, "each hue has a text colour");
assert(WHITE !== DARK, "white and dark text differ");
assert(Object.keys(TOKENS).length % 4 === 0, "tokens come in whole hues");
assert(typeof TOKENS["gray-100"][0] === "string", "tokens are pairs of text");
assert(PX.card > PX.chip, "cards are rounder than chips");
assert(weight.title > weight.text, "titles are heavier than text");

export function token(h: string): TokenName {
  assert(/^#[0-9a-f]{6}$/.test(h), "token needs a six digit hex colour");
  const known = BY_HEX.get(h);
  if (known) return known;
  const a = rgb(h);
  let best: TokenName = "gray-100";
  let nearest = Infinity;
  for (const n of TOKEN_NAMES) {
    const c = rgb(light(n));
    const d = (c[0] - a[0]) ** 2 + (c[1] - a[1]) ** 2 + (c[2] - a[2]) ** 2;
    if (d < nearest) {
      nearest = d;
      best = n;
    }
  }
  assert(isTokenName(best), "the nearest token is known");
  return best;
}

export function card(r: number): { fill: string; stroke: string; r: number } {
  assert(Number.isFinite(r), "a radius is a number");
  assert(r >= 0, "a radius is not negative");
  return { fill: gray[100], stroke: gray[400], r };
}

export type FigureExport = Record<string, unknown>;

const SHEETS = new Map<string, readonly [number, number]>([["letter", [215.9, 279.4]], ["a4", [210, 297]]]);

export function patentFigure(base: FigureExport, colour: boolean): FigureExport {
  assert(typeof base === "object", "the figure export is an object");
  assert(typeof colour === "boolean", "colour is a flag");
  if (!colour) return { ...base, format: "patent" };
  const sheetName = base.sheet ?? "letter";
  const size = typeof sheetName === "string" ? SHEETS.get(sheetName) : undefined;
  if (!size) throw new Error(`patentFigure: unknown sheet "${JSON.stringify(sheetName)}"`);
  const rest = Object.fromEntries(Object.entries(base).filter(([k]) => k !== "sheet" && k !== "sheetId" && k !== "numerals"));
  assert(size[0] > 0 && size[1] > 0, "a sheet has a size");
  return { ...rest, format: "slide", width: size[0], height: size[1], name: `${typeof base.name === "string" ? base.name : "fig"}-colour` };
}
