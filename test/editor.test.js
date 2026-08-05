import test from "node:test";
import assert from "node:assert/strict";

import {
  DiagramEditor,
  ROOT_CONTAINER_ID,
  ensureDocumentIds,
  findItemLocation,
} from "../src/editor.js";
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
  editor.moveActor(id, editor.document.actors.length);

  assert.deepEqual(
    editor.document.actors.map((actor) => actor.name),
    ["Client", "API", "Worker", "Queue"],
  );
  assert.equal(editor.document.actors.at(-1).id, id);
  assert.match(editor.source, /@Queue\n  icon tray/);
  assert.doesNotMatch(JSON.stringify(editor.document), /"line"/);
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

  assert.throws(
    () =>
      editor.updateItem(group.id, {
        groupType: "gap",
      }),
    /Group type must start with a lowercase letter/,
  );
});

test("clears group labels and wraps items without a label", () => {
  const editor = new DiagramEditor(SOURCE);
  const group = editor.document.items[1];

  editor.updateItem(group.id, { label: "" });

  assert.equal(editor.document.items[1].label, null);
  assert.match(editor.source, /^critical$/m);
  assert.doesNotMatch(editor.source, /^critical\s+$/m);
  assert.doesNotThrow(() => parse(editor.source));

  editor.undo();
  assert.equal(editor.document.items[1].label, "Processing");
  editor.redo();
  assert.equal(editor.document.items[1].label, null);

  const wrapperEditor = new DiagramEditor(SOURCE);
  const first = wrapperEditor.document.items[0];
  const wrapperId = wrapperEditor.wrapItems(
    ROOT_CONTAINER_ID,
    [first.id],
    "review",
    null,
  );

  assert.equal(wrapperEditor.document.items[0].id, wrapperId);
  assert.equal(wrapperEditor.document.items[0].label, null);
  assert.match(wrapperEditor.source, /^review$/m);
  assert.doesNotThrow(() => parse(wrapperEditor.source));
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

test("preserves timeline order when removing a non-final section", () => {
  const createEditor = () =>
    new DiagramEditor(`@A
@B

choice Result
  | first
    A -> B: First
  | second
    B -> A: Second
  | third
    A -> B: Third
`);
  const labels = (editor) =>
    editor.document.items[0].sections.flatMap((section) =>
      section.items.map((item) => item.label),
    );

  const firstEditor = createEditor();
  firstEditor.removeSection(
    firstEditor.document.items[0].sections[0].id,
  );
  assert.deepEqual(labels(firstEditor), ["First", "Second", "Third"]);

  const middleEditor = createEditor();
  middleEditor.removeSection(
    middleEditor.document.items[0].sections[1].id,
  );
  assert.deepEqual(labels(middleEditor), ["First", "Second", "Third"]);
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

test("encodes multiline edits without creating timeline items", () => {
  const editor = new DiagramEditor(SOURCE);
  const message = editor.document.items[0];
  const originalItemCount = editor.document.items.length;

  editor.updateItem(message.id, {
    label: "Changed\nAPI -> Client: not another item",
    tooltip: "First line\nStored at C:\\work",
  });

  assert.equal(editor.document.items.length, originalItemCount);
  assert.match(
    editor.source,
    /Changed\\nAPI -> Client: not another item/,
  );
  assert.match(editor.source, /First line\\nStored at C:\\\\work/);

  const reparsed = parse(editor.source);
  assert.equal(reparsed.items.length, originalItemCount);
  assert.equal(
    reparsed.items[0].label,
    "Changed\nAPI -> Client: not another item",
  );
  assert.equal(
    reparsed.items[0].tooltip,
    "First line\nStored at C:\\work",
  );
});

test("rejects multiline edits for identity and compact fields", () => {
  const editor = new DiagramEditor(SOURCE);
  const actor = editor.document.actors[0];
  const message = editor.document.items[0];

  assert.throws(
    () => editor.updateActor(actor.id, { name: "Client\nAdmin" }),
    /must stay on one line/,
  );
  assert.throws(
    () => editor.updateItem(message.id, { tag: "first\nsecond" }),
    /must stay on one line/,
  );
});

test("allocates collision-free IDs within each editor session", () => {
  const document = parse(`@A
@B

choice Outcome
  | first
    A -> B: Existing
`);
  document.actors[0].id = "actor:edit-1";
  document.actors[1].id = "actor:custom";
  document.items[0].id = "item:edit-1";
  document.items[0].sections[0].id = "section:edit-1";

  const editor = new DiagramEditor(document);

  assert.equal(editor.addActor(), "actor:edit-2");
  assert.equal(
    editor.addMessage(ROOT_CONTAINER_ID, editor.document.items.length, {
      source: "A",
      target: "B",
    }),
    "item:edit-2",
  );
  assert.equal(
    editor.addSection(editor.document.items[0].id),
    "section:edit-2",
  );
});

test("does not reuse generated IDs across deletion or history", () => {
  const editor = new DiagramEditor(SOURCE);
  const firstId = editor.addActor();

  editor.removeActor(firstId);
  editor.undo();
  assert.equal(editor.document.actors.at(-1).id, firstId);
  editor.redo();

  const secondId = editor.addActor();
  assert.notEqual(secondId, firstId);
});

test("rejects duplicate or reserved IDs at the editor boundary", () => {
  const duplicate = parse(SOURCE);
  duplicate.actors[0].id = duplicate.items[0].id;

  assert.throws(
    () => new DiagramEditor(duplicate),
    /Duplicate document ID "item:0"/,
  );

  const reserved = parse(SOURCE);
  reserved.actors[0].id = ROOT_CONTAINER_ID;
  assert.throws(
    () => new DiagramEditor(reserved),
    /Document ID "root" is reserved/,
  );
});

test("owns recursively immutable document snapshots", () => {
  const editor = new DiagramEditor(SOURCE);
  const first = editor.document;
  const originalName = first.actors[0].name;

  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.actors), true);
  assert.equal(Object.isFrozen(first.items[1].items), true);
  assert.throws(() => {
    first.actors[0].name = "Changed outside a command";
  }, TypeError);
  assert.throws(() => {
    first.items.push(first.items[0]);
  }, TypeError);
  assert.equal(editor.source.includes(originalName), true);

  editor.updateActor(first.actors[0].id, { name: "Browser" });
  assert.notEqual(editor.document, first);
  assert.equal(first.actors[0].name, originalName);
  assert.equal(editor.document.actors[0].name, "Browser");

  editor.undo();
  assert.equal(editor.document, first);
});

test("adds IDs without mutating a caller-owned document", () => {
  const input = parse(SOURCE);
  const result = ensureDocumentIds(input);

  assert.equal(input.actors[0].id, undefined);
  assert.equal(typeof result.actors[0].id, "string");
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.actors[0]), true);
});

test("rejects ambiguous or invalid programmatic documents", () => {
  const mixed = parse(SOURCE);
  const group = mixed.items[1];
  group.sections = [
    {
      type: "section",
      id: "section:custom",
      label: "alternative",
      items: [structuredClone(group.items[0])],
    },
  ];

  assert.throws(
    () => serialize(mixed),
    /cannot contain both direct items and sections/,
  );
  assert.throws(
    () => new DiagramEditor(mixed),
    /cannot contain both direct items and sections/,
  );

  const invalidReference = parse(SOURCE);
  invalidReference.items[0].target = "Missing actor";
  assert.throws(
    () => serialize(invalidReference),
    /Unknown actor "Missing actor"/,
  );

  const invalidGroupType = parse(SOURCE);
  invalidGroupType.items[1].groupType = "critical path";
  assert.throws(
    () => serialize(invalidGroupType),
    /groupType must start with a lowercase letter/,
  );
  invalidGroupType.items[1].groupType = "gap";
  assert.throws(
    () => serialize(invalidGroupType),
    /reserved "gap" keyword/,
  );

  const implicit = parse("A -> B\nB --> A");
  implicit.actors.reverse();
  assert.throws(
    () => serialize(implicit),
    /must exactly match first-use actor order/,
  );

  const implicitWithMetadata = parse("A -> B");
  implicitWithMetadata.actors[0].tag = "external";
  assert.throws(
    () => serialize(implicitWithMetadata),
    /set document\.explicitActors to true/,
  );

  const emptyExplicit = parse("A -> B");
  emptyExplicit.explicitActors = true;
  emptyExplicit.actors = [];
  assert.throws(
    () => serialize(emptyExplicit),
    /must contain at least one actor/,
  );

  const missingFlag = parse("A -> B");
  delete missingFlag.explicitActors;
  assert.throws(
    () => serialize(missingFlag),
    /explicitActors must be a boolean/,
  );

  const excessiveNesting = parse("A -> B");
  let nested = excessiveNesting.items[0];
  for (let depth = 0; depth < 129; depth += 1) {
    nested = {
      type: "group",
      groupType: "review",
      label: null,
      items: [nested],
      sections: [],
      leadingComments: [],
      bodyTrailingComments: [],
    };
  }
  excessiveNesting.items = [nested];
  assert.throws(
    () => serialize(excessiveNesting),
    /maximum group nesting depth of 128/,
  );
});

test("moves comments with their structural owner and deletes them together", () => {
  const editor = new DiagramEditor(`@A
@B

// first note
A -> B: First
// second note
B --> A: Second
`);
  const first = editor.document.items[0];
  const second = editor.document.items[1];

  editor.moveItem(second.id, ROOT_CONTAINER_ID, 0);
  assert.match(
    editor.source,
    /\/\/ second note\nB --> A: Second\n\/\/ first note\nA -> B: First/,
  );

  editor.removeItem(second.id);
  assert.doesNotMatch(editor.source, /second note|Second/);
  assert.match(editor.source, /\/\/ first note\nA -> B: First/);

  const groupId = editor.wrapItems(
    ROOT_CONTAINER_ID,
    [first.id],
    "review",
    "Grouped",
  );
  assert.match(
    editor.source,
    /review Grouped\n  \/\/ first note\n  A -> B: First/,
  );

  editor.ungroup(groupId);
  assert.match(editor.source, /\/\/ first note\nA -> B: First/);
});

test("discarding a wrapper discards only wrapper-owned comments", () => {
  const editor = new DiagramEditor(`@A
@B

// group note
review Grouped
  // child note
  A -> B: First
  // group tail
`);
  const group = editor.document.items[0];

  editor.ungroup(group.id);

  assert.doesNotMatch(editor.source, /group note|group tail/);
  assert.match(editor.source, /\/\/ child note\nA -> B: First/);
});
