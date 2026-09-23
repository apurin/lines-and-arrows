# Lines & Arrows

[![A Lines & Arrows sequence diagram showing a person and AI agent creating readable diagram source, rendering it, and sharing it with a team](https://lines-and-arrows.dev/assets/social-card.png)](https://lines-and-arrows.dev/showcase)

Lines & Arrows is a sequence-diagram language, SVG renderer, and visual editor.
Its readable source is the durable format shared by people, agents, the viewer,
and the editor.

[Website](https://lines-and-arrows.dev/) ·
[Constructor](https://lines-and-arrows.dev/constructor) ·
[Showcase](https://lines-and-arrows.dev/showcase) ·
[Syntax reference](./syntax.md) ·
[Agent guide][agent-guide]

[agent-guide]: https://raw.githubusercontent.com/apurin/lines-and-arrows/refs/heads/main/website/agents.md

The JavaScript runtime has zero dependencies and includes TypeScript
declarations. The current `0.15` line is under active development before 1.0;
minor releases may change its contracts.

Browser modules target current stable Chromium. The syntax module and CLI run
on Node.js 22 or newer without DOM globals.

## Browser

Load the registered web component from jsDelivr:

```html
<script
  type="module"
  src="https://cdn.jsdelivr.net/npm/lines-and-arrows@0.15"
></script>

<lines-and-arrows theme="auto">
  @Client
  @API

  Client -> API: Start
  API --> Client: Complete
</lines-and-arrows>
```

Diagram source inside HTML is text content, so generated embeds must escape
`&`, `<`, and `>`. The element's `source` property and `renderDiagram()` accept
raw diagram source.

Set `mode="edit"` to open the visual editor. The
[Constructor](https://lines-and-arrows.dev/constructor) produces complete HTML
for themes, editing controls, actor selection, branding, copy source, and canvas
behavior. Set `copy-source="false"` to hide the Copy source action. When a view
sets both `branding="false"` and `copy-source="false"`, the diagram starts at
the top edge.

Built-in icons load from the pinned Phosphor package on jsDelivr. Allow that
origin in browser content policies, or omit icon properties for offline embeds.

## npm

```sh
npm install lines-and-arrows
```

```js
import { renderDiagram } from "lines-and-arrows";

const source = `Customer -> API: Start job
API --> Customer: Accepted`;

renderDiagram(
  document.querySelector("#diagram"),
  source,
  { theme: "auto" },
);
```

Package entry points:

| Import | Purpose |
| --- | --- |
| `lines-and-arrows` | Render source as SVG in a browser |
| `lines-and-arrows/auto` | Registers `<lines-and-arrows>` on import |
| `lines-and-arrows/element` | Exports explicit element registration |
| `lines-and-arrows/syntax` | DOM-free parsing, serialization, and validation |

Node.js 22 or newer is required for the syntax API and CLI. The element entries
import safely without a DOM, such as during server rendering: `/auto` registers
the element only where custom elements exist, and an explicit
`defineLinesAndArrows()` call without them throws.

The element's `source` property accepts diagram text. Assigning different valid
source starts a fresh editor session; a syntax error throws synchronously and
preserves the current diagram. Assigning source never emits `la-change` and
discards an uncommitted inline edit. Changing `theme`, `palette`, `mode`, or
another attribute instead commits a pending inline edit and emits `la-change`
synchronously, as does an operating-system theme change under `theme="auto"`.
Visual edits emit `la-change` with `{ source }`, while rendering failures emit
`la-error` with `{ error }`. Undo and redo are built into edit mode; while a
text field has focus, the undo and redo shortcuts apply to that field instead
of the diagram. Delete, Backspace, and Alt+Arrow reordering act on the
selection only while the canvas or the selected element has focus, never while
a button or field in the editor does. TypeScript users can import
`ChangeDetail`, `ErrorDetail`, and `LinesAndArrowsEventMap` from
`lines-and-arrows/element`; the event map extends `HTMLElementEventMap`, so
standard DOM events keep their types.

## Diagram source

```lines-and-arrows
@Customer
  icon user

@API
  icon cloud
  tag public

@Worker
  icon gear

Customer -> API: Start job
API -> Worker: Dispatch

critical Job execution
  Worker -> Worker: Process
  Worker --> API: Completed

gap A few moments later

API --> Customer: Job complete
```

The [syntax reference](./syntax.md) defines actors, messages, arrow forms,
groups, sections, gaps, header comments, escaping, validation, and canonical
serialization. The [agent guide][agent-guide] provides a compact authoring and
embedding workflow.

## Validation

Validate one or more files, or standard input, with the published CLI:

```sh
lines-and-arrows diagram.txt
lines-and-arrows first.txt second.txt
lines-and-arrows --json diagram.txt
lines-and-arrows - < diagram.txt
lines-and-arrows --version
```

The exit code is 0 when every input is valid, 1 when any input is invalid, and
2 for a usage error or when any input cannot be read; every input is still
checked and reported. With `--json`, a single input prints one object and
several inputs print an array. Each object has `valid` and `file`; an invalid
input adds `error` with `line` and `message`, while a read error has only
`error.message`. Run `lines-and-arrows --help` for every option.

Use `validate`, `parse`, and `serialize` from `lines-and-arrows/syntax` in
JavaScript.

## Development

Development needs Node.js 22 or newer and a local Google Chrome installation:
the browser suite in `npm run check` launches Chrome's stable channel through
`playwright-core`, which does not download browsers.

```sh
npm ci
npm run check
python3 -m http.server 4173
```

The interactive development demo is available at
`http://localhost:4173/demo/`. [CONTRIBUTING.md](./CONTRIBUTING.md) covers
prerequisites and focused test runs; [AGENTS.md](./AGENTS.md) documents the
repository conventions.

## Publishing

Stable npm releases are produced by the
[release workflow](https://github.com/apurin/lines-and-arrows/blob/main/.github/workflows/release.yml)
from an annotated `vX.Y.Z` tag whose commit is already on remote `main`.
The release commit sets the new version in `package.json` and
`package-lock.json`, then runs `npm run website:prepare`, which rewrites the
version references in this README, the website, and its runtime from
`package.json`. This README ships inside the package, so `npm run check` fails
while its version reference differs from `package.json`. The agent guide is
read from `main`, so push the release commit and its tag close together: until
npm publication finishes, the guide's new CDN URLs do not resolve.

The release workflow runs `npm ci` and `npm run check`. After npm publication,
the workflow creates the GitHub release with the annotated tag message as its
notes, so write that message as release notes: a summary line followed by the
notable changes.

Website deployment is independent of package publication. After the npm
release is verified, run `npm run website:prepare` again as the first
deployment step; on a synchronized checkout it changes nothing and confirms
that every runtime and example URL matches the published version.

## License

[MIT](./LICENSE). Phosphor Icons and Prism notices are recorded in
[THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).
