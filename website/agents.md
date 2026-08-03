# Lines & Arrows for agents

Use Lines & Arrows to describe an interaction sequence as compact, editable
text.

## Authoring workflow

1. Write the source using the shapes below.
2. Preserve actor order, timeline order, group nesting, and all visible text.
3. Run `lines-and-arrows validate --json FILE` or call `validate(source)`.
4. Fix the reported line, then validate again.

Validation uses only JavaScript and does not require a DOM or renderer.

## Core rules

- Use UTF-8 text and two spaces per indentation level.
- Declare every actor first when actor order or metadata matters.
- When any actor is declared, declare every referenced actor.
- Use `->` for a solid message, `-->` for a dashed message, and `->x` for a
  lost message.
- Omit the colon when a message has no label.
- Write `\n` for a visible line break in a label or tooltip and `\\` for a
  literal backslash.
- Keep actor names, tags, group types, and icon identifiers on one line.
- Indent nested timeline items under an open group type.
- Put alternative or parallel lanes under `| section name`.
- Use `gap TEXT` for meaningful omitted time or context.
- Put comments on their own line with `//` and indent them like the construct
  they describe; structural edits carry those comments with that construct.
- Keep coordinates, colors, dimensions, and themes out of the source.

## Syntax shapes

```lines-and-arrows
@Actor Name
  icon catalog-identifier
  tag short visible text
  tooltip additional detail\non another line
  tooltip-icon catalog-identifier

Source -> Target: Optional label\ncontinued label
  tag short visible text
  tooltip additional detail
  tooltip-icon catalog-identifier

group-type Visible label
  Source -> Target: Nested item

choice Visible label
  | first outcome
    Source --> Target: Result
  | second outcome
    Source ->x Target: Lost message

gap Visible discontinuity
// Source comment
```

Group types are open vocabulary except for the reserved `gap` keyword. Values
such as `choice`, `repeat`, `parallel`, `optional`, `critical`, and
domain-specific lowercase names all use the same structure.

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
  choice Worker result
    | completed
      Worker --> API: Done
    | queue unavailable
      Worker ->x Queue: Publish event
  gap The next event loop
  Worker --> Agent: Report result
```

## Programmatic validation

```js
import {
  validate,
} from "lines-and-arrows/syntax";

const result = validate(source);
if (!result.valid) {
  throw new Error(result.error.message);
}
```

Read [syntax.md](./syntax.md) when the complete grammar or round-trip contract
is needed.
