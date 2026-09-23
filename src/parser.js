import { decodeText } from "./text.js";
import {
  ARROW_PATTERN,
  GROUP_LINE_PATTERN,
  MESSAGE_PROPERTY_LINE_PATTERN,
} from "./grammar.js";
import { visitMessages } from "./document.js";

const ACTOR_FORBIDDEN_PATTERN = /:|-->|->x|->/;
const SUPPORTED_ARROWS = new Set(["->", "-->", "->x"]);
// Arrow-like punctuation runs, including forms other notations use. Only
// consulted to explain a line that already failed to parse.
const ARROW_RUN_PATTERN =
  /<{1,2}[-=~.]+(?:>{1,2}|x(?![\p{L}\p{N}]))?|-+(?:>{1,2}(?:[xo](?![\p{L}\p{N}]))?|\)|x(?![\p{L}\p{N}]))|[-=~.]*[=~.][-=~.]*>{1,2}|[←→↔⇐⇒⇔⟵⟶]/u;
const PROPERTY_SHAPE_PATTERN = /^([A-Za-z][A-Za-z0-9-]*) +\S/;
const ACTOR_PROPERTIES = ["icon", "tag", "tooltip", "tooltip-icon"];
const MESSAGE_PROPERTIES = ["tag", "tooltip", "tooltip-icon"];
const DECLARE_ACTOR_HINT = "Declare actors as @Name lines before the timeline.";
const INDENT_BODY_HINT =
  "Indent the body by two spaces; groups end where the indentation ends.";
const SECTIONS_HINT =
  "Indent the body by two spaces and write each branch as a | section.";
// Keywords from other sequence-diagram notations, keyed in lowercase.
const FOREIGN_KEYWORD_HINTS = new Map([
  ["participant", DECLARE_ACTOR_HINT],
  ["actor", DECLARE_ACTOR_HINT],
  ["box", "Actors cannot be boxed; declare each one as @Name."],
  [
    "note",
    "Attach a tooltip or tag indented under the actor or message instead.",
  ],
  ["autonumber", "There is no numbering directive; remove this line."],
  ["title", "Write a title as a // comment before the diagram."],
  [
    "activate",
    "Activation bars are not part of the syntax; remove this line.",
  ],
  [
    "deactivate",
    "Activation bars are not part of the syntax; remove this line.",
  ],
  ["sequencediagram", "The diagram needs no type header; remove this line."],
  ["end", "Remove this line; groups end where the indentation ends."],
  ["else", "Write alternatives as | sections inside a choice group."],
  ["alt", SECTIONS_HINT],
  ["par", SECTIONS_HINT],
  ["loop", INDENT_BODY_HINT],
  ["opt", INDENT_BODY_HINT],
  ["break", INDENT_BODY_HINT],
  ["critical", INDENT_BODY_HINT],
  ["group", INDENT_BODY_HINT],
  [
    "rect",
    "Background rectangles are not supported; use a group with an indented body.",
  ],
]);

export class LinesAndArrowsSyntaxError extends SyntaxError {
  constructor(message, line) {
    super(`Line ${line}: ${message}`);
    this.name = "LinesAndArrowsSyntaxError";
    this.line = line;
  }
}

function fail(message, line) {
  throw new LinesAndArrowsSyntaxError(message, line);
}

function makeLine(raw, index) {
  if (raw.trim() === "") {
    return {
      number: index + 1,
      indent: 0,
      content: "",
      blank: true,
      comment: false,
    };
  }

  const trimmed = raw.trimStart();
  if (trimmed.startsWith("//")) {
    return {
      number: index + 1,
      indent: 0,
      content: trimmed,
      blank: false,
      comment: true,
    };
  }

  if (raw.includes("\t")) {
    fail("Tabs are not allowed; use two spaces per indentation level.", index + 1);
  }

  const leading = raw.match(/^ */)[0].length;
  if (leading % 2 !== 0) {
    fail("Indentation must use exactly two spaces per level.", index + 1);
  }
  const content = raw.slice(leading);
  return {
    number: index + 1,
    indent: leading / 2,
    content,
    blank: content.trim() === "",
    comment: false,
  };
}

const ARROW_RUN_SEARCH = new RegExp(ARROW_RUN_PATTERN, "gu");

// Returns the first arrow-like token in a line. Tokens without a visible
// arrowhead ("-x", "-)") count only between spaces, so "api-x" or "(see -)"
// in ordinary text is not mistaken for an arrow.
function findArrowToken(content) {
  for (const match of content.matchAll(ARROW_RUN_SEARCH)) {
    const [token] = match;
    if (
      /[<>←→↔⇐⇒⇔⟵⟶]/u.test(token) ||
      (/\s/.test(content[match.index - 1] ?? "") &&
        /\s/.test(content[match.index + token.length] ?? ""))
    ) {
      return match;
    }
  }
  return null;
}

function arrowProblem(content) {
  const match = findArrowToken(content);
  if (!match) {
    return null;
  }
  const [token] = match;
  if (!SUPPORTED_ARROWS.has(token)) {
    return `Unsupported arrow "${token}". Use ->, -->, or ->x; messages read from source to target, so swap the sides of a reversed arrow.`;
  }
  const before = content.slice(0, match.index);
  const after = content.slice(match.index + token.length);
  if (!after.trim() || after.trimStart().startsWith(":")) {
    return `A message needs a target after "${token}".`;
  }
  if (!before.trim()) {
    return `A message needs a source before "${token}".`;
  }
  if (!/\s$/.test(before) || !/^\s/.test(after)) {
    return `Missing spaces around the arrow. Write "${before.trimEnd()} ${token} ${after.trimStart()}".`;
  }
  return "Unsupported or malformed arrow expression.";
}

function withKeywordHint(message, keyword) {
  const hint = FOREIGN_KEYWORD_HINTS.get(keyword.toLowerCase());
  return hint ? `${message} ${hint}` : null;
}

function emptyGroupMessage(line, groupType) {
  const message = "A group must contain at least one timeline item.";
  return (
    withKeywordHint(message, groupType) ??
    arrowProblem(line.content) ??
    message
  );
}

function unexpectedLineMessage(content) {
  const message = "Expected a message, group, or gap.";
  return (
    withKeywordHint(message, content.split(/\s/, 1)[0]) ??
    arrowProblem(content) ??
    message
  );
}

function assertText(value, label, line, options = {}) {
  const text = decodeText(value).trim();
  if (!text) {
    fail(`${label} cannot be empty.`, line);
  }
  if (options.multiline === false && text.includes("\n")) {
    fail(`${label} must stay on one line.`, line);
  }
  return text;
}

function optionalText(value) {
  const text = decodeText(value).trim();
  return text || null;
}

function assertActorName(value, line) {
  const name = assertText(value, "Actor name", line, {
    multiline: false,
  });
  if (
    ACTOR_FORBIDDEN_PATTERN.test(name) ||
    name.startsWith("@") ||
    name.startsWith("|") ||
    name.startsWith("//")
  ) {
    fail(`Invalid actor name "${name}".`, line);
  }
  return name;
}

function createCursor(source) {
  const withoutMark = source.startsWith("\uFEFF") ? source.slice(1) : source;
  const normalized = withoutMark.replace(/\r\n?/g, "\n");
  return {
    lines: normalized.split("\n").map(makeLine),
    index: 0,
  };
}

function consumeHeader(cursor) {
  const comments = [];

  while (cursor.index < cursor.lines.length) {
    const line = cursor.lines[cursor.index];
    if (line.comment) {
      comments.push(line.content.slice(2).trim());
      cursor.index += 1;
      continue;
    }
    if (line.blank) {
      cursor.index += 1;
      continue;
    }
    break;
  }

  for (let index = cursor.index; index < cursor.lines.length; index += 1) {
    const line = cursor.lines[index];
    if (line.comment) {
      fail("Comments are only allowed before the diagram.", line.number);
    }
  }

  return comments;
}

function skipBlankLines(cursor) {
  while (cursor.lines[cursor.index]?.blank) {
    cursor.index += 1;
  }
}

function nextContentIndex(cursor, index) {
  let next = index;
  while (cursor.lines[next]?.blank) {
    next += 1;
  }
  return next;
}

// A "word value" line at property depth that cannot be a timeline item: not
// an arrow expression, gap, section, declaration, or group with a body.
function looksLikeProperty(cursor, index) {
  const line = cursor.lines[index];
  const match = line.content.match(PROPERTY_SHAPE_PATTERN);
  if (!match || match[1] === "gap" || findArrowToken(line.content)) {
    return false;
  }
  const next = cursor.lines[nextContentIndex(cursor, index + 1)];
  return !next || next.indent <= line.indent;
}

// A line shaped like both a message and a group ("critical Retry A -> B")
// is a message when its source is one word, because the group label would
// begin with the arrow. Otherwise the more-indented line that follows
// decides: a message property or nothing makes it a message, and a timeline
// item or section makes it a group.
function arrowLineIsGroup(cursor, line, messageMatch) {
  if (!/\s/.test(messageMatch[1])) {
    return false;
  }
  const nextIndex = nextContentIndex(cursor, cursor.index + 1);
  const next = cursor.lines[nextIndex];
  if (!next || next.indent <= line.indent) {
    return false;
  }
  return !(
    MESSAGE_PROPERTY_LINE_PATTERN.test(next.content) ||
    looksLikeProperty(cursor, nextIndex)
  );
}

function unknownPropertyMessage(key, owner, names) {
  const message = `Unknown ${owner} property "${key}".`;
  const lowercase = key.toLowerCase();
  if (names.includes(lowercase)) {
    return `${message} Property names are lowercase: use "${lowercase}".`;
  }
  const list = `${names.slice(0, -1).join(", ")}, and ${names.at(-1)}`;
  const title = `${owner[0].toUpperCase()}${owner.slice(1)}`;
  return `${message} ${title} properties are ${list}.`;
}

function parseProperties(cursor, indent, owner, names) {
  const allowed = new Set(names);
  const properties = {};
  skipBlankLines(cursor);

  while (cursor.index < cursor.lines.length) {
    const line = cursor.lines[cursor.index];

    if (line.indent < indent) {
      break;
    }
    if (line.indent > indent) {
      fail("Unexpected extra indentation.", line.number);
    }

    const separator = line.content.indexOf(" ");
    const key = separator === -1 ? line.content : line.content.slice(0, separator);
    if (!allowed.has(key)) {
      if (looksLikeProperty(cursor, cursor.index)) {
        fail(unknownPropertyMessage(key, owner, names), line.number);
      }
      break;
    }

    if (Object.hasOwn(properties, key)) {
      fail(`Duplicate ${key} property.`, line.number);
    }

    const value = separator === -1 ? "" : line.content.slice(separator + 1);
    properties[key] = assertText(
      value,
      `${key} value`,
      line.number,
      {
        multiline: key === "tooltip",
      },
    );
    cursor.index += 1;
    skipBlankLines(cursor);
  }

  return properties;
}

function parseActor(cursor) {
  const line = cursor.lines[cursor.index];
  const name = assertActorName(line.content.slice(1), line.number);
  cursor.index += 1;

  const properties = parseProperties(cursor, 1, "actor", ACTOR_PROPERTIES);

  return {
    type: "actor",
    name,
    icon: properties.icon ?? null,
    tag: properties.tag ?? null,
    tooltip: properties.tooltip ?? null,
    tooltipIcon: properties["tooltip-icon"] ?? null,
    line: line.number,
  };
}

function parseMessage(cursor, line, match) {
  const source = assertActorName(match[1], line.number);
  const arrow = match[2];
  const target = assertActorName(match[3], line.number);
  const label =
    match[4] === undefined
      ? null
      : assertText(match[4], "Message label", line.number);
  cursor.index += 1;

  const properties = parseProperties(
    cursor,
    line.indent + 1,
    "message",
    MESSAGE_PROPERTIES,
  );

  return {
    type: "message",
    source,
    target,
    arrow,
    label,
    tag: properties.tag ?? null,
    tooltip: properties.tooltip ?? null,
    tooltipIcon: properties["tooltip-icon"] ?? null,
    line: line.number,
  };
}

function parseSection(cursor, indent) {
  const line = cursor.lines[cursor.index];
  if (line.indent !== indent || !line.content.startsWith("|")) {
    fail("Expected a group section.", line.number);
  }
  if (line.content !== "|" && !line.content.startsWith("| ")) {
    fail(
      'A section label must be separated from "|" by a space.',
      line.number,
    );
  }

  const label = assertText(line.content.slice(1), "Section label", line.number);
  cursor.index += 1;
  const items = parseItems(cursor, indent + 1);

  if (items.length === 0) {
    fail("A section must contain at least one timeline item.", line.number);
  }

  return {
    type: "section",
    label,
    items,
  };
}

function parseSections(cursor, indent) {
  const sections = [];

  while (cursor.index < cursor.lines.length) {
    const sectionLine = cursor.lines[cursor.index];
    if (sectionLine.indent < indent) {
      break;
    }
    if (sectionLine.indent !== indent) {
      fail("Unexpected indentation in group sections.", sectionLine.number);
    }
    if (!sectionLine.content.startsWith("|")) {
      fail(
        "A group cannot mix direct timeline items and sections.",
        sectionLine.number,
      );
    }
    sections.push(parseSection(cursor, indent));
  }

  return sections;
}

function parseGroup(cursor, line, match) {
  const groupType = match[1];
  const label = optionalText(match[2]);
  cursor.index += 1;
  const bodyIndent = line.indent + 1;
  skipBlankLines(cursor);

  const next = cursor.lines[cursor.index];
  if (!next || next.indent <= line.indent) {
    fail(emptyGroupMessage(line, groupType), line.number);
  }
  if (next.indent !== bodyIndent) {
    fail("Group contents must be indented by one level.", next.number);
  }

  let body;

  if (next.content.startsWith("|")) {
    body = parseSections(cursor, bodyIndent);
  } else {
    body = parseItems(cursor, bodyIndent);
    if (body.length === 0) {
      fail(emptyGroupMessage(line, groupType), line.number);
    }
    const nextLine = cursor.lines[cursor.index];
    if (
      nextLine?.indent === bodyIndent &&
      nextLine.content.startsWith("|")
    ) {
      fail(
        "A group cannot mix direct timeline items and sections.",
        nextLine.number,
      );
    }
  }

  return {
    type: "group",
    groupType,
    label,
    body,
  };
}

function parseGap(cursor, line) {
  const label = assertText(line.content.slice(4), "Gap label", line.number);
  cursor.index += 1;

  const next = cursor.lines[nextContentIndex(cursor, cursor.index)];
  if (next?.indent > line.indent) {
    fail(
      'The reserved "gap" keyword cannot introduce a group body.',
      line.number,
    );
  }

  return {
    type: "gap",
    label,
  };
}

function parseItems(cursor, indent) {
  const items = [];
  skipBlankLines(cursor);

  while (cursor.index < cursor.lines.length) {
    const line = cursor.lines[cursor.index];
    if (line.indent < indent) {
      break;
    }
    if (line.indent > indent) {
      fail("Unexpected extra indentation.", line.number);
    }
    if (line.content.startsWith("|")) {
      break;
    }
    if (line.content.startsWith("@")) {
      fail("Actor declarations must appear before the timeline.", line.number);
    }

    if (line.content.startsWith("gap ")) {
      items.push(parseGap(cursor, line));
      skipBlankLines(cursor);
      continue;
    }
    if (line.content === "gap") {
      fail("Gap text cannot be empty.", line.number);
    }

    const messageMatch = line.content.match(ARROW_PATTERN);
    const groupMatch = line.content.trimEnd().match(GROUP_LINE_PATTERN);
    if (
      messageMatch &&
      !(groupMatch && arrowLineIsGroup(cursor, line, messageMatch))
    ) {
      items.push(parseMessage(cursor, line, messageMatch));
      skipBlankLines(cursor);
      continue;
    }

    if (groupMatch) {
      items.push(parseGroup(cursor, line, groupMatch));
      skipBlankLines(cursor);
      continue;
    }

    if (line.content.includes("->")) {
      fail(
        arrowProblem(line.content) ??
          "Unsupported or malformed arrow expression.",
        line.number,
      );
    }

    fail(unexpectedLineMessage(line.content), line.number);
  }

  return items;
}

function resolveActors(declaredActors, items) {
  const byName = new Map();
  for (const actor of declaredActors) {
    if (byName.has(actor.name)) {
      fail(`Duplicate actor "${actor.name}".`, actor.line);
    }
    byName.set(actor.name, actor);
  }

  const actors = [...declaredActors];
  visitMessages(items, (message) => {
    for (const name of [message.source, message.target]) {
      if (!byName.has(name)) {
        const actor = {
          type: "actor",
          name,
          icon: null,
          tag: null,
          tooltip: null,
          tooltipIcon: null,
          line: message.line,
        };
        byName.set(name, actor);
        actors.push(actor);
      }
    }
  });
  return actors;
}

function publicActor(actor) {
  const {
    line: _line,
    ...result
  } = actor;
  return result;
}

function publicItem(item) {
  const { line: _line, ...result } = item;
  if (item.type !== "group") {
    return result;
  }

  return {
    ...result,
    body: item.body.map((child) => {
      if (child.type !== "section") {
        return publicItem(child);
      }
      const { line: _sectionLine, ...publicSection } = child;
      return {
        ...publicSection,
        items: child.items.map(publicItem),
      };
    }),
  };
}

export function parse(source) {
  const cursor = createCursor(source);
  const declaredActors = [];
  const comments = consumeHeader(cursor);

  while (cursor.index < cursor.lines.length) {
    const line = cursor.lines[cursor.index];
    if (line.indent === 0 && line.content.startsWith("@")) {
      declaredActors.push(parseActor(cursor));
      skipBlankLines(cursor);
      continue;
    }
    break;
  }

  const items = parseItems(cursor, 0);

  if (cursor.index < cursor.lines.length) {
    const line = cursor.lines[cursor.index];
    fail("Unexpected content.", line.number);
  }
  if (items.length === 0) {
    fail("A diagram must contain at least one timeline item.", 1);
  }

  const actors = resolveActors(declaredActors, items);
  return {
    type: "diagram",
    actors: actors.map(publicActor),
    items: items.map(publicItem),
    comments,
  };
}
