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

test("editor preserves mixed declared and inferred actor order", () => {
  const editor = new DiagramEditor(`@Database

Client -> API: Start
API -> Database: Store`);

  assert.deepEqual(
    editor.document.actors.map(({ name }) => name),
    ["Database", "Client", "API"],
  );
  assert.equal(
    editor.source,
    "@Database\n\nClient -> API: Start\nAPI -> Database: Store\n",
  );

  const client = editor.document.actors.find(({ name }) => name === "Client");
  editor.updateActor(client.id, { tag: "caller" });
  assert.deepEqual(
    editor.document.actors.map(({ name }) => name),
    ["Database", "Client", "API"],
  );
  assert.match(editor.source, /@Client\n  tag caller/);
  assert.doesNotMatch(editor.source, /@API/);
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

test("removals that would empty the timeline are refused with a reason", () => {
  const keepOne = /^A diagram must keep at least one message or gap\.$/;
  const refuses = (source, command, expected = keepOne) => {
    const editor = new DiagramEditor(source);
    const before = editor.document;
    assert.throws(
      () => command(editor),
      (error) =>
        error.constructor === Error &&
        expected.test(error.message) &&
        !/Line \d/.test(error.message),
    );
    assert.equal(editor.document, before);
    assert.equal(editor.canUndo, false);
  };

  refuses("A -> B: Start", (editor) =>
    editor.removeItem(editor.document.items[0].id),
  );
  refuses("gap Later", (editor) =>
    editor.removeItem(editor.document.items[0].id),
  );
  refuses("A -> B: Start\nA -> B: Done", (editor) =>
    editor.removeItems(editor.document.items.map(({ id }) => id)),
  );
  refuses("opt Retry\n  A -> B: Start", (editor) =>
    editor.removeItem(editor.document.items[0].body[0].id),
  );
  refuses(
    "A -> B: Start\nopt Retry\n  B -> A: Done",
    (editor) => editor.removeActor(editor.document.actors[0].id),
    /^Removing actor "A" would also remove every message; a diagram must keep at least one message or gap\.$/,
  );

  const editor = new DiagramEditor("A -> B: Start\ngap Later");
  editor.removeActor(editor.document.actors[0].id);
  assert.equal(editor.source, "@B\n\ngap Later\n");
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

test("group labels cannot start with an arrow", () => {
  const editor = new DiagramEditor(SOURCE);
  const beforeDocument = editor.document;
  const group = editor.document.items.find(({ type }) => type === "group");
  const message = "A group label cannot start with an arrow.";

  assert.throws(
    () => editor.updateItem(group.id, { label: "-> retry" }),
    (error) => error.message === message,
  );
  assert.throws(
    () =>
      editor.wrapItems(
        ROOT_CONTAINER_ID,
        [editor.document.items[0].id],
        "retry",
        " --> API",
      ),
    (error) => error.message === message,
  );
  assert.equal(editor.document, beforeDocument);
  assert.equal(editor.canUndo, false);

  editor.updateItem(group.id, { label: "Retry API -> Worker" });
  assert.match(editor.source, /^critical Retry API -> Worker$/m);
  editor.updateItem(group.id, { label: "->" });
  assert.match(editor.source, /^critical ->$/m);
});

test("actor renames reject the reserved gap keyword", () => {
  const editor = new DiagramEditor(SOURCE);
  const beforeDocument = editor.document;
  const api = editor.document.actors.find(({ name }) => name === "API");

  for (const name of ["gap", "gap service", "  gap  "]) {
    assert.throws(
      () => editor.updateActor(api.id, { name }),
      (error) =>
        error.message ===
        `Actor name "${name.trim()}" cannot start with the reserved word "gap".`,
      name,
    );
  }
  assert.throws(
    () => editor.updateActor(api.id, { name: "API: public" }),
    /^Error: Invalid actor name "API: public"\.$/,
  );
  assert.equal(editor.document, beforeDocument);
  assert.equal(editor.canUndo, false);

  editor.updateActor(api.id, { name: "gapfill" });
  assert.match(editor.source, /^Client -> gapfill: Start$/m);
  editor.updateActor(api.id, { name: "Gap" });
  assert.match(editor.source, /^Client -> Gap: Start$/m);
});

test("added messages reuse neighboring endpoints or the first actors", () => {
  const editor = new DiagramEditor(SOURCE);
  const added = (parentId, index) => {
    const id = editor.addItem(parentId, index, "message");
    const { item } = findItemLocation(editor.document, id);
    return [item.source, item.target, item.arrow, item.label];
  };
  const group = editor.document.items.find(({ type }) => type === "group");

  // Below "Client -> API: Start": the message above wins.
  assert.deepEqual(added(ROOT_CONTAINER_ID, 1), ["Client", "API", "->", null]);
  // At the top of the group body only the message below is adjacent.
  assert.deepEqual(added(group.id, 0), ["API", "Worker", "->", null]);
  // Between "Worker --> API" and the end of the group body.
  assert.deepEqual(added(group.id, 3), ["Worker", "API", "->", null]);

  // Gaps on both sides: no adjacent message, so the first two actors.
  const noNeighbor = new DiagramEditor(
    "@A\n@B\n@C\n\nA -> C: Start\ngap Later\ngap Much later\nC -> B: Next",
  );
  const id = noNeighbor.addItem(ROOT_CONTAINER_ID, 2, "message");
  const { item, index } = findItemLocation(noNeighbor.document, id);
  assert.equal(index, 2);
  assert.deepEqual([item.source, item.target], ["A", "B"]);

  const single = new DiagramEditor("@Solo\n\ngap Later");
  single.addItem(ROOT_CONTAINER_ID, 1, "message");
  assert.equal(single.source, "gap Later\nSolo -> Solo\n");
});
