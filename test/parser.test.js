import test from "node:test";
import assert from "node:assert/strict";

import {
  LinesAndArrowsSyntaxError,
  parse,
  serialize,
} from "lines-and-arrows/syntax";

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
  parallel
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

test("parses the complete language sample", () => {
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
  assert.equal(document.items[1].items[1].label, null);
  assert.equal(document.items[1].items[1].sections.length, 2);
  assert.equal(document.items[1].items[2].type, "gap");
  assert.equal(
    document.items[1].items[3].sections[1].items[0].arrow,
    "->x",
  );
});

test("round-trips labeled and unlabeled nested groups", () => {
  const direct = parse(`review
  A -> B`);
  assert.equal(direct.items[0].groupType, "review");
  assert.equal(direct.items[0].label, null);
  assert.match(serialize(direct), /^review$/m);

  const source = `critical Process report
  API -> Worker: Start analysis
  parallel
    | validate input
      Worker -> Worker: Check evidence
    | persist event
      Worker -> Queue: Store audit event`;

  const document = parse(source);
  const nested = document.items[0].items[1];

  assert.equal(document.items[0].label, "Process report");
  assert.equal(nested.groupType, "parallel");
  assert.equal(nested.label, null);
  assert.equal(nested.sections.length, 2);

  const canonical = serialize(document);
  assert.match(canonical, /^  parallel$/m);
  assert.doesNotMatch(canonical, /^  parallel\s+$/m);
  assert.deepEqual(parse(canonical), document);
});

test("accepts compact syntax variants", () => {
  const cases = [
    {
      name: "implicit actors, unnamed and self messages, and every arrow",
      source: `Client -> Client
Client --> API: Accepted
API ->x Queue`,
      check(document) {
        assert.equal(document.explicitActors, false);
        assert.deepEqual(
          document.actors.map((actor) => actor.name),
          ["Client", "API", "Queue"],
        );
        assert.deepEqual(
          document.items.map((item) => item.arrow),
          ["->", "-->", "->x"],
        );
        assert.deepEqual(
          document.items.map((item) => item.label),
          [null, "Accepted", null],
        );
        assert.equal(document.items[0].source, "Client");
        assert.equal(document.items[0].target, "Client");
      },
    },
    {
      name: "Unicode, open identifiers, URLs, and additional colons",
      source: String.raw`@Cliente Ñ
  icon vendor-person-v9
  tooltip Première ligne\n次の行
  tooltip-icon vendor-info-v2

@API

workflow-v2 Résultat: prêt
  Cliente Ñ -> API: https://example.test/jobs/1:a?next=b:c`,
      check(document) {
        assert.equal(document.actors[0].icon, "vendor-person-v9");
        assert.equal(document.actors[0].tooltip, "Première ligne\n次の行");
        assert.equal(document.items[0].groupType, "workflow-v2");
        assert.equal(document.items[0].label, "Résultat: prêt");
        assert.equal(
          document.items[0].items[0].label,
          "https://example.test/jobs/1:a?next=b:c",
        );
      },
    },
    {
      name: "CRLF and whitespace-only blank lines",
      source: "@A\r\n@B\r\n \t \r\nA -> B\r\n",
      check(document) {
        assert.equal(document.items.length, 1);
        assert.deepEqual(
          document.actors.map((actor) => actor.name),
          ["A", "B"],
        );
      },
    },
  ];

  for (const { name, source, check } of cases) {
    const document = parse(source);
    assert.doesNotThrow(() => check(document), name);
  }
});

test("rejects malformed or ambiguous source with structured locations", () => {
  const cases = [
    {
      name: "tab indentation",
      source: "A -> B\n\tB -> A",
      message: /Tabs are not allowed/,
      line: 2,
    },
    {
      name: "odd indentation",
      source: "review Work\n   A -> B",
      message: /exactly two spaces/,
      line: 2,
    },
    {
      name: "skipped indentation",
      source: "review Work\n    A -> B",
      message: /indented by one level/,
      line: 2,
    },
    {
      name: "duplicate actors",
      source: "@A\n@A\n\nA -> A",
      message: /Duplicate actor "A"/,
      line: 2,
    },
    {
      name: "duplicate actor property",
      source: "@A\n  icon one\n  icon two\n\nA -> A",
      message: /Duplicate icon property/,
      line: 3,
    },
    {
      name: "duplicate message property",
      source: "A -> B\n  tooltip one\n  tooltip two",
      message: /Duplicate tooltip property/,
      line: 3,
    },
    {
      name: "empty actor",
      source: "@\n\nA -> A",
      message: /Actor name cannot be empty/,
      line: 1,
    },
    {
      name: "empty timeline",
      source: "@A\n@B",
      message: /diagram must contain at least one timeline item/i,
      line: 1,
    },
    {
      name: "empty explicit message label",
      source: "A -> B:",
      message: /Message label cannot be empty/,
      line: 1,
    },
    {
      name: "empty unlabeled group body",
      source: "review",
      message: /group must contain at least one timeline item/i,
      line: 1,
    },
    {
      name: "empty section label",
      source: "choice Result\n  |\n    A -> B",
      message: /Section label cannot be empty/,
      line: 2,
    },
    {
      name: "empty section body",
      source: "choice Result\n  | accepted",
      message: /section must contain at least one timeline item/i,
      line: 2,
    },
    {
      name: "empty gap",
      source: "gap",
      message: /Gap text cannot be empty/,
      line: 1,
    },
    {
      name: "empty actor property",
      source: "@A\n  tag\n\nA -> A",
      message: /tag value cannot be empty/,
      line: 2,
    },
    {
      name: "empty message property",
      source: "A -> B\n  tooltip ",
      message: /tooltip value cannot be empty/,
      line: 2,
    },
    {
      name: "actor declared after timeline",
      source: "A -> B\n@C",
      message: /Actor declarations must appear before the timeline/,
      line: 2,
    },
    {
      name: "unknown actor with explicit declarations",
      source: "@A\n@B\n\nA -> Missing",
      message: /Unknown actor "Missing"/,
      line: 4,
    },
    {
      name: "unsupported fat arrow",
      source: "A => B",
      message: /Expected a message, group, or gap/,
      line: 1,
    },
    {
      name: "unsupported reverse arrow",
      source: "A <- B",
      message: /Expected a message, group, or gap/,
      line: 1,
    },
    {
      name: "malformed long arrow",
      source: "A ---> B",
      message: /Unsupported or malformed arrow expression/,
      line: 1,
    },
    {
      name: "unsupported alternate arrowhead",
      source: "A ->> B",
      message: /Unsupported or malformed arrow expression/,
      line: 1,
    },
    {
      name: "unsupported tilde arrow",
      source: "A ~> B",
      message: /Expected a message, group, or gap/,
      line: 1,
    },
    {
      name: "sections followed by direct items",
      source: `choice Result
  | accepted
    A -> B
  B -> A`,
      message: /cannot mix direct timeline items and sections/,
      line: 4,
    },
    {
      name: "direct items followed by sections",
      source: `choice Result
  A -> B
  | accepted
    B -> A`,
      message: /cannot mix direct timeline items and sections/,
      line: 3,
    },
    {
      name: "missing section separator space",
      source: `choice Result
  |accepted
    A -> B`,
      message: /must be separated from "\|" by a space/,
      line: 2,
    },
    {
      name: "gap used as a group type",
      source: `gap Wrapper
  A -> B`,
      message: /reserved "gap" keyword cannot introduce a group body/,
      line: 1,
    },
  ];

  for (const { name, source, message, line } of cases) {
    let thrown = null;
    try {
      parse(source);
    } catch (error) {
      thrown = error;
    }

    assert.ok(
      thrown instanceof LinesAndArrowsSyntaxError,
      `${name}: expected LinesAndArrowsSyntaxError`,
    );
    assert.match(thrown.message, message, name);
    assert.equal(thrown.line, line, name);
  }
});

test("keeps source locations in errors rather than parsed documents", () => {
  const document = parse(COMPLETE_SOURCE);

  assert.doesNotMatch(JSON.stringify(document), /"line"/);
  assert.throws(
    () => parse("Client -> API:\n"),
    (error) =>
      error instanceof LinesAndArrowsSyntaxError &&
      error.line === 1,
  );
});

test("returns a structured error before deeply nested input exhausts the stack", () => {
  const source = [
    ...Array.from(
      { length: 129 },
      (_, depth) => `${"  ".repeat(depth)}review`,
    ),
    `${"  ".repeat(129)}A -> B`,
  ].join("\n");

  assert.throws(
    () => parse(source),
    (error) =>
      error instanceof LinesAndArrowsSyntaxError &&
      error.line === 130 &&
      /cannot exceed 128 indentation levels/.test(error.message),
  );
});

test("exposes the documented syntax error constructor", () => {
  const error = new LinesAndArrowsSyntaxError("Broken", 7);

  assert.equal(error.line, 7);
  assert.equal(error.message, "Line 7: Broken");
});

test("round-trips escaped multiline text and literal backslashes", () => {
  const source = String.raw`@Client
  tooltip First line\nSecond line at C:\\work

@API

choice First decision\nwith context
  | accepted\nimmediately
    Client -> API: Submit report\nand evidence
      tooltip Preserve C:\\evidence\nuntil review
  | delayed
    gap Next day\n09:00
    API --> Client: Complete`;
  const document = parse(source);
  const group = document.items[0];
  const message = group.sections[0].items[0];
  const gap = group.sections[1].items[0];

  assert.equal(
    document.actors[0].tooltip,
    "First line\nSecond line at C:\\work",
  );
  assert.equal(group.label, "First decision\nwith context");
  assert.equal(group.sections[0].label, "accepted\nimmediately");
  assert.equal(message.label, "Submit report\nand evidence");
  assert.equal(
    message.tooltip,
    "Preserve C:\\evidence\nuntil review",
  );
  assert.equal(gap.label, "Next day\n09:00");

  const canonical = serialize(document);
  assert.match(canonical, /Submit report\\nand evidence/);
  assert.match(canonical, /C:\\\\evidence\\nuntil review/);
  const reparsed = parse(canonical);
  assert.deepEqual(reparsed, document);
  assert.equal(serialize(reparsed), canonical);
});

test("keeps identity and compact metadata fields single-line", () => {
  for (const source of [
    String.raw`@Client\nAdmin

Client -> Client: Start`,
    String.raw`@Client
  tag first\nsecond

Client -> Client: Start`,
    String.raw`@Client
  icon user\nadmin

Client -> Client: Start`,
    String.raw`@Client
  tooltip detail
  tooltip-icon info\nwarning

Client -> Client: Start`,
  ]) {
    assert.throws(() => parse(source), /must stay on one line/);
  }
});

test("round-trips comments with structural placement and indentation", () => {
  const source = `  // document leading
@A
  // before icon
  icon user
    // after icon
// before actor
@B
  // actor property tail

// before message
A -> B: Start
  // before tag
  tag important
    // message property tail
choice Outcome
  // before first section
  | accepted
    // before nested message
    B --> A: Done
    // section trailing
  // before second section
  | rejected
    A ->x B
    // second section trailing
  // group trailing
// before gap
gap Later
  // document trailing`;

  const document = parse(source);
  const firstActor = document.actors[0];
  const message = document.items[0];
  const group = document.items[1];

  assert.equal(document.comments, undefined);
  assert.deepEqual(document.leadingComments, [
    { type: "comment", text: "document leading", indent: 1 },
  ]);
  assert.deepEqual(firstActor.propertyComments, [
    {
      type: "comment",
      text: "before icon",
      indent: 1,
      after: "header",
    },
    {
      type: "comment",
      text: "after icon",
      indent: 2,
      after: "icon",
    },
  ]);
  assert.equal(document.actors[1].leadingComments[0].text, "before actor");
  assert.equal(message.leadingComments[0].text, "before message");
  assert.equal(message.propertyComments[1].after, "tag");
  assert.equal(group.sections[0].leadingComments[0].text, "before first section");
  assert.equal(
    group.sections[0].items[0].leadingComments[0].text,
    "before nested message",
  );
  assert.equal(
    group.sections[0].bodyTrailingComments[0].text,
    "section trailing",
  );
  assert.equal(group.bodyTrailingComments[0].text, "group trailing");
  assert.equal(document.trailingComments[0].text, "document trailing");

  const canonical = serialize(document);
  const reparsed = parse(canonical);
  assert.deepEqual(reparsed, document);
  assert.equal(serialize(reparsed), canonical);
  assert.match(canonical, /^  \/\/ document leading$/m);
  assert.match(canonical, /^    \/\/ after icon$/m);
  assert.match(canonical, /^  \/\/ group trailing$/m);
});

test("assigns unique ephemeral structural IDs without serializing them", () => {
  const document = parse(COMPLETE_SOURCE);
  const ids = [];

  function collect(items) {
    for (const item of items) {
      ids.push(item.id);
      if (item.type !== "group") {
        continue;
      }
      if (item.sections.length > 0) {
        for (const section of item.sections) {
          ids.push(section.id);
          collect(section.items);
        }
      } else {
        collect(item.items);
      }
    }
  }

  collect(document.items);

  assert.ok(ids.length > 0);
  assert.equal(ids.every((id) => typeof id === "string"), true);
  assert.equal(new Set(ids).size, ids.length);

  const canonical = serialize(document);
  for (const id of ids) {
    assert.equal(canonical.includes(id), false);
  }
});
