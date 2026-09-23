import assert from "node:assert/strict";
import test from "node:test";

import {
  LinesAndArrowsSyntaxError,
  parse,
  serialize,
  validate,
} from "lines-and-arrows/syntax";

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

