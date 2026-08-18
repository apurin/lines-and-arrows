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
  src="https://cdn.jsdelivr.net/npm/lines-and-arrows@0.10"
></script>

<lines-and-arrows mode="view" theme="auto">
  @Client
  @API

  Client -> API: Start
  API --> Client: Complete
</lines-and-arrows>
```

The `@0.10` compatibility alias receives patch releases without crossing into a
potentially breaking `1.0`. Use an exact version when a deployment must remain
fully pinned.

For direct CDN access to the JavaScript API without automatic registration:

```js
import {
  renderDiagram,
} from "https://cdn.jsdelivr.net/npm/lines-and-arrows@0.10/dist/lines-and-arrows.min.js";
```

Set `mode="edit"` to enable the visual editor, including canvas undo and redo
controls. View mode is non-selectable by default; add the boolean
`selectable-actors` attribute when actors should respond to pointer and keyboard
selection. A compact header centers the quiet “Powered by Lines & Arrows” link
above the actors and provides a Copy source button. Copied source begins with
`// Powered by https://lines-and-arrows.dev/`. Set `branding="false"` to hide
the attribution text. Set `history-controls="false"` to hide the edit-mode undo
and redo buttons while keeping the element's `undo()`, `redo()`, `canUndo`, and
`canRedo` API. The canvas is transparent by default; set
`canvas-background="solid"` when the component should paint its theme or
palette background.
Source nested naturally inside the element may share the page's indentation;
the component removes that common indentation while preserving the diagram's
relative indentation.

## Syntax

```lines-and-arrows
@Customer
  icon user

@API
  icon cloud
  tag internet-facing
  tooltip Accepts requests outside the trust boundary

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

Actor declarations, message labels, and group labels are optional:

```lines-and-arrows
Client -> API
API --> Client: Accepted
API ->x Queue: Delivery lost
```

See [syntax.md](./syntax.md) for the complete language definition and the
[agent usage guide](https://lines-and-arrows.dev/agents)
for a compact authoring reference.

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

Run `lines-and-arrows --help` to see the available command-line options.

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
  selectableActors: true,
  branding: true,
  onActorSelect({ name, actor }) {
    console.log(name, actor?.tooltip);
  },
});
viewer.selectActor("Customer");

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

The `<lines-and-arrows>` element exposes `source`, `mode`, `theme`, `palette`,
`canvasBackground`, `selectableActors`, `historyControls`, `branding`, `layout`,
`iconResolver`, and `iconCatalog`. In view mode, `selectActor(name)`,
`clearActorSelection()`, and `selectedActorName` control the optional actor
selection. The
JavaScript renderers accept the same `branding` boolean and default it to
`true`. Both renderers provide the Copy source header action. `renderEditor()`
also accepts `historyControls: false` to hide its undo and redo buttons.
The default layout uses a 2-unit horizontal inset and accepts
`layout: { marginX: 0 }` for edge-to-edge content. Hosts can provide larger
surrounding space with their own CSS margin or padding.

Actor selection is opt-in through `selectableActors: true` or the
`selectable-actors` element attribute. `initialSelectedActorName` preselects an
actor during `renderDiagram()`. User and programmatic selection emit
`la-actor-select` with the actor's unique `name` and an immutable snapshot
containing its name, icon, tag, tooltip text, tooltip icon, and inferred state.
Clearing selection emits `{ name: null, actor: null }`. Editor selection remains
separate: its `select(id)` and user selection emit `la-select` with the selected
immutable editor model item.
`la-change` is emitted only after a command commits a different source; its
detail contains the new source, immutable AST snapshot, command name, and
history state.
In edit mode, `replaceSource()` returns `true` only when it commits a different
valid source. Invalid source returns `false` and emits `la-error`, whose detail
contains the original error.

Layout overrides are compacting preferences, not permission to overlap
content. The renderer clamps unsafe spacing values and reserves room for actor
metadata, message labels, group headers, and section dividers.

When actor selection is enabled, actors expose accessible names, enter the
keyboard tab order, and respond to Enter or Space. Escape or selecting the
canvas clears the actor selection. Messages, groups, sections, and gaps remain
static in view mode; their tooltip controls stay accessible independently.

## Install

```sh
npm install lines-and-arrows
```

The published package contains the JavaScript runtime, optional type
declarations, validation CLI, syntax reference, licenses, and notices.
The DOM-free syntax API and CLI support Node.js 22 and newer. The browser
renderer targets modern browsers with native ES modules, custom elements, and
ES2022 support; legacy browsers need host-provided transpilation and polyfills.

## Themes and icons

Use `theme: "light"`, `"dark"`, or `"auto"`. Supply a small per-diagram
palette when the diagram should follow a host surface:

```js
diagram.palette = {
  background: "var(--page)",
  foreground: "var(--text)",
  accent: "var(--accent)",
  danger: "var(--danger)",
};
diagram.canvasBackground = "solid";
```

The renderer derives muted text, lines, nested group fills, tags, selection,
and editor surfaces from these colors. `accentForeground` and
`dangerForeground` are optional contrast overrides. `renderDiagram()` and
`renderEditor()` accept the same `palette` and `canvasBackground` options.
The canvas is transparent by default so the host background remains visible;
use `canvasBackground: "solid"` to paint the theme or palette background.
Built-in light and dark themes use translucent group overlays. Lifelines use a
low-opacity version of the actor accent and sit behind every other diagram
layer, remaining visible beneath groups but not through gaps. Metadata pills
use opaque derived surfaces.

Actor and tooltip icons work without configuration through the default
Phosphor resolver. Set
`iconResolver(name, theme)` and `iconCatalog` to provide another icon set. On
the custom element, set either property to `null` to disable the resolver or
clear the catalog.

The default resolver fetches each used icon from the exactly pinned Phosphor
package on jsDelivr. For offline, privacy-sensitive, or restrictive-CSP hosts,
set `iconResolver` to `null` or return same-origin icon URLs from a custom
resolver. Only `icon` and `tooltip-icon` identifiers are passed to the
configured resolver; all other diagram fields render locally.

Phosphor Icons is MIT licensed. See
[THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

## Repository

- `src/` — parser, serializer, editor model, SVG renderer, and web component.
- `bin/` — DOM-free syntax validation command.
- `test/` — syntax, serialization, editor-model, and icon-provider checks.
- `type-tests/` — strict consumer checks for every public TypeScript entry point.
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

## Publishing

The npm package, CDN distribution, GitHub release, and product website are
separate artifacts:

- `lines-and-arrows` is the single unscoped npm package.
- jsDelivr serves the browser bundles directly from published npm versions.
- GitHub Releases record each stable package release.
- The product website in `website/` has its own deployment lifecycle.

After the npm release is published and verified, run `npm run website:prepare`
before deploying `website/`. The command reads the released version from
`package.json`, synchronizes the website runtime and static CDN examples, and
validates the prepared output. The website does not maintain a separate version.

The `files` allowlist in `package.json` defines the npm package contents. It
contains the runtime source, browser distributions, validation CLI, type
declarations, consumer documentation, and license notices. Repository tests,
build tooling, demos, and website files remain repository-only.

Stable releases use semantic versions. Before `1.0`, patch releases preserve
the current minor-version contract, while a new minor version may introduce
breaking changes. Consumers can choose between:

- `https://cdn.jsdelivr.net/npm/lines-and-arrows@0.10` for compatible patch
  updates within the `0.10` line.
- `https://cdn.jsdelivr.net/npm/lines-and-arrows@0.10.0` for an immutable,
  exactly pinned release.

Publishing runs exclusively through the
[release workflow](https://github.com/apurin/lines-and-arrows/blob/main/.github/workflows/release.yml)
using npm trusted publishing and GitHub Actions OIDC. A stable release follows
this flow:

1. Fetch `origin` and inspect both the worktree and commits ahead of
   `origin/main`. If unrelated work is present, prepare the release in a clean
   checkout based on `origin/main`; do not tag a mixed local history.
2. Update the matching version in `package.json` and `package-lock.json`.
3. Run `npm ci`, `npm run check`, and `npm pack --dry-run`.
4. Commit only the intended release changes on `main` and push that commit to
   `origin/main`.
5. Verify that the exact release commit is reachable from remote `main`. Only
   then create and push its annotated `vX.Y.Z` tag. A tag-only push is not a
   completed release.
6. The release workflow confirms that the tag and package version match,
   repeats the checks in a clean environment, builds the CDN bundles, publishes
   the package with npm provenance, and creates the GitHub Release.
7. Verify the npm `latest` tag, a fresh npm installation, and both the exact
   and minor-version jsDelivr URLs.

## License

Lines & Arrows is available under the [MIT License](./LICENSE).
