# View and edit interaction model

The SVG canvas has two modes: `view` and `edit`. Both modes allow selection.
Edit mode adds contextual manipulation without changing the diagram at rest.

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
circular plus button. It creates a connection or another timeline item at that
exact position.

These controls are absent in view mode and absent when the pointer is elsewhere.

## Reordering

- A selected actor is dragged horizontally. A vertical insertion line shows its
  destination.
- A selected connection or gap exposes a small reorder dot just outside its
  leftmost visual edge. Dragging it vertically shows a horizontal insertion
  line.
- A selected group exposes the same reorder affordance in its header. The group
  and all descendants move as one timeline item.
- An item inside a group remains in its current parent during a vertical drag.
  Deliberately crossing a group boundary horizontally changes the prospective
  parent, which is communicated by the insertion line's width and indentation.

Nothing else reflows until the drop is committed.

## Grouping

A timeline marquee selects a contiguous vertical range of sibling items.
Grouping wraps that range in a new neutral group and focuses the inline group
label. The group type is selected from its header.

Items from different parents cannot be grouped in one operation. Existing
groups can be selected only as complete units.

Removing a group preserves its contents. Deleting the group and its contents is
a separate destructive command.
