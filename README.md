# Lines & Arrows

Lines & Arrows is a small text format and SVG editor for sequence diagrams.
The source format is independent of any particular rendering engine.

The implementation currently provides:

- a dependency-free parser;
- a canonical text serializer;
- responsive SVG view and edit renderers;
- light, dark, and system themes;
- selectable actors, messages, groups, sections, and gaps;
- contextual actor and timeline editing;
- exact-position insertion, drag reordering, and cross-group movement;
- contiguous marquee grouping and non-destructive ungrouping;
- undo, redo, keyboard editing, and source replacement;
- an opt-in custom element;
- an optional icon resolver.

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
});

viewer.select("actor:API");
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

`renderDiagram` accepts either source text or a parsed document. The optional
`iconResolver(name, theme)` callback returns an image URL for an actor icon.
`renderEditor` uses the same inputs and options plus an optional persistent
`DiagramEditor` instance.

The custom element emits `la-select`, `la-change`, and `la-error` events. Its
`source`, `mode`, `theme`, `selectedIds`, `canUndo`, and `canRedo` properties
make it usable without coupling an application to its shadow DOM.

## Edit controls

- Select an actor, message, gap, group, or section to open its compact editor.
- Drag a selected actor horizontally to reorder it.
- Hover a lifeline between timeline items, then drag its arrow circle to an
  actor to create an unnamed connection, including back to the same actor.
- Drag either endpoint of a selected connection to another actor to retarget it.
- Drag the four-dot handle on a selected timeline item or section to reposition
  it.
- Hover or focus the eye beside a tag to reveal its tooltip immediately.
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
