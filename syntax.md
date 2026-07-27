# Lines & Arrows syntax

Status: working definition

Lines & Arrows is a small text format for sequence diagrams. The document
captures the meaning and order of a sequence without depending on a particular
visual engine. An SVG renderer, a canvas editor, a terminal renderer, and a
future renderer should be able to read the same document.

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
  tag comment
  tooltip Public entry point
  tooltip-icon chat-circle

@Worker
  icon gear

@Queue
  icon tray

Customer -> API: Start job
  tag critical
  tooltip Must be acknowledged\nbefore processing continues
  tooltip-icon warning

critical Job execution
  API -> Worker: Start job
  choice Worker result
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
- Tabs are invalid on nonblank lines.
- Blank lines, including lines containing only spaces or tabs, are ignored.
- A line whose first non-space characters are `//` is a comment.
- A comment's indentation places it in the same structural scope as the
  surrounding actor, property, timeline item, group, or section.
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
  tag comment
  tooltip Public entry point
```

Actor properties are optional:

| Property | Meaning |
| --- | --- |
| `icon IDENTIFIER` | A stable icon-catalog identifier. |
| `tag TEXT` | A short, visible, single-line label. |
| `tooltip TEXT` | Additional detail exposed on hover, focus, or an equivalent interaction. May contain `\n`. |
| `tooltip-icon IDENTIFIER` | An optional icon-catalog identifier for the tooltip control. |

An actor may have at most one of each property. Property order does not change
meaning. Canonical output uses `icon`, `tag`, `tooltip`, then `tooltip-icon`.
When a tooltip is present, renderers expose a compact information control
beside the tag, or by itself when there is no tag. Without `tooltip-icon`, the
control uses a lowercase `i`.

The text following `@` is both the actor's visible name and its identity in the
source. Renaming an actor in the visual editor must update every reference to it
atomically. Editors and parsers may assign session-local IDs internally, but
those IDs are not serialized.

Actor declarations are optional:

- If the document has no declarations, actors are inferred in first-use order.
- If the document has any declaration, every referenced actor must be declared.
  Declaration order is actor order.
- Declarations must appear before the first timeline item.

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

A message may have one `tag`, one `tooltip`, and one `tooltip-icon`:

```lines-and-arrows
API -> Worker: Start job
  tag critical
  tooltip This operation must be idempotent
  tooltip-icon warning
```

The properties have the same meaning as actor tags and tooltips. A tag remains
short and visible; a tooltip carries the detail. A tooltip may exist without a
tag. Renderers show its information control in the message metadata row.

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

A group is a type, a label, and an indented body:

```lines-and-arrows
repeat Each uploaded chunk
  Client -> API: Upload chunk
  API --> Client: Next chunk
```

The first word is the group type. Everything after it is the visible label.
The label may contain `\n`; the group type stays on one line.
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

Comments occupy their own line and are ignored by the diagram:

```lines-and-arrows
// Retry is deliberately outside the critical group.
API -> Worker: Start job
```

Indent comments like the construct they describe. A comment before an actor,
timeline item, or section is attached to that construct. A comment among actor
or message properties stays after the same header or property. An indented
comment after the final child of a group or section stays at the end of that
body. Comments before the first construct or after the timeline belong to the
document.

This structural attachment avoids source line bookkeeping. Moving or grouping
a construct moves its attached comments. Deleting a construct deletes its
attached comments. Removing a group or section wrapper discards comments owned
by that wrapper while retaining comments owned by the children that remain.
Comments never become visible or selectable diagram controls.

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
document         = comments, [ actors ], timeline, comments ;
comments         = { comment | blank } ;

actors           = actor, { comments, actor } ;
actor            = "@", single-line-text, newline,
                   { actor-property | comment } ;
actor-property   = indent, ( icon | tag | tooltip | tooltip-icon ), newline ;
icon             = "icon", space, single-line-text ;
tag              = "tag", space, single-line-text ;
tooltip          = "tooltip", space, escaped-text ;
tooltip-icon     = "tooltip-icon", space, single-line-text ;

timeline         = { timeline-item | comment | blank } ;
timeline-item    = message | group | gap ;

message          = single-line-text, space, arrow, space, single-line-text,
                   [ ":", [ space ], escaped-text ], newline,
                   { message-property | comment } ;
message-property = indent, ( tag | tooltip | tooltip-icon ), newline ;
arrow            = "->" | "-->" | "->x" ;

group            = group-type, space, escaped-text, newline,
                   ( group-body | sections ) ;
group-body       = indent, timeline-item,
                   { indent, timeline-item | comment | blank } ;
sections         = section, { section } ;
section          = indent, "|", space, escaped-text, newline, group-body ;

gap              = "gap", space, escaped-text, newline ;
comment          = [ indent ], "//", [ text ], newline ;
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
- actor declarations after the timeline begins.

A parse-write round trip must preserve document meaning. A canonical writer may
normalize indentation, blank lines, and property order, but must not change
actor order, timeline order, hierarchy, text, arrow forms, actor or tooltip
icon identifiers, tags, tooltips, or the structural placement and relative
indentation of comments. Canonical output writes real line breaks inside values
as `\n` and literal backslashes as `\\`.

Programmatic documents follow the same grammar. `serialize(document)` validates
the document before returning source and rejects structures that would lose
meaning, including a group containing both direct items and sections.

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
