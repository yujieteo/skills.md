---
name: guardrails
description: Find the parts that a project has (a fixed bug, comments, states, hot paths, a web page, a simulation, tuned parameters) and add the related lint rule, test, budget check, state model or replay in the tools of that project. For explicit use only, when the user invokes /guardrails.
disable-model-invocation: true
---

# Guardrails

Make the tools stop a fault, so that no person must remember a rule.
The target is the project or the bug that the user names. If the user names no target, ask for one.
Do the steps in sequence. Each step starts with "Applies when". If the project does not have that part, do not change the project for that step.
Use the language, linter, test runner and build of the project. Add a new tool only when the project has none for that job.

## Step 0: Find the parts

Read the build files, the linter config, the tests and the main loop. Write one table:

| Part | Found | Evidence (`file:line`) | Step |
|---|---|---|---|

Write "no" for each part that the project does not have. Do not add a part to make a step apply.

## Step 1: A bug becomes a rule

Applies when: the user names a bug, or a step below finds one.

1. Write a lint rule that catches the pattern of the bug. When no lint rule can catch it, write a failing test.
2. Run it on the code before the fix and see it fail for the right reason. Then run it on the fix and see it pass.
3. Name the bug in the rule name or the test name.

Reason: a fixed bug comes back when the next change does not know about it. A rule or a test stops it on each run.

## Step 2: No comments

Applies when: the project has source code. Tool directives (for example a lint disable, a shebang or a type pragma) and licence headers are not comments for this rule.

1. Add a lint rule that bans comments.
2. Change each comment that the rule finds. When a comment explains code, give the code a better name. When a comment states a behavior, write a test with that behavior as its name. Delete a comment only when its text is in the code already.

Reason: a comment does not run, so it becomes wrong when the code changes. A name or a test stays true or fails.

## Step 3: States

Applies when: a major system keeps a state that changes on events (for example a session, an upload, a connection or a turn).

1. Run `/state-machine` on each major system. Make one machine file for each system.
2. Each bug that it proves goes to step 1.

Reason: state bugs live in combinations of flags that no test tries. The state table finds them.

## Step 4: Hot paths

Applies when: code runs each frame, each tick or each sample (for example a render loop, a game loop or an audio callback).

1. Put `.hot` in the name of each file with such code, before the extension (for example `physics.hot.ts`). Move cold code out of these files.
2. Add a lint rule that applies only to `*.hot.*` files and bans allocation: object literals, array literals, closures and `new`.
3. Change each allocation that the rule finds: reuse a buffer, a pool or a value from the setup code.

Reason: an allocation in a loop that runs each frame causes garbage collection pauses. The file name tells the reader and the linter which code is hot.

## Step 5: Web page budget

Applies when: the project ships a web page.

1. Measure the gzipped size of each file that the first page load downloads.
2. Add a build step that fails when the total is larger than the budget. Use the budget of the owner. When there is none, use the current total, rounded up to the next 10 KB, and report it.

Reason: the first download sets the load time on a slow network. Each change adds a few kilobytes, and no review sees the total.

## Step 6: Deterministic simulation

Applies when: the project has a simulation (code that changes its state from inputs over many steps, for example a game, a physics model or a scheduler).

1. Make each step a function of the state and the inputs only. Use a fixed time step and a seeded random number generator.
2. Add a lint rule that bans the wall clock and unseeded random numbers in simulation files.
3. Record the seed and the inputs of a run. Add a test that replays a recorded run and compares a hash of the final state.
4. When a server accepts a result of a run (for example a score), make the server replay the inputs and compare the result.

Reason: a run that does not replay cannot be debugged from a report. A posted result that the server does not replay can be false.

## Step 7: Tuned parameters

Applies when: a parameter has a target value that a run can measure (for example a survival rate for each difficulty). Step 6 must apply first.

1. Write a headless bot that runs the simulation without the interface.
2. Add a test that runs the bot many times for each parameter set and fails when the measured value is outside the target range.
3. Report each parameter set that fails, with its measured value. Do not change the parameter without the owner.

Reason: a person tunes by feel and by a small number of runs. A bot measures the target on each change.

## Done

- The part table of step 0.
- For each step that applies: the rule, test or check, its path, and its first run output.
- For each step that does not apply: one line that names the missing part.
- The open questions for the owner: budgets, target values and the bugs that the new rules found.
