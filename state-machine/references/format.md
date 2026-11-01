# The machine file (`.sm.md`)

One Markdown file holds the requirements, the bugs and each machine. `sm-axi` reads only the parts below. Other text is free.

```markdown
# Upload: from pick to stored            <- title of the review page

Source: app at 1a2b3c, read only.        <- intro text, shown under the title

## Requirements

- R1: A person can cancel an upload at any time. — DESIGN.md:12
- R2: A failed upload can be tried again. — issue #40

## Bugs

- B1: Cancel during retry leaves the spinner on. — tests/upload_cancel.rs fails on 1a2b3c

## Machine upload

initial: idle
final: stored

| state | event | guard | next | req | source |
|---|---|---|---|---|---|
| idle | pick | | sending | R1 | src/upload.ts:20 |
| sending | done | ok | stored | R1 | src/upload.ts:41 |
| sending | done | else | failed | R2 | src/upload.ts:44 |
| failed | retry | | sending | R2 | src/upload.ts:60 |
| * | cancel | | idle | R1 | src/upload.ts:70 |

## Proposal upload

(the same form: a simpler design of the machine `upload`)
```

## Sections

| Section | Content |
|---|---|
| `# <title>` | The page title. The lines after it, up to the first machine, are the intro. |
| `## Requirements` | `- <id>: <text> — <source>`. The source is required (` -- ` also works). |
| `## Bugs` | `- <id>: <text> — <failing test>`. Only bugs with a failing test. |
| `## Machine <name>` | `initial:`, `final:` (a comma list, can be empty) and the table. |
| `## Proposal <name>` | A simpler design of the machine `<name>`, in the same form. |

## Columns

| Column | Rule |
|---|---|
| `state` | A state name, or `*` for each non-final state. |
| `event` | The event name. Use the same word for the same event in each row. |
| `guard` | Empty, a condition, or `else`. Write `!x` or `not x` for the opposite of `x`. Write `or` and `and`, not `\|\|`. |
| `next` | The next state, the same state (a loop with an effect), or `-` (the event is ignored: no effect). |
| `req` | Requirement ids, separated by spaces or commas. Empty or `-` is no requirement. |
| `source` | `file:line` of the code, or the requirement id. |

A `*` row applies to each non-final state that has no own row for its event. A `*` row with a guard applies to each non-final state that has no own row for its event and that guard.

## Findings

`sm-axi check` prints `machines`, `bugs`, `simplify`, `checks` and `proposals`. Each finding has `kind`, `machine`, `at` (`state`, `state/event` or an id), `line` (`L<n>` of the file) and `detail`.

| Kind | Group | Meaning |
|---|---|---|
| `unreachable` | check | No path from `initial`. |
| `dead-end` | check | Not final, and no row goes to another state. |
| `unhandled` | check | A reachable non-final state has no row for these events. |
| `two-transitions` | check | 2 or more rows on one state and event, and the guards overlap (the same guard, or one row has no guard). |
| `guard-gap` | check | Guarded rows with no `else`, and not exactly `x` and `!x`. |
| `row-no-req` | check | A row with no requirement, or with an id that is not in `## Requirements`. |
| `req-no-row` | check | A requirement that no row of a machine cites. |
| `merge-states` | simplify | Equivalent states (minimisation): the same events go to equivalent states, and the same events are ignored. |
| `pass-through` | simplify | One row in, one row out, no guard, and no requirement of its own. |
| `global-event` | simplify | One event, guard and next state in 3 or more states. |
| `flag-guard` | simplify | One guard term in 3 or more rows of 2 or more states. |
| `flag-states` | simplify | 3 or more state names made only of name parts that other states share (`on_open`, `off_open`). |
| `function` | simplify | 2 states or fewer, or no branch and no loop. |

`rows_per_req` is the rows of a machine divided by the requirements that it cites.

A proposal has `status` `shown` or `hidden`, with the reason. It shows only if it cites each requirement that the machine cites, has fewer rows, and has no check finding.

Exit codes: 0 no check finding, 1 one or more check findings, 2 a usage or parse error.
