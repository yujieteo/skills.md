# Website Design Audit Standard

30 Oct 2026 · Teo Yu Jie

Each rule has an ID, a pass test, and a source. Audit one page at a time. Mark each rule Pass, Fail, or N/A. A rule marked Fail needs a fix or a written reason.

## 1. Motion

| ID | Rule | Pass test | Source |
| --- | --- | --- | --- |
| M1 | Each animation has a purpose: explain a feature, give feedback, keep spatial sense, or (seldom seen) give delight. | Write the purpose for each animation. Remove an animation with no purpose. | Emil: You Don't Need Animations |
| M2 | Do not animate actions that users do tens or hundreds of times each day (command menu open, list hover). Never animate keyboard actions. | Arrow-key highlight in a list has transition-duration 0. A daily menu opens with no animation. | Emil: You Don't Need Animations |
| M3 | UI animation takes less than 300 ms. Micro-interaction: 100-150 ms. Tooltip, dropdown: 150-250 ms. Modal, drawer: 200-300 ms. Exit is about 20% faster than entrance. A larger element is slower than a small one. | List every duration in the CSS. Each value is in range. Allowed exceptions: marketing pages, a bottom sheet at 500 ms, and page-load or page-transition motion up to 600 ms. Observed: paco.me enter animation 0.6 s; shud.in page transition 0.4 s and 0.6 s. | Emil: Agents with Taste; Building a Drawer |
| M4 | Easing: element enters or leaves the screen = ease-out. Element moves on screen = ease-in-out. Hover change = ease. Constant motion = linear. Default = ease-out. | No ease-in on any UI transition. Observed: hover and color changes on emilkowal.ski and shud.in use cubic-bezier(0.4, 0, 0.2, 1) at 0.15 s (Tailwind default). This is allowed. | Emil: 7 Practical Tips; Agents with Taste |
| M5 | Use custom curves, not the built-in ones, for important motion. Reference curves: sheet = cubic-bezier(0.32, 0.72, 0, 1). Reveal = cubic-bezier(0.77, 0, 0.175, 1). | Curves are named tokens in one file. | Emil: Drawer; Clip Path |
| M6 | A pressed button scales down to a value from 0.94 to 0.97. | Each button has transform: scale(0.94) to scale(0.97) on :active. Observed: emilkowal.ski uses 0.94 and 0.96. | Emil: 7 Practical Tips |
| M7 | An element that appears starts at scale 0.9 or more (0.93-0.95 in the examples). Never start at scale(0). | No scale(0) in any enter animation. | Emil: 7 Practical Tips |
| M8 | A popover scales from its trigger. | transform-origin is set from the trigger (Radix: --radix-dropdown-menu-content-transform-origin; Base UI: --transform-origin). It is not center. | Emil: 7 Practical Tips |
| M9 | First tooltip waits before it opens. The next tooltip opens at once, with no delay and no animation. Tooltip transition: 0.125 s ease-out on opacity and transform, from scale 0.97. | Move between two tooltips: the second has transition-duration 0ms. | Emil: 7 Practical Tips |
| M10 | Use CSS transitions, not keyframes, for state that can change while it moves (stacks, toggles). Use @starting-style for enter. | A fast second trigger does not make an element jump. | Emil: Toast |
| M11 | If a crossfade still looks wrong after you tune easing and duration, add filter: blur() under 20 px (2 px in the example). Use this last. | Each blur value is under 20 px and has a note that says why. | Emil: 7 Practical Tips; Agents with Taste |
| M12 | Animate transform, opacity, clip-path, and small blur only. Do not animate width, height, or margin. Shaky motion: add will-change: transform. Hover flicker: animate the child, not the parent. Do not use translateZ(0) as a hack. | Search the CSS for transitions on layout properties. None found. | Emil: Clip Path; Agents with Taste. bendc: Guidelines |
| M13 | During a drag, set transform on the element itself. Do not change a CSS variable on a parent with many children. | Drag a 20+ item drawer. No dropped frames. | Emil: Drawer |
| M14 | A reveal on scroll runs one time and starts when 100 px or more of the element is in view. Use IntersectionObserver or a hook with the same behavior. Reveal: clip-path inset(0 0 100% 0) to inset(0), 1 s. | Scroll to the element. It animates once. No layout shift. | Emil: Clip Path |
| M15 | Page-load animation and view transitions run only when the user has not asked for reduced motion. | Set prefers-reduced-motion: reduce. No enter animation and no view transition runs. | Observed: paco.me (no-preference gate), shud.in (not reduce gate), emilkowal.ski (motion-reduce classes) |

## 2. Components

| ID | Rule | Pass test | Source |
| --- | --- | --- | --- |
| K1 | Toast: it closes after 4 s. The timer stops on hover and when the browser tab is hidden (document.hidden). | Hover a toast, then switch tab. The toast stays. | Emil: Toast |
| K2 | Toast stack: each toast is offset by gap x index, and scaled by 1 - 0.05 x index. In stacked mode, all toasts have the height of the front toast. Hover expands the stack. | Add 3 toasts with different heights. The edges line up. | Emil: Toast |
| K3 | Fill the gaps between stacked items with an :after pseudo-element, so hover does not break. | Move the pointer slowly across a gap. The stack stays open. | Emil: Toast |
| K4 | Swipe to dismiss uses speed, not only distance. Speed = distance / time. Dismiss when distance passes the limit or speed is above 0.11 (value from Sonner, found by trial). | A short fast flick closes the toast. | Emil: Toast |
| K5 | A drag that goes the wrong way gets friction: it slows and stops. It does not stop at once. The element keeps pointer capture while it drags. | Drag outside the element. The drag continues. | Emil: Toast; Drawer |
| K6 | Sheet or drawer motion: transform 0.5 s cubic-bezier(0.32, 0.72, 0, 1). | The CSS has this exact transition. | Emil: Drawer |
| K7 | A drawer starts a drag only when its content is scrolled to the top. After a scroll reaches the top, block dragging for 100 ms. Ignore a second finger until the first one lifts. | Fast scroll to the top does not close the drawer. | Emil: Drawer |
| K8 | Drawer snap points are a fraction of the viewport or a fixed px value. On release, go to the nearest point. A hard flick can skip points. | Release at 3 positions. Each one snaps to the right point. | Emil: Drawer |
| K9 | When the keyboard opens, use the Visual Viewport API to set drawer height and bottom position. | Focus an input on a phone. The input and drawer content stay visible. | Emil: Drawer |
| K10 | Build overlays on an accessible primitive (Radix Dialog, Popover, Tabs). It handles focus and ARIA. | The overlay traps focus and closes with Escape. | Emil: Drawer; Clip Path. Paco: cmdk |
| K11 | Command menu: the page does not listen for the open key by default. Add the Cmd+K and Ctrl+K listener yourself. Escape, or Backspace on an empty field, goes back one level. | Keyboard-only use works for open, search, select, go back. | Paco: cmdk |
| K12 | Command list: height follows content with transition: height 100ms ease (--cmdk-list-height). Set scroll-padding-block to 8px at the start and end. | The list does not jump when results change. | Paco: cmdk |
| K13 | Command menu has a visible empty state and a loading state. It has no virtualization, so keep it under about 2,000-3,000 items. | Search for a string with no match. A message shows. | Paco: cmdk |
| K14 | Tab highlight: copy the tab list, style the copy as active, and clip it with clip-path: inset(0 R% 0 L% round 17px). Animate the clip to the new tab. The copy has aria-hidden and tabindex -1. | The highlight moves with no color-fade lag. | Emil: Clip Path (technique from Paco) |

## 3. Type

| ID | Rule | Pass test | Source |
| --- | --- | --- | --- |
| T1 | Load Inter with a preconnect and the stylesheet. Set :root font-family: Inter, sans-serif and font-feature-settings: 'liga' 1, 'calt' 1. Inside @supports (font-variation-settings: normal), use InterVariable, sans-serif. | The computed font of body text is Inter or InterVariable. @font-face has font-display: swap. Observed: rsms.me. | rsms: Inter |
| T2 | Numbers in tables, prices, and counters use tabular figures (tnum, or font-variant-numeric: tabular-nums). | Digits in a column have equal width. | rsms: Inter; Emil: Agents with Taste |
| T3 | Use the slashed zero (zero) or the disambiguation set (ss02) only where 0/O or I/l can be confused, for example codes and IDs. | Each use is in an ID or code context. | rsms: Inter |
| T4 | The prose column is 692 px wide at most. | max-width on prose is 692 px or less. Observed: paco.me 640 px, shud.in 672 px, emilkowal.ski 692 px. The 65ch value is in Emil's skill, but his own site is wider. | Emil: Agents with Taste |
| T5 | Headings use text-wrap: balance. No heading ends with one word on its last line. | Resize from 320 px to 1440 px. No orphan word in any heading. Observed: shud.in h1 has text-wrap: balance. | Shu: react-wrap-balancer |
| T6 | Use the single character …, not three dots. | Search the markup for "...". None in UI text. | Emil: Agents with Taste |
| T7 | Uppercase labels have wider letter-spacing. | Each uppercase label has letter-spacing above 0. | Emil: Agents with Taste |
| T8 | The fallback font stack has x-height and weight close to the main font. | Block the font file. The layout shift is small. | Emil: Agents with Taste |
| T9 | Underline is for links only. Use weight or color for other emphasis. Use bold for UI emphasis. Use italic only for citations and stress in prose. | No underlined text that is not a link. | Emil: Agents with Taste |
| T10 | Line height is unitless (1.5 to 1.7 for body text; observed 1.5 on emilkowal.ski and rsms.me, 1.71 on shud.in). Relative sizes use rem. | No px line-height. No em font-size. | bendc: Guidelines |
| T11 | Set one fixed group of stylistic font features on body, for example cv01 and ss03. | The computed font-feature-settings of body lists the group. Observed: emilkowal.ski (cv01, ss03), shud.in (calt, cv01, cv03, cv04, liga, ss03). | Observed: emilkowal.ski, shud.in |

## 4. Layout and code

| ID | Rule | Pass test | Source |
| --- | --- | --- | --- |
| L1 | Use semantic HTML: main, article, header, time with datetime. Use a real a or button for each link and button. | No div or span with a click handler and a button look. | bendc: Guidelines |
| L2 | Alt text on each image. A label on each form control. Do not use color alone to give information. | Run an accessibility check. Zero missing alt or label errors. | bendc: Guidelines |
| L3 | The html tag has lang. The document declares UTF-8 (meta charset). | Both are in the page source. | bendc: Guidelines |
| L4 | Scripts do not block the first render. Put them after the content. | No render-blocking script in the head. | bendc: Guidelines |
| L5 | One global box-sizing: border-box. Do not change the box model on single elements. | One box-sizing rule in the CSS. | bendc: Guidelines |
| L6 | Keep elements in normal flow. Use flex or grid. Use position: absolute only for stacked or layered components (for example a toast stack). | Each position: absolute has a written reason. | bendc: Guidelines; Emil: Toast |
| L7 | A selector has at most 3 structural parts. No id selectors. No !important. Do not override a style when a better selector avoids it. | Run a CSS linter with these limits. | bendc: Guidelines |
| L8 | A small control has a hit area of at least 44 px. Make it larger with a pseudo-element. | Measure each icon button. 44 px or more in both directions. | Emil: Agents with Taste |
| L9 | Give feedback at once for each user action: a loading state on submit, a success state on copy. | Click each action. A visible state change shows at once. | Emil: 7 Practical Tips |
| L10 | Test worst-case data: long names, empty lists, large counts. | Each list and card holds an empty case and a long-text case. | Emil: skill list (break-ui) |

## 5. Theme

| ID | Rule | Pass test | Source |
| --- | --- | --- | --- |
| C1 | The default theme is the system setting (prefers-color-scheme). The user can also pick light or dark. | Change the OS theme. The page follows. A site with one theme says so with `<meta name="color-scheme" content="only light">` (observed: shud.in). A site can follow the system with no toggle (observed: paco.me). | Paco: next-themes |
| C2 | No flash on load. A small script sets the theme attribute on the html tag before first paint. | Hard reload in dark mode with a production build. No light frame shows. | Paco: next-themes |
| C3 | Set color-scheme so built-in controls (inputs, buttons, scrollbars) match the theme. | A native input is dark in dark mode. | Paco: next-themes |
| C4 | Colors are CSS variables on :root. The dark values are under [data-theme='dark'] on the html tag. | No hard-coded color in a component. | Paco: next-themes |
| C5 | Switch the theme with all transitions off for one moment, then turn them on again. | During a switch, all elements change at the same time. | Paco: next-themes |
| C6 | A theme change in one tab changes all open tabs. | Open 2 tabs. Switch in one. The other follows. | Paco: next-themes |
| C7 | The toggle shows "System" when the system setting is active. It renders only after mount, with a placeholder of the same size. | No hydration warning. No layout shift. | Paco: next-themes |
| C8 | An image that depends on the theme: render both images and hide one with CSS, or use an empty placeholder until the theme is known. | No wrong-theme image flash. | Paco: next-themes |
| C9 | The browser theme bar (theme-color meta) uses an opaque color. It does not support transitions or transparent colors. Mix the overlay with the background to get the opaque color. | The bar color matches the page in each theme. Use one theme-color meta for each scheme, with a media attribute. Observed: paco.me (#1c1c1c dark, #ffffff light). | Emil: Drawer |

## Sources
Pages that I opened on 2026-10-30.
* Emil Kowalski: You Don't Need Animations
* Emil Kowalski: 7 Practical Animation Tips
* Emil Kowalski: Building a Toast Component
* Emil Kowalski: Building a Drawer Component
* Emil Kowalski: The Magic of Clip Path
* Emil Kowalski: Agents with Taste
* Emil Kowalski: Developing Taste
* Emil Kowalski: skill list
* Rasmus Andersson: Inter
* Benjamin De Cock: frontend-guidelines
* Paco Coursey: next-themes
* Paco Coursey: cmdk
* Shu Ding: react-wrap-balancer
Live sites measured with computed CSS on 2026-10-30: emilkowal.ski, rsms.me, paco.me, shud.in.
