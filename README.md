# skills.md

Agent skills for Claude Code that start when the user names them.

## Skills

- [concept-ui](concept-ui/SKILL.md): redesign an app or a screen from its conceptual model.
- [guardrails](guardrails/SKILL.md): add the checks that stop the faults of a project.
- [schematic-emil](schematic-emil/SKILL.md): draw a schematic figure or a patent sheet in the look of [emilkowal.ski](https://emilkowal.ski).
- [state-machine](state-machine/SKILL.md): review code or a requirement as a state table. The CLI is `state-machine/bin/sm-axi.ts` (Bun, no dependencies). Example: [femahoy chat](state-machine/examples/femahoy-chat/).

## Install for Claude Code

Copy or symlink the skill folder into `~/.claude/skills/`:

```sh
git clone https://github.com/yujieteo/skills.md
ln -s "$PWD/skills.md/concept-ui" ~/.claude/skills/concept-ui
ln -s "$PWD/skills.md/guardrails" ~/.claude/skills/guardrails
ln -s "$PWD/skills.md/schematic-emil" ~/.claude/skills/schematic-emil
ln -s "$PWD/skills.md/state-machine" ~/.claude/skills/state-machine
ln -s "$PWD/skills.md/state-machine/bin/sm-axi.ts" ~/.local/bin/sm-axi
```

`schematic-emil` needs the upstream skills `schematic-figure` and `patent-drawing` by Jinchen Zhao and Logan Wright (LGW Lab, Yale University). Install them from the commit that [schematic-emil/SKILL.md](schematic-emil/SKILL.md) pins:

```sh
git clone https://github.com/lgwrightlab/schematic-figure
git -C schematic-figure checkout <pinned commit>
ln -s "$PWD/schematic-figure/.claude/skills/schematic-figure" ~/.claude/skills/schematic-figure
ln -s "$PWD/schematic-figure/.claude/skills/patent-drawing" ~/.claude/skills/patent-drawing
```

The `animate` option of `schematic-emil` also needs the `emil-design-eng` skill from [emilkowalski/skills](https://github.com/emilkowalski/skills). Without it, the other options work.

To install for one project only, use `.claude/skills/` in that project.

## Invoke

`concept-ui`, `guardrails` and `state-machine` set `disable-model-invocation: true`, so only the user starts them.
The agent can also start `schematic-emil` when the user names it in a task.
Type the skill name and the target:

```text
/concept-ui the settings screen
/guardrails the game in ~/src/game
/schematic-emil a figure of the cache flow for the blog post
/state-machine the upload flow in src/upload.ts
```

## Develop

The tools run on [Bun](https://bun.sh) with strict TypeScript.

```sh
bun install
bun run check
```

`bun run check` runs `tsc --noEmit`, `scripts/lint.ts`, `knip` (dead code) and `bun test`.

To update an expected output, run `bun test -u` and read the diff.

## Process replay

A change to a transform (`sm-axi check`, `sm-axi render`, `useEmil`, `emilTheme`, `patentFigure`) must not change its outputs, unless you accept the difference.

```sh
bun run capture
bun run replay
bun run replay --accept
```

`capture` keeps the inputs of the tests in `~/.cache/skills-md-replay`. `replay` compares the outputs of the merge base with `origin/main` and of `HEAD`. `--accept` accepts the differences. `--base <commit>` changes the base.
Commit before you run `replay`. The rules of this check are in step 11 of [guardrails](guardrails/SKILL.md).
