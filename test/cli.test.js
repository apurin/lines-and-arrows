import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const CLI = fileURLToPath(new URL("../bin/lines-and-arrows.js", import.meta.url));
const VERSION = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
).version;

let directory;
let valid;
let invalid;
let missing;

function cli(args, input) {
  return spawnSync(process.execPath, [CLI, ...args], {
    encoding: "utf8",
    input,
  });
}

test.before(() => {
  directory = mkdtempSync(join(tmpdir(), "lines-and-arrows-cli-"));
  valid = join(directory, "valid.la");
  invalid = join(directory, "invalid.la");
  missing = join(directory, "missing.la");
  writeFileSync(valid, "Client -> API: Start\n");
  writeFileSync(invalid, "Client -> API: Start\nAPI -> Client:\n");
});

test.after(() => {
  rmSync(directory, { recursive: true, force: true });
});

test("prints the package version", () => {
  for (const flag of ["--version", "-v"]) {
    const result = cli([flag]);
    assert.equal(result.status, 0, flag);
    assert.equal(result.stdout, `${VERSION}\n`, flag);
    assert.equal(result.stderr, "", flag);
  }
});

test("documents every option in the help", () => {
  for (const flag of ["--help", "-h"]) {
    const result = cli([flag]);
    assert.equal(result.status, 0, flag);
    for (const text of ["--json", "--version", "-v", "--help", "-h", "stdin"]) {
      assert.ok(result.stdout.includes(text), `${flag} help mentions ${text}`);
    }
    assert.match(result.stdout, /Exit codes:/);
  }
});

test("reports usage errors with exit code 2", () => {
  for (const args of [[], ["--jsn", valid], ["-x"], ["-", valid], ["--json"]]) {
    const result = cli(args);
    assert.equal(result.status, 2, args.join(" "));
    assert.equal(result.stdout, "", args.join(" "));
    assert.match(result.stderr, /Usage: lines-and-arrows/, args.join(" "));
  }
  assert.match(cli(["--jsn", valid]).stderr, /Unknown option: --jsn/);
});

test("validates one valid file", () => {
  const text = cli([valid]);
  assert.equal(text.status, 0);
  assert.equal(text.stdout, `Valid: ${valid}\n`);

  const json = cli(["--json", valid]);
  assert.equal(json.status, 0);
  assert.deepEqual(JSON.parse(json.stdout), { valid: true, file: valid });
});

test("reports the line of one invalid file", () => {
  const text = cli([invalid]);
  assert.equal(text.status, 1);
  assert.equal(text.stdout, "");
  assert.match(text.stderr, new RegExp(`^${escape(invalid)}:2: `));

  const json = cli(["--json", invalid]);
  const result = JSON.parse(json.stdout);
  assert.equal(json.status, 1);
  assert.equal(result.valid, false);
  assert.equal(result.file, invalid);
  assert.equal(result.error.line, 2);
  assert.equal(typeof result.error.message, "string");
});

test("validates several files and reports each one", () => {
  const text = cli([valid, invalid]);
  assert.equal(text.status, 1);
  assert.equal(text.stdout, `Valid: ${valid}\n`);
  assert.match(text.stderr, new RegExp(`^${escape(invalid)}:2: `));

  const json = cli(["--json", valid, invalid]);
  const results = JSON.parse(json.stdout);
  assert.equal(json.status, 1);
  assert.ok(Array.isArray(results));
  assert.deepEqual(results[0], { valid: true, file: valid });
  assert.equal(results[1].file, invalid);
  assert.equal(results[1].error.line, 2);

  const allValid = cli(["--json", valid, "--", valid]);
  assert.equal(allValid.status, 0);
  assert.equal(JSON.parse(allValid.stdout).length, 2);
});

test("reports unreadable files as read errors", () => {
  const text = cli([missing]);
  assert.equal(text.status, 2);
  assert.equal(text.stdout, "");
  assert.match(text.stderr, new RegExp(`^${escape(missing)}: .*ENOENT`));

  const json = cli(["--json", missing]);
  assert.equal(json.status, 2);
  assert.equal(json.stderr, "");
  const result = JSON.parse(json.stdout);
  assert.deepEqual(Object.keys(result), ["valid", "file", "error"]);
  assert.equal(result.valid, false);
  assert.equal(result.file, missing);
  assert.deepEqual(Object.keys(result.error), ["message"]);
  assert.match(result.error.message, /ENOENT/);

  const mixed = cli(["--json", invalid, missing, valid]);
  const results = JSON.parse(mixed.stdout);
  assert.equal(mixed.status, 2);
  assert.deepEqual(
    results.map(({ file, valid: isValid }) => [file, isValid]),
    [
      [invalid, false],
      [missing, false],
      [valid, true],
    ],
  );
});

test("validates standard input", () => {
  const validInput = cli(["--json", "-"], "Client -> API: Start");
  assert.equal(validInput.status, 0);
  assert.deepEqual(JSON.parse(validInput.stdout), {
    valid: true,
    file: "<stdin>",
  });

  const invalidInput = cli(["-"], "Client -> API:");
  assert.equal(invalidInput.status, 1);
  assert.match(invalidInput.stderr, /^<stdin>:1: /);
});

function escape(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
