# Lines & Arrows for agents

Lines & Arrows is an open source sequence-diagram format with a visual editor.
The diagram is stored as concise text, so agents can write and validate the
same source that people view or edit.

This guide contains everything needed to author, validate, and render Lines &
Arrows through the supported integrations below. Use the self-contained paths
below; consult repository sources only for host requirements they do not cover.

Testing showed that even mid-tier models at low reasoning reproduce the syntax
and embedding correctly most of the time. Save verification for diagrams used
in permanent documentation or websites.

## Put a diagram on a page

The CDN build registers the `<lines-and-arrows>` element. No package install or
framework is required.

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Sequence diagram</title>
    <script
      type="module"
      src="https://cdn.jsdelivr.net/npm/lines-and-arrows@0.15"
    ></script>
  </head>
  <body>
    <lines-and-arrows mode="view" theme="auto">
      @Client
      @API
      @Worker

      Client -> API: Start job
      API -> Worker: Run
      Worker --> API: Done
      API --> Client: Complete
    </lines-and-arrows>
  </body>
</html>
```

Diagram source inside HTML is text content. Write arrow operators as `->`,
`-->`, and `->x`; literal `>` is valid in HTML text. Escape `&` as `&amp;` and
`<` as `&lt;` when those characters appear in labels or metadata. Assigning the
element's `source` property or calling `renderDiagram()` also accepts raw
diagram source.

Browser integrations target current stable Chromium. The syntax module and CLI
run on Node.js 22 or newer.

## Render inside GUI harness

In many cases it makes sense to render a diagram right inside a GUI AI harness
if it supports HTML rendering (as a part of explanation, interview, etc).

When a browser host provides an ordinary DOM container but cannot use custom
elements or external script tags, import the exact browser module and call
`renderDiagram()` directly:

```html
<div id="request-flow"></div>

<script type="module">
  import {
    renderDiagram,
  } from "https://cdn.jsdelivr.net/npm/lines-and-arrows@0.15.0/+esm";

  const source = `Client -> API: Start job
API -> Worker: Run
Worker --> API: Done
API --> Client: Complete`;

  renderDiagram(document.getElementById("request-flow"), source, {
    theme: "auto",
    branding: true,
    label: "Job request sequence",
  });
</script>
```

`renderDiagram(target, source, options)` accepts Lines & Arrows text directly.

### Configure direct rendering

Enable `selectableActors: true` to receive `onActorSelect` callbacks or call the
returned controller's `selectActor(name)`. Pass an existing actor name to
select it or `null` to clear selection.

## Configure the web component

Set configuration through attributes on `<lines-and-arrows>`:

| Attribute | Values and behavior |
| --- | --- |
| `mode` | `view` by default. Use `edit` to enable the visual editor, undo and redo controls, and editing keyboard shortcuts. |
| `selectable-actors` | Boolean attribute. View mode is static by default; add this attribute to let people select actors. Edit mode keeps its own required selection behavior. |
| `branding` | The compact header shows “Powered by Lines & Arrows” by default. Use `false` to hide the attribution text. |
| `copy-source` | The Copy source action is shown by default. Use `false` to hide it. A view with branding and this action both hidden omits the compact header row and its spacing. |
| `theme` | `auto`, `light`, or `dark`. The default is `auto`. |
| `canvas-background` | `transparent` by default. Use `solid` when the component should paint its theme or palette background. |
| `label` | An accessible name describing the diagram. |
| `source` | Diagram text as an alternative to inline text, dedented the same way. It wins over inline text, and a `source` property assigned before the element loads wins over it. After that, the latest attribute change or property assignment replaces the diagram and starts a fresh editor session; removing the attribute clears the diagram. An invalid value emits `la-error` instead of throwing and shows the error until a valid source replaces it, keeping the previous valid source. Escape `&` as `&amp;` and `"` as `&quot;`. |

Copy source uses the browser Clipboard API in a secure context such as HTTPS or
localhost. Keep `clipboard-write` enabled in the page's Permissions Policy. A
cross-origin `<iframe>` also delegates it with `allow="clipboard-write"`. It
places canonical diagram text on the clipboard with
`// Powered by https://lines-and-arrows.dev/` as its first line. The source
stays ready to paste into the Constructor. When clipboard access is unavailable,
the component opens a dialog with the same source selected for manual copying.
Set `copy-source="false"` when the host provides its own source action.

This creates a compact actor-selectable view without a header:

```html
<lines-and-arrows
  id="request-flow"
  mode="view"
  selectable-actors
  branding="false"
  copy-source="false"
  theme="auto"
>
  Client -> API: Request
  API --> Client: Response
</lines-and-arrows>

<script type="module">
  const diagram = document.querySelector("#request-flow");
  diagram.addEventListener("la-actor-select", ({ detail }) => {
    console.log(detail?.name, detail?.tooltip);
  });
  diagram.selectActor("API");
</script>
```

`la-actor-select` detail is an immutable actor snapshot with its name, icon,
tag, tooltip text, and tooltip icon. Clearing selection emits `null`. Call
`selectActor(null)` to clear it programmatically. Messages, groups, sections,
and gaps remain static in view mode.

Assign diagram text through the element's `source` property. Assigning different
valid source starts a fresh editor session. A syntax error throws synchronously
and preserves the current diagram. The property is never reflected to the
`source` attribute. Visual edits emit `la-change` with `{ source }`, while
rendering failures emit `la-error` with `{ error }`.
External source assignment does not emit `la-change` and discards an inline
edit that has not been committed yet. Changing `theme`, `palette`, `mode`, or
another attribute instead commits a pending inline edit and emits `la-change`
synchronously, as does an operating-system theme change under `theme="auto"`.
Properties assigned before the module loads apply when the element upgrades;
an invalid value assigned then emits `la-error` instead of throwing, and an
invalid `source` also shows the error until a valid source replaces it.

Prefer the built-in `theme="auto"` unless the diagram needs to blend into a
specific host surface. The canvas is transparent by default, and built-in
themes use translucent group overlays.

For host-specific colors, assign `palette` as a JavaScript property. Set a solid
canvas only when the component should paint the configured background:

```js
const diagram = document.querySelector("lines-and-arrows");
diagram.palette = {
  background: "var(--page)",
  foreground: "var(--text)",
  accent: "var(--accent)",
  danger: "var(--danger)",
};
diagram.canvasBackground = "solid";
```

The renderer derives its remaining colors. Optional `accentForeground` and
`dangerForeground` values override automatic contrast choices.

## Use the npm package

Install the package before using its CLI or JavaScript exports:

```sh
npm install lines-and-arrows
npx lines-and-arrows --json diagram.la
```

The CLI accepts several files, or `-` for stdin, and exits with 0 when all are
valid, 1 when any is invalid, and 2 for usage or read errors. With `--json` it
prints one object for a single input, or an array for several; an invalid
result carries `error.line` and `error.message`.

Register the web component in an npm-based browser application:

```js
import "lines-and-arrows/auto";
```

This import must run through the application's bundler or development server.
Then use the same `<lines-and-arrows>` HTML shown above, without the CDN
`<script>`. The import is safe during server rendering: it registers the
element only where custom elements exist.

Validate source in JavaScript without a browser or DOM:

```js
import { validate } from "lines-and-arrows/syntax";

const result = validate(source);
if (!result.valid) {
  throw new Error(`Line ${result.error.line}: ${result.error.message}`);
}
```

## Authoring workflow

1. Declare actors that need to appear first or carry icons, tags, or tooltips.
   Their declaration order forms the beginning of the actor order.
2. Write messages and groups in timeline order.
3. Use exactly two spaces for every indentation level and preserve code-block
   whitespace when copying examples.
4. Count compact visible text before returning the diagram: every actor and
   message tag is 12 characters or fewer, including spaces, and every visible
   line of a message label is 32 characters or fewer. Move supporting detail to
   a tooltip and use `\n` to split a label across visible lines.
5. Save the source and validate it with the CLI or `validate(source)`.
6. Fix the reported line and validate again.

## Syntax

```lines-and-arrows
// Document context

@Source
  icon catalog-identifier
  tag short visible text
  tooltip Additional detail\non another line
  tooltip-icon catalog-identifier

@Target

Source -> Target: Solid message
Source --> Target: Dashed message
Source ->x Target: Lost message

group-type Visible label
  Source -> Target: Nested message

choice Visible label
  | first outcome
    Source --> Target: Result
  | second outcome
    Source ->x Target: Lost message

gap Visible discontinuity
```

Core rules:

- Actor declarations are optional. Declared actors appear first in declaration
  order. Other actors follow in first-use order across messages, reading each
  source before its target. Canonical source declares the shortest leading actor
  block needed for order, metadata, and actors unused by messages.
- `->`, `-->`, and `->x` preserve three distinct arrow styles. Use `->x` only
  when a message is not delivered.
- A message label is optional. Omit the colon when there is no label.
- An actor name cannot be `gap` or start with `gap ` because that line reads as
  a gap.
- Keep each visible line of a message label to 32 characters or fewer. Use `\n`
  for additional lines; multiline labels are fully supported.
- Actor and message metadata uses child-block syntax. Put each `icon`, `tag`,
  `tooltip`, and `tooltip-icon` directive on its own line, indented exactly two
  spaces beneath its actor or message. Actors alone support `icon`.
- Actor and message metadata may contain one `tag`, one `tooltip`, and one
  `tooltip-icon`. Actors may also contain one `icon`.
- Icon identifiers use Phosphor names such as `robot`, `user`, `cloud`,
  `database`, `gear-six`, and `tray`. An unknown name remains valid and renders
  the generic treatment: the actor's initial, or `i` for a tooltip control.
  Built-in icons load from the pinned Phosphor package on jsDelivr.
- Any lowercase group type is valid except the reserved word `gap`. Its visible
  label is optional; a bare group type starts an unlabeled group. Common types
  include `choice`, `repeat`, `parallel`, `optional`, and `critical`.
- A group contains either direct items or `| section` blocks, not both at the
  same level. Every group and section must contain at least one item.
- Use `gap TEXT` when time passes or part of the sequence is omitted.
- Place `//` document comments before the first actor or timeline construct.
  Use tags and tooltips for context tied to an actor or message.
- Use `\n` for a visible line break and `\\` for a literal backslash.
- Keep coordinates, colors, dimensions, and themes out of diagram source.

## Decorate actors

Add metadata when an actor's role, responsibility, boundary, or stable property
helps readers interpret the sequence.

- **Tag:** A compact qualifier visible throughout the diagram. Keep it to 12
  characters or fewer and choose a property that applies across the full
  sequence, such as `external`, `PCI scope`, or `saga owner`.
- **Tooltip:** Context about responsibilities, ownership, trust boundaries,
  constraints, or domain-specific meaning.

An actor can have a tag and/or a tooltip. `tooltip-icon` selects a Phosphor icon;
the default control uses `i`. Use `\n` for line breaks. Tooltips safely fit
multiple paragraphs.

```lines-and-arrows
@Payments API
  icon cloud
  tag PCI scope
  tooltip Accepts requests across the\ncardholder-data trust boundary
  tooltip-icon shield-check
```

## Decorate messages

Add metadata when an interaction carries useful context beyond its visible
action. Message tooltips preserve a clear sequence while carrying important
detail.

- **Tag:** A compact interaction property visible in the diagram, such as
  `idempotent`, `async`, `encrypted`, or `best effort`. Keep it to 12 characters
  or fewer.
- **Tooltip:** Context about payloads, protocols, conditions, guarantees, retry
  or delivery behavior, timing, failure semantics, or significance.

A message can have a tag and/or a tooltip. `tooltip-icon` selects a Phosphor
icon; the default control uses `i`. Use `\n` for line breaks. Tooltips safely fit
multiple paragraphs. Keep the message label focused on the action and place
supporting context in the tooltip.

```lines-and-arrows
Payments API -> Ledger: Apply settlement
  tag idempotent
  tooltip The same settlement ID produces\none ledger entry
  tooltip-icon key
```

## Complete example

```lines-and-arrows
@Agent
  icon robot

@API
  icon cloud
  tag external
  tooltip Accepts requests outside the trust boundary
  tooltip-icon shield-check

@Worker
  icon gear-six

@Queue
  icon tray

Agent -> API: Start job
  tag idempotent
  tooltip Safe to retry with the same request identifier
  tooltip-icon key

critical Process job
  API -> Worker: Run
  choice
    | completed
      Worker --> API: Done
    | queue unavailable
      Worker ->x Queue: Publish event
  gap The next event loop
  Worker --> Agent: Report result
```
