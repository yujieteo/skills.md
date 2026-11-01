# sm-axi self-test: one known fault for each finding

## Requirements

- R1: A job can start and stop. — owner, test fixture
- R2: A job ends when its work is done. — owner, test fixture
- R3: A started job loads, then runs. — owner, test fixture
- R4: Any job can be cancelled. — owner, test fixture
- R9: Nobody uses this. — owner, test fixture

## Machine bugs

initial: a
final: done

| state | event | guard | next | req | source |
|---|---|---|---|---|---|
| a | go | | b | R1 | t:1 |
| a | stop | | done | R1 | t:2 |
| b | go | ok | c | R1 | t:3 |
| b | stop | | done | R1 | t:4 |
| c | go | | done | R2 | t:5 |
| c | go | | a | R2 | t:6 |
| d | go | | done | R1 | t:7 |
| d | stop | | done | | t:8 |
| a | jump | | e | R1 | t:9 |
| * | jump | | - | R1 | t:10 |

## Machine simp

initial: idle
final: done

| state | event | guard | next | req | source |
|---|---|---|---|---|---|
| idle | start | | load | R3 | t:11 |
| load | loaded | | run | R3 | t:12 |
| run | finish | | done | R2 | t:13 |
| idle | cancel | | done | R4 | t:14 |
| load | cancel | | done | R4 | t:15 |
| run | cancel | | done | R4 | t:16 |
| idle | poll | busy | idle | R3 | t:17 |
| idle | poll | !busy | idle | R3 | t:18 |
| run | poll | busy | run | R3 | t:19 |
| run | poll | !busy | run | R3 | t:20 |
| load | poll | | - | R3 | t:21 |
| * | start | | - | R3 | t:22 |
| * | loaded | | - | R3 | t:23 |
| * | finish | | - | R3 | t:24 |

## Machine twins

initial: s
final: done

| state | event | guard | next | req | source |
|---|---|---|---|---|---|
| s | left | | p | R1 | t:25 |
| s | right | | q | R1 | t:26 |
| p | ok | | done | R2 | t:27 |
| q | ok | | done | R2 | t:28 |
| p | left | | - | R1 | t:29 |
| q | left | | - | R1 | t:30 |
| * | right | | - | R1 | t:31 |
| * | ok | | - | R1 | t:32 |

## Machine flags

initial: on_open
final:

| state | event | guard | next | req | source |
|---|---|---|---|---|---|
| on_open | toggle | | off_open | R1 | t:33 |
| off_open | toggle | | on_open | R1 | t:34 |
| on_open | close | | on_closed | R1 | t:35 |
| on_closed | toggle | | off_closed | R1 | t:36 |
| off_closed | toggle | | on_closed | R1 | t:37 |
| off_open | close | | off_closed | R1 | t:38 |
| on_closed | open | | on_open | R1 | t:39 |
| off_closed | open | | off_open | R1 | t:40 |
| * | close | | - | R1 | t:41 |
| * | open | | - | R1 | t:42 |

## Machine pipe

initial: read
final: written

| state | event | guard | next | req | source |
|---|---|---|---|---|---|
| read | parsed | | check | R2 | t:43 |
| check | checked | | written | R2 | t:44 |
| * | parsed | | - | R2 | t:45 |
| * | checked | | - | R2 | t:46 |

## Proposal twins

initial: s
final: done

| state | event | guard | next | req | source |
|---|---|---|---|---|---|
| s | left | | side | R1 | t:47 |
| s | right | | side | R1 | t:48 |
| side | ok | | done | R2 | t:49 |
| side | left | | - | R1 | t:50 |
| * | right | | - | R1 | t:51 |
| * | ok | | - | R1 | t:52 |

## Proposal bugs

initial: a
final: done

| state | event | guard | next | req | source |
|---|---|---|---|---|---|
| a | stop | | done | R1 | t:53 |
