import test from "node:test";
import assert from "node:assert/strict";

import {
  LinesAndArrowsSyntaxError,
  parse,
} from "../src/parser.js";
import { layoutDiagram } from "../src/layout.js";

const COMPLETE_SOURCE = `@Customer
  icon user
  tag review
  tooltip Reviews the result

@API
  icon cloud

@Worker
  icon gear-six

@Queue
  icon tray

Customer -> API: Submit report
  tag critical
  tooltip Retain original evidence

critical Process report
  API -> Worker: Start analysis
  parallel Prepare result
    | validate input
      Worker -> Worker: Check evidence
    | persist event
      Worker -> Queue: Store audit event
  gap 30 seconds later
  choice Worker result
    | completed
      Worker --> API: Analysis complete
    | queue unavailable
      Worker ->x Queue: Publish completion event

API --> Customer: Present result`;

test("parses the complete view-mode language sample", () => {
  const document = parse(COMPLETE_SOURCE);

  assert.equal(document.explicitActors, true);
  assert.deepEqual(
    document.actors.map((actor) => actor.name),
    ["Customer", "API", "Worker", "Queue"],
  );
  assert.equal(document.actors[0].tag, "review");
  assert.equal(document.items.length, 3);
  assert.equal(document.items[1].type, "group");
  assert.equal(document.items[1].groupType, "critical");
  assert.equal(document.items[1].items[1].groupType, "parallel");
  assert.equal(document.items[1].items[1].sections.length, 2);
  assert.equal(document.items[1].items[2].type, "gap");
  assert.equal(
    document.items[1].items[3].sections[1].items[0].arrow,
    "->x",
  );
});

test("infers actors in first-use order", () => {
  const document = parse(`Client -> API: Start
API -> Worker: Dispatch
Worker --> Client: Complete`);

  assert.equal(document.explicitActors, false);
  assert.deepEqual(
    document.actors.map((actor) => actor.name),
    ["Client", "API", "Worker"],
  );
});

test("rejects undeclared actors in an explicit document", () => {
  assert.throws(
    () =>
      parse(`@Client
@API

Client -> Worker: Start`),
    (error) =>
      error instanceof LinesAndArrowsSyntaxError &&
      error.message.includes('Unknown actor "Worker"'),
  );
});

test("rejects unsupported tilde arrows", () => {
  assert.throws(
    () => parse("Client ~> API: Start"),
    /Unsupported or malformed arrow expression/,
  );
});

test("rejects duplicate properties", () => {
  assert.throws(
    () =>
      parse(`@Client
  tag one
  tag two

Client -> Client: Start`),
    /Duplicate tag property/,
  );
});

test("lays out timeline rows in increasing vertical order", () => {
  const document = parse(COMPLETE_SOURCE);
  const layout = layoutDiagram(document);

  assert.equal(layout.actors.length, 4);
  assert.equal(layout.groups.length, 3);
  assert.equal(layout.sections.length, 4);
  assert.ok(layout.height > 600);
  assert.ok(layout.actors[0].width > layout.actors[0].height);
  assert.equal(
    layout.lifelineTop,
    layout.actors[0].y + layout.actors[0].height,
  );

  const positions = layout.rows.map((row) => row.y);
  assert.deepEqual(positions, [...positions].sort((a, b) => a - b));

  for (const group of layout.groups) {
    assert.ok(group.bottom > group.top);
    assert.ok(group.height > 0);
  }
});
