import assert from "node:assert/strict";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const temporary = mkdtempSync(join(tmpdir(), "lines-and-arrows-package-"));
const cache = join(temporary, "npm-cache");

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, npm_config_cache: cache },
    ...options,
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `${command} failed`);
  }
  return result.stdout;
}

try {
  const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  assert.equal(packageJson.dependencies, undefined, "runtime dependencies must stay empty");
  const bundle = "./dist/lines-and-arrows.auto.min.js";
  assert.equal(packageJson.jsdelivr, bundle);
  assert.equal(packageJson.unpkg, bundle);
  assert.deepEqual(packageJson.sideEffects, ["./src/auto.js", bundle]);

  const packed = JSON.parse(
    run("npm", [
      "pack",
      "--ignore-scripts",
      "--json",
      "--pack-destination",
      temporary,
    ]),
  )[0];
  const paths = packed.files.map(({ path }) => path);
  const dist = paths.filter((path) => path.startsWith("dist/"));

  assert.deepEqual(dist, ["dist/lines-and-arrows.auto.min.js"]);
  assert.ok(
    !paths.some((path) => /^(demo|test|type-tests|website|scripts)\//.test(path)),
    "development files crossed the package boundary",
  );
  assert.ok(packed.size <= 150_000, `packed package is ${packed.size} bytes`);
  const consumer = join(temporary, "consumer");
  mkdirSync(consumer);
  writeFileSync(
    join(consumer, "package.json"),
    JSON.stringify({ private: true, type: "module" }),
  );
  run(
    "npm",
    [
      "install",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      "--no-package-lock",
      join(temporary, packed.filename),
    ],
    { cwd: consumer },
  );

  const smoke = `
    const root = await import("lines-and-arrows");
    const syntax = await import("lines-and-arrows/syntax");
    if (Object.keys(root).join() !== "renderDiagram") throw new Error("root exports drifted");
    if (!syntax.validate("A -> B").valid) throw new Error("syntax import failed");
  `;
  run("node", ["--input-type=module", "--eval", smoke], { cwd: consumer });
  run(
    process.execPath,
    [join(consumer, "node_modules/.bin/lines-and-arrows"), "--json", "-"],
    { cwd: consumer, input: "A -> B" },
  );

  process.stdout.write(
    `Package verified: ${packed.size} bytes packed, ${packed.unpackedSize} bytes unpacked, ${paths.length} files.\n`,
  );
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
