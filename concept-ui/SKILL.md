---
name: concept-ui
description: Redesign the interface of an app or a screen from its conceptual model. First write the concepts and the object-action matrix, then map them to a layered, direct-manipulation, mobile-first interface, with checks that a reviewer can measure. For explicit use only, when the user invokes /concept-ui.
disable-model-invocation: true
---

# Concept UI

Design the model first and the screen second.
Do the three phases in sequence. Do not start a phase before the previous phase is complete.
The target is the app or screen that the user names. If the user names no target, ask for one.

## Phase 1: Conceptual model

Write `docs/concepts.md` (or the location that the project uses for design documents).
In this phase, do not write about layout, widgets, colours or screens.

1. Read the code and use the app. Make a list of the things that users see, make, change or delete.
2. For each concept (Jackson), write:
   - **Name**: one noun.
   - **Purpose**: one sentence. One concept has one purpose. If you find two purposes, make two concepts.
   - **State**: the data that the concept keeps.
   - **Actions**: the operations that change the state, as verbs.
   - **Operational principle**: one short scenario that shows how the concept fulfils its purpose ("after you do X, Y occurs").
3. For each object (ORCA), write:
   - **Objects**: the things that users manipulate.
   - **Relationships**: how each object connects to other objects, with cardinality.
   - **Calls-to-action**: the actions that a user can do on the object. For each action, write its frequency: many times a day, some times a day, or rarely.
   - **Attributes**: the data that a user sees or changes on the object.
4. Write how the concepts interact (synchronisations): when an action in one concept causes an action in another concept.
5. Use the same name for each concept and object in the code, the document and the interface.

## Phase 2: Object-action matrix

Make a table (Rosenberg). Put the objects in the rows and the actions in the columns.
In each cell, write the interface location of that action on that object, or leave the cell empty.

Count the faults. A fault is one of these:
- **Expected empty cell**: a user expects the action on the object, but the interface does not give it. Example: you can rename a project but not a file.
- **Displaced action**: the action is in the interface, but not on its object. Example: delete is in a global menu, not on the item.
- **Inconsistent action**: one action has different names, gestures or locations on different objects.

A cell that is empty because the action has no meaning for that object is not a fault. Write "n/a" in it.
Record the fault count before the change. Fix the faults in the model or the interface until the count is 0, or until the user accepts each remaining fault.

## Phase 3: Map the model to the interface

Each object in the model becomes a visible thing on the screen. Each call-to-action becomes a control on, or next to, its object.
Then apply the rules below. Each rule is a check. Record pass or fail for each check, with the evidence.

1. **Posture and chrome budget** (Cooper).
   Decide if the app is sovereign (used for long periods, full screen) or transient (used for a short task, then closed).
   Check: write the posture in `docs/concepts.md`. For a transient app, chrome (bars, panels, menus) uses no more than 15% of the viewport height at 375 px width. For a sovereign app, the content area is the largest area on each screen.
2. **Content layer and floating control layer** (Liquid Glass).
   Content fills the screen. Controls and navigation float above the content in a separate layer.
   Check: content scrolls below the controls, and no control takes a fixed band of layout from the content.
3. **One z-position for each object** (Material 1).
   Define a small set of z-layers, for example: content 0, raised item 1, floating controls 2, sheet 3, dialog 4. Use shadow or blur to show height.
   Check: each object kind has one z-layer in a single table in the code (tokens or constants). No object changes layer, except during a lift or drag gesture.
4. **Direct manipulation** (Shneiderman).
   Users act on the visible object: drag, swipe, tap, edit in place. Each action shows its result at once. Each action is reversible.
   Check: no destructive action uses a confirm dialog. Each destructive action shows an undo control for at least 5 seconds, and the undo restores the previous state.
   Check: each pressable control changes on press (`:active` or `pointerdown`), not on release. It scales to 0.95–0.98 in 100–160 ms.
5. **A visible signifier for each action** (Norman).
   An affordance is what the user can do. A signifier shows the user that they can do it.
   Check: each cell of the matrix that is not empty has a visible signifier (icon, handle, label or hint). A gesture alone is not a signifier. A hover state alone is not a signifier, because touch screens have no hover.
6. **Fluid motion** (Apple, Designing Fluid Interfaces; Kowalski).
   Motion follows the finger, and the user can interrupt and redirect it at any time.
   Each animation has a purpose: spatial consistency, a change of state, or feedback. Use the action frequency from Phase 1.
   Check:
   - An action that users do many times a day, or start from the keyboard, has no animation. Press feedback (rule 4) is not part of this check.
   - Each other UI animation changes only `transform` and `opacity` and lasts 300 ms or less.
   - Elements that enter or exit use an ease-out curve, for example `cubic-bezier(0.23, 1, 0.32, 1)`. No UI animation uses `ease-in`.
   - No element starts from `scale(0)`. An element enters from `scale(0.9)` or more, with `opacity: 0`.
   - A popover scales from its trigger (`transform-origin`). A modal scales from the centre.
   - During an animation, a new touch stops the animation and gives control to the finger. State that can change during an animation uses a CSS transition or a spring, not keyframes.
   - A released drag continues with the finger velocity. A flick faster than 0.11 px/ms dismisses, at any distance.
   - With `prefers-reduced-motion: reduce`, movement is replaced by a fade or no animation.
7. **Mobile first**.
   Check at 375 px width:
   - The page has no horizontal scroll.
   - Each tap target is at least 44 × 44 px.
   - Content and controls respect the safe-area insets (`env(safe-area-inset-*)`), and the viewport meta tag has `viewport-fit=cover`.
   - The primary controls are in the bottom half of the screen, in thumb reach.
   - Each input has a font size of 16 px or more. The viewport meta tag has no `user-scalable=no` and no `maximum-scale`.
   - A full-height app shell uses `100dvh`, not `100vh`.
   - Each `:hover` rule is inside `@media (hover: hover) and (pointer: fine)`.
   Then check that the layout also works at desktop width (1280 px or more).
   Emulation does not show hover, safe-area, input-zoom or gesture faults. Record which checks need a real phone.
8. **Type and colour restraint** (Kowalski).
   Make the hierarchy with weight, colour and space first, and with size last.
   Check:
   - Body text lines are 65 characters or shorter (`max-width: 65ch`).
   - Headings of 24 px or more have a letter-spacing from -0.04em to -0.02em.
   - Numbers that change in place use `font-variant-numeric: tabular-nums`.
   - Content text uses no more than 3 colours: primary, secondary and one accent.
9. **Worst-case content** (Kowalski).
   Demo data makes a design look good. Real data breaks it.
   Check: render each object with 0, 1 and many items, with missing optional fields, and with the longest value that the schema accepts. If the schema has no limit, use a long real name. No text overflows or clips. Counts use the correct plural ("1 member", with `Intl.PluralRules`).

## Output

Give the user these items, in this sequence:

1. `docs/concepts.md`: concepts, ORCA objects, synchronisations and posture.
2. The object-action matrix before the change and after the change, each with its fault count.
3. The list of changes, each with the concept, object or rule that it serves.
4. The pass or fail result for each check in Phase 3, with the evidence.
5. Screenshots of each changed screen at 375 px and at 1280 px width, before and after the change.

If the project has a pull request flow, put items 2 to 5 in the pull request description.

## Worked example

The snowmobile redesign used this method: https://github.com/yujieteo/snowmobile/pull/3.
It wrote the conceptual model in `docs/concepts.md` first, decreased the matrix faults from 10 to 0, and then added a floating control layer, z-layers, direct manipulation with undo, signifiers and a mobile-first layout.

## Sources

| Work | What it gives |
| --- | --- |
| Daniel Jackson, *The Essence of Software* | Concepts, each with one purpose, state, actions and an operational principle |
| Daniel Rosenberg, *UX Magic* | Semantic interaction design: the conceptual model ("grammar") first, and the object-action matrix |
| Johnson & Henderson, *Conceptual Models* (2nd ed., 2024) | The model holds objects, attributes and operations, and no layout or widgets |
| Sophia Prater, OOUX / ORCA | Objects, relationships, calls-to-action, attributes |
| Material Design 1, Environment | A 3D space with light and shadow, and one z-position for each object |
| Apple, *Designing Fluid Interfaces* (WWDC18) | Motion that is responsive, interruptible and redirectable |
| Apple, Liquid Glass (WWDC25) | A control layer that floats above the content layer |
| Ben Shneiderman, direct manipulation | Visible objects, physical actions and rapid reversible actions |
| Don Norman, *The Design of Everyday Things* (revised ed.) | Affordances versus signifiers |
| Alan Cooper, application posture | Sovereign versus transient applications, which sets the chrome budget |
| Emil Kowalski, [emilkowalski/skills](https://github.com/emilkowalski/skills) (MIT), Sonner, Vaul, [emilkowal.ski](https://emilkowal.ski/), [aiforui.dev](https://aiforui.dev/) | Motion by action frequency, easing and duration limits, press feedback, mobile web fixes, type restraint and worst-case data |
