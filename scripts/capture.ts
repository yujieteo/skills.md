import { rmSync } from "node:fs";
import { cacheDir } from "./replay-lib.ts";

rmSync(cacheDir(), { recursive: true, force: true });
const done = Bun.spawnSync([process.execPath, "test"], { env: { ...process.env, SKILLS_REPLAY_CAPTURE: "1" }, stdout: "inherit", stderr: "inherit" });
process.exit(done.exitCode);
