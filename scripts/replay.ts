import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { cacheDir, loadCaptured } from "./replay-lib.ts";

const EARLY_STOP_SHARE = 0.2;
const here = path.resolve(import.meta.dir, "..");
const harness = path.join(here, "scripts", "replay-run.ts");

const git = (...args: string[]): string => {
  const done = Bun.spawnSync(["git", "-C", here, ...args], { stdout: "pipe", stderr: "pipe" });
  if (done.exitCode !== 0) throw new Error(`git ${args.join(" ")}: ${done.stderr.toString().trim()}`);
  return done.stdout.toString().trim();
};

function snapshot(sha: string, dir: string): void {
  mkdirSync(dir, { recursive: true });
  const archive = Bun.spawnSync(["git", "-C", here, "archive", sha], { stdout: "pipe" });
  const unpack = Bun.spawnSync(["tar", "-x", "-C", dir], { stdin: archive.stdout });
  if (archive.exitCode !== 0 || unpack.exitCode !== 0) throw new Error(`cannot copy commit ${sha}`);
}

function runHarness(root: string, inputFile: string): string {
  const done = Bun.spawnSync([process.execPath, harness, root, inputFile], { stdout: "pipe", stderr: "pipe" });
  if (done.exitCode !== 0) throw new Error(`replay of ${inputFile} failed in ${root}: ${done.stderr.toString().trim()}`);
  return done.stdout.toString();
}

function diff(name: string, before: string, after: string, scratch: string): string {
  const a = path.join(scratch, "base.txt");
  const b = path.join(scratch, "branch.txt");
  writeFileSync(a, before);
  writeFileSync(b, after);
  const done = Bun.spawnSync(["diff", "-u", "--label", `base ${name}`, "--label", `branch ${name}`, a, b], { stdout: "pipe" });
  return done.stdout.toString();
}

const args = process.argv.slice(2);
const accept = args.includes("--accept");
const baseFlag = args.indexOf("--base");
const baseRef = baseFlag >= 0 ? (args[baseFlag + 1] ?? "") : "origin/main";
if (!baseRef) throw new Error("--base needs a commit");

if (git("status", "--porcelain")) throw new Error("the working tree has uncommitted changes: commit first, because replay compares commits");
const captured = loadCaptured();
if (!captured.length) throw new Error(`no captured inputs in ${cacheDir()}: run \`bun run capture\` first`);

const baseSha = git("merge-base", baseRef, "HEAD");
const headSha = git("rev-parse", "HEAD");
const scratch = mkdtempSync(path.join(tmpdir(), "replay-"));
try {
  const baseRoot = path.join(scratch, "base");
  const headRoot = path.join(scratch, "branch");
  snapshot(baseSha, baseRoot);
  snapshot(headSha, headRoot);
  const diffs: string[] = [];
  let checked = 0;
  for (const { file, input } of captured) {
    const inputFile = path.join(cacheDir(), file);
    checked++;
    const before = runHarness(baseRoot, inputFile);
    const after = runHarness(headRoot, inputFile);
    if (before !== after) diffs.push(diff(`${input.tool} ${input.name}`, before, after, scratch));
    if (diffs.length / captured.length > EARLY_STOP_SHARE) {
      console.log(`large change: more than 20% of the inputs differ (${diffs.length} of ${checked} checked, ${captured.length} captured)`);
      break;
    }
  }
  for (const d of diffs) console.log(d);
  console.log(`replayed ${checked} of ${captured.length} inputs, base ${baseSha.slice(0, 9)}, branch ${headSha.slice(0, 9)}: ${diffs.length} differ`);
  if (diffs.length && !accept) {
    console.log("fail: run again with --accept to accept these differences on this run");
    process.exit(1);
  }
  if (diffs.length) console.log("accepted on this run");
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
