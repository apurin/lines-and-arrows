import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const experimentDir = path.dirname(fileURLToPath(import.meta.url));
const sourcePath = path.join(experimentDir, "sequence-language-study.source.fragment.html");
const reportPath = path.join(experimentDir, "sequence-language-study.fragment.html");
let report = await readFile(sourcePath, "utf8");

const imageTags = [...report.matchAll(/<img\b[^>]*>/g)]
  .map((match) => match[0])
  .filter((tag) => tag.includes("rendered/fragments/"));

if (imageTags.length !== 3) {
  throw new Error(`Expected 3 PlantUML image tags, found ${imageTags.length}.`);
}

for (const imageTag of imageTags) {
  const relativePath =
    imageTag.match(/data-rendered-source="(rendered\/fragments\/[^"/]+\.svg)"/)?.[1] ??
    imageTag.match(/src="(rendered\/fragments\/[^"/]+\.svg)"/)?.[1];
  if (!relativePath) {
    throw new Error("PlantUML image tag is missing its rendered source path.");
  }
  const svg = await readFile(path.join(experimentDir, relativePath));
  const dataUrl = `data:image/svg+xml;base64,${svg.toString("base64")}`;
  let embeddedTag = imageTag.replace(/src="[^"]*"/, `src="${dataUrl}"`);
  if (!embeddedTag.includes("data-rendered-source=")) {
    embeddedTag = embeddedTag.replace(">", ` data-rendered-source="${relativePath}">`);
  }
  report = report.replace(imageTag, embeddedTag);
}

await writeFile(reportPath, report);
console.log(`Embedded ${imageTags.length} PlantUML SVGs in ${reportPath}`);
