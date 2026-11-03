import { describe, expect, test } from "bun:test";
import { capture, evaluatePatent, evaluateStyle, installDomStubs, type ElementSpec, type StyleApi, type StyleInput } from "../../scripts/replay-lib.ts";
import { hex, token } from "../tokens.ts";

installDomStubs();
const style = await import("../style.ts");
const api: StyleApi = { useEmil: style.useEmil, emilTheme: style.emilTheme, patentFigure: style.patentFigure };

const sheet: ElementSpec = { tag: "text", attrs: { "data-role": "sheet", y: "4", "font-family": "Arial" } };
const background: ElementSpec = { tag: "rect", attrs: { "data-role": "background", fill: "#ffffff" } };
const drawing: ElementSpec[] = [
  { tag: "rect", attrs: { fill: "#fff", stroke: "#0090ff", "data-panel": "" } },
  { tag: "path", attrs: { stroke: "black", fill: "none" } },
  { tag: "circle", attrs: { fill: "#123456", stroke: "#e54d2e", "data-panel": "" } },
  { tag: "stop", attrs: { "stop-color": "#8d8d86" } },
];

const scenario = (name: string, venue: string, extra: Partial<StyleInput> = {}): StyleInput => ({
  tool: "style",
  name,
  venue,
  theme: false,
  animate: false,
  elements: [sheet, background, ...drawing],
  sheetBoxY: 2,
  sight: { x: 90, y: 96, w: 600, h: 800 },
  widthMM: 215.9,
  heightMM: 279.4,
  ...extra,
});

const scenarios: StyleInput[] = [
  ...["web", "journal", "slide", "poster", "patent", "patent-colour"].map((v) => scenario(`venue ${v}`, v)),
  scenario("web themed", "web", { theme: true }),
  scenario("web themed and animated", "web", { theme: true, animate: true }),
  scenario("patent sheet number above the sight", "patent", { sheetBoxY: 10, sight: { x: 90, y: 96, w: 600, h: 800 } }),
  scenario("unknown venue", "billboard"),
];

describe("useEmil and emilTheme", () => {
  for (const input of scenarios) {
    test(input.name, () => {
      capture(input);
      expect(evaluateStyle(api, input)).toMatchSnapshot();
    });
  }
});

describe("patentFigure", () => {
  const cases: [string, Record<string, string>, boolean][] = [
    ["filing version", { sheet: "a4", name: "fig1" }, false],
    ["colour version on letter", { name: "fig1", sheetId: "1", numerals: "yes", sheet: "letter" }, true],
    ["colour version on a4", { sheet: "a4" }, true],
    ["colour version of an unknown sheet", { sheet: "tabloid" }, true],
  ];
  for (const [name, base, colour] of cases) {
    test(name, () => {
      const input = { tool: "patent-figure" as const, name, base, colour };
      capture(input);
      expect(evaluatePatent(api, input)).toMatchSnapshot();
    });
  }
});

describe("colour parsing", () => {
  test("hex expands a short colour and names", () => {
    expect([hex("#fff"), hex("white"), hex("BLACK"), hex("#12345"), hex("rgb(0,0,0)")]).toEqual(["#ffffff", "#ffffff", "#000000", null, null]);
  });
  test("a colour that is not a token maps to the nearest token", () => {
    expect([token("#0090ff"), token("#ffffff"), token("#000000")]).toEqual(["blue-9", "gray-100", "gray-1200"]);
  });
});
