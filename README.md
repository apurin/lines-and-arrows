# Lines & Arrows

Lines & Arrows is a small text format and SVG editor for sequence diagrams.
The source format is independent of any particular rendering engine.

The implementation currently provides:

- a dependency-free parser;
- a canonical text serializer;
- responsive SVG view and edit renderers;
- light, dark, and system themes;
- optional selection for actors, messages, groups, sections, and gaps;
- contextual actor and timeline editing;
- exact-position insertion, drag reordering, and cross-group movement;
- contiguous marquee grouping and non-destructive ungrouping;
- undo, redo, keyboard editing, and source replacement;
- an opt-in custom element;
- a ready-to-use Phosphor icon provider with configurable overrides.

The interaction model is recorded in [ux.md](./ux.md), and the source language
is defined in [syntax.md](./syntax.md).

## Browser usage

```html
<script type="module">
  import {
    defineLinesAndArrows,
  } from "./src/index.js";

  defineLinesAndArrows();

  const diagram = document.querySelector("lines-and-arrows");
  diagram.source = `
@Client
@API

Client -> API: Start
API --> Client: Complete
  `;
</script>

<lines-and-arrows mode="edit" theme="auto"></lines-and-arrows>
```

## JavaScript usage

```js
import {
  DiagramEditor,
  parse,
  renderDiagram,
  renderEditor,
} from "./src/index.js";

const document = parse(source);
const viewer = renderDiagram(container, document, {
  theme: "light",
  selectable: false,
});

viewer.destroy();

const editor = new DiagramEditor(source);
const editable = renderEditor(container, editor.document, {
  editor,
  theme: "light",
  onChange({ source: nextSource }) {
    console.log(nextSource);
  },
});

editable.undo();
editable.redo();
```

`renderDiagram` accepts either source text or a parsed document. Element
selection is enabled by default and can be disabled with `selectable: false`.
Actor and configured tooltip icons work without setup. By default, Lines &
Arrows resolves the bold SVG assets from the version-pinned Phosphor Icons
2.1.1 package on jsDelivr. Its picker shows 48 recommended actor icons and
searches the complete local index of Phosphor icon names.

Set `iconResolver(name, theme)` and `iconCatalog` to use another provider. The
catalog is also the provider's availability index: default recommendations
missing from a custom catalog are skipped. Supplying a custom resolver without
a catalog leaves the picker empty rather than assuming that provider supports
Phosphor names. Catalog entries may be icon-name strings or objects with
`name`, `label`, and `keywords`. Set the resolver to `null` and the catalog to
`[]` to disable external icons. Tooltips use a built-in lowercase `i` when
`tooltip-icon` is omitted or cannot be resolved. `renderEditor` uses the same
inputs and options plus an optional persistent `DiagramEditor` instance.

Phosphor Icons is MIT licensed. See
[THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

The custom element emits `la-select`, `la-change`, and `la-error` events. Its
`source`, `mode`, `theme`, `selectable`, `iconResolver`, `iconCatalog`,
`selectedIds`, `canUndo`, and `canRedo` properties make it usable without
coupling an application to its shadow DOM. Edit mode always enables selection;
view mode respects the `selectable` property or `selectable="false"` attribute.

## Edit controls

- Select an actor, message, gap, group, or section to open its compact editor.
- Use the icon button beside an actor name or tooltip to open the searchable
  icon palette. Its first two rows prioritize common sequence-diagram actors;
  search covers the full provider catalog.
- Drag a selected actor horizontally to reorder it.
- Hover a lifeline between timeline items, then drag its arrow circle to an
  actor to create an unnamed connection, including back to the same actor.
- Drag either endpoint of a selected connection to another actor to retarget it.
- Drag the four-dot handle on a selected timeline item or section to reposition
  it.
- Hover or focus the information control beside a tag to reveal its tooltip
  immediately.
- Hover between actors or timeline items to reveal structural insertion
  controls.
- Drag across contiguous sibling timeline items, then choose **Group**.
- Use `Delete` to remove the selection, `Escape` to cancel, and
  `Command/Ctrl+Z` or `Command/Ctrl+Shift+Z` for history.
- Use `Alt` with arrow keys to reorder the selected actor or timeline item.

## Development

```sh
npm test
python3 -m http.server 4173
```

Then open `http://localhost:4173/demo/`.
