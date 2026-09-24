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
const STYLESHEET = /(const [A-Z_]+_STYLES = )`([^`$\\]*)`/g;
const EXPECTED_STYLESHEETS = 2;
let stylesheets = 0;
const minifyStylesheets = {
  name: "minify-stylesheets",
  setup(builder) {
    builder.onLoad(
      { filter: /[\\/]src[\\/][^\\/]+\.js$/ },
      async ({ path }) => {
        const source = await readFile(path, "utf8");
        let contents = "";
        let last = 0;
        for (const match of source.matchAll(STYLESHEET)) {
          const { code } = await transform(match[2], {
            loader: "css",
            minify: true,
          });
          contents +=
            source.slice(last, match.index) +
            match[1] +
            JSON.stringify(code.trim());
          last = match.index + match[0].length;
          stylesheets += 1;
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

if (stylesheets !== EXPECTED_STYLESHEETS) {
  throw new Error(
    `Minified ${stylesheets} stylesheets; expected ${EXPECTED_STYLESHEETS}.`,
  );
}
