# skills.md

Agent skills that are invoked by name.

## Skills

- [concept-ui](concept-ui/SKILL.md): redesign an app or a screen from its conceptual model, then map the model to a layered, direct-manipulation, mobile-first interface.

## Install for Claude Code

Copy or symlink the skill folder into `~/.claude/skills/`:

```sh
git clone https://github.com/yujieteo/skills.md
ln -s "$PWD/skills.md/concept-ui" ~/.claude/skills/concept-ui
```

To install for one project only, use `.claude/skills/` in that project.

## Invoke

The skill sets `disable-model-invocation: true`, so the agent does not start it automatically.
Type its name and the target:

```text
/concept-ui the settings screen
```
