# Example: the femahoy chat

The first real run of the skill, on femahoy at the commit of [chat.sm.md](chat.sm.md), with no change to femahoy.

| File                     | Content                                                                                  |
| ------------------------ | ---------------------------------------------------------------------------------------- |
| [chat.sm.md](chat.sm.md) | The machines `chat` and `job`, the proposal, the requirements and the bug                |
| [check.toon](check.toon) | `sm-axi check chat.sm.md`                                                                |
| [chat.html](chat.html)   | `sm-axi render chat.sm.md`: the review page                                              |
| [tests/](tests/)         | Failing tests. The `TARGET` constant of each file names the femahoy path that it targets |

## Results

- B1, a bug: after Stop, entries of the stopped agent still show. `tests/chat_stale_line.rs` fails on that commit. The chat shows `end done in 0.0 s` and `note Terminated: 15` after `note stopped the agent`. The `end` entry hides the Rerun button (`daemon/page.html:819`). The cause: `Chat::follow` pushes each entry of each agent (`daemon/chat.rs:386`), and the stderr thread does the same (`daemon/chat.rs:313`).
- The hidden state `broken`: a message that cannot reach the agent drops the input but keeps the chat `running` (`daemon/chat.rs:264`). `tests/chat_write_failure.rs` fails on that commit with `state=running` after the write failure. It pins the proposal, not a bug: the owner decides.
- `job` has no state in the code: the page only shows entries. `asked` and `meshed` are equivalent, and `reported` is a pass-through. R8 ("at least 2 meshes") has a row (`solved | open`), but no guard stops a report after 1 mesh. Only the instructions of the agent ask for it.
- 6 rows have no requirement. The owner decides on each one on the board.

## Refactor plan (not done: a separate approved step)

The proposal `chat` has 16 rows, not 20, keeps each requirement, and passes the checks.

1. Replace the flags `reading`, `turn`, `sent`, `taken`, `input` and `agent` of `Log` (`daemon/chat.rs:70`) with one field: `enum Agent { None, Resting { child, input }, Working { child, input, started_ms, unread } }`. `running()` becomes a match.
2. A write failure in `ask` (`daemon/chat.rs:264`) ends the agent (`Log::end`) and goes to `None`. The state `broken` goes.
3. `follow` and the stderr thread push an entry only when `log.current(pid)` (`daemon/chat.rs:386` and `daemon/chat.rs:313`). This also fixes B1.
4. Keep `tests/chat_stop.rs` green. Make `tests/chat_stale_line.rs` and `tests/chat_write_failure.rs` green.

Run the tests in a femahoy checkout:

```sh
cp state-machine/examples/femahoy-chat/tests/*.rs <femahoy>/crates/fh/tests/
cargo test -p fh --test chat_stale_line --test chat_write_failure
```
