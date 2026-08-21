import assert from "node:assert/strict";
import test from "node:test";

import { assignStructuralIds } from "../src/document.js";
import { layoutDiagram, layoutDiagramWithoutHeader } from "../src/layout.js";
import { messageLabelMetrics, selfMessageWidth } from "../src/metadata.js";
import { parse } from "../src/parser.js";

function layout(source, withoutHeader = false) {
  const document = assignStructuralIds(parse(source));
  return withoutHeader ? layoutDiagramWithoutHeader(document) : layoutDiagram(document);
}

test("actors, metadata, and the first message do not overlap", () => {
  const result = layout(`@Human
  tag reviewer
  tooltip Reviews the finished result

@Agent

Human -> Agent: Make one focused change`);
  const human = result.actorByName.get("Human");
  const message = result.rows[0];
  const metadataBottom =
    human.y + human.height + result.options.actorMetadataGap + result.options.actorMetadataHeight;

  assert.ok(message.top >= metadataBottom + 4);
  assert.ok(result.actors[1].x >= human.x + human.width);
  assert.ok(result.width >= result.actors[1].x + result.actors[1].width);
});

test("nested groups contain multiline rows and self messages", () => {
  const result = layout(String.raw`@Agent
@Worker

critical First\nsecond
  parallel Work
    | local
      Worker -> Worker: Long self message that needs room
    | remote
      Agent -> Worker: First\nsecond
      gap Next\nday`);

  for (const group of result.groups) {
    assert.ok(group.bottom > group.top);
    const nestedRows = result.rows.filter((row) => row.top >= group.top && row.bottom <= group.bottom);
    assert.ok(nestedRows.length > 0);
  }
  assert.ok(result.rows.every((row) => row.bottom <= result.height));
  const selfMessage = result.rows.find((row) => row.source === row.target);
  const worker = result.actorByName.get("Worker");
  const messageRight =
    worker.centerX +
    selfMessageWidth(selfMessage, result.options.messageLabelMaxWidth);
  assert.ok(result.groups[1].right > messageRight);
  assert.ok(result.groups[0].right > result.groups[1].right);
});

test("header-free diagrams use the top edge", () => {
  const source = "A -> B: One";
  const withHeader = layout(source);
  const withoutHeader = layout(source, true);

  assert.equal(withoutHeader.actors[0].y, 0);
  assert.ok(withHeader.actors[0].y > withoutHeader.actors[0].y);
});

test("message labels expand the space between lifelines", () => {
  const label = "Confirm compatible migration";
  const result = layout(`@Client
@API

Client -> API: ${label}`);
  const client = result.actorByName.get("Client");
  const api = result.actorByName.get("API");
  const labelMetrics = messageLabelMetrics(label);

  assert.deepEqual(labelMetrics.visibleLines, [label]);
  assert.ok(
    api.centerX - client.centerX >= labelMetrics.width,
  );
  assert.ok(
    api.centerX - client.centerX >
      result.options.actorWidth + result.options.actorGap,
  );
});

test("message rows reserve space for their visible decorations", () => {
  const result = layout(`A -> B
A -> B: Label
A -> B
  tag tagged
A -> B
  tooltip More detail
A -> B: Label
  tag tagged
  tooltip More detail
A -> A
A -> A: Label
A -> A
  tag local
A -> A: Label
  tag local
  tooltip More detail`);

  assert.deepEqual(
    result.rows.map((row) => row.height),
    [24, 35, 41, 41, 52, 50, 61, 67, 78],
  );
});
