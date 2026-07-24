# Lines & Arrows

Lines & Arrows is a small text format and SVG viewer for sequence diagrams.
The source format is independent of any particular rendering engine.

The implementation currently provides:

- a dependency-free parser;
- a responsive SVG view renderer;
- light, dark, and system themes;
- selectable actors, messages, groups, sections, and gaps;
- an opt-in custom element;
- an optional icon resolver.

The visual editor is intentionally not implemented yet. Its interaction model
is recorded in [ux.md](./ux.md), and the source language is defined in
[syntax.md](./syntax.md).

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

<lines-and-arrows theme="auto"></lines-and-arrows>
```

## JavaScript usage

```js
import { parse, renderDiagram } from "./src/index.js";

const document = parse(source);
const viewer = renderDiagram(container, document, {
  theme: "light",
});

viewer.select("actor:API");
viewer.destroy();
```

`renderDiagram` accepts either source text or a parsed document. The optional
`iconResolver(name, theme)` callback returns an image URL for an actor icon.

## Development

```sh
npm test
python3 -m http.server 4173
```

Then open `http://localhost:4173/demo/`.
