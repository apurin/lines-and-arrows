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
  const emptyValue = parse("A -> B: Start");
  emptyValue.items[0].label = "";
  assert.throws(() => serialize(emptyValue), /items\[0\]\.label.*empty/i);
  emptyValue.items[0].label = "Start";
  emptyValue.actors[0].tag = " ";
  assert.throws(() => serialize(emptyValue), /actors\[0\]\.tag.*empty/i);
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
