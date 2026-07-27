---
name: lines-and-arrows
description: Author, validate, and revise Lines & Arrows sequence diagrams. Use when creating or editing Lines & Arrows source, checking syntax without rendering a page, or preparing diagram source for the viewer or visual editor.
---

# Work with Lines & Arrows

1. Read [agents.md](./agents.md) for the compact authoring rules.
2. Write or revise the diagram source while preserving actor order, timeline
   order, hierarchy, text, arrows, tags, tooltips, icon identifiers, and
   comment placement and indentation.
   Encode intentional line breaks in labels and tooltips as `\n`, literal
   backslashes as `\\`, and keep identity and icon fields on one line.
3. Validate a file with
   `lines-and-arrows validate --json FILE`, or call `validate(source)` from
   `lines-and-arrows/syntax`.
4. Use the returned line to repair syntax errors.
5. Read [syntax.md](./syntax.md) only when the complete grammar or renderer
   contract is needed.

Keep layout, colors, dimensions, and themes out of diagram source. Do not create
an HTML page solely to validate syntax.
