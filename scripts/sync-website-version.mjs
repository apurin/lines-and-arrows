import { readFile, readdir, writeFile } from "node:fs/promises";
import { extname } from "node:path";

const packageFile = new URL("../package.json", import.meta.url);
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

  output = output.replace(
    /lines-and-arrows(@|&#64;)(\d+)\.(\d+)(?:\.(\d+))?/g,
    (_reference, separator, _major, _minor, patch) => {
      concreteReferences += 1;
      return `lines-and-arrows${separator}${patch === undefined ? compatibleVersion : version}`;
    },
  );

  if (output !== source) {
    await writeFile(file, output);
    changedFiles += 1;
  }
}

if (concreteReferences === 0) {
  throw new Error("Found no concrete lines-and-arrows CDN references in website/");
}

const preparedRuntime = await readFile(runtimeFile, "utf8");
if (!preparedRuntime.includes(`export const CDN_VERSION = "${version}";`)) {
  throw new Error("website/runtime.js did not receive the package version");
}

console.log(
  `Prepared website for lines-and-arrows@${version}; updated ${changedFiles} file${changedFiles === 1 ? "" : "s"}.`,
);
