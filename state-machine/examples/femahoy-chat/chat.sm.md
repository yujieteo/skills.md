# femahoy chat: from request to mesh, solve and report

Source: femahoy at 321483d6, read only. `daemon/` is `crates/fh/src/daemon/`.
Machine `chat` is the agent process in the daemon (`Log` in `daemon/chat.rs`): its state is not a field, but `running()` over the flags `reading`, `turn`, `sent`, `taken` and `input`.
Machine `job` is what the page shows for one request (`entry()` in `daemon/page.html`). It is a parallel region of `chat`.

## Requirements

- R1: A message during the work reaches the agent at its next step. — DESIGN.md:36
- R2: `Stop agent and commands` ends the work at once. — DESIGN.md:36
- R3: If no agent is alive, a message starts one first, and the new agent continues the session of the chat. — daemon/chat.rs:238 and daemon/chat.rs:274
- R4: An `error` entry shows when the agent cannot start, or when it ended before the end of its work. — daemon/chat.rs:36
- R5: A status shows the current action of the agent and the time. — DESIGN.md:36
- R6: A missing or signed-out agent tells the person what to do. — DESIGN.md:82
- R7: The agent writes a CAD script for the part, meshes it with gmsh, writes the solver input and solves it. — README.md:42
- R8: It solves at least 2 meshes to find the mesh error. — README.md:42
- R9: At the end, the agent writes 1 HTML report with the results, a hand check and the viewer. — README.md:42
- R10: The page refuses an empty message. — daemon/chat.rs:242

## Bugs

- B1: After Stop, entries of the stopped agent still show. A late `end` entry hides the Rerun button (daemon/page.html:819). Row `* | stale_line`. — tests/chat_stale_line.rs fails on 321483d6

## Machine chat

initial: none
final:

| state | event | guard | next | req | source |
|---|---|---|---|---|---|
| none | ask | spawn ok | working | R3 | daemon/chat.rs:247 |
| none | ask | else | none | R4 R6 | daemon/chat.rs:292 |
| working | ask | write ok | working | R1 | daemon/chat.rs:270 |
| working | ask | else | broken | | daemon/chat.rs:264 |
| resting | ask | write ok | working | R1 R5 | daemon/chat.rs:250 |
| resting | ask | else | broken | | daemon/chat.rs:264 |
| broken | ask | spawn ok | working | R3 R4 | daemon/chat.rs:278 |
| broken | ask | else | none | R4 | daemon/chat.rs:292 |
| working | turn | | working | R5 | daemon/chat.rs:377 |
| working | result | sent > taken | working | R1 | daemon/chat.rs:383 |
| working | result | else | resting | R5 | daemon/chat.rs:383 |
| working | exit | | none | R4 | daemon/chat.rs:414 |
| broken | exit | | none | R4 | daemon/chat.rs:414 |
| resting | exit | | none | R3 | daemon/chat.rs:417 |
| none | exit | | - | R2 | daemon/chat.rs:397 |
| * | stop | | none | R2 | daemon/chat.rs:328 |
| * | empty | | - | R10 | daemon/chat.rs:242 |
| * | turn | | - | R5 | daemon/chat.rs:376 |
| * | result | | - | R5 | daemon/chat.rs:376 |
| * | stale_line | | - | | daemon/chat.rs:386 |

## Proposal chat

initial: none
final:

| state | event | guard | next | req | source |
|---|---|---|---|---|---|
| none | ask | spawn ok | working | R3 | daemon/chat.rs:247 |
| none | ask | else | none | R4 R6 | daemon/chat.rs:292 |
| working | ask | write ok | working | R1 | daemon/chat.rs:270 |
| resting | ask | write ok | working | R1 R5 | daemon/chat.rs:250 |
| * | ask | else | none | R4 | proposal: a write failure ends the agent |
| working | turn | | working | R5 | daemon/chat.rs:377 |
| working | result | sent > taken | working | R1 | daemon/chat.rs:383 |
| working | result | else | resting | R5 | daemon/chat.rs:383 |
| working | exit | | none | R4 | daemon/chat.rs:414 |
| resting | exit | | none | R3 | daemon/chat.rs:417 |
| none | exit | | - | R2 | daemon/chat.rs:397 |
| * | stop | | none | R2 | daemon/chat.rs:328 |
| * | empty | | - | R10 | daemon/chat.rs:242 |
| * | turn | | - | R5 | daemon/chat.rs:376 |
| * | result | | - | R5 | daemon/chat.rs:376 |
| * | stale_line | | - | R2 | proposal: drop each line of an agent that is not current |

## Machine job

initial: idle
final:

| state | event | guard | next | req | source |
|---|---|---|---|---|---|
| idle | you | | asked | R1 | daemon/page.html:851 |
| asked | show | | meshed | R7 | daemon/page.html:802 |
| asked | open | | solved | R7 | daemon/page.html:782 |
| meshed | show | | meshed | R7 | daemon/page.html:802 |
| meshed | open | | solved | R7 | daemon/page.html:782 |
| solved | open | | solved | R8 | daemon/page.html:782 |
| solved | report | | reported | R9 | daemon/page.html:795 |
| reported | end | | idle | R9 | daemon/page.html:818 |
| solved | end | | idle | | daemon/page.html:818 |
| asked | end | | idle | | daemon/page.html:818 |
| meshed | end | | idle | | daemon/page.html:818 |
| * | error | | idle | R4 | daemon/page.html:777 |
| * | stopped | | idle | R2 | daemon/page.html:823 |
| * | you | | - | R1 | DESIGN.md:36 |
| * | show | | - | R7 | daemon/chat.rs:336 |
| * | open | | - | R7 | daemon/chat.rs:336 |
| * | report | | - | R9 | daemon/chat.rs:336 |
| * | end | | - | R5 | daemon/page.html:818 |
