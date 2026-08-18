import assert from "node:assert/strict";
import test from "node:test";

import {
  ROOT_CONTAINER_ID,
  findItemLocation,
  visitMessages,
} from "../src/document.js";
import { DiagramEditor } from "../src/editor.js";
import { parse } from "../src/parser.js";

const SOURCE = `@Client
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
  assert.equal(group.sections[0].id, addedSectionId);
  assert.equal(
    group.sections.find(({ id }) => id === sectionId).label,
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

test("comments move and disappear with their timeline item", () => {
  const editor = new DiagramEditor(`@A
@B

// first note
A -> B: First
// second note
B --> A: Second`);
  const secondId = editor.document.items[1].id;

  editor.moveItem(secondId, ROOT_CONTAINER_ID, 0);
  assert.equal(editor.document.items[0].leadingComments[0].text, "second note");
  assert.match(editor.source, /\/\/ second note\nB --> A: Second/);

  editor.removeItem(secondId);
  assert.doesNotMatch(editor.source, /second note|Second/);
  assert.match(editor.source, /\/\/ first note\nA -> B: First/);
});
