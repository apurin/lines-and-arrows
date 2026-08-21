# Lines & Arrows syntax

Status: working definition

Lines & Arrows is a small text format for sequence diagrams. The document
captures the meaning and order of a sequence without depending on a particular
visual engine. The SVG renderer, visual editor, syntax API, and command-line
validator all use the same portable source.

The syntax is the source of truth. A visual editor reads and writes this format;
it does not store a separate, richer diagram that cannot be represented as
text.

## Design boundaries

The language stores:

- actors and their order;
- messages and their order;
- message line and end styles;
- nested groups and group sections;
- semantic gaps in the timeline;
- one optional tag and one optional tooltip on an actor or message;
- an optional icon identifier on an actor or tooltip.

The language does not store:

- coordinates, dimensions, routing, or other layout details;
- colors, fonts, spacing, or themes;
- renderer-specific directives;
- durable internal object IDs.

A renderer may make different layout and styling choices, but it must preserve
the document's actors, order, hierarchy, arrow distinctions, gaps, tags, and
tooltips.

## Complete example

```lines-and-arrows
@Customer
  icon user

@API
  icon cloud
  tag internet-facing
  tooltip Accepts requests outside the trust boundary
  tooltip-icon shield-check

@Worker
  icon gear

@Queue
  icon tray

Customer -> API: Start job
  tag idempotent
  tooltip Safe to retry with the same request identifier
  tooltip-icon key

critical Job execution
  API -> Worker: Start job
  choice
    | accepted
      Worker --> API: Accepted
    | queue unavailable
      Worker ->x Queue: Enqueue job
  gap 30 seconds later
  Worker --> API: Completed

API --> Customer: Job complete
```

## Structure and whitespace

The format is UTF-8, line-oriented, and indentation-based.

- One indentation level is two spaces.
- Tabs are invalid in actors, properties, and timeline constructs.
- Blank lines, including lines containing only spaces or tabs, are ignored.
- Before the first actor or timeline construct, a line whose first
  non-whitespace characters are `//` is a document header comment.
- Header comments have no structural indentation. Canonical output writes
  them at column zero.
- After the first actor or timeline construct, comment lines are invalid with
  `Comments are only allowed before the diagram.`
- Inline comments are not supported. This keeps values such as URLs
  unambiguous.
- Source values stay on one physical line; `\n` represents supported visible
  line breaks without changing indentation or structure.

Indentation expresses ownership:

- indented actor properties belong to the actor above them;
- indented message properties belong to the message above them;
- indented timeline items belong to the group or section above them.

Incorrect or skipped indentation is a syntax error.

## Actors

An actor declaration begins with `@`:

```lines-and-arrows
@API
  icon cloud
  tag internet-facing
  tooltip Accepts requests outside the trust boundary
```

Actor properties are optional:

| Property | Meaning |
| --- | --- |
| `icon IDENTIFIER` | A stable icon-catalog identifier. |
| `tag TEXT` | A short, visible, single-line qualifier for a stable constraint or property. |
| `tooltip TEXT` | Additional detail exposed on hover, focus, or an equivalent interaction. May contain `\n`. |
| `tooltip-icon IDENTIFIER` | An optional icon-catalog identifier for the tooltip control. |

An actor may have at most one of each property. Property order does not change
meaning. Canonical output uses `icon`, `tag`, `tooltip`, then `tooltip-icon`.
When a tooltip is present, renderers expose a compact information control
beside the tag, or by itself when there is no tag. Without `tooltip-icon`, the
control uses a lowercase `i`.

The text following `@` is both the actor's visible name and its identity in the
source. Renaming an actor in the visual editor must update every reference to it
atomically. Public syntax documents contain semantic source data; renderers and
editors may assign private session IDs.

Actor declarations are optional:

- If the document has no declarations, actors are inferred in first-use order.
- If the document has any declaration, every referenced actor must be declared.
  Declaration order is actor order.
- Declarations must appear before the first timeline item.

Canonical output writes declarations when they establish actor order, preserve
actor metadata, or include actors unused by messages. Otherwise, actor order is
represented by first use in the timeline.

An unknown icon identifier does not invalidate a diagram. A renderer should use
its generic actor treatment or the default tooltip information icon and
preserve the identifier when the document is written again.

## Messages

A message has a source, an arrow, a target, and an optional label:

```lines-and-arrows
Client -> API
API -> Worker: Start job
Worker --> API: Accepted
Worker ->x Queue: Enqueue job
```

Omit the `:` when the message has no label. When it is present, the first `:`
after the target separates the target from the label, and the label must not be
empty.

Use `\n` where a message label should break across visible lines:

```lines-and-arrows
Client -> API: Submit report\nand supporting evidence
```

We recommend keeping each visible line of a message label to 32 characters or
fewer. A label may contain multiple lines; use `\n` wherever a line should
break.

A message may have one `tag`, one `tooltip`, and one `tooltip-icon`:

```lines-and-arrows
API -> Worker: Start job
  tag idempotent
  tooltip Safe to retry with the same request identifier
  tooltip-icon key
```

Use actor tags for stable constraints or properties that remain true throughout
the diagram. Use message tags for contracts or outcomes of that interaction.
Tags stay short and visible; tooltips carry supporting detail. A tooltip may
exist without a tag. Renderers show its information control in the message
metadata row.

### Arrow forms

| Arrow | Meaning | Recommended visual treatment |
| --- | --- | --- |
| `->` | A message. Commonly used for a request, command, or action. | Solid line with an arrowhead. |
| `-->` | A visually distinct message. Commonly used for a response, result, or acknowledgement. | Dotted or dashed line with an arrowhead. |
| `->x` | A lost or undelivered message: the intended target does not receive it. | Solid line ending in a cross. |

The arrow form preserves a visual distinction. It does not infer
request/response pairs, synchronization, or execution behavior.

The cross has a narrower meaning than a failed operation. It means delivery
failed or the message was lost. If a target receives a request and rejects it,
represent that as a delivered request followed by a response:

```lines-and-arrows
Client -> API: Create order
API --> Client: Rejected
```

## Groups

A group is a type, an optional label, and an indented body:

```lines-and-arrows
repeat Each uploaded chunk
  Client -> API: Upload chunk
  API --> Client: Next chunk
```

The first word is the group type. When present, everything after it is the
visible label. The label may be omitted or contain `\n`; the group type stays
on one line.
Group types use lowercase letters, numbers, and hyphens, beginning with a
letter.

The type vocabulary is deliberately open. `choice`, `repeat`, `parallel`,
`optional`, `critical`, and domain-specific values such as `review` all use the
same structure. A renderer that does not recognize a type must preserve it and
may display the group with a neutral treatment. `gap` is the one reserved type:
it introduces a timeline gap and cannot introduce a group body.

Groups may be nested.

### Sections

A group with alternatives or parallel lanes uses `|` sections:

```lines-and-arrows
choice Inventory result
  | available
    API -> Warehouse: Reserve item
    Warehouse --> API: Reserved
  | sold out
    API --> Customer: Unavailable
```

Separate `|` from the section label with at least one space. The label may
contain `\n`. A group body contains either direct timeline items or sections,
not both at the same indentation level. Every group and every section must
contain at least one timeline item.

## Gaps

A gap marks a meaningful discontinuity in the timeline:

```lines-and-arrows
API -> Worker: Start job
gap 30 seconds later
Worker --> API: Completed
```

The text after `gap` is required, visible, and may contain `\n`. In a
lifeline-based renderer, the gap crosses every lifeline. In another kind of
renderer, it must remain an equally prominent timeline marker.

A gap means that time passed, context changed, or an omitted part of the
sequence separates the surrounding interactions. It does not encode duration
or proportional spacing: `gap 30 seconds later` is not required to be wider
than `gap the next morning`.

Gaps may appear inside groups and sections.

## Comments

Comments form an optional document header before the first actor declaration or
timeline construct. Blank lines may appear within the header:

```lines-and-arrows
// Checkout request flow

// Used by the operations guide
API -> Worker: Start job
```

The parser stores header comment text in the document's `comments` array. Each
entry represents one physical comment line. Canonical output writes the
comments together at the top of the source, and visual edits preserve them.
Comments stay outside the rendered diagram. Use tags and tooltips for context
attached to actors and messages.

## Names and text

Actor names, labels, tags, and tooltips are trimmed but otherwise preserve their
Unicode text and capitalization.

The two text escapes are:

- `\n` for an intentional visible line break;
- `\\` for a literal backslash.

Line breaks are supported in message, group, section, and gap labels and in
tooltips. Actor names, tags, group types, `icon` values, and `tooltip-icon`
values stay on one line. Those fields identify objects or occupy deliberately
compact controls, so line breaks would be ambiguous rather than useful.

Other backslash combinations have no special meaning. A canonical writer
escapes every literal backslash, so text always parses back to the same value.

In this draft:

- actor names may contain spaces;
- actor names may not contain `:`, an arrow form, or begin with `@`, `|`, or
  `//`;
- group labels, section labels, message labels, tags, and tooltips may contain
  punctuation, including additional colons;
- empty names and explicitly empty text values are invalid;
- a `\n` escape is invalid in a field defined as single-line.

These restrictions keep parsing small and deterministic without adding a
quoting syntax.

## Compact grammar

The grammar below describes tokens at the current indentation level.
Indentation ownership is defined by the rules above.

```ebnf
document         = header, [ actors ], timeline ;
header           = { comment | blank } ;

actors           = actor, { actor | blank } ;
actor            = "@", single-line-text, newline,
                   { actor-property | blank } ;
actor-property   = indent, ( icon | tag | tooltip | tooltip-icon ), newline ;
icon             = "icon", space, single-line-text ;
tag              = "tag", space, single-line-text ;
tooltip          = "tooltip", space, escaped-text ;
tooltip-icon     = "tooltip-icon", space, single-line-text ;

timeline         = timeline-item, { timeline-item | blank } ;
timeline-item    = message | group | gap ;

message          = single-line-text, space, arrow, space, single-line-text,
                   [ ":", [ space ], escaped-text ], newline,
                   { message-property | blank } ;
message-property = indent, ( tag | tooltip | tooltip-icon ), newline ;
arrow            = "->" | "-->" | "->x" ;

group            = group-type, [ space, escaped-text ], newline,
                   ( group-body | sections ) ;
group-body       = indent, timeline-item,
                   { indent, timeline-item | blank } ;
sections         = section, { section } ;
section          = indent, "|", space, escaped-text, newline, group-body ;

gap              = "gap", space, escaped-text, newline ;
comment          = { " " | "\t" }, "//", [ text ], newline ;
blank            = newline ;
group-type       = letter, { lowercase-letter | digit | "-" } ;
escaped-text     = { unicode-character | "\n" | "\\" } ;
single-line-text = escaped-text without "\n" ;
```

`timeline` must contain at least one timeline item. The grammar is descriptive;
an implementation should parse arrow tokens longest-first. `gap` is excluded
from `group-type` because it is reserved by the `gap` production.

## Validation and round trips

A parser must report, at minimum:

- malformed indentation or tabs;
- duplicate actor properties;
- duplicate message tags, tooltips, or tooltip icons;
- unknown actor references in a document with explicit declarations;
- empty names, explicit labels, groups, sections, or gaps;
- line-break escapes in single-line fields;
- mixed direct items and sections in one group;
- a section marker without separator whitespace;
- use of the reserved `gap` keyword as a group type;
- unsupported arrow forms;
- actor declarations after the timeline begins;
- a comment after the first actor or timeline construct.

A parse-write round trip must preserve document meaning. A canonical writer may
normalize indentation, blank lines, and property order, but must not change
actor order, timeline order, hierarchy, text, arrow forms, actor or tooltip
icon identifiers, tags, tooltips, or document header comments. Canonical output
writes real line breaks inside values as `\n` and literal backslashes as `\\`.

Programmatic documents follow the same grammar. `serialize(document)` validates
the document before returning source. A parsed group has one non-empty `body`
containing either timeline items or sections; each section contains timeline
items.

## Renderer contract

The syntax is intentionally independent of any drawing implementation. A
conforming renderer:

1. preserves actor and timeline order;
2. preserves group nesting and section boundaries;
3. visibly or accessibly distinguishes every supported arrow form;
4. preserves gaps as semantic rows rather than converting their text into
   proportional time;
5. exposes tags and tooltip detail, including to keyboard and assistive
   technology users;
6. preserves unknown group types and actor or tooltip icon identifiers on
   write;
7. never writes layout or theme choices back into the source.
