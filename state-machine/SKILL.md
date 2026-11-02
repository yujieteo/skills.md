---
name: state-machine
description: Model the states of code or of a written requirement as one table, question each requirement, delete what is not necessary, show a simpler design, prove each bug with a failing test, and give the owner an HTML review board with a step-through simulator. For explicit use only, when the user invokes /state-machine.
disable-model-invocation: true
---

# State machine

Make a state machine smaller before you make it correct.
Do the steps in sequence. Never fix code before the owner approves the row on the board.
The target is the code, the requirement, or both, that the user names. If the user names no target, ask for one.

The CLI is `bin/sm-axi` in this skill folder (Node, no dependencies).
Run it as `node <skill-folder>/bin/sm-axi`, or link it as `sm-axi` on the PATH.
It prints compact TOON. The `help` lines of each output give the next command.

## Step 0: Write the machine file

Read [references/format.md](references/format.md) before you write the first file.

1. Write `<name>.sm.md` next to the design documents of the project, or in a scratch folder when the project is read-only.
2. Write the requirements first. Each requirement has an id, its text, and its source: a rule in a design document (`DESIGN.md:36`), an issue, or the exact words of the owner. Do not write a requirement that has no source.
3. Write one row for each transition: `state | event | guard | next | req | source`.
   - From code: the source is `file:line` of the code that does the transition.
   - From a requirement only: the source is the requirement id.
4. When the code keeps its state in flags (booleans, counters, `Option` fields), name the real states and write each flag test as a guard. Write a state that the flags allow but no name covers (for example, a closed input while the turn runs). These hidden states are where bugs live.
5. Keep machines flat. A parallel region is a second `## Machine` in the same file.

## Step 1: Question the requirements

Run `sm-axi check <file>`. Read the `row-no-req` and `req-no-row` findings.

- A row with no requirement: the code does it, but nobody asked for it. Ask the owner on the board: approve it (then name the requirement and its source), or reject it (then it is deleted).
- A requirement with no row: nothing does it. Ask whether it is still necessary.
- Do not invent a requirement to remove a finding. The finding is the question.
- For each requirement, ask: did a real run show the need? A requirement added "in case" is a candidate to delete.

## Step 2: Delete

After the review, delete each rejected row and its requirement from the file.
Delete each requirement that the owner rejected, and each row that only it cited.
Run `sm-axi check` again.

## Step 3: Simplify

Read the `simplify` findings of `sm-axi check`:

| Finding | Question for the design |
|---|---|
| `merge-states` | The states do the same thing. Can they be one state? |
| `pass-through` | One way in, one way out, no guard, no own requirement. Delete the state. |
| `global-event` | Many states do the same on one event. Write one `*` row. |
| `flag-guard` | One flag in many guards. Is it a hidden state, or a second machine? |
| `flag-states` | The state names combine flags. Make one machine for each flag. |
| `function` | No branch and no loop. A plain function is better than a machine. |

Also look at `rows_per_req`. A high ratio means that the machine is larger than its requirements.

When a simpler design exists, write it as `## Proposal <machine>` in the same file.
`sm-axi` shows a proposal only if it keeps each accepted requirement, has fewer rows and passes the 7 checks. Else `check` says why it is hidden. Do not argue for a hidden proposal.

## Step 4: Kill bugs

The 7 checks run on what remains:

1. `unreachable`: no path from the initial state.
2. `dead-end`: no exit and not final.
3. `unhandled`: an event of the machine with no row in a state. Write the row, or write it as ignored (`next` is `-`).
4. `two-transitions`: two rows on one state and event with overlapping guards.
5. `guard-gap`: the guards of one state and event do not cover all cases. Add an `else` row.
6. `row-no-req`: a row with no requirement (step 1).
7. `req-no-row`: a requirement with no row (step 1).

For each finding that is a fault in the code (not only in the table):

1. Write a failing test in the test style of the target project. Name the row of the machine in the test name.
2. Run it and see it fail for the right reason. When the project is read-only, run it in a scratch copy.
3. Add the bug to `## Bugs` with the test path as its proof.
4. Do not fix it. The owner decides on the board.

## Step 5: Review

Run `sm-axi render <file>`. It writes `<name>.html`. Read [references/review.md](references/review.md).

- If `lavish-axi` is on the PATH, run `lavish-axi <name>.html`. The owner approves, rejects or comments on each row and each requirement, and queues the review.
- Else give the owner the file path. The page puts the decisions on the clipboard ("Copy the review").
- Report the file path and the board first. Then wait for the feedback (`lavish-axi poll <name>.html`).
- Apply the feedback: delete rejected rows and their requirements, answer each comment, run `check` and `render` again. Account for each submitted id.

## Refactor

When the owner approves a proposal, do not refactor in the same step.

1. Write the plan: the rows that change, the code that changes (`file:line`), and the order.
2. Write the failing tests that pin the approved behavior of the proposal. Run them and see them fail.
3. Stop. The refactor is a separate step, which the owner approves.

## Done

- The machine file, the `check` output, the review page, and each failing test with the path that it targets.
- A short report: the proven bugs, the deleted rows and requirements, the proposal (shown or hidden, and why), and the open questions for the owner.
