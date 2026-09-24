import { mkdir, readFile, rm } from "node:fs/promises";

import { build, transform } from "esbuild";

const outputDirectory = new URL("../dist/", import.meta.url);
const { version } = JSON.parse(
  await readFile(new URL("../package.json", import.meta.url), "utf8"),
);

// esbuild leaves template literals as written, so the stylesheet strings
// would ship with their indentation. Minify each one as CSS instead. A
// stylesheet that gains an interpolation or escape no longer matches, which
// the count below reports rather than shipping it unminified.
const STYLESHEET = /(const ([A-Z_]+_STYLES) = )`([^`$\\]*)`/g;
const DECLARED_STYLESHEET = /const ([A-Z_]+_STYLES) = `/g;
const EXPECTED_STYLESHEETS = ["EDIT_STYLES", "VIEW_STYLES"];
const stylesheets = [];
const declared = [];
const minifyStylesheets = {
  name: "minify-stylesheets",
  setup(builder) {
    builder.onLoad(
      { filter: /[\\/]src[\\/][^\\/]+\.js$/ },
      async ({ path }) => {
        const source = await readFile(path, "utf8");
        declared.push(
          ...[...source.matchAll(DECLARED_STYLESHEET)].map((match) => match[1]),
        );
        let contents = "";
        let last = 0;
        for (const match of source.matchAll(STYLESHEET)) {
          const { code } = await transform(match[3], {
            loader: "css",
            minify: true,
          });
          contents +=
            source.slice(last, match.index) +
            match[1] +
            JSON.stringify(code.trim());
          last = match.index + match[0].length;
          stylesheets.push(match[2]);
        }
        return { contents: contents + source.slice(last), loader: "js" };
      },
    );
  },
};

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
  plugins: [minifyStylesheets],
});

const minified = stylesheets.sort().join(", ");
const expected = EXPECTED_STYLESHEETS.join(", ");
if (minified !== expected || declared.sort().join(", ") !== expected) {
  throw new Error(
    `Minified stylesheets [${minified}] of declared [${declared.join(", ")}]; expected [${expected}].`,
  );
}
