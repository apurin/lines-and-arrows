import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  LinesAndArrowsSyntaxError,
  parse,
  serialize,
  validate,
} from "lines-and-arrows/syntax";

const CLI = fileURLToPath(new URL("../bin/lines-and-arrows.js", import.meta.url));
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

  assert.equal(document.explicitActors, true);
  assert.deepEqual(
    document.actors.map(({ name }) => name),
    ["Customer", "API", "Worker"],
  );
  assert.equal(document.actors[0].tooltip, "Starts the request\nand reviews the result");
  assert.equal(document.items[1].type, "group");
  assert.equal(document.items[1].items[1].sections.length, 2);
  assert.equal(document.items[1].items[1].sections[1].items[1].arrow, "->x");
  assert.deepEqual(parse(canonical), document);
});

test("infers actors and preserves comments with their constructs", () => {
  const source = `// before message
Client -> API: Start
  // message detail
  tooltip First line\\nSecond line

// before group
review Work
  // inside group
  API --> Client`;
  const document = parse(source);
  const canonical = serialize(document);

  assert.equal(document.explicitActors, false);
  assert.deepEqual(document.actors.map(({ name }) => name), ["Client", "API"]);
  assert.equal(document.leadingComments[0].text, "before message");
  assert.equal(document.items[0].propertyComments[0].text, "message detail");
  assert.equal(document.items[1].leadingComments[0].text, "before group");
  assert.equal(document.items[1].items[0].leadingComments[0].text, "inside group");
  assert.deepEqual(parse(canonical), document);
});

test("reports concise syntax and document validation errors", () => {
  const result = validate(`@Client

Client -> Missing: Start`);

  assert.deepEqual(result, {
    valid: false,
    error: {
      message: 'Unknown actor "Missing".',
      line: 3,
    },
  });
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
});

test("validates files and stdin through the verb-less CLI", () => {
  const valid = spawnSync(process.execPath, [CLI, "--json", "-"], {
    encoding: "utf8",
    input: "Client -> API: Start",
  });
  const invalid = spawnSync(process.execPath, [CLI, "--json", "-"], {
    encoding: "utf8",
    input: "Client -> API:",
  });
  const path = join(tmpdir(), `lines-and-arrows-${process.pid}.txt`);
  writeFileSync(path, "Client -> API: Start");
  const file = spawnSync(process.execPath, [CLI, path], { encoding: "utf8" });
  rmSync(path);

  assert.equal(valid.status, 0);
  assert.deepEqual(JSON.parse(valid.stdout), { valid: true, file: "<stdin>" });
  assert.equal(invalid.status, 1);
  assert.equal(JSON.parse(invalid.stdout).error.line, 1);
  assert.equal(file.status, 0);
  assert.equal(file.stdout, `Valid: ${path}\n`);
});
