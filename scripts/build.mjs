import { mkdir, rm } from "node:fs/promises";

import { build } from "esbuild";

const outputDirectory = new URL("../dist/", import.meta.url);

await rm(outputDirectory, { force: true, recursive: true });
await mkdir(outputDirectory, { recursive: true });

await build({
  bundle: true,
  entryPoints: [new URL("../src/auto.js", import.meta.url).pathname],
  format: "esm",
  minify: true,
  outfile: new URL(
    "lines-and-arrows.auto.min.js",
    outputDirectory,
  ).pathname,
  platform: "browser",
});
