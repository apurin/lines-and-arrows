import test from "node:test";
import assert from "node:assert/strict";

import {
  DiagramEditor,
  ROOT_CONTAINER_ID,
  findItemLocation,
} from "../src/editor.js";
import { layoutDiagram } from "../src/layout.js";
import { parse } from "../src/parser.js";
import { serialize } from "../src/serialize.js";

const SOURCE = `@Client
  icon user

@API
  tag public

@Worker

Client -> API: Start
critical Processing
  API -> Worker: Dispatch
  Worker --> API: Complete
API --> Client: Done
`;

test("serializes a parseable canonical document", () => {
  const source = serialize(parse(SOURCE));
  const document = parse(source);

  assert.deepEqual(
    document.actors.map((actor) => actor.name),
    ["Client", "API", "Worker"],
  );
  assert.equal(document.items[1].type, "group");
  assert.equal(document.items[1].items.length, 2);
});

test("renames an actor and every message reference atomically", () => {
  const editor = new DiagramEditor(SOURCE);
  const actor = editor.document.actors.find(
    (candidate) => candidate.name === "API",
  );

  editor.updateActor(actor.id, {
    name: "Gateway",
    tooltip: "Public edge",
    tooltipIcon: "info",
  });

  assert.match(editor.source, /@Gateway/);
  assert.doesNotMatch(editor.source, /@API/);
  assert.match(editor.source, /Client -> Gateway: Start/);
  assert.match(editor.source, /Gateway -> Worker: Dispatch/);
  assert.match(editor.source, /  tooltip-icon info/);
  assert.equal(editor.canUndo, true);

  editor.undo();
  assert.match(editor.source, /@API/);
  editor.redo();
  assert.match(editor.source, /@Gateway/);
});

test("adds and reorders actors without changing their references", () => {
  const editor = new DiagramEditor(SOURCE);
  const id = editor.addActor(1);
  editor.updateActor(id, { name: "Queue", icon: "tray" });
  const layout = layoutDiagram(editor.document);
  editor.moveActor(id, editor.document.actors.length);

  assert.deepEqual(
    editor.document.actors.map((actor) => actor.name),
    ["Client", "API", "Worker", "Queue"],
  );
  assert.equal(
    layout.actors.find((actor) => actor.name === "Queue").id,
    id,
  );
  assert.match(editor.source, /@Queue\n  icon tray/);
});

test("adds, moves, updates, and removes timeline items", () => {
  const editor = new DiagramEditor(SOURCE);
  const messageId = editor.addItem(ROOT_CONTAINER_ID, 1, "message");
  editor.updateItem(messageId, {
    source: "Worker",
    target: "Client",
    arrow: "->x",
    label: "Delivery lost",
    tag: "failed",
    tooltip: "The receiver never acknowledged delivery",
    tooltipIcon: "warning",
  });
  editor.moveItem(messageId, ROOT_CONTAINER_ID, 4);

  const location = findItemLocation(editor.document, messageId);
  assert.equal(location.index, 3);
  assert.match(editor.source, /Worker ->x Client: Delivery lost/);
  assert.match(editor.source, /  tag failed/);
  assert.match(
    editor.source,
    /  tooltip The receiver never acknowledged delivery/,
  );
  assert.match(editor.source, /  tooltip-icon warning/);
  assert.equal(
    location.item.tooltip,
    "The receiver never acknowledged delivery",
  );
  assert.equal(location.item.tooltipIcon, "warning");

  editor.removeItem(messageId);
  assert.doesNotMatch(editor.source, /Delivery lost/);
});

test("adds an unnamed message and retargets either endpoint", () => {
  const editor = new DiagramEditor(SOURCE);
  const messageId = editor.addMessage(ROOT_CONTAINER_ID, 1, {
    source: "Client",
    target: "Worker",
  });

  assert.match(editor.source, /^Client -> Worker$/m);
  assert.equal(
    findItemLocation(editor.document, messageId).item.label,
    null,
  );

  editor.updateItem(messageId, {
    source: "API",
    target: "Client",
    label: "",
  });

  assert.match(editor.source, /^API -> Client$/m);
  assert.doesNotMatch(editor.source, /^API -> Client:/m);
  assert.doesNotThrow(() => parse(editor.source));
});

test("adds an unnamed self-message", () => {
  const editor = new DiagramEditor(SOURCE);
  const messageId = editor.addMessage(ROOT_CONTAINER_ID, 1, {
    source: "API",
    target: "API",
  });
  const message = findItemLocation(editor.document, messageId).item;

  assert.equal(message.source, "API");
  assert.equal(message.target, "API");
  assert.match(editor.source, /^API -> API$/m);
  assert.doesNotThrow(() => parse(editor.source));
});

test("reorders the only item in a nested container without dropping it", () => {
  const editor = new DiagramEditor(SOURCE);
  const firstId = editor.document.items[0].id;
  const groupId = editor.wrapItems(
    ROOT_CONTAINER_ID,
    [firstId],
    "group",
    "Single",
  );

  editor.moveItem(firstId, groupId, 1);

  assert.equal(editor.document.items[0].id, groupId);
  assert.equal(editor.document.items[0].items[0].id, firstId);
  assert.doesNotThrow(() => parse(editor.source));
});

test("wraps only contiguous sibling items and ungroups without loss", () => {
  const editor = new DiagramEditor(SOURCE);
  const ids = [editor.document.items[0].id, editor.document.items[1].id];
  const groupId = editor.wrapItems(
    ROOT_CONTAINER_ID,
    ids,
    "review",
    "Review path",
  );

  assert.equal(editor.document.items[0].id, groupId);
  assert.equal(editor.document.items[0].items.length, 2);
  editor.ungroup(groupId);
  assert.equal(editor.document.items[0].id, ids[0]);
  assert.equal(editor.document.items[1].id, ids[1]);
});

test("requires syntax-safe one-token group types", () => {
  const editor = new DiagramEditor(SOURCE);
  const group = editor.document.items[1];
  const originalSource = editor.source;

  assert.throws(
    () =>
      editor.updateItem(group.id, {
        groupType: "critical path",
      }),
    /Group type must start with a lowercase letter/,
  );
  assert.equal(editor.source, originalSource);

  const ids = [
    editor.document.items[0].id,
    editor.document.items[1].id,
  ];
  assert.throws(
    () =>
      editor.wrapItems(
        ROOT_CONTAINER_ID,
        ids,
        "review group",
        "Review path",
      ),
    /Group type must start with a lowercase letter/,
  );

  editor.updateItem(group.id, {
    groupType: "critical-path2",
  });
  assert.match(editor.source, /^critical-path2 Processing$/m);
  assert.doesNotThrow(() => parse(editor.source));
});

test("creates, edits, reorders, and removes group sections", () => {
  const editor = new DiagramEditor(SOURCE);
  const group = editor.document.items[1];
  const selectedSection = editor.convertGroupToSections(group.id);
  const addedSection = editor.addSection(group.id, 1);
  editor.updateSection(addedSection, { label: "retry" });
  editor.moveSection(addedSection, 0);

  assert.equal(editor.document.items[1].sections[0].label, "retry");
  assert.equal(editor.document.items[1].sections.length, 3);

  editor.removeSection(selectedSection);
  assert.equal(editor.document.items[1].sections.length, 2);
  assert.doesNotThrow(() => parse(editor.source));
});

test("source replacement participates in undo history", () => {
  const editor = new DiagramEditor(SOURCE);
  editor.replaceSource(`@A
@B

A -> B: Replaced
`);

  assert.match(editor.source, /A -> B: Replaced/);
  editor.undo();
  assert.match(editor.source, /Client -> API: Start/);
});
