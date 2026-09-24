import { execFileSync } from "node:child_process";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { extname } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const packageFile = new URL("../package.json", import.meta.url);
const readmeFile = new URL("../README.md", import.meta.url);
const websiteDirectory = new URL("../website/", import.meta.url);
const runtimeFile = new URL("./runtime.js", websiteDirectory);
const textExtensions = new Set([".css", ".html", ".js", ".md", ".txt", ".xml"]);

const packageJson = JSON.parse(await readFile(packageFile, "utf8"));
const version = packageJson.version;
const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);

if (!match) {
  throw new Error(`Expected package.json version to be X.Y.Z, received ${version}`);
}

const compatibleVersion = `${match[1]}.${match[2]}`;
const cdnPattern = /lines-and-arrows@(\d+)\.(\d+)(?:\.(\d+))?/g;
const readmeLinePattern = /The current release line is `\d+\.\d+`/g;

const syncCdnReferences = (source) => {
  let references = 0;
  const output = source.replace(
    cdnPattern,
    (_reference, _major, _minor, patch) => {
      references += 1;
      return `lines-and-arrows@${patch === undefined ? compatibleVersion : version}`;
    },
  );
  return { output, references };
};

const collectTextFiles = async (directory) => {
  const files = [];

  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const url = new URL(entry.name, directory);
    if (entry.isDirectory()) {
      files.push(...(await collectTextFiles(new URL(`${entry.name}/`, directory))));
    } else if (entry.isFile() && textExtensions.has(extname(entry.name))) {
      files.push(url);
    }
  }

  return files;
};

const runtimeSource = await readFile(runtimeFile, "utf8");
const runtimePattern = /export const CDN_VERSION = "\d+\.\d+\.\d+";/g;
const runtimeMatches = runtimeSource.match(runtimePattern) ?? [];

if (runtimeMatches.length !== 1) {
  throw new Error("Expected one CDN_VERSION declaration in website/runtime.js");
}

const files = await collectTextFiles(websiteDirectory);
let changedFiles = 0;
let concreteReferences = 0;

for (const file of files) {
  const source = await readFile(file, "utf8");
  let output = source;

  if (file.href === runtimeFile.href) {
    output = output.replace(
      runtimePattern,
      `export const CDN_VERSION = "${version}";`,
    );
  }

  const synced = syncCdnReferences(output);
  output = synced.output;
  concreteReferences += synced.references;

  if (output !== source) {
    await writeFile(file, output);
    changedFiles += 1;
  }
}

if (concreteReferences === 0) {
  throw new Error("Found no concrete lines-and-arrows CDN references in website/");
}

const readmeSource = await readFile(readmeFile, "utf8");
const readmeLines = readmeSource.match(readmeLinePattern) ?? [];

if (readmeLines.length !== 1) {
  throw new Error(
    "Expected one \"The current release line is `X.Y`\" sentence in README.md",
  );
}

const readme = syncCdnReferences(
  readmeSource.replace(
    readmeLinePattern,
    `The current release line is \`${compatibleVersion}\``,
  ),
);

if (readme.references === 0) {
  throw new Error("Found no concrete lines-and-arrows CDN references in README.md");
}

if (readme.output !== readmeSource) {
  await writeFile(readmeFile, readme.output);
  changedFiles += 1;
}

// The homepage states the size of the CDN file a browser downloads. Build the
// bundle from the current source and write its gzipped size, rounded to whole
// kilobytes, so the published number always matches the release.
const buildScript = fileURLToPath(new URL("./build.mjs", import.meta.url));
execFileSync(process.execPath, [buildScript], { stdio: "inherit" });
const bundle = await readFile(
  new URL("../dist/lines-and-arrows.auto.min.js", import.meta.url),
);
const gzippedKilobytes = Math.round(gzipSync(bundle, { level: 9 }).length / 1000);
const homepageFile = new URL("./index.html", websiteDirectory);
const homepageSource = await readFile(homepageFile, "utf8");
const sizePattern = /Just \d+ kB gzipped\./g;
if ((homepageSource.match(sizePattern) ?? []).length !== 1) {
  throw new Error('Expected one "Just N kB gzipped." size claim in website/index.html');
}
const homepageOutput = homepageSource.replace(
  sizePattern,
  `Just ${gzippedKilobytes} kB gzipped.`,
);
if (homepageOutput !== homepageSource) {
  await writeFile(homepageFile, homepageOutput);
  changedFiles += 1;
}

const preparedRuntime = await readFile(runtimeFile, "utf8");
if (!preparedRuntime.includes(`export const CDN_VERSION = "${version}";`)) {
  throw new Error("website/runtime.js did not receive the package version");
}

console.log(
  `Prepared README and website for lines-and-arrows@${version} (CDN bundle ${gzippedKilobytes} kB gzipped); updated ${changedFiles} file${changedFiles === 1 ? "" : "s"}.`,
);
