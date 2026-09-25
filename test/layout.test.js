import assert from "node:assert/strict";
import test from "node:test";

import { assignStructuralIds } from "../src/document.js";
import {
  layoutDiagram,
  layoutDiagramForEditor,
  layoutDiagramWithoutHeader,
} from "../src/layout.js";
import {
  messageLabelMetrics,
  metadataMetrics,
  selfMessageWidth,
} from "../src/metadata.js";
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

test("measured actor boxes keep the outer margin and the column spacing", () => {
  const source = `@a rather long lowercase name
@Mid
@another long lowercase name

critical Retry
  a rather long lowercase name -> Mid: Call
  gap Later
Mid -> another long lowercase name: Done`;
  // A measurer narrower than the worst-case estimate, as real fonts are.
  const measure = (name) => name.length * 6;
  for (const layoutFor of [layoutDiagram, layoutDiagramForEditor]) {
    const document = assignStructuralIds(parse(source));
    const estimated = layoutFor(document);
    const measured = layoutFor(document, measure);
    const { marginX } = measured.options;
    const first = measured.actors[0];
    const last = measured.actors.at(-1);

    // Without a measurer every box fills its column.
    for (const actor of estimated.actors) {
      assert.equal(actor.x, actor.slotX);
      assert.equal(actor.width, actor.slotWidth);
    }
    assert.equal(estimated.actors[0].x, marginX);

    // Boxes are centered on their columns at the measured width.
    for (const [index, actor] of measured.actors.entries()) {
      assert.equal(actor.slotWidth, estimated.actors[index].width);
      assert.equal(
        actor.width,
        Math.max(96, measure(actor.name) + 32),
      );
      assert.equal(actor.x + actor.width / 2, actor.centerX);
      assert.equal(actor.slotX + actor.slotWidth / 2, actor.centerX);
    }
    // The unused part of the edge columns is not kept as padding.
    assert.ok(first.slotX < marginX);
    assert.equal(first.x, marginX);
    assert.equal(measured.contentLeft, marginX);
    assert.equal(last.x + last.width, measured.width - marginX);
    assert.equal(measured.contentRight, measured.width - marginX);
    assert.ok(measured.width < estimated.width);
    // Only the outer edges move inward.
    const shift = estimated.actors[0].centerX - first.centerX;
    for (const [index, actor] of measured.actors.entries()) {
      assert.equal(actor.centerX, estimated.actors[index].centerX - shift);
    }
    assert.equal(measured.groups[0].left, marginX);
    assert.equal(measured.groups[0].right, measured.contentRight);
  }
});

test("a measured name wider than its column keeps the full column", () => {
  const document = assignStructuralIds(parse("@WWWW\n@Mid\n\nWWWW -> Mid"));
  const estimated = layoutDiagram(document);
  const measured = layoutDiagram(document, (name) => name.length * 40);

  assert.deepEqual(
    measured.actors.map(({ x, width, centerX }) => ({ x, width, centerX })),
    estimated.actors.map(({ x, width, centerX }) => ({ x, width, centerX })),
  );
  assert.equal(measured.width, estimated.width);
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

test("tag pills show complete text at compact width", () => {
  const metrics = metadataMetrics("local + one replica", false);
  const wideLowercase = metadataMetrics("m".repeat(20), false);

  assert.equal(metrics.visibleTag, "local + one replica");
  assert.ok(Math.abs(metrics.tagWidth - 126.4) < 0.01);
  assert.equal(wideLowercase.tagWidth, 230);
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
