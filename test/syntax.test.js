import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { validate } from "lines-and-arrows/syntax";

const CLI = fileURLToPath(
  new URL("../bin/lines-and-arrows.js", import.meta.url),
);

test("validates source without a DOM", () => {
  const result = validate("Client -> API: Start");

  assert.equal(result.valid, true);
  assert.equal(result.document.items[0].label, "Start");
});

test("returns structured syntax errors", () => {
  const result = validate(`@Client

Client -> Worker: Start`);

  assert.equal(result.valid, false);
  assert.deepEqual(
    {
      name: result.error.name,
      line: result.error.line,
    },
    {
      name: "LinesAndArrowsSyntaxError",
      line: 3,
    },
  );
  assert.match(result.error.message, /Unknown actor "Worker"/);
});

test("validates stdin through the command line", () => {
  const success = spawnSync(
    process.execPath,
    [CLI, "validate", "--json", "-"],
    {
      encoding: "utf8",
      input: "Client -> API: Start",
    },
  );
  const failure = spawnSync(
    process.execPath,
    [CLI, "validate", "--json", "-"],
    {
      encoding: "utf8",
      input: "Client -> API:",
    },
  );

  assert.equal(success.status, 0);
  assert.deepEqual(JSON.parse(success.stdout), {
    valid: true,
    file: "<stdin>",
  });

  assert.equal(failure.status, 1);
  assert.equal(JSON.parse(failure.stdout).valid, false);
});

test("prints command-line help", () => {
  for (const flag of ["--help", "-h"]) {
    const result = spawnSync(process.execPath, [CLI, flag], {
      encoding: "utf8",
    });

    assert.equal(result.status, 0);
    assert.equal(result.stderr, "");
    assert.match(result.stdout, /Usage: lines-and-arrows validate/);
    assert.match(result.stdout, /--json/);
  }
});
