# The review page

`sm-axi render <file>` writes one HTML file with no network files. It shows, from the most important item:

1. The verdict: proven bugs, check findings, simplifications, rows per requirement.
2. The proven bugs with their failing tests.
3. The findings in the order of the work: question the requirements, simplify, kill bugs. Each finding links to its row.
4. For each machine: the diagram and the simulator. A shown proposal is side by side with the current machine.
5. The rows, with Approve, Reject and a comment on each row. Then the requirements, with the same controls.

## The board

- With lavish-axi: `lavish-axi <file>.html`. "Queue the review" queues one tracked batch with each decided id (`<machine>-L<line>` for a row, the id for a requirement). Then the owner sends it. Read it with `lavish-axi poll <file>.html`.
- Without lavish-axi: open the file in a browser. "Copy the review" puts the decisions on the clipboard as text, one id on each line.
- A rejected row is deleted with its requirement. A comment needs an answer in the next version.
- After the changes, run `check` and `render` again, and reply on the board with `lavish-axi reply <file>.html --agent-reply "<what changed>"`.

## Look

The tokens of the owner's site (`https://teoyujie.org/shared/kowalski.css`), light only, as the site: the gray scale, the Inter and IBM Plex Mono stacks, the strong ease-out curve, the `.button` look, 44 px tap areas, and hover only under `(hover: hover) and (pointer: fine)`.

## Motion

Names from animation-vocabulary. Each motion has a purpose.

| Motion | Name | Values | Purpose |
|---|---|---|---|
| The current-state marker moves along the transition | Translate, a Tween along the edge path (WAAPI) | `transform` only, 200 ms, `cubic-bezier(0.23, 1, 0.32, 1)` | Spatial consistency: the reviewer sees which edge the event took |
| A button press | Press / Tap feedback | `scale(0.97)`, 150 ms ease-out | Feedback |
| A fired row, the current node | none (instant colour) | | A colour change at the arrival does not need motion |

- A keyboard-fired event (`click` with `detail` 0) moves the marker at once: never animate a keyboard action.
- Reduced motion: the marker moves at once, and the press scale is 1.
- A second event during a move finishes the first move, then starts the next one.

## review-animations verdict of the template

| Before | After | Why |
|---|---|---|
| Marker jumps to the next state | WAAPI `transform` along the edge, 200 ms strong ease-out | Spatial consistency; under 300 ms; ease-out answers the click at once |
| Every fire animates | No movement for a keyboard fire or reduced motion | Keyboard actions get no animation; reduced motion is honoured |
| Node colour fades | Instant colour at the arrival | No second motion that competes with the marker |

Approve: `transform` only, no `transition: all`, no `ease-in`, hover gated, reduced motion honoured.
