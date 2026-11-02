# skills.md

Agent skills for Claude Code that you invoke by name.

## Skills

- [concept-ui](concept-ui/SKILL.md): UI redesign. Redesign an app or a screen from its conceptual model, then map the model to a layered, direct-manipulation, mobile-first interface.
- [guardrails](guardrails/SKILL.md): project rules. Find the parts that a project has, then add the lint rule, test, build budget, state model or replay that stops the related fault, in the tools of that project.
- [state-machine](state-machine/SKILL.md): requirement and code review. Model code or a requirement as one state table, delete the rows and requirements that are not necessary, show a simpler design, prove each bug with a failing test, and review it on an HTML board. The CLI is `state-machine/bin/sm-axi` (Node, no dependencies). Example: [femahoy chat](state-machine/examples/femahoy-chat/).

## Install for Claude Code

Copy or symlink the skill folder into `~/.claude/skills/`:

```sh
git clone https://github.com/yujieteo/skills.md
ln -s "$PWD/skills.md/concept-ui" ~/.claude/skills/concept-ui
ln -s "$PWD/skills.md/guardrails" ~/.claude/skills/guardrails
ln -s "$PWD/skills.md/state-machine" ~/.claude/skills/state-machine
ln -s "$PWD/skills.md/state-machine/bin/sm-axi" ~/.local/bin/sm-axi
```

To install for one project only, use `.claude/skills/` in that project.

## Invoke

Each skill sets `disable-model-invocation: true`, so the agent does not start it automatically.
Type its name and the target:

```text
/concept-ui the settings screen
/guardrails the game in ~/src/game
/state-machine the upload flow in src/upload.ts
```

## Test

```sh
node state-machine/test/run.js
```
