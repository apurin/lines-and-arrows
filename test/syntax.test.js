import assert from "node:assert/strict";
import test from "node:test";

import {
  LinesAndArrowsSyntaxError,
  parse,
  serialize,
  validate,
} from "lines-and-arrows/syntax";
import { roundTripDifference } from "../src/serialize.js";

import { GROUP_TYPE_PATTERN_SOURCE } from "../src/grammar.js";

const SOURCE = `// Customer journey
@Customer
  icon user
  tooltip Starts the request\\nand reviews the result

@API
  tag public

@Worker

Customer -> API: Submit report
  tag critical

critical Process report
  API -> Worker: Start analysis
  choice Result
    | completed
      Worker --> API: Analysis complete
    | delayed
      gap 30 seconds later
      Worker ->x API: Delivery failed

API --> Customer: Present result`;

test("parses the language and writes stable, semantic source", () => {
  const document = parse(SOURCE);
  const canonical = serialize(document);

  assert.deepEqual(
    document.actors.map(({ name }) => name),
    ["Customer", "API", "Worker"],
  );
  assert.equal(document.actors[0].tooltip, "Starts the request\nand reviews the result");
  assert.equal(document.items[1].type, "group");
  assert.equal(document.items[1].body[1].body.length, 2);
  assert.equal(document.items[1].body[1].body[1].items[1].arrow, "->x");
  assert.deepEqual(parse(canonical), document);
});

test("round-trips document header comments", () => {
  const source = `// Deployment context

  // Generated for review

Client -> API: Start`;
  const document = parse(source);
  const canonical = serialize(document);

  assert.deepEqual(document.comments, [
    "Deployment context",
    "Generated for review",
  ]);
  assert.deepEqual(document.actors.map(({ name }) => name), ["Client", "API"]);
  assert.equal(
    canonical,
    "// Deployment context\n// Generated for review\n\nClient -> API: Start\n",
  );
  assert.deepEqual(parse(canonical), document);
  document.comments = ["Context\nClient -> API: Injected"];
  assert.throws(() => serialize(document), /comments\[0\].*one line/i);
});

test("places declared actors before actors inferred from the timeline", () => {
  const source = `@Database

@Audit

Client -> API: Start
choice Processing
  | store
    API -> Database: Save
  | inspect
    Worker -> Worker: Check
API --> Client: Done`;
  const document = parse(source);

  assert.deepEqual(
    document.actors.map(({ name }) => name),
    ["Database", "Audit", "Client", "API", "Worker"],
  );
  assert.equal(serialize(document), `${source}\n`);
  assert.deepEqual(parse(serialize(document)), document);
});

test("canonical source preserves every actor order with a minimal prefix", () => {
  const base = parse("A -> B: First\nC -> A: Second");
  const actorsByName = new Map(
    base.actors.map((actor) => [actor.name, actor]),
  );

  for (const [names, expectedDeclarations] of [
    [["A", "B", "C"], 0],
    [["A", "C", "B"], 2],
    [["B", "A", "C"], 1],
    [["B", "C", "A"], 2],
    [["C", "A", "B"], 1],
    [["C", "B", "A"], 2],
  ]) {
    const document = structuredClone(base);
    document.actors = names.map((name) => actorsByName.get(name));
    const source = serialize(document);

    assert.equal(
      source.split("\n").filter((line) => line.startsWith("@")).length,
      expectedDeclarations,
      names.join(", "),
    );
    assert.deepEqual(parse(source), document, names.join(", "));
  }
});

test("rejects comments after the diagram starts", () => {
  assert.deepEqual(validate("Client -> API: Start\n// Later note"), {
    valid: false,
    error: {
      message: "Comments are only allowed before the diagram.",
      line: 2,
    },
  });
});

test("reports concise syntax and document validation errors", () => {
  assert.deepEqual(
    validate(`@Client

Client -> Missing: Start`),
    { valid: true },
  );
  assert.throws(
    () => parse("Client -> API:"),
    (error) =>
      error instanceof LinesAndArrowsSyntaxError &&
      error.line === 1 &&
      /label cannot be empty/i.test(error.message),
  );
  for (const [source, message] of [
    ["review\n   A -> B", /exactly two spaces/],
    ["choice Result\n  A -> B\n  | other\n    B -> A", /cannot mix/],
    ["A -> B\n  tag one\n  tag two", /Duplicate tag property/],
  ]) {
    assert.throws(() => parse(source), message);
  }
  assert.deepEqual(validate("Client -> API: Start"), { valid: true });
  assert.throws(
    () => serialize({ actors: [], items: [] }),
    /must have type "diagram"/i,
  );
  const emptyValue = parse("A -> B: Start");
  emptyValue.items[0].label = "";
  assert.throws(() => serialize(emptyValue), /items\[0\]\.label.*empty/i);
  emptyValue.items[0].label = "Start";
  emptyValue.actors[0].tag = " ";
  assert.throws(() => serialize(emptyValue), /actors\[0\]\.tag.*empty/i);
  const missingActor = parse("A -> B: Start");
  missingActor.actors.pop();
  assert.throws(() => serialize(missingActor), /Unknown actor "B"/);
});

test("group type pattern source is valid for HTML pattern attributes", () => {
  // Browsers compile the pattern attribute as ^(?:pattern)$ with the v flag.
  const pattern = new RegExp(`^(?:${GROUP_TYPE_PATTERN_SOURCE})$`, "v");
  for (const value of ["choice", "my-type", "a1"]) {
    assert.equal(pattern.test(value), true, value);
    assert.equal(
      parse(`${value} Label\n  A -> B: Go`).items[0].groupType,
      value,
    );
  }
  for (const value of ["Gap", "-x", "a b"]) {
    assert.equal(pattern.test(value), false, value);
  }
});

test("ignores one leading byte order mark", () => {
  const source = "@Client\n  tag caller\n\nClient -> API: Start";
  const document = parse(`﻿${source}`);

  assert.deepEqual(document, parse(source));
  assert.equal(serialize(document).startsWith("﻿"), false);
  assert.deepEqual(parse("﻿// Context\ngap Later").comments, ["Context"]);
  assert.equal(
    parse("A -> B: x﻿y").items[0].label,
    "x﻿y",
  );
  assert.equal(validate("﻿﻿@Client\nClient -> API").valid, false);
});

test("names unsupported arrows and missing arrow spacing", () => {
  const supported = /Use ->, -->, or ->x; messages read from source to target/;
  for (const token of [
    "<-",
    "<--",
    "=>",
    "->>",
    "-->>",
    "-)",
    "-x",
    "<-x",
    "..>",
    "→",
  ]) {
    for (const source of [`A ${token} B: Hi`, `a ${token} b`]) {
      const result = validate(`Client -> API\n${source}`);
      assert.equal(result.valid, false, source);
      assert.equal(result.error.line, 2, source);
      assert.ok(
        result.error.message.startsWith(`Unsupported arrow "${token}". `),
        `${source}: ${result.error.message}`,
      );
      assert.match(result.error.message, supported, source);
    }
  }

  for (const [source, spaced] of [
    ["A->B", "A -> B"],
    ["Client-->API: Done", "Client --> API: Done"],
    ["Client->x Queue", "Client ->x Queue"],
    ["Client->xray", "Client -> xray"],
  ]) {
    assert.deepEqual(validate(source).error, {
      message: `Missing spaces around the arrow. Write "${spaced}".`,
      line: 1,
    });
  }
  assert.match(validate("A->>B: Hi").error.message, /^Unsupported arrow "->>"/);
  for (const [source, token] of [
    ["A -> ", "->"],
    ["client -> ", "->"],
    ["client ->", "->"],
    ["client -> : Hi", "->"],
    ["a --> ", "-->"],
    ["order service ->", "->"],
    ["Client->", "->"],
  ]) {
    assert.deepEqual(
      validate(source).error,
      { message: `A message needs a target after "${token}".`, line: 1 },
      source,
    );
  }
  assert.equal(
    validate("-> api").error.message,
    'A message needs a source before "->".',
  );
  for (const source of ["retry api-x", "retry (see -)", "Retry api-x"]) {
    assert.doesNotMatch(validate(source).error.message, /arrow/, source);
  }
});

test("hints at the equivalent of foreign keywords only after parsing fails", () => {
  for (const [source, line, message] of [
    ["participant Client\nClient -> API", 1, /^A group must contain at least one timeline item\. .*@Name/],
    ["actor Client\nClient -> API", 1, /@Name/],
    ["Client -> API\nnote over API: Busy", 2, /tooltip or tag/],
    ["Client -> API\nNote over API: Busy", 2, /^Expected a message, group, or gap\. .*tooltip or tag/],
    ["autonumber\nClient -> API", 1, /no numbering directive/],
    ["title Checkout\nClient -> API", 1, /\/\/ comment/],
    ["Client -> API\nactivate API", 2, /remove this line/],
    ["sequenceDiagram\nClient -> API", 1, /^Expected a message, group, or gap\. .*remove this line/],
    ["loop Retry\nClient -> API\nend", 1, /Indent the body by two spaces; groups end where the indentation ends/],
    ["repeat Retry\n  Client -> API\nend", 3, /groups end where the indentation ends/],
    ["choice\n  | ok\n    Client -> API\nelse\nAPI -> Client", 4, /\| sections/],
    ["alt Valid\nClient -> API", 1, /\| section/],
    ["box Backend\nClient -> API", 1, /@Name/],
    ["Client -> API\ndeactivate API", 2, /Activation bars.*remove this line/],
    ["par Fan out\nClient -> API", 1, /\| section/],
    ["opt Cached\nClient -> API", 1, /Indent the body by two spaces/],
    ["break Failed\nClient -> API", 1, /Indent the body by two spaces/],
    ["critical Commit\nClient -> API", 1, /Indent the body by two spaces/],
    ["group Setup\nClient -> API", 1, /Indent the body by two spaces/],
    ["rect Highlight\nClient -> API", 1, /Background rectangles/],
  ]) {
    const result = validate(source);
    assert.equal(result.valid, false, source);
    assert.equal(result.error.line, line, source);
    assert.match(result.error.message, message, source);
    assert.doesNotMatch(result.error.message, /^Line \d|!/, source);
  }

  for (const source of [
    "loop Retry\n  Client -> API",
    "alt Valid\n  Client -> API",
    "opt Cached\n  Client -> API",
    "par\n  | first\n    Client -> API\n  | second\n    API -> Client",
    "critical Retry A => B\n  Client -> API",
    "note Busy\n  Client -> API",
  ]) {
    assert.deepEqual(validate(source), { valid: true }, source);
  }
});

test("names unknown actor and message properties", () => {
  for (const [source, line, message] of [
    [
      "@A\n  colour red\n\nA -> B",
      2,
      'Unknown actor property "colour". Actor properties are icon, tag, tooltip, and tooltip-icon.',
    ],
    [
      "A -> B\n  tag ok\n  colour red",
      3,
      'Unknown message property "colour". Message properties are tag, tooltip, and tooltip-icon.',
    ],
    [
      "critical Work\n  A -> B\n    priority high",
      3,
      'Unknown message property "priority". Message properties are tag, tooltip, and tooltip-icon.',
    ],
    [
      "A -> B\n  Tag idempotent",
      2,
      'Unknown message property "Tag". Property names are lowercase: use "tag".',
    ],
    [
      "A -> B\n  colour api-x",
      2,
      'Unknown message property "colour". Message properties are tag, tooltip, and tooltip-icon.',
    ],
    [
      "@A\n  Icon user\nA -> B",
      2,
      'Unknown actor property "Icon". Property names are lowercase: use "icon".',
    ],
  ]) {
    assert.deepEqual(validate(source).error, { message, line }, source);
  }
});

test("keeps mis-indented timeline items as indentation errors", () => {
  for (const [source, line] of [
    ["A -> B\n  C -> D", 2],
    ["A -> B\n  Client API -> Worker: Run", 2],
    ["A -> B\n  C <- D", 2],
    ["A -> B\n  gap later", 2],
    ["A -> B\n  | branch", 2],
    ["A -> B\n  loop Retry\n    B -> C", 2],
    ["A -> B\n  optional", 2],
    ["@A\n  @B\nA -> B", 2],
    ["@A\n  A -> B", 2],
  ]) {
    assert.deepEqual(
      validate(source).error,
      { message: "Unexpected extra indentation.", line },
      source,
    );
  }
});

test("reads a line with both shapes as a group when a body follows", () => {
  const group = parse("critical Retry A -> B\n  A -> B: Try\n  B --> A: Done");
  assert.equal(group.items[0].type, "group");
  assert.equal(group.items[0].groupType, "critical");
  assert.equal(group.items[0].label, "Retry A -> B");
  assert.equal(group.items[0].body.length, 2);

  const sections = `choice A -> B
  | accepted
    A -> B: Send
  | lost
    A ->x B: Send
`;
  assert.equal(parse(sections).items[0].label, "A -> B");
  assert.equal(parse(sections).items[0].body[1].label, "lost");
  assert.equal(serialize(parse(sections)), sections);

  const nested = `review Before A -> B
  gap Later
  repeat Each A --> B
    loop Again
      A -> B
`;
  assert.equal(serialize(parse(nested)), nested);
  assert.equal(parse("critical A->B\n  A -> B").items[0].label, "A->B");
});

test("keeps one-word and property-bearing arrow lines as messages", () => {
  for (const source of ["client -> api", "client -> api: Send"]) {
    const [item] = parse(source).items;
    assert.equal(item.type, "message", source);
    assert.equal(item.source, "client", source);
  }
  assert.deepEqual(validate("client -> api\n  api -> db").error, {
    message: "Unexpected extra indentation.",
    line: 2,
  });

  const source = `order service -> api: Send
  tag idempotent
order service -> api
billing api --> order service
`;
  const document = parse(source);
  assert.deepEqual(
    document.items.map(({ type, source: from }) => [type, from]),
    [
      ["message", "order service"],
      ["message", "order service"],
      ["message", "billing api"],
    ],
  );
  assert.equal(serialize(document), source);
  assert.deepEqual(validate("order service -> api\n  tags idempotent").error, {
    message:
      'Unknown message property "tags". Message properties are tag, tooltip, and tooltip-icon.',
    line: 2,
  });

  const misindented = parse("order service -> api\n  api -> db");
  assert.equal(misindented.items[0].type, "group");
  assert.equal(misindented.items[0].label, "service -> api");
});

test("rejects groups that would be written as messages", () => {
  const document = parse("critical Retry A -> B\n  A -> B");
  document.items[0].label = "-> B";
  assert.throws(
    () => serialize(document),
    (error) =>
      error instanceof TypeError &&
      /items\[0\]\.label cannot start with an arrow/.test(error.message),
  );

  const property = parse("critical Retry A -> B\n  tagger -> B");
  property.actors[0].name = "tag line";
  property.items[0].body[0].source = "tag line";
  assert.throws(
    () => serialize(property),
    (error) =>
      error instanceof TypeError &&
      /items\[0\]\.body\[0\]/.test(error.message),
  );
});

test("rejects actor names that start with the reserved gap keyword", () => {
  for (const [source, name] of [
    ["@gap\nA -> B", "gap"],
    ["@gap service\nA -> B", "gap service"],
    ["A -> gap: Hi", "gap"],
    ["A --> gap service", "gap service"],
  ]) {
    assert.deepEqual(
      validate(source).error,
      {
        message: `Actor name "${name}" cannot start with the reserved word "gap".`,
        line: 1,
      },
      source,
    );
  }
  for (const source of ["Gap -> gapfill: Hi", "@Gap service\ngapfill -> B"]) {
    const document = parse(source);
    assert.deepEqual(parse(serialize(document)), document, source);
  }

  const renamed = parse("service -> API: Hi");
  renamed.actors[0].name = "gap service";
  renamed.items[0].source = "gap service";
  assert.throws(
    () => serialize(renamed),
    (error) =>
      error instanceof TypeError &&
      /actors\[0\]\.name.*reserved word "gap"/.test(error.message),
  );
});

test("serialize verifies that source reads back to the same document", () => {
  const padded = parse("A -> B: Hi");
  padded.items[0].arrow = " ->";
  assert.throws(
    () => serialize(padded),
    (error) =>
      error instanceof TypeError &&
      /document\.items\[0\]\.arrow/.test(error.message),
  );

  const source = `// Context
@A
  tag first

A -> B: Start
choice Result
  | done
    B --> A: Done
  | later
    gap Later
    B ->x A: Lost`;
  const reparsed = parse(source);
  const input = structuredClone(reparsed);
  input.actors.forEach((actor, index) => {
    actor.id = `actor:${index}`;
    actor.icon = undefined;
    actor.line = index + 2;
  });
  input.comments[0] = "  Context ";
  input.items[0].label = " Start\r\n";
  input.items[0].tooltip = undefined;
  input.items[1].id = "item:1";
  assert.equal(roundTripDifference(input, reparsed), null);

  for (const [change, path] of [
    [(document) => (document.comments[0] = "Other"), "document.comments[0]"],
    [(document) => document.comments.push("More"), "document.comments[1]"],
    [(document) => (document.actors[0].tag = null), "document.actors[0].tag"],
    [(document) => document.actors.reverse(), "document.actors[0].name"],
    [(document) => (document.items[0].target = "C"), "document.items[0].target"],
    [(document) => (document.items[0] = { type: "gap", label: "x" }), "document.items[0].type"],
    [(document) => (document.items[1].groupType = "repeat"), "document.items[1].groupType"],
    [(document) => (document.items[1].label = "Other"), "document.items[1].label"],
    [(document) => (document.items[1].body[1].label = "soon"), "document.items[1].body[1].label"],
    [(document) => (document.items[1].body[1].items[0].label = "Soon"), "document.items[1].body[1].items[0].label"],
    [(document) => document.items[1].body[0].items.push({ type: "gap", label: "x" }), "document.items[1].body[0].items[1]"],
    [(document) => (document.items[1].body = document.items[1].body[0].items), "document.items[1].body"],
    [(document) => document.items.pop(), "document.items[1]"],
  ]) {
    const changed = structuredClone(input);
    change(changed);
    assert.equal(roundTripDifference(changed, reparsed), path, path);
  }
});
