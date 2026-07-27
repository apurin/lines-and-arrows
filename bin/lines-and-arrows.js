#!/usr/bin/env node

import { readFile } from "node:fs/promises";

import { validate } from "../src/syntax.js";

function usage() {
  process.stderr.write(
    "Usage: lines-and-arrows validate [--json] <file|->\n",
  );
}

async function readStdin() {
  process.stdin.setEncoding("utf8");
  let source = "";
  for await (const chunk of process.stdin) {
    source += chunk;
  }
  return source;
}

const args = process.argv.slice(2);
const jsonIndex = args.indexOf("--json");
const json = jsonIndex !== -1;
if (json) {
  args.splice(jsonIndex, 1);
}

if (args.length !== 2 || args[0] !== "validate") {
  usage();
  process.exitCode = 2;
} else {
  const input = args[1];

  try {
    const source =
      input === "-" ? await readStdin() : await readFile(input, "utf8");
    const result = validate(source);
    const file = input === "-" ? "<stdin>" : input;

    if (json) {
      process.stdout.write(
        `${JSON.stringify(
          result.valid
            ? { valid: true, file }
            : { valid: false, file, error: result.error },
          null,
          2,
        )}\n`,
      );
    } else if (result.valid) {
      process.stdout.write(`Valid: ${file}\n`);
    } else {
      process.stderr.write(
        `${file}:${result.error.line}: ${result.error.message}\n`,
      );
    }

    process.exitCode = result.valid ? 0 : 1;
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 2;
  }
}
