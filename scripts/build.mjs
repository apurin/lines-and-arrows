import { mkdir, readFile, rm } from "node:fs/promises";

import { build } from "esbuild";

const outputDirectory = new URL("../dist/", import.meta.url);
const { version } = JSON.parse(
  await readFile(new URL("../package.json", import.meta.url), "utf8"),
);

await rm(outputDirectory, { force: true, recursive: true });
await mkdir(outputDirectory, { recursive: true });

await build({
  banner: {
    js: `/*! lines-and-arrows v${version} | MIT | https://lines-and-arrows.dev */`,
  },
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
