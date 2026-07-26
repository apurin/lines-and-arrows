# Lines & Arrows

Lines & Arrows is a lightweight, text-first sequence-diagram viewer and visual
editor. Its small indentation-based language stores the meaning and order of a
sequence without coupling the document to a particular rendering engine.

The project currently provides a dependency-free parser and serializer,
responsive SVG rendering, a direct-manipulation editor, an opt-in web
component, TypeScript declarations, light and dark themes, and a configurable
icon resolver.

> **Status:** active development. The package manifest is still marked
> `private`, so `@lines-and-arrows/core` is not ready to install from npm yet.

## Highlights

- View and edit modes using the same responsive SVG canvas.
- Actors, messages, self-messages, open-ended group types, group sections,
  nested groups, and timeline gaps.
- Solid, dashed, and lost-message arrows.
- Optional actor and message tags, tooltips, and icons.
- Direct actor and message creation, endpoint retargeting, drag reordering,
  marquee grouping, and non-destructive ungrouping.
- Undo, redo, keyboard editing, and source replacement.
- Optional selection in view mode.
- Light, dark, and system themes.
- Built-in Phosphor icon catalog with configurable provider overrides.

## Syntax

```lines-and-arrows
@Customer
  icon user

@API
  icon server
  tag public
  tooltip Public entry point

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

Actor declarations are optional when actors can be inferred from their first
use. Message labels are optional:

```lines-and-arrows
Client -> API
API --> Client: Accepted
API ->x Queue: Delivery failed
```

See [syntax.md](./syntax.md) for the complete language definition.

## Web component

During local development, import the component directly from the source tree:

```html
<script type="module">
  import {
    defineLinesAndArrows,
  } from "./src/index.js";

  defineLinesAndArrows();
</script>

<lines-and-arrows
  mode="view"
  theme="auto"
  selectable="false"
>
@Client
@API

Client -> API: Start
API --> Client: Complete
</lines-and-arrows>
```

Set `mode="edit"` to enable the visual editor. The element exposes `source`,
`mode`, `theme`, `selectable`, `layout`, `iconResolver`, `iconCatalog`,
`selectedIds`, `canUndo`, and `canRedo`, as well as selection, history, and
source-replacement methods.

It emits:

- `la-select` when the selection changes;
- `la-change` after an editor command changes the source;
- `la-error` when parsing or editing fails.

## JavaScript API

```js
import {
  DiagramEditor,
  parse,
  renderDiagram,
  renderEditor,
  serialize,
} from "./src/index.js";

const document = parse(source);
const canonicalSource = serialize(document);

const viewer = renderDiagram(container, document, {
  theme: "auto",
  selectable: false,
});

viewer.destroy();

const editor = new DiagramEditor(canonicalSource);
const editable = renderEditor(container, editor.document, {
  editor,
  theme: "auto",
  onChange({ source: nextSource }) {
    console.log(nextSource);
  },
});

editable.undo();
editable.redo();
```

`renderDiagram` and `renderEditor` accept source text or a parsed document and
return controllers that can be destroyed when the host view is removed.

## npm and CDN distribution

The intended package name is `@lines-and-arrows/core`. Publishing is currently
disabled with `"private": true`; after the first public release, consumers will
be able to install it with:

```sh
npm install @lines-and-arrows/core
```

and import it from a CDN that exposes npm ES modules:

```js
import {
  defineLinesAndArrows,
} from "https://cdn.jsdelivr.net/npm/@lines-and-arrows/core@VERSION/+esm";
```

Pin an explicit version in production rather than using an unversioned CDN URL.

The published package is configured to contain the runtime source, type
declarations, README, syntax reference, MIT license, and third-party notices.

## Themes and icons

Use `theme: "light"`, `"dark"`, or `"auto"`. Selection is enabled by default
for `renderDiagram` and can be disabled with `selectable: false`.

Actor and tooltip icons work without configuration. By default, Lines & Arrows
resolves bold SVG assets from the version-pinned Phosphor Icons 2.1.1 package
on jsDelivr. The editor offers 48 recommended actor icons and searches the
complete local icon-name catalog.

Set `iconResolver(name, theme)` and `iconCatalog` to provide another icon set.
Set the resolver to `null` and the catalog to `[]` to disable external icons.
Tooltips fall back to a built-in lowercase `i`.

Phosphor Icons is MIT licensed. See
[THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

## Repository layout

- `src/` — parser, serializer, layout, SVG renderer, editor, and web component.
- `test/` — parser, model, layout, theme, and editor regression tests.
- `demo/` — local interactive development demo.
- `website/` — public product website and showcases.

## Development

```sh
npm test
python3 -m http.server 4173
```

Then open `http://localhost:4173/demo/`.

## License

Lines & Arrows is available under the [MIT License](./LICENSE).
