# Lines & Arrows

Lines & Arrows is a lightweight sequence-diagram language, SVG viewer, and
visual editor. Its indentation-based source keeps actor order, interactions,
groups, sections, gaps, tags, tooltips, and icons independent of any particular
renderer.

The runtime is dependency-free JavaScript. It works as an npm module, a native
browser module, or an opt-in web component. Handwritten type declarations are
included for TypeScript consumers; the project has no TypeScript build step.

> **Status:** available for use and under active development before 1.0.

## Browser module

The jsDelivr entry registers the web component automatically:

```html
<script
  type="module"
  src="https://cdn.jsdelivr.net/npm/lines-and-arrows@0.1"
></script>

<lines-and-arrows mode="view" theme="auto">
  @Client
  @API

  Client -> API: Start
  API --> Client: Complete
</lines-and-arrows>
```

The `@0.1` compatibility alias receives patch releases without crossing into a
potentially breaking `0.2`. Use an exact version when a deployment must remain
fully pinned.

For direct CDN access to the JavaScript API without automatic registration:

```js
import {
  renderDiagram,
} from "https://cdn.jsdelivr.net/npm/lines-and-arrows@0.1/dist/lines-and-arrows.min.js";
```

Set `mode="edit"` to enable the visual editor, including canvas undo and redo
controls. Use `selectable="false"` when a view should have no selectable diagram
elements. A quiet “Powered by Lines & Arrows” website link appears by default;
set `branding="false"` to hide it.
Source nested naturally inside the element may share the page's indentation;
the component removes that common indentation while preserving the diagram's
relative indentation.

## Syntax

```lines-and-arrows
@Customer
  icon user

@API
  icon cloud
  tag public
  tooltip Public entry point

@Worker
  icon gear

Customer -> API: Start job\nand supporting evidence
API -> Worker: Dispatch

critical Job execution
  Worker -> Worker: Process
  Worker --> API: Completed

gap A few moments later

API --> Customer: Job complete
```

Actor declarations and message labels are optional:

```lines-and-arrows
Client -> API
API --> Client: Accepted
API ->x Queue: Delivery lost
```

See [syntax.md](./syntax.md) for the complete language definition and
[agents.md](./agents.md) for a compact authoring reference.

Use `\n` for an intentional line break in labels and tooltips, and `\\` for a
literal backslash. Actor names, tags, group types, and icon identifiers stay on
one line.

## Validate without a page

Agents and build tools can check source without creating a DOM:

```js
import {
  validate,
} from "lines-and-arrows/syntax";

const result = validate(source);

if (!result.valid) {
  console.error(
    `${result.error.line}: ${result.error.message}`,
  );
}
```

`validate` returns `{ valid: true, document }` on success and
`{ valid: false, error }` on syntax errors. `parse` remains available when
throwing behavior is more convenient. Parsed comments stay structurally
attached to the nearby actor, property, timeline item, group, or section, so
canonical serialization and editor moves retain their relative indentation
without tracking source line numbers.

Validate a file or stdin from the command line:

```sh
lines-and-arrows validate diagram.txt
lines-and-arrows validate --json diagram.txt
lines-and-arrows validate - < diagram.txt
```

Inside this repository:

```sh
npm run validate -- diagram.txt
```

## JavaScript API

```js
import {
  DiagramEditor,
  parse,
  renderDiagram,
  renderEditor,
  serialize,
} from "lines-and-arrows";

const document = parse(source);
const canonicalSource = serialize(document);

const viewer = renderDiagram(container, document, {
  theme: "auto",
  selectable: false,
  branding: true,
});

const editor = new DiagramEditor(canonicalSource);
const editable = renderEditor(container, editor.document, {
  editor,
  theme: "auto",
  onChange({ source: nextSource }) {
    console.log(nextSource);
  },
});

viewer.destroy();
editable.destroy();
```

`DiagramEditor` owns an immutable document snapshot. Read
`editor.document`, a controller's `ast`, or a change event's `ast` to inspect
the current state; use editor commands or `replaceSource()` to change it.
Snapshots are replaced atomically for edits, undo, and redo. `serialize()`
also validates programmatically constructed documents and rejects ambiguous
structures, such as a group containing both direct items and sections.

The `<lines-and-arrows>` element exposes `source`, `mode`, `theme`,
`selectable`, `branding`, `layout`, `iconResolver`, and `iconCatalog`, plus
selection, history, and source-replacement methods. The JavaScript renderers
accept the same `branding` boolean and default it to `true`. `select(id)` and
user selection both emit `la-select` with the selected immutable model item.
`la-change` is emitted only after a command commits a different source; its
detail contains the new source, immutable AST snapshot, command name, and
history state.
In edit mode, `replaceSource()` returns `true` only when it commits a different
valid source. Invalid source returns `false` and emits `la-error`, whose detail
contains the original error.

Layout overrides are compacting preferences, not permission to overlap
content. The renderer clamps unsafe spacing values and reserves room for actor
metadata, message labels, group headers, and section dividers.

Selectable actors and messages expose accessible names, enter the keyboard tab
order, and respond to Enter or Space. Screen readers use the rendered SVG's
standard roles and ARIA labels, so hosts do not need a separate accessibility
helper API.

## Install

```sh
npm install lines-and-arrows
```

The published package contains the JavaScript runtime, optional type
declarations, validation CLI, syntax reference, licenses, and notices.

## Themes and icons

Use `theme: "light"`, `"dark"`, or `"auto"`. Actor and tooltip icons work
without configuration through the default Phosphor resolver. Set
`iconResolver(name, theme)` and `iconCatalog` to provide another icon set. On
the custom element, set either property to `null` to disable the resolver or
clear the catalog.

Phosphor Icons is MIT licensed. See
[THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

## Repository

- `src/` — parser, serializer, editor model, SVG renderer, and web component.
- `bin/` — DOM-free syntax validation command.
- `test/` — syntax, serialization, editor-model, and icon-provider checks.
- `demo/` — local interactive development demo.
- `website/` — public product website and showcases.

Run the programmatic checks:

```sh
npm run check
```

Run the local demo:

```sh
python3 -m http.server 4173
```

Then open `http://localhost:4173/demo/`.

## License

Lines & Arrows is available under the [MIT License](./LICENSE).
