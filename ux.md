# View and edit interaction model

The SVG canvas has two modes: `view` and `edit`. Selection is configurable in
view mode and required in edit mode. Edit mode adds contextual manipulation
without changing the diagram at rest.

## Shared visual states

1. Rest looks the same in both modes.
2. Hover adds only a soft highlight or cursor change.
3. Selection reveals only the affordance relevant to the selected object.
4. Dragging keeps the original layout in place and shows an insertion line.
5. Dropping commits one atomic change.
6. Escape cancels without changing the document.

There are no persistent inspectors, selection toolbars, or movement buttons on
the canvas.

## Add affordances

In edit mode, hovering between actor headers reveals a small circular button
with a plus at that insertion position.

Hovering over an insertion line between timeline items reveals the same
circular plus button. It creates a gap or group at that exact position. Inside
a group or section, the button sits just outside its immediate group's left
border while the insertion line stays within that container. Top-level buttons
keep their original position when the diagram has no groups; with groups, they
share the outside left rail.

At the same insertion position, hovering over an actor lifeline reveals a tiny
circle with an arrow. Dragging it to an actor creates an unnamed connection
from the first actor to the target, including a self-message when dropped back
on the same actor. The existing diagram stays in place during the drag; a
provisional connection shows the prospective target. The circle stays above
that line, and its arrow points in the drag direction. On the rightmost actor
it points left before dragging.

These controls are absent in view mode and absent when the pointer is elsewhere.

## Reordering

- A selected actor is dragged horizontally. A vertical insertion line shows its
  destination.
- A selected connection or gap exposes a small reorder dot just outside its
  leftmost visual edge. Dragging it vertically shows a horizontal insertion
  line.
- A selected connection also exposes a small grip at each endpoint. Dragging
  either grip to an actor changes only that endpoint. Dropping both endpoints
  on one actor creates a self-message.
- Hovering either endpoint reveals the same grip before selection, so it can be
  retargeted directly. Hover highlighting applies to both the line and its
  arrowhead.
- A selected group exposes the same reorder affordance in its header. The group
  and all descendants move as one timeline item.
- An item inside a group remains in its current parent during a vertical drag.
  Deliberately crossing a group boundary horizontally changes the prospective
  parent, which is communicated by the insertion line's width and indentation.

Nothing else reflows until the drop is committed.

## Grouping

A timeline marquee selects a contiguous vertical range of sibling items.
Grouping wraps that range in a new neutral group and focuses its contextual
label field. The same editor exposes the open group type.

Items from different parents cannot be grouped in one operation. Existing
groups can be selected only as complete units.

Removing a group preserves its contents. Deleting the group and its contents is
a separate destructive command.

## Contextual editing

Selecting an object opens one compact editor close to that object:

- actors expose name with its icon button, tag, and tooltip with its icon
  button;
- messages expose three graphical arrow-style buttons, optional label, tag, and
  tooltip with its icon button; endpoints are edited directly on the
  connection. The titleless editor is centered close to the selected
  connection;
- gaps expose their label;
- groups expose their open type and label, plus section and ungroup actions;
- sections expose their label and safe removal.

Group lifelines continue through the header. Compact surface-colored
backplates immediately around the non-empty label and the group type mask the
lifelines beneath their text, matching the treatment of section labels. Empty
labels add no label backplate. The group label is left-aligned and its type is
right-aligned.

Tags and tooltip controls share one compact metadata row. The tooltip control
appears only when tooltip text exists and reveals that text immediately on
hover or focus. It uses a lowercase `i` by default and may use any identifier
supported by the actor icon resolver. Actor metadata is centered on the bottom
edge of its panel. Tags and tooltip controls use one theme color at the same
intensity on actors, the canvas, groups, and nested groups.

Pressing an icon button opens a compact popup with a search field and tight
icon grid. The actor-name row shows the selected actor icon; the tooltip row
shows its selected icon or the default information symbol. Selecting a grid
item applies it immediately. The first grid item clears the actor icon or
restores the tooltip default. Hosts provide the searchable catalog separately
from the resolver so the editor stays independent of a particular icon set.
Actor panels expand when necessary to keep that metadata row inside the panel
with a small margin on each side.
They also expand to show the complete actor name without truncation. Wider actor
panels widen the diagram rather than compressing neighboring columns.

Text fields commit on blur or Enter. Tooltip controls are single-line because
each source property occupies one line. Invalid edits stay visible with a local
error rather than corrupting the document.

## Keyboard controls

- `Escape` cancels a drag or insertion and clears selection.
- `Delete` or `Backspace` deletes the selected object or contiguous range.
- `Command/Ctrl+Z` undoes; adding Shift redoes.
- `Command/Ctrl+Y` is also accepted for redo.
- `Alt+Left/Right` reorders a selected actor.
- `Alt+Up/Down` reorders a selected timeline item or section.
