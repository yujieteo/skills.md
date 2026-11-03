import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { decodeInput, evaluatePatent, evaluateStyle, installDomStubs, toJson, type Json, type SmInput, type StyleApi } from "./replay-lib.ts";

const REPLAY_PAGE_SCRIPT = /<script[^>]*>[\s\S]*?<\/script>/g;

function smEntry(root: string): string[] {
  const ts = path.join(root, "state-machine", "bin", "sm-axi.ts");
  return existsSync(ts) ? [process.execPath, ts] : ["node", path.join(root, "state-machine", "bin", "sm-axi")];
}

function runSm(root: string, input: SmInput): Json {
  const dir = mkdtempSync(path.join(tmpdir(), "replay-sm-"));
  try {
    const file = "input.sm.md";
    writeFileSync(path.join(dir, file), input.text);
    const args = input.command === "render" ? [input.command, file, "--out", "out.html"] : [input.command, file];
    const [cmd, ...entry] = smEntry(root);
    const done = Bun.spawnSync([cmd ?? "", ...entry, ...args], { cwd: dir, stdout: "pipe", stderr: "pipe" });
    const result: { [key: string]: Json } = { exit: done.exitCode, stdout: done.stdout.toString(), stderr: done.stderr.toString() };
    const outFile = path.join(dir, "out.html");
    if (input.command === "render" && existsSync(outFile)) {
      const html = readFileSync(outFile, "utf8");
      result.data = html.match(/^const DATA = (.*);$/m)?.[1] ?? null;
      result.page = html.replace(REPLAY_PAGE_SCRIPT, "<script></script>");
    }
    return result;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

async function loadStyle(root: string): Promise<StyleApi> {
  installDomStubs();
  const ts = path.join(root, "schematic-emil", "style.ts");
  const mod: unknown = await import(existsSync(ts) ? ts : path.join(root, "schematic-emil", "style.js"));
  const fn = (name: string): ((...args: unknown[]) => unknown) => {
    const found: unknown = typeof mod === "object" && mod !== null ? Reflect.get(mod, name) : undefined;
    if (typeof found !== "function") throw new Error(`style module has no function ${name}`);
    return (...args) => Reflect.apply(found, undefined, args);
  };
  const useEmil = fn("useEmil");
  const emilTheme = fn("emilTheme");
  const patentFigure = fn("patentFigure");
  return {
    useEmil: (F, L, venue) => useEmil(F, L, venue),
    emilTheme: (F, options) => emilTheme(F, options),
    patentFigure: (base, colour) => patentFigure(base, colour),
  };
}

const [root, inputFile] = process.argv.slice(2);
if (!root || !inputFile) throw new Error("usage: replay-run.ts <root> <input.json>");
const parsed: unknown = JSON.parse(readFileSync(inputFile, "utf8"));
const input = decodeInput(parsed);
const output: Json =
  input.tool === "sm-axi"
    ? runSm(root, input)
    : input.tool === "style"
      ? evaluateStyle(await loadStyle(root), input)
      : evaluatePatent(await loadStyle(root), input);
process.stdout.write(JSON.stringify(toJson(output), null, 2) + "\n");
