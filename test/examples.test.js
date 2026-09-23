import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { parse } from "lines-and-arrows/syntax";
import { dedentInlineSource } from "../src/text.js";

// The agent guide asks for tags of 12 characters or fewer and message label
// lines of 32 characters or fewer. Published examples and the demo follow
// the same rules.
const TAG_LIMIT = 12;
const LABEL_LINE_LIMIT = 32;

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const MARKDOWN_FILES = ["README.md", "syntax.md", "website/agents.md"];
const pagesIn = (directory) =>
  readdirSync(join(ROOT, directory))
    .filter((name) => /\.(html|js)$/.test(name))
    .map((name) => `${directory}/${name}`);
const PAGE_FILES = [
  ...pagesIn("website"),
  ...pagesIn("demo"),
  "scripts/social-card.html",
];

const ELEMENT = /<lines-and-arrows\b[^>]*>([\s\S]*?)<\/lines-and-arrows>/g;
const ESCAPED_ELEMENT =
  /&lt;lines-and-arrows\b[\s\S]*?&gt;([\s\S]*?)&lt;\/lines-and-arrows&gt;/g;
const FEATURE_SOURCE =
  /<pre class="feature-source"><code>([\s\S]*?)<\/code><\/pre>/g;
const SOURCE_TEMPLATE = /\b\w*[sS]ource\s*=\s*`((?:\\[\s\S]|[^`\\])*)`/g;
const FENCE = /^```([\w-]*)\n([\s\S]*?)^```$/gm;

function unescapeHtml(text) {
  return text
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&amp;", "&");
}

function unescapeTemplate(text) {
  assert.doesNotMatch(text, /\$\{/, "example templates must be literal");
  return text.replace(/\\([\s\S])/g, "$1");
}

function matches(pattern, text) {
  return [...text.matchAll(pattern)].map((match) => match[1]);
}

function htmlExamples(html) {
  return [
    ...matches(ELEMENT, html).map((body) => unescapeHtml(body)),
    ...matches(ESCAPED_ELEMENT, html).map((body) => unescapeHtml(body)),
    ...matches(FEATURE_SOURCE, html).map((body) => unescapeHtml(body)),
  ];
}

function scriptExamples(script) {
  return matches(SOURCE_TEMPLATE, script).map(unescapeTemplate);
}

function markdownExamples(markdown) {
  const examples = [];
  for (const [, language, body] of markdown.matchAll(FENCE)) {
    if (language === "lines-and-arrows") {
      examples.push(body);
    } else if (language === "html") {
      examples.push(...htmlExamples(body), ...scriptExamples(body));
    } else if (language === "js") {
      examples.push(...scriptExamples(body));
    }
  }
  return examples;
}

function collectExamples() {
  const examples = [];
  for (const file of MARKDOWN_FILES) {
    const text = readFileSync(join(ROOT, file), "utf8");
    for (const source of markdownExamples(text)) {
      examples.push({ file, source });
    }
  }
  for (const file of PAGE_FILES) {
    const text = readFileSync(join(ROOT, file), "utf8");
    const found = file.endsWith(".js")
      ? scriptExamples(text)
      : [...htmlExamples(text), ...scriptExamples(text)];
    for (const source of found) {
      examples.push({ file, source });
    }
  }
  return examples
    .map(({ file, source }) => ({ file, source: dedentInlineSource(source) }))
    .filter(({ source }) => source.trim());
}

function* messages(items) {
  for (const item of items) {
    if (item.type === "message") {
      yield item;
    } else if (item.type === "group") {
      for (const child of item.body) {
        yield* messages(child.type === "section" ? child.items : [child]);
      }
    }
  }
}

function compactTextProblems(document) {
  const problems = [];
  const tagged = [...document.actors, ...messages(document.items)];
  for (const owner of tagged) {
    if (owner.tag !== null && owner.tag.length > TAG_LIMIT) {
      problems.push(`tag "${owner.tag}" has ${owner.tag.length} characters`);
    }
  }
  for (const message of messages(document.items)) {
    for (const line of message.label?.split("\n") ?? []) {
      if (line.length > LABEL_LINE_LIMIT) {
        problems.push(`label line "${line}" has ${line.length} characters`);
      }
    }
  }
  return problems;
}

test("published examples are found in every documented location", () => {
  const counts = new Map();
  for (const { file } of collectExamples()) {
    counts.set(file, (counts.get(file) ?? 0) + 1);
  }
  for (const file of [
    "README.md",
    "syntax.md",
    "website/agents.md",
    "website/index.html",
    "website/app.js",
    "website/features.html",
    "website/features.js",
    "website/constructor.js",
    "demo/index.html",
    "demo/themes.html",
    "scripts/social-card.html",
  ]) {
    assert.ok(counts.get(file) > 0, `no examples found in ${file}`);
  }
  assert.equal(counts.get("website/showcase.html"), 12);
  assert.equal(counts.get("website/features.html"), 7);
});

test("published examples parse and keep tags and labels compact", () => {
  const failures = [];
  for (const { file, source } of collectExamples()) {
    const firstLine = source.split("\n", 1)[0];
    let document;
    try {
      document = parse(source);
    } catch (error) {
      failures.push(`${file} (${firstLine}): ${error.message}`);
      continue;
    }
    for (const problem of compactTextProblems(document)) {
      failures.push(`${file} (${firstLine}): ${problem}`);
    }
  }
  assert.deepEqual(failures, []);
});

test("the compact text check reports long tags and label lines", () => {
  const document = parse(`@API
  tag internet-facing

API -> API: Short line\\nA label line that is longer than the limit
  tag within limit`);
  assert.deepEqual(compactTextProblems(document), [
    'tag "internet-facing" has 15 characters',
    'label line "A label line that is longer than the limit" has 42 characters',
  ]);
});
