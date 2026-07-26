# Lines & Arrows for agents

Use Lines & Arrows when an interaction sequence must stay easy for another agent
or a human to inspect and edit.

## Authoring rules

- Write UTF-8, line-oriented text.
- Use two spaces per indentation level. Never use tabs.
- Keep coordinates, colors, dimensions, and theme choices out of the source.
- Declare actors first when actor order or metadata matters.
- If any actor is declared, declare every referenced actor.
- Use `->` for a request or action.
- Use `-->` for a visually distinct response or result.
- Use `->x` only when a message is lost or not delivered.
- Put nested timeline items under an open group type.
- Put alternative or parallel lanes under `| section name`.
- Use `gap TEXT` for meaningful omitted time or context.
- Put comments on their own line with `//`.

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

## Syntax shapes

```lines-and-arrows
@Actor Name
  icon catalog-identifier
  tag short visible text
  tooltip additional detail
  tooltip-icon catalog-identifier

Source -> Target: Optional label
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
// Source-only comment
```

Group types are open vocabulary. `choice`, `repeat`, `parallel`, `optional`,
`critical`, and domain-specific lowercase names all use the same structure.

## Embed

```js
import {
  defineLinesAndArrows,
  parse,
  renderDiagram,
} from "@lines-and-arrows/core";

const diagramDocument = parse(source);
const view = renderDiagram(container, diagramDocument, { theme: "auto" });

defineLinesAndArrows();
const element = document.querySelector("lines-and-arrows");
element.source = source;
element.mode = "view";
element.theme = "auto";
```

```html
<lines-and-arrows mode="view" theme="auto"></lines-and-arrows>
```

## Validate before returning

- The document has at least one timeline item.
- Indentation never skips a level.
- Explicit labels, groups, sections, and gaps are not empty.
- Actor declarations appear before the timeline.
- A group body contains direct items or sections at one level, not both.
- The arrow form is exactly `->`, `-->`, or `->x`.
- Layout and presentation remain renderer concerns.
