# concept-ui

See [SKILL.md](SKILL.md) for the method.

## Credit

Parts of the method use rules from Emil Kowalski's [emilkowalski/skills](https://github.com/emilkowalski/skills) and from his sites [emilkowal.ski](https://emilkowal.ski/) and [aiforui.dev](https://aiforui.dev/).
The skill states these rules in its own words. It does not copy his files.
His repositories [sonner](https://github.com/emilkowalski/sonner) and [vaul](https://github.com/emilkowalski/vaul) are MIT licensed, Copyright (c) 2023 Emil Kowalski. The skill copies no code from them.

### Evidence

- Rule 4, undo timer pause: `emilkowalski/sonner src/index.tsx` line 234, `src/hooks.tsx` lines 4–11.
- Rule 6, durations of 500 ms or less and the sheet curve: `emilkowalski/vaul src/constants.ts`, `src/style.css` line 4, `emilkowalski/sonner src/styles.css` line 89.
- Rule 6, dismiss thresholds: `emilkowalski/sonner src/index.tsx` lines 40 and 348, `emilkowalski/vaul src/constants.ts`.
- Rule 6, damped drag: `emilkowalski/vaul src/helpers.ts` line 90, `emilkowalski/sonner src/index.tsx` line 387.
- Rule 6, pointer capture: `emilkowalski/sonner src/index.tsx` line 321, `emilkowalski/vaul src/index.tsx` line 276.

### Licence of emilkowalski/skills

His skills repository has this licence:

```text
MIT License

Copyright (c) 2026 Emil Kowalski

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
