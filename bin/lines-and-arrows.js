#!/usr/bin/env node

import { readFile } from "node:fs/promises";

import { validate } from "../src/syntax.js";

const USAGE = `Usage: lines-and-arrows [--json] <file...|->
       lines-and-arrows --version
       lines-and-arrows --help

Validate one or more Lines & Arrows diagram source files, or read source from
stdin with -. Stdin cannot be combined with files.

Options:
  --json         Print results as JSON: one object for a single input, or an
                 array of objects for several inputs
  -v, --version  Print the package version
  -h, --help     Show this help
  --             Treat every following argument as a file name

Exit codes:
  0  Every input is valid
  1  At least one input is invalid, and every input could be read
  2  Usage error, or at least one input could not be read
`;

class UsageError extends Error {}

function parseArguments(args) {
  const options = { help: false, json: false, version: false, inputs: [] };
  let filesOnly = false;

  for (const arg of args) {
    if (filesOnly || arg === "-" || !arg.startsWith("-")) {
      options.inputs.push(arg);
    } else if (arg === "--") {
      filesOnly = true;
    } else if (arg === "--json") {
      options.json = true;
    } else if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else if (arg === "--version" || arg === "-v") {
      options.version = true;
    } else {
      throw new UsageError(`Unknown option: ${arg}`);
    }
  }

  if (options.help || options.version) {
    return options;
  }
  if (options.inputs.length === 0) {
    throw new UsageError("Expected at least one file, or - for stdin");
  }
  if (options.inputs.length > 1 && options.inputs.includes("-")) {
    throw new UsageError("Stdin (-) cannot be combined with other inputs");
  }
  return options;
}

async function readStdin() {
  process.stdin.setEncoding("utf8");
  let source = "";
  for await (const chunk of process.stdin) {
    source += chunk;
  }
  return source;
}

async function check(input) {
  const file = input === "-" ? "<stdin>" : input;
  let source;
  try {
    source = input === "-" ? await readStdin() : await readFile(input, "utf8");
  } catch (error) {
    return {
      status: 2,
      json: { valid: false, file, error: { message: error.message } },
      text: `${file}: ${error.message}\n`,
    };
  }

  const result = validate(source);
  return result.valid
    ? { status: 0, json: { valid: true, file }, text: `Valid: ${file}\n` }
    : {
        status: 1,
        json: { valid: false, file, error: result.error },
        text: `${file}:${result.error.line}: ${result.error.message}\n`,
      };
}

async function main(args) {
  let options;
  try {
    options = parseArguments(args);
  } catch (error) {
    if (!(error instanceof UsageError)) {
      throw error;
    }
    process.stderr.write(`${error.message}\n\n${USAGE}`);
    return 2;
  }

  if (options.help) {
    process.stdout.write(USAGE);
    return 0;
  }
  if (options.version) {
    const packageJson = JSON.parse(
      await readFile(new URL("../package.json", import.meta.url), "utf8"),
    );
    process.stdout.write(`${packageJson.version}\n`);
    return 0;
  }

  const results = [];
  for (const input of options.inputs) {
    results.push(await check(input));
  }

  if (options.json) {
    const output =
      results.length === 1
        ? results[0].json
        : results.map((result) => result.json);
    process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  } else {
    for (const result of results) {
      const stream = result.status === 0 ? process.stdout : process.stderr;
      stream.write(result.text);
    }
  }

  return Math.max(...results.map((result) => result.status));
}

process.exitCode = await main(process.argv.slice(2));
