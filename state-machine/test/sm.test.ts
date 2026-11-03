import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { capture } from "../../scripts/replay-lib.ts";

const entry = path.join(import.meta.dir, "..", "bin", "sm-axi.ts");
const scratch = mkdtempSync(path.join(tmpdir(), "sm-axi-"));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

type Result = { status: number; stdout: string };

function sm(cwd: string, command: "check" | "render", file: string, ...flags: string[]): Result {
  const done = Bun.spawnSync([process.execPath, entry, command, file, ...flags], { cwd, stdout: "pipe", stderr: "pipe" });
  capture({ tool: "sm-axi", name: file, command, text: readFileSync(path.join(cwd, file), "utf8") });
  return { status: done.exitCode, stdout: done.stdout.toString() };
}

function inScratch(name: string, text: string): string {
  writeFileSync(path.join(scratch, name), text);
  return name;
}

describe("faults.sm.md", () => {
  const here = import.meta.dir;
  test("check output equals expected.toon and exits 1 when a check finds a fault", () => {
    const check = sm(here, "check", "faults.sm.md");
    expect(check.stdout).toBe(readFileSync(path.join(here, "expected.toon"), "utf8"));
    expect(check.status).toBe(1);
  });

  test("render embeds the machines and the shown proposal", () => {
    const out = path.join(scratch, "faults.html");
    const render = sm(here, "render", "faults.sm.md", "--out", out);
    const html = readFileSync(out, "utf8");
    expect(render.status).toBe(0);
    expect(html).toContain('"name":"twins"');
    expect(html).toContain('"proposals":[{');
    expect(html).not.toContain("__DATA__");
    expect(html).not.toContain("__SCRIPT__");
  });
});

describe("a file that does not parse", () => {
  test("a parse error exits 2 and names each error", () => {
    const bad = inScratch("bad.sm.md", "# bad\n\n## Requirements\n\n- R1: no source\n\n## Machine m\n\n| state | event | next |\n|---|---|---|\n| a | go | b |\n");
    const parse = sm(scratch, "check", bad);
    expect(parse.status).toBe(2);
    expect(parse.stdout).toMatch(/R1 has no source/);
    expect(parse.stdout).toMatch(/machine m has no .*initial/);
  });

  test("a missing file exits 2 and prints the usage", () => {
    const done = Bun.spawnSync([process.execPath, entry, "check", "missing.sm.md"], { cwd: scratch, stdout: "pipe" });
    expect(done.exitCode).toBe(2);
    expect(done.stdout.toString()).toContain("cannot read missing.sm.md: ENOENT");
  });
});

describe("the femahoy chat example", () => {
  const dir = path.join(import.meta.dir, "..", "examples", "femahoy-chat");
  test("check output equals check.toon", () => {
    expect(sm(dir, "check", "chat.sm.md").stdout).toBe(readFileSync(path.join(dir, "check.toon"), "utf8"));
  });
  test("render writes the page", () => {
    const render = sm(dir, "render", "chat.sm.md", "--out", path.join(scratch, "chat.html"));
    expect(render.status).toBe(0);
    expect(render.stdout).toContain("wrote:");
  });
});

describe("a wildcard machine", () => {
  const text = [
    "# wild",
    "",
    "## Requirements",
    "",
    "- R1: stop always works — owner",
    "- R2: start from idle — owner",
    "",
    "## Machine door",
    "",
    "initial: idle",
    "final: done",
    "",
    "| state | event | guard | next | req | source |",
    "|---|---|---|---|---|---|",
    "| idle | start | ok | busy | R2 | a.ts:1 |",
    "| idle | start | else | idle | R2 | a.ts:2 |",
    "| busy | finish | - | idle | R2 | a.ts:3 |",
    "| * | stop | - | done | R1 | a.ts:4 |",
    "",
  ].join("\n");
  test("a star row applies to each state that has no own row", () => {
    const check = sm(scratch, "check", inScratch("wild.sm.md", text));
    expect(check.stdout).toMatchSnapshot();
  });
});
