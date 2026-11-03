# skills.md

Agent skills for Claude Code that you invoke by name.

## Skills

- [concept-ui](concept-ui/SKILL.md): UI redesign. Redesign an app or a screen from its conceptual model, then map the model to a layered, direct-manipulation, mobile-first interface.
- [guardrails](guardrails/SKILL.md): project rules. Find the parts that a project has, then add the lint rule, type, test, page budget, state model, replay, property test, fuzz target or expect test that stops the related fault, in the tools of that project.
- [schematic-emil](schematic-emil/SKILL.md): figures. Draw a scientific schematic or a patent drawing sheet in the look of [emilkowal.ski](https://emilkowal.ski), for the web, papers, slides and patents. It is a style for the [schematic-figure](https://github.com/lgwrightlab/schematic-figure) and patent-drawing skills by Jinchen Zhao and Logan Wright (LGW Lab, Yale University). Read their [blog post](https://lgwrightlab.github.io/schematic-figure/). Install those two skills from commit `09d8b6e`.
- [state-machine](state-machine/SKILL.md): requirement and code review. Model code or a requirement as one state table, delete the rows and requirements that are not necessary, show a simpler design, prove each bug with a failing test, and review it on an HTML board. The CLI is `state-machine/bin/sm-axi` (Node, no dependencies). Example: [femahoy chat](state-machine/examples/femahoy-chat/).

## Install for Claude Code

Copy or symlink the skill folder into `~/.claude/skills/`:

```sh
git clone https://github.com/yujieteo/skills.md
ln -s "$PWD/skills.md/concept-ui" ~/.claude/skills/concept-ui
ln -s "$PWD/skills.md/guardrails" ~/.claude/skills/guardrails
ln -s "$PWD/skills.md/schematic-emil" ~/.claude/skills/schematic-emil
ln -s "$PWD/skills.md/state-machine" ~/.claude/skills/state-machine
ln -s "$PWD/skills.md/state-machine/bin/sm-axi" ~/.local/bin/sm-axi
```

`schematic-emil` needs the upstream skills at the pinned commit:

```sh
git clone https://github.com/lgwrightlab/schematic-figure
git -C schematic-figure checkout 09d8b6e98d04b91de6e8b6632b3356b9fc237417
ln -s "$PWD/schematic-figure/.claude/skills/schematic-figure" ~/.claude/skills/schematic-figure
ln -s "$PWD/schematic-figure/.claude/skills/patent-drawing" ~/.claude/skills/patent-drawing
```

To install for one project only, use `.claude/skills/` in that project.

## Invoke

Each skill sets `disable-model-invocation: true`, so the agent does not start it automatically.
Type its name and the target:

```text
/concept-ui the settings screen
/guardrails the game in ~/src/game
/schematic-emil a figure of the cache flow for the blog post
/state-machine the upload flow in src/upload.ts
```

## Test

```sh
node state-machine/test/run.js
```
