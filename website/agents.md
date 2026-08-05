# Lines & Arrows for agents

Lines & Arrows is an open source sequence-diagram format with a visual editor.
The diagram is stored as concise text, so agents can write and validate the
same source that people view or edit.

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
      src="https://cdn.jsdelivr.net/npm/lines-and-arrows@0.3"
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

Use `mode="edit"` for the visual editor. Use `selectable="false"` for a
non-interactive view and `branding="false"` to hide the attribution. The
`@0.3` CDN URL accepts compatible patch releases; use `@0.3.0` to pin the exact
release.

## Use the npm package

Install the package before using its CLI or JavaScript exports:

```sh
npm install lines-and-arrows
npx lines-and-arrows validate --json diagram.la
```

Register the web component in an npm-based browser application:

```js
import "lines-and-arrows/auto";
```

This import must run through the application's bundler or development server.
Then use the same `<lines-and-arrows>` HTML shown above, without the CDN
`<script>`.

Validate source in JavaScript without a browser or DOM:

```js
import { validate } from "lines-and-arrows/syntax";

const result = validate(source);
if (!result.valid) {
  throw new Error(`Line ${result.error.line}: ${result.error.message}`);
}
```

## Authoring workflow

1. Write actors first when their order, icons, tags, or tooltips matter.
2. Write messages and groups in timeline order.
3. Use two spaces for every indentation level. Never use tabs.
4. Save the source and validate it with the CLI or `validate(source)`.
5. Fix the reported line and validate again.

## Syntax

```lines-and-arrows
@Actor Name
  icon catalog-identifier
  tag short visible text
  tooltip Additional detail\non another line
  tooltip-icon catalog-identifier

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
// Source-only comment
```

Core rules:

- Actor declarations are optional. Without them, actors appear in first-use
  order. If any actor is declared, declare every referenced actor.
- `->`, `-->`, and `->x` preserve three distinct arrow styles. Use `->x` only
  when a message is not delivered.
- A message label is optional. Omit the colon when there is no label.
- Actor and message metadata may contain one `tag`, one `tooltip`, and one
  `tooltip-icon`. Actors may also contain one `icon`.
- Icon identifiers use Phosphor names such as `robot`, `user`, `cloud`,
  `database`, `gear-six`, and `tray`. An unknown name remains valid but may
  render without an icon.
- Any lowercase group type is valid except the reserved word `gap`. Its visible
  label is optional; a bare group type starts an unlabeled group. Common types
  include `choice`, `repeat`, `parallel`, `optional`, and `critical`.
- A group contains either direct items or `| section` blocks, not both at the
  same level. Every group and section must contain at least one item.
- Use `gap TEXT` when time passes or part of the sequence is omitted.
- Use `\n` for a visible line break and `\\` for a literal backslash.
- Keep coordinates, colors, dimensions, and themes out of diagram source.

## Complete example

```lines-and-arrows
@Agent
  icon robot
  tag author
  tooltip Produces the initial sequence

@API
  icon cloud

@Worker
  icon gear-six

@Queue
  icon tray

Agent -> API: Start job
  tag critical
  tooltip Preserve the original evidence

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
