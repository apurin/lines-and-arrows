import assert from "node:assert/strict";
import test from "node:test";

import {
  ROOT_CONTAINER_ID,
  findItemLocation,
  visitMessages,
} from "../src/document.js";
import { DiagramEditor } from "../src/editor.js";

const SOURCE = `// Request workflow

@Client
@API
@Worker

Client -> API: Start
critical Processing
  API -> Worker: Dispatch
  Worker --> API: Complete
API --> Client: Done`;

test("editor snapshots are immutable, canonical, and undoable", () => {
  const editor = new DiagramEditor(SOURCE);
  const originalDocument = editor.document;
  const originalSource = editor.source;
  const actor = editor.document.actors.find(({ name }) => name === "API");

  assert.ok(Object.isFrozen(editor.document));
  assert.ok(Object.isFrozen(editor.document.items));
  editor.updateActor(actor.id, {
    name: "Gateway",
    tag: "public",
    tooltip: "Public edge",
  });

  assert.notEqual(editor.document, originalDocument);
  assert.match(editor.source, /Client -> Gateway: Start/);
  assert.match(editor.source, /Gateway -> Worker: Dispatch/);
  assert.match(editor.source, /  tooltip Public edge/);
  assert.deepEqual(editor.document.comments, ["Request workflow"]);
  assert.equal(editor.canUndo, true);
  assert.equal(editor.undo(), true);
  assert.equal(editor.document, originalDocument);
  assert.equal(editor.source, originalSource);
  assert.equal(editor.redo(), true);
  assert.match(editor.source, /@Gateway/);
  assert.doesNotMatch(editor.source, /(?:actor|item|section):/);
});

test("timeline commands preserve structure through grouping and sections", () => {
  const editor = new DiagramEditor(SOURCE);
  const messageId = editor.addMessage(ROOT_CONTAINER_ID, 1, {
    source: "Worker",
    target: "Client",
    arrow: "->x",
    label: "Delivery failed",
  });
  editor.moveItem(messageId, ROOT_CONTAINER_ID, 4);

  const firstTwo = editor.document.items.slice(0, 2).map(({ id }) => id);
  const groupId = editor.wrapItems(ROOT_CONTAINER_ID, firstTwo, "review", "Path");
  const sectionId = editor.convertGroupToSections(groupId);
  editor.updateSection(sectionId, { label: "fallback" });
  const addedSectionId = editor.addSection(groupId, 1);
  editor.moveSection(addedSectionId, 0);

  const group = findItemLocation(editor.document, groupId).item;
  assert.equal(group.type, "group");
  assert.equal(group.body[0].id, addedSectionId);
  assert.equal(
    group.body.find(({ id }) => id === sectionId).label,
    "fallback",
  );
  assert.match(editor.source, /Worker ->x Client: Delivery failed/);

  const messagesBeforeRemoval = [];
  visitMessages(editor.document.items, (message) => {
    messagesBeforeRemoval.push(message.id);
  });
  editor.removeSection(addedSectionId);
  const messagesAfterRemoval = [];
  visitMessages(editor.document.items, (message) => {
    messagesAfterRemoval.push(message.id);
  });
  assert.deepEqual(messagesAfterRemoval, messagesBeforeRemoval);

  editor.ungroup(groupId);
  assert.doesNotMatch(editor.source, /^review Path$/m);
});

test("actor removal deletes references and empty wrappers", () => {
  const editor = new DiagramEditor(SOURCE);
  const worker = editor.document.actors.find(({ name }) => name === "Worker");

  editor.removeActor(worker.id);

  assert.deepEqual(editor.document.actors.map(({ name }) => name), ["Client", "API"]);
  assert.doesNotMatch(editor.source, /Worker|critical Processing/);
  assert.match(editor.source, /Client -> API: Start/);
  assert.match(editor.source, /API --> Client: Done/);
});

test("invalid commands leave the current snapshot and history unchanged", () => {
  const editor = new DiagramEditor(SOURCE);
  const beforeDocument = editor.document;
  const api = editor.document.actors.find(({ name }) => name === "API");

  assert.throws(() => editor.updateActor(api.id, { name: "Client" }), /already exists/);
  assert.equal(editor.document, beforeDocument);
  assert.equal(editor.canUndo, false);

  const group = editor.document.items.find(({ type }) => type === "group");
  assert.throws(() => editor.moveItem(group.id, group.id, 0), /cannot be moved into itself/);
  assert.equal(editor.document, beforeDocument);
  assert.equal(editor.canUndo, false);
});
