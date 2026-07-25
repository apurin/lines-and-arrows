import test from "node:test";
import assert from "node:assert/strict";

import {
  LinesAndArrowsSyntaxError,
  parse,
} from "../src/parser.js";
import { layoutDiagram } from "../src/layout.js";
import {
  ACTOR_LABEL_MARGIN_X,
  ACTOR_METADATA_MARGIN_X,
  actorLabelWidth,
  messageLabelMetrics,
  metadataMetrics,
  selfMessageWidth,
} from "../src/metadata.js";

const COMPLETE_SOURCE = `@Customer
  icon user
  tag review
  tooltip Reviews the result
  tooltip-icon chat-circle

@API
  icon cloud

@Worker
  icon gear-six

@Queue
  icon tray

Customer -> API: Submit report
  tag critical
  tooltip Retain original evidence
  tooltip-icon warning

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
  assert.equal(document.actors[0].tooltipIcon, "chat-circle");
  assert.equal(document.items.length, 3);
  assert.equal(document.items[0].tooltipIcon, "warning");
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

test("parses messages without labels", () => {
  const document = parse(`Client -> API
API --> Worker: Accepted
Worker ->x Queue`);

  assert.deepEqual(
    document.items.map((item) => item.label),
    [null, "Accepted", null],
  );
  assert.equal(document.items[0].source, "Client");
  assert.equal(document.items[0].target, "API");
});

test("rejects an explicitly empty message label", () => {
  assert.throws(
    () => parse("Client -> API:"),
    /Message label cannot be empty/,
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

test("reserves a metadata row for a tooltip without a tag", () => {
  const layout = layoutDiagram(
    parse(`Client -> API: Start
  tooltip Visible through the information control
API --> Client: Complete`),
  );

  assert.ok(layout.rows[0].height > layout.rows[1].height);
  assert.equal(
    layout.rows[1].y - layout.rows[0].y,
    layout.rows[0].height,
  );
});

test("expands actor panels to contain long metadata", () => {
  const layout = layoutDiagram(
    parse(`@Customer
  tag needs careful review
  tooltip Review this before accepting

@API

Customer -> API: Submit`),
  );
  const [customer, api] = layout.actors;
  const metadataWidth = metadataMetrics(
    customer.tag,
    customer.tooltip,
  ).width;

  assert.ok(customer.width > layout.options.actorWidth);
  assert.ok(
    customer.width >= metadataWidth + ACTOR_METADATA_MARGIN_X * 2,
  );
  assert.equal(
    api.x - (customer.x + customer.width),
    layout.options.actorGap,
  );
});

test("expands actor panels and diagram width to contain long names", () => {
  const longName = "Primary Billing and Reconciliation Service";
  const layout = layoutDiagram(
    parse(`@${longName}
@API

${longName} -> API: Submit`),
  );
  const [service, api] = layout.actors;

  assert.ok(service.width > layout.options.actorWidth);
  assert.ok(
    service.width >=
      actorLabelWidth(longName) + ACTOR_LABEL_MARGIN_X * 2,
  );
  assert.equal(
    api.x - (service.x + service.width),
    layout.options.actorGap,
  );
  assert.equal(
    layout.width,
    layout.options.marginX * 2 +
      service.width +
      api.width +
      layout.options.actorGap,
  );
});

test("widens self-messages and reserves room before the next lifeline", () => {
  const layout = layoutDiagram(
    parse(`@API
@Worker

API -> API: Reconcile outstanding evidence
  tag needs review now
  tooltip Review the local result
API -> Worker: Continue`),
  );
  const [api, worker] = layout.actors;
  const selfMessage = layout.rows[0];
  const loopWidth = selfMessageWidth(selfMessage);

  assert.ok(
    loopWidth >= messageLabelMetrics(selfMessage.label).width,
  );
  assert.ok(
    loopWidth >=
      metadataMetrics(
        selfMessage.tag,
        selfMessage.tooltip,
      ).width,
  );
  assert.ok(worker.centerX - api.centerX > loopWidth);
});

test("reserves canvas space for a rightmost self-message", () => {
  const layout = layoutDiagram(
    parse(`@API
@Worker

API -> Worker: Start
Worker -> Worker: Check evidence
  tag local review
  tooltip This stays on the worker`),
  );
  const worker = layout.actors[1];
  const selfMessage = layout.rows[1];

  assert.ok(
    layout.width >=
      worker.centerX +
        selfMessageWidth(selfMessage) +
        layout.options.marginX,
  );
});
