// Plain-node test of sm-axi: node state-machine/test/run.js
// faults.sm.md has one known fault for each check and each simplify finding; expected.toon is the output.
"use strict";
const { spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const bin = path.join(__dirname, "..", "bin", "sm-axi");
const sm = (...a) => spawnSync(process.execPath, [bin, ...a], { cwd: __dirname, encoding: "utf8" });
let failed = 0;
const ok = (cond, name, detail = "") => { console.log(`${cond ? "ok" : "FAIL"} ${name}${cond ? "" : "\n" + detail}`); if (!cond) failed++; };

const check = sm("check", "faults.sm.md");
const want = fs.readFileSync(path.join(__dirname, "expected.toon"), "utf8");
ok(check.stdout === want, "check output equals expected.toon", check.stdout);
ok(check.status === 1, "check exits 1 when a check finds a fault", String(check.status));

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sm-axi-"));
const bad = path.join(tmp, "bad.sm.md");
fs.writeFileSync(bad, "# bad\n\n## Requirements\n\n- R1: no source\n\n## Machine m\n\n| state | event | next |\n|---|---|---|\n| a | go | b |\n");
const parse = sm("check", bad);
ok(parse.status === 2 && /R1 has no source/.test(parse.stdout) && /machine m has no .*initial/.test(parse.stdout), "a parse error exits 2 and names each error", parse.stdout);

const out = path.join(tmp, "faults.html");
const render = sm("render", "faults.sm.md", "--out", out);
const html = render.status === 0 ? fs.readFileSync(out, "utf8") : "";
ok(/"name":"twins"/.test(html) && /"proposals":\[\{/.test(html) && !/\/\*DATA\*\/null/.test(html), "render embeds the machines and the shown proposal", render.stdout);
fs.rmSync(tmp, { recursive: true, force: true });
process.exit(failed ? 1 : 0);
