import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const root = path.dirname(new URL(import.meta.url).pathname);
const mode = process.argv[2] ?? "all";
const server = "https://www.plantuml.com/plantuml/svg";
const corpusRenderDir = "/tmp/lines-and-arrows-plantuml-corpus";

function encode6bit(value) {
  if (value < 10) return String.fromCharCode(48 + value);
  value -= 10;
  if (value < 26) return String.fromCharCode(65 + value);
  value -= 26;
  if (value < 26) return String.fromCharCode(97 + value);
  value -= 26;
  if (value === 0) return "-";
  if (value === 1) return "_";
  return "?";
}

function append3bytes(byte1, byte2, byte3) {
  const c1 = byte1 >> 2;
  const c2 = ((byte1 & 0x3) << 4) | (byte2 >> 4);
  const c3 = ((byte2 & 0xf) << 2) | (byte3 >> 6);
  const c4 = byte3 & 0x3f;
  return [c1, c2, c3, c4].map((value) => encode6bit(value & 0x3f)).join("");
}

function plantumlEncode(source) {
  const compressed = zlib.deflateRawSync(Buffer.from(source, "utf8"), { level: 9 });
  let encoded = "";
  for (let index = 0; index < compressed.length; index += 3) {
    const byte1 = compressed[index];
    const byte2 = index + 1 < compressed.length ? compressed[index + 1] : 0;
    const byte3 = index + 2 < compressed.length ? compressed[index + 2] : 0;
    encoded += append3bytes(byte1, byte2, byte3);
  }
  return encoded;
}

function safeName(value) {
  return value.replace(/[^a-z0-9._-]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase();
}

function corpusItems() {
  const resultsPath = path.join(root, "results.json");
  if (!fs.existsSync(resultsPath)) return [];
  const results = JSON.parse(fs.readFileSync(resultsPath, "utf8"));
  return results.diagrams.map((diagram) => ({
    id: diagram.id,
    title: diagram.title,
    source: diagram.source,
    output: path.join(corpusRenderDir, `${safeName(diagram.id)}.svg`)
  }));
}

function fragmentItems() {
  const fragmentsPath = path.join(root, "fragments.json");
  if (!fs.existsSync(fragmentsPath)) return [];
  const fragments = JSON.parse(fs.readFileSync(fragmentsPath, "utf8"));
  return fragments.map((fragment) => ({
    ...fragment,
    output: path.join(root, "rendered", "fragments", `${safeName(fragment.id)}.svg`)
  }));
}

async function render(item) {
  fs.mkdirSync(path.dirname(item.output), { recursive: true });
  const encoded = plantumlEncode(item.source);
  const response = await fetch(`${server}/${encoded}`, {
    headers: { "user-agent": "lines-and-arrows-sequence-study/1.0" }
  });
  const svg = await response.text();
  if (!response.ok) {
    const detail = svg
      .replace(/<[^>]+>/g, " ")
      .replace(/&[^;]+;/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 240);
    throw new Error(`${item.id}: server returned ${response.status}${detail ? ` — ${detail}` : ""}`);
  }
  if (!/<svg\b/i.test(svg)) throw new Error(`${item.id}: response is not SVG`);
  const syntaxError = svg.match(/(?:Syntax Error|Cannot parse|Error line|No valid diagram)/i);
  if (syntaxError) throw new Error(`${item.id}: PlantUML reported ${syntaxError[0]}`);
  fs.writeFileSync(item.output, svg);
  return {
    id: item.id,
    title: item.title,
    sourceBytes: Buffer.byteLength(item.source),
    svgBytes: Buffer.byteLength(svg),
    output: path.relative(root, item.output)
  };
}

async function mapConcurrent(items, concurrency, operation) {
  const results = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      try {
        results[index] = await operation(items[index]);
      } catch (error) {
        results[index] = {
          id: items[index].id,
          title: items[index].title,
          error: error instanceof Error ? error.message : String(error)
        };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

if (mode === "--self-test") {
  const source = "@startuml\nBob -> Alice : hello\n@enduml";
  console.log(JSON.stringify({ source, encoded: plantumlEncode(source) }, null, 2));
  process.exit(0);
}

const items = [
  ...(mode === "all" || mode === "corpus" ? corpusItems() : []),
  ...(mode === "all" || mode === "fragments" ? fragmentItems() : [])
];

if (!items.length) {
  console.error(`No render inputs found for mode: ${mode}`);
  process.exit(2);
}

const startedAt = new Date().toISOString();
const rendered = await mapConcurrent(items, 3, render);
const failed = rendered.filter((item) => item.error);
const summary = {
  server,
  startedAt,
  finishedAt: new Date().toISOString(),
  mode,
  count: rendered.length,
  successCount: rendered.length - failed.length,
  failedCount: failed.length,
  rendered
};
fs.writeFileSync(path.join(root, `render-summary-${mode}.json`), `${JSON.stringify(summary, null, 2)}\n`);
console.log(`Rendered ${summary.successCount}/${rendered.length} PlantUML diagrams via ${server}.`);
if (failed.length) {
  console.error(failed.map((item) => item.error).join("\n"));
  process.exitCode = 1;
}
