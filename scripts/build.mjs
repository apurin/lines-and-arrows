import { mkdir, rm } from "node:fs/promises";

import { build } from "esbuild";

const outputDirectory = new URL("../dist/", import.meta.url);

await rm(outputDirectory, { force: true, recursive: true });
await mkdir(outputDirectory, { recursive: true });

const shared = {
  bundle: true,
  format: "esm",
  minify: true,
  platform: "browser",
  sourcemap: true,
  target: "es2022",
};

await Promise.all([
  build({
    ...shared,
    entryPoints: [new URL("../src/index.js", import.meta.url).pathname],
    outfile: new URL(
      "lines-and-arrows.min.js",
      outputDirectory,
    ).pathname,
  }),
  build({
    ...shared,
    entryPoints: [new URL("../src/auto.js", import.meta.url).pathname],
    outfile: new URL(
      "lines-and-arrows.auto.min.js",
      outputDirectory,
    ).pathname,
  }),
]);
