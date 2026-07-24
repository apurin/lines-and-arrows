import fs from "node:fs";
import path from "node:path";

const root = path.dirname(new URL(import.meta.url).pathname);
const rawDir = path.join(root, "raw");
const outputPath = path.join(root, "results.json");

const files = fs.existsSync(rawDir)
  ? fs.readdirSync(rawDir).filter((name) => name.endsWith(".md")).sort()
  : [];

const featureTotals = new Map();
const diagrams = [];

function recordFeature(feature, diagramId, domain, amount = 1) {
  const current = featureTotals.get(feature) ?? {
    occurrences: 0,
    diagrams: new Set(),
    domains: new Set()
  };
  current.occurrences += amount;
  current.diagrams.add(diagramId);
  current.domains.add(domain);
  featureTotals.set(feature, current);
}

function participantDeclaration(line) {
  const match = line.match(/^(actor|participant|boundary|control|entity|database|queue|collections)\s+(.+)$/i);
  if (!match) return null;
  const kind = match[1].toLowerCase();
  const remainder = match[2].trim();
  const aliasMatch = remainder.match(/^(.*?)\s+as\s+([A-Za-z_][\w.]*)$/i);
  const label = aliasMatch ? aliasMatch[1].trim() : remainder;
  const alias = aliasMatch ? aliasMatch[2] : remainder.replace(/^"|"$/g, "");
  return { kind, label, alias, quoted: label.startsWith('"') };
}

function messageParts(line) {
  if (/^(title|header|footer|note|rnote|hnote|ref|skinparam|!)/i.test(line)) return null;
  const tokens = [...line.matchAll(/\S+/g)];
  const arrowMatch = tokens.find((match) => {
    const withoutColor = match[0].replace(/\[#[A-Za-z0-9]+\]/g, "");
    return /[-.]/.test(withoutColor)
      && /[<>\[\]]/.test(withoutColor)
      && /^[-.<>ox\\/\[\]]+$/i.test(withoutColor);
  });
  if (!arrowMatch) return null;
  const arrow = arrowMatch[0];
  const arrowIndex = arrowMatch.index;
  const source = line.slice(0, arrowIndex).trim();
  const remainder = line.slice(arrowIndex + arrow.length).trim();
  if (!source || !remainder) return null;
  const colonIndex = remainder.indexOf(":");
  const rawTarget = (colonIndex >= 0 ? remainder.slice(0, colonIndex) : remainder).trim();
  const label = colonIndex >= 0 ? remainder.slice(colonIndex + 1).trim() : "";
  const target = rawTarget.replace(/\s+(?:\+\+|--|\*\*|!!)(?:\s+#[\w]+)?$/, "").trim();
  return { source, target, arrow, label, rawTarget };
}

function cleanEndpoint(endpoint) {
  return endpoint
    .replace(/^\[|\]$/g, "")
    .replace(/^"|"$/g, "")
    .trim();
}

function quantiles(values) {
  if (!values.length) return { min: 0, median: 0, p75: 0, max: 0, mean: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  const at = (fraction) => sorted[Math.floor((sorted.length - 1) * fraction)];
  return {
    min: sorted[0],
    median: at(0.5),
    p75: at(0.75),
    max: sorted.at(-1),
    mean: Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2))
  };
}

for (const file of files) {
  const domain = file.replace(/\.md$/, "");
  const markdown = fs.readFileSync(path.join(rawDir, file), "utf8");
  const matches = [...markdown.matchAll(/```plantuml\s*\n([\s\S]*?)```/gi)];

  for (const [index, match] of matches.entries()) {
    const prefix = markdown.slice(0, match.index);
    const headings = [...prefix.matchAll(/^##\s+(.+)$/gm)];
    const title = headings.at(-1)?.[1]?.trim() ?? `Diagram ${index + 1}`;
    const source = match[1].trim();
    const id = `${domain}:${String(index + 1).padStart(2, "0")}`;
    const lines = source
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("'") && !/^@(?:start|end)uml$/i.test(line));

    const declarations = [];
    const messages = [];
    const localFeatures = new Map();
    const fragmentStack = [];
    let maxFragmentDepth = 0;

    const add = (feature, amount = 1) => {
      localFeatures.set(feature, (localFeatures.get(feature) ?? 0) + amount);
      recordFeature(feature, id, domain, amount);
    };

    for (const line of lines) {
      const declaration = participantDeclaration(line);
      if (declaration) {
        declarations.push(declaration);
        add("participant.declaration");
        add(`participant.kind.${declaration.kind}`);
        if (declaration.alias !== declaration.label.replace(/^"|"$/g, "")) add("participant.alias");
        if (declaration.quoted) add("participant.quoted-label");
        continue;
      }

      const lower = line.toLowerCase();
      const fragmentMatch = lower.match(/^(alt|opt|loop|par|break|critical|group)(?:\s|$)/);
      if (fragmentMatch) {
        const kind = fragmentMatch[1];
        add(`fragment.${kind}`);
        fragmentStack.push(kind);
        maxFragmentDepth = Math.max(maxFragmentDepth, fragmentStack.length);
        continue;
      }
      if (/^else(?:\s|$)/i.test(line)) {
        add("fragment.else");
        continue;
      }
      if (/^and(?:\s|$)/i.test(line)) {
        add("fragment.and-intuitive");
        continue;
      }
      if (/^end$/i.test(line)) {
        if (fragmentStack.length) fragmentStack.pop();
        continue;
      }

      const simpleCommands = [
        ["note", /^(?:note|rnote|hnote)(?:\s|$)/i],
        ["activation.activate", /^activate(?:\s|$)/i],
        ["activation.deactivate", /^deactivate(?:\s|$)/i],
        ["lifecycle.create", /^create(?:\s|$)/i],
        ["lifecycle.destroy", /^destroy(?:\s|$)/i],
        ["return", /^return(?:\s|$)/i],
        ["reference", /^ref(?:\s|$)/i],
        ["autonumber", /^autonumber(?:\s|$)/i],
        ["autoactivate", /^autoactivate(?:\s|$)/i],
        ["title", /^title(?:\s|$)/i],
        ["divider", /^==.*==$/],
        ["delay", /^\.\.\..*\.\.\.$/],
        ["manual-space", /^\|\|.*\|\|$/],
        ["pagination", /^newpage(?:\s|$)/i],
        ["participant.box", /^box(?:\s|$)/i],
        ["preprocessor", /^!/],
        ["presentation", /^(?:skinparam|style|hide\s+footbox|show\s+footbox)(?:\s|$)/i]
      ];
      const command = simpleCommands.find(([, pattern]) => pattern.test(line));
      if (command) {
        add(command[0]);
        continue;
      }

      const message = messageParts(line);
      if (message) {
        messages.push(message);
        add("message");
        if (message.arrow.includes("--") || message.arrow.includes("..")) add("message.dashed");
        else add("message.solid");
        if (message.arrow.includes(">>") || message.arrow.includes("<<")) add("message.open-head");
        if (/x/i.test(message.arrow)) add("message.lost");
        if (/[\[\]]/.test(message.arrow) || /[\[\]]/.test(message.source) || /[\[\]]/.test(message.target)) add("message.external");
        if (cleanEndpoint(message.source) === cleanEndpoint(message.target)) add("message.self");
        if (/\+\+|\*\*|!!/.test(message.rawTarget)) add("message.lifecycle-shortcut");
        if (message.label.includes("\\n")) add("message.multiline-label");
      }
    }

    const declaredAliases = new Set(declarations.map((item) => item.alias));
    const participantKinds = new Map(declarations.map((item) => [item.alias, item.kind]));
    const endpoints = new Set(
      messages
        .flatMap((item) => [cleanEndpoint(item.source), cleanEndpoint(item.target)])
        .filter((item) => item && item !== "[" && item !== "]")
    );
    const implicitParticipants = [...endpoints].filter((item) => !declaredAliases.has(item));
    if (implicitParticipants.length) add("participant.implicit", implicitParticipants.length);

    for (const message of messages) {
      const sourceKind = participantKinds.get(cleanEndpoint(message.source));
      const targetKind = participantKinds.get(cleanEndpoint(message.target));
      if (sourceKind) add(`message.from-kind.${sourceKind}`);
      if (targetKind) add(`message.to-kind.${targetKind}`);
      if (/\b(?:publish|enqueue|emit|notify|schedule|dispatch|signal|broadcast|stream|deliver|forward|telemetry)\b/i.test(message.label)) {
        add("message.event-like");
      }
    }

    diagrams.push({
      id,
      domain,
      index: index + 1,
      title,
      source,
      lineCount: lines.length,
      messageCount: messages.length,
      declaredParticipantCount: declarations.length,
      distinctEndpointCount: endpoints.size,
      implicitParticipants,
      maxFragmentDepth,
      features: Object.fromEntries([...localFeatures.entries()].sort(([a], [b]) => a.localeCompare(b)))
    });
  }
}

const domains = Object.groupBy(diagrams, (diagram) => diagram.domain);
const controlFamilySpecs = {
  actors: ["participant.declaration"],
  connections: ["message"],
  groups: ["fragment.alt", "fragment.loop", "fragment.par", "fragment.critical", "fragment.opt", "fragment.break", "fragment.group"],
  multiSectionGroups: ["fragment.alt", "fragment.par"],
  lifelineSpans: ["activation.activate", "lifecycle.create", "lifecycle.destroy"],
  timelineMarkers: ["delay", "divider", "manual-space"]
};

const controlFamilies = Object.fromEntries(
  Object.entries(controlFamilySpecs).map(([family, features]) => {
    const matching = diagrams.filter((diagram) => features.some((feature) => diagram.features[feature]));
    return [family, {
      diagramCount: matching.length,
      domainCount: new Set(matching.map((diagram) => diagram.domain)).size,
      features
    }];
  })
);

const results = {
  generatedAt: new Date().toISOString(),
  corpus: {
    fileCount: files.length,
    diagramCount: diagrams.length,
    diagramsPerDomain: Object.fromEntries(
      Object.entries(domains).map(([domain, items]) => [domain, items.length])
    ),
    messageCount: diagrams.reduce((sum, diagram) => sum + diagram.messageCount, 0),
    distributions: {
      messagesPerDiagram: quantiles(diagrams.map((diagram) => diagram.messageCount)),
      declaredParticipantsPerDiagram: quantiles(diagrams.map((diagram) => diagram.declaredParticipantCount)),
      distinctEndpointsPerDiagram: quantiles(diagrams.map((diagram) => diagram.distinctEndpointCount)),
      linesPerDiagram: quantiles(diagrams.map((diagram) => diagram.lineCount)),
      fragmentDepth: quantiles(diagrams.map((diagram) => diagram.maxFragmentDepth))
    }
  },
  features: Object.fromEntries(
    [...featureTotals.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([feature, value]) => [feature, {
        occurrences: value.occurrences,
        diagramCount: value.diagrams.size,
        domainCount: value.domains.size,
        diagrams: [...value.diagrams].sort(),
        domains: [...value.domains].sort()
      }])
  ),
  controlFamilies,
  diagrams
};

fs.writeFileSync(outputPath, `${JSON.stringify(results, null, 2)}\n`);
console.log(JSON.stringify(results.corpus, null, 2));

if (files.length !== 10 || diagrams.length !== 100) {
  console.error(`Corpus incomplete: expected 10 files / 100 diagrams, found ${files.length} / ${diagrams.length}.`);
  process.exitCode = 2;
}
