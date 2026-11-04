---
name: guardrails
description: Find the parts that a project has (a fixed bug, comments, types, states, hot paths, web pages, a simulation, tuned parameters, pure functions, parsers, printed output, a deterministic transform, dead code, C code, an app) and add the related lint rule, type, test, budget check, state model, replay, property test, fuzz target, expect test, output replay, dead-code check, sanitizer build or verification rule in the tools of that project. For explicit use only, when the user invokes /guardrails.
disable-model-invocation: true
---

# Guardrails

Make the tools stop a fault, so that no person must remember a rule.
The target is the project or the bug that the user names. If the user names no project or bug, ask for one.
Do the steps in sequence. Each step starts with "Applies when". If the project lacks that part, do not change the project for that step.
Use the language, linter, test runner and build of the project. Add a new tool only when the project has no tool for that job.
Before you keep a new check that runs, break the code that it guards. See the check fail, then remove the break. A rule in the agent instructions has no break.
A raised budget or a new excluded file needs the approval of the owner and a reason in the change. Never disable a check. Fix the code, or delete the check with the approval of the owner.

## Step 0: Find the parts

Read the build files, the linter config, the tests and the main loop. Write one table:

| Part | Found | Evidence (`file:line`) | Step |
| ---- | ----- | ---------------------- | ---- |

Give one row to each deterministic transform. Its output depends only on its input. Examples: a compiler, a code generator, a renderer, a serializer, a build step, or app logic with an output that a test can capture.
Write "no" for each part that the project does not have. Do not add a part to make a step apply.

## Step 1: A bug becomes a rule

Applies when: the user names a bug, or a step below finds one.

1. Write a lint rule that catches the pattern of the bug. When no lint rule can catch it, write a failing test.
2. Run it on the code before the fix and see it fail for the right reason. Then run it on the fix and see it pass.
3. Name the bug in the rule name or the test name.

Reason: a fixed bug comes back when the next change does not know about it. A rule or a test stops it on each run.

## Step 2: No comments

Applies when: the project has source code. Tool directives (a lint disable, a shebang or a type pragma) and licence headers are not comments for this rule. Item 7 still applies to a lint disable.

1. Choose the excluded files. Exclude a file that a tool writes (generated code, a lock file, build output). Exclude a file from another project (vendored or copied code). Start from the paths that the ignore files, the package manager and the build already name. Add a copied file only when you know its source and licence. Write the list once, in the lint config.
2. Add a lint rule that bans comments in all other files. Keep only a comment that links to an outside source. Examples: an issue, an RFC, a paper or a credit to an author. Find comments with a parser or a lexer. Use the comment rule of the project linter, a tree-sitter query, or the tokenizer of the language.
3. Do not find comments with a text pattern (for example grep for `#` or `//`). A text pattern also matches a colour value such as `#fff`, a URL and a string.
4. Change each comment that the rule finds. When a comment explains code, give the code a better name. When a comment states a behavior, write a test with that behavior as its name.
5. If a fact fits no name and no test, put it in code that runs. Example: a build tool version. Use a named constant, a type, a build script assertion, or an error message for a false fact.
6. Never move a fact into a README or another prose file. Delete a comment only when its fact is in code that runs already or after item 4 or 5.
7. Do not keep a lint disable of a rule that catches real bugs, such as a type error. Fix the code, then remove the disable.

Reason: a comment does not run, so it becomes wrong when the code changes, and a README becomes wrong in the same way. A name, a test or a check stays true or fails. A parser reads comments as the compiler reads them, so it does not match strings or colour values.

## Step 3: Types

Applies when: the project has a static type checker, and a value can hold an illegal state. Examples of checkers: TypeScript, Rust, OCaml, or Python with mypy.

1. Turn on the strictest mode of the type checker that the build can pass. Make the build fail on a type error.
2. Find each value that can hold an illegal state. Examples: flags that exclude each other, optional fields that always go together, and plain strings or numbers for ids and units.
3. Change each one to a type that cannot hold the illegal state. Use a tagged union for exclusive states. Use one record for fields that go together. Use a distinct type for each id and unit.
4. Parse outside data (JSON, a config file, environment variables or a request) into a type at the boundary. Inside the boundary, use only the parsed type.
5. Derive each type from the schema that owns the shape (for example a database schema, an OpenAPI file or a protobuf file). Do not write the same shape again by hand.
6. Each illegal state that the code can reach is a bug. Give it to step 1.

Reason: the type checker gives feedback on each build, and it checks a rule in all of the code at once. A test checks only the cases that it runs.

## Step 4: States

Applies when: a major system keeps a state that changes on events (for example a session, an upload, a connection or a turn).

1. Run `/state-machine` on each major system. Make one machine file for each system.
2. Give each bug that it proves to step 1.
3. Use a model checker when an invariant is critical and the state table is too large to check by hand. Examples: money, data loss, access control.
4. Write the model (for example in TLA+) from the machine file.
5. Record the covered files and their hash in a check script or the model checker config. Make the test or the build fail if a covered file changes later. To pass, run the model checker again. Update the hash. Do not use a comment or a prose note for the record.

Reason: state bugs live in combinations of flags that no test tries. The state table finds them, and a model checker tries all combinations. Formal methods were expensive, but an agent makes a model cheap to write.

## Step 5: Hot paths

Applies when: code runs each frame, each tick or each sample (for example a render loop, a game loop or an audio callback).

1. Put `.hot` in the name of each file with such code, before the extension (for example `physics.hot.ts`). Move cold code out of these files.
2. Add a lint rule that applies only to `*.hot.*` files and bans allocation: object literals, array literals, closures and `new`.
3. Change each allocation that the rule finds: reuse a buffer, a pool or a value from the setup code.

Reason: an allocation in a loop that runs each frame causes garbage collection pauses. The file name tells the reader and the linter which code is hot.

## Step 6: Web page budget

Applies when: the project ships a web page.

1. List each route or page template (for example the home page, the article template and the tool template). Do not list each article.
2. Add a build step that finds each page in the build output itself. The step gives each page the budget of its route or template. A page that the list does not name gets the default budget. The step never skips a page.
3. For each page, the step measures the gzipped size of each file that the first load of that page downloads. Count the shared files in the total of each page. The step fails when a page total is larger than its budget.
4. Use the budget of the owner for each route or template and for the default. If the owner gives none, use the largest current page total of that route or template. Round it up to the next 10 KB. For the default, use the largest total of all pages, rounded in the same way. Report each budget.

Reason: a user can arrive on any page from a link, and the first download sets the load time on a slow network. Each change adds a few kilobytes, and no review sees the total.

## Step 7: Deterministic simulation

Applies when: the project has a simulation. A simulation changes its state from inputs over many steps, for example a game, a physics model or a scheduler.

1. Make each step a function of the state and the inputs only. Use a fixed time step and a seeded random number generator.
2. Add a lint rule that bans the wall clock and unseeded random numbers in simulation files.
3. Record the seed and the inputs of a run. Add a test that replays a recorded run and compares a hash of the final state.
4. Add a test that runs the simulation with many seeds and checks the invariants of the state after each step. Record each seed that fails as a run for item 3. Give the bug to step 1.
5. If a server accepts a result of a run, such as a score, make the server replay the inputs and compare the result.

Reason: you cannot debug a run that does not replay from a report. A posted result that the server does not replay can be false.

## Step 8: Tuned parameters

Applies when: a parameter has a target value that a run can measure (for example a survival rate for each difficulty). Step 7 applies first.

1. Write a headless bot that runs the simulation without the interface.
2. Add a test that runs the bot many times for each parameter set. Make it fail when the measured value is outside the target range.
3. Report each parameter set that fails, with its measured value. Do not change the parameter without the owner.

Reason: a person tunes by feel and by a small number of runs. A bot measures the target on each change.

## Step 9: Property tests and fuzz targets

Applies when: the project has a parser of outside input, or a pure function with a rule that holds for all inputs. Example: decode after encode gives the input.

1. Use the property test library of the language (for example fast-check, Hypothesis, proptest or QuickCheck). Write one property test for each rule.
2. For each parser of outside input, add a fuzz target for the fuzzer of the language. Examples: cargo-fuzz, Go fuzz or Atheris. Make the target fail on a crash or a hang.
3. Keep each input that fails in the library or the fuzzer as a fixed test case. Give the bug to step 1.

Reason: a person writes the test inputs that the person expects. A generator tries inputs that nobody expects, and it makes each failure small.

## Step 10: Expect tests

Applies when: code makes output that a person reads to check it, or a test asserts many fields one by one. Examples of output: compiler output, a report, a rendered table or a state trace.

1. Use the snapshot or expect test tool of the test runner (for example Vitest snapshots, insta, ppx_expect or syrupy).
2. Write a test that prints the output as readable text. Keep the text in the test or in a fixture file next to it. Print only what a user of the code can see, not internal state.
3. Make the test fail on each difference and show the diff. Update the kept text only with a command, so that the change shows in the review.

Reason: the printed text shows the behavior in one place, as the fixture tests of a compiler do. The reviewer reads one diff of text, not each assertion.

## Step 11: Output replay

Applies when: step 0 found a deterministic transform.
Use step 10 for a small output that a person reads. Use this step for a large generated output (for example a whole C file or a GPU kernel). Step 7 stays for a simulation.
Source of the idea: <https://github.com/tinygrad/tinygrad/blob/master/test/external/process_replay/README.md>

1. Add a capture switch (for example an environment variable). When the tests run with it, the transform writes each input to a local cache outside the repository.
2. Add a replay command. It runs the base commit and the branch, each in an isolated copy (for example a git worktree). It gives each captured input to the transform of each commit and diffs the outputs.
3. Treat each commit as a refactor: the command fails on each diff. Nothing in the commit (for example a title tag or a trailer) can turn the check off.
4. When a change must change the output, the command prints the diff. It passes only when the person who runs it accepts that diff on that run (for example with an `--accept` flag).
5. When more than 20% of the outputs differ, the command stops early and reports a large change. Without an accept, this is a failure.
6. Run the command locally before a review. Do not add it to CI.

Reason: a refactor of a transform can change one output in a thousand, and no test asserts that output. The inputs of the existing tests find it. An accept on each run makes a person read the diff, and a commit cannot skip the check. The early stop saves time when the diff is too large to read.

## Step 12: Dead code

Applies when: the project has source code.

1. Use the dead-code rule of the project linter, or add a dead-code tool of the language. Examples: knip, cargo-udeps, or the unused warnings of the compiler as errors. Make the build fail on each file, export, function or dependency that nothing uses.
2. Use the excluded files of step 2. Give each public entry point to the tool as a root.
3. Delete each unreferenced symbol that the tool finds. Ask the owner before you delete a public API.
4. Write this rule in the agent instructions of the project. Before you end a change, find the references of each symbol that the change replaced. Use the language server or the compiler. At zero references, delete the symbol.

Reason: an agent adds new code next to old code, because a deletion needs proof. The reference query gives the proof, and the build fails until the old code goes.

## Step 13: C sanitizers

Applies when: the project ships C or C++ code, also C that a compiler generates (for example from Goose).

1. Add a test build that compiles with `-fsanitize=undefined,address` and `-fno-sanitize-recover=all`.
2. Run the test command of the project on that build. A sanitizer report fails the test.
3. Each fault that a sanitizer reports goes to step 1. For generated C, fix the generator, not the generated file.

Reason: undefined behavior and memory faults often give the correct result in a test, then fail on another compiler or input. A sanitizer stops the test at the fault.

## Step 14: Verify

Applies when: the project has an app that a person or a program starts. Examples: a web site, a server, a command or a game.

1. Find the verification skill or command of the project (for example a `verify-*` skill). It starts the app and proves a change on the path of a user.
2. If the project has one, write this rule in the agent instructions of the project. Before you say that you finished a change, run it and show its output.
3. If the project has none, do not write one. Name the gap in Done as an open question.

Reason: tests show that the parts work, but only a start of the app shows that a change works for a user. The agent then gives proof, not a guess.

## Done

- The part table of step 0.
- For each step that applies: the rule, type, test or check, its path and its first run output.
- For each check that runs: the break that it caught.
- For step 6: for each route or template and for the default, the largest current page total and the budget.
- For each step that does not apply: one line that names the missing part.
- The open questions for the owner. They are the budgets, the target values, the excluded files of step 2 and the bugs that the new rules found. If step 14 found no verification skill, add that gap.
