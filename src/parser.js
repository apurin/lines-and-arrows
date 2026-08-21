import { decodeText } from "./text.js";
import { GROUP_LINE_PATTERN } from "./grammar.js";
import { visitMessages } from "./document.js";

const ARROW_PATTERN =
  /^(.*?)\s+(-->|->x|->)\s+([^:]+?)(?::\s*(.*))?$/;
const ACTOR_FORBIDDEN_PATTERN = /:|-->|->x|->/;

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
  const normalized = source.replace(/\r\n?/g, "\n");
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

function parseProperties(cursor, indent, allowed) {
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

  const properties = parseProperties(
    cursor,
    1,
    new Set(["icon", "tag", "tooltip", "tooltip-icon"]),
  );

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
    new Set(["tag", "tooltip", "tooltip-icon"]),
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
    fail("A group must contain at least one timeline item.", line.number);
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
      fail("A group must contain at least one timeline item.", line.number);
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

  let nextIndex = cursor.index;
  while (cursor.lines[nextIndex]?.blank) {
    nextIndex += 1;
  }
  if (cursor.lines[nextIndex]?.indent > line.indent) {
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
    if (messageMatch) {
      items.push(parseMessage(cursor, line, messageMatch));
      skipBlankLines(cursor);
      continue;
    }

    if (line.content.includes("->")) {
      fail("Unsupported or malformed arrow expression.", line.number);
    }

    const groupMatch = line.content.trimEnd().match(GROUP_LINE_PATTERN);
    if (groupMatch) {
      items.push(parseGroup(cursor, line, groupMatch));
      skipBlankLines(cursor);
      continue;
    }

    fail("Expected a message, group, or gap.", line.number);
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

  if (declaredActors.length > 0) {
    visitMessages(items, (message) => {
      for (const name of [message.source, message.target]) {
        if (!byName.has(name)) {
          fail(`Unknown actor "${name}".`, message.line);
        }
      }
    });
    return declaredActors;
  }

  const inferred = [];
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
        inferred.push(actor);
      }
    }
  });
  return inferred;
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
