# Lines & Arrows

[![A Lines & Arrows sequence diagram showing a person and AI agent creating readable diagram source, rendering it, and sharing it with a team](https://lines-and-arrows.dev/assets/social-card.png)](https://lines-and-arrows.dev/showcase)

Lines & Arrows is a sequence-diagram language, SVG renderer, and visual editor.
Its readable source is the durable format shared by people, agents, the viewer,
and the editor.

[Website](https://lines-and-arrows.dev/) ·
[Constructor](https://lines-and-arrows.dev/constructor) ·
[Showcase](https://lines-and-arrows.dev/showcase) ·
[Syntax reference](./syntax.md) ·
[Agent guide](https://lines-and-arrows.dev/agents)

The JavaScript runtime has zero dependencies and includes TypeScript
declarations. The current `0.10` line is under active development before 1.0;
minor releases may change its contracts.

## Browser

Load the registered web component from jsDelivr:

```html
<script
  type="module"
  src="https://cdn.jsdelivr.net/npm/lines-and-arrows@0.10"
></script>

<lines-and-arrows theme="auto">
  @Client
  @API

  Client -> API: Start
  API --> Client: Complete
</lines-and-arrows>
```

Set `mode="edit"` to open the visual editor. The
[Constructor](https://lines-and-arrows.dev/constructor) produces complete HTML
for themes, editing controls, actor selection, branding, and canvas behavior.

## npm

```sh
npm install lines-and-arrows
```

```js
import { parse, renderDiagram } from "lines-and-arrows";

const source = `Customer -> API: Start job
API --> Customer: Accepted`;

renderDiagram(
  document.querySelector("#diagram"),
  parse(source),
  { theme: "auto" },
);
```

Package entry points:

| Import | Purpose |
| --- | --- |
| `lines-and-arrows` | Parser, serializer, editor model, SVG renderers, themes, icons, and web-component definition |
| `lines-and-arrows/auto` | Registers `<lines-and-arrows>` on import |
| `lines-and-arrows/element` | Web-component class and explicit registration |
| `lines-and-arrows/syntax` | DOM-free parsing, serialization, and validation |

Node.js 22 or newer is required for the syntax API and CLI.

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
groups, sections, gaps, comments, escaping, validation, and canonical
serialization. The [agent guide](https://lines-and-arrows.dev/agents) provides
a compact authoring and embedding workflow.

## Validation

Validate a file or standard input with the published CLI:

```sh
lines-and-arrows validate diagram.txt
lines-and-arrows validate --json diagram.txt
lines-and-arrows validate - < diagram.txt
```

Use `validate`, `parse`, and `serialize` from `lines-and-arrows/syntax` in
JavaScript.

## Development

```sh
npm ci
npm run check
python3 -m http.server 4173
```

The interactive development demo is available at
`http://localhost:4173/demo/`.

## Publishing

Stable npm releases are produced by the
[release workflow](https://github.com/apurin/lines-and-arrows/blob/main/.github/workflows/release.yml)
from an annotated `vX.Y.Z` tag whose commit is already on remote `main`.
Release preparation runs `npm ci`, `npm run check`, and `npm pack --dry-run`.
After npm publication, `npm run website:prepare` synchronizes the website with
the package version for its independent deployment.

## License

[MIT](./LICENSE). Phosphor Icons and Prism notices are recorded in
[THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).
