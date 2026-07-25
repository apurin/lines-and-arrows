const ARROW_PATTERN =
  /^(.*?)\s+(-->|->x|->)\s+([^:]+?)(?::\s*(.*))?$/;
const GROUP_PATTERN = /^([a-z][a-z0-9-]*)\s+(.+)$/;
const ACTOR_FORBIDDEN_PATTERN = /:|-->|->x|->/;

export class LinesAndArrowsSyntaxError extends SyntaxError {
  constructor(message, line, column = 1) {
    super(`Line ${line}, column ${column}: ${message}`);
    this.name = "LinesAndArrowsSyntaxError";
    this.line = line;
    this.column = column;
  }
}

function fail(message, line, column = 1) {
  throw new LinesAndArrowsSyntaxError(message, line, column);
}

function makeLine(raw, index) {
  if (raw.includes("\t")) {
    fail("Tabs are not allowed; use two spaces per indentation level.", index + 1);
  }

  const leading = raw.match(/^ */)[0].length;
  if (leading % 2 !== 0) {
    fail("Indentation must use exactly two spaces per level.", index + 1);
  }

  const content = raw.slice(leading);
  return {
    raw,
    number: index + 1,
    indent: leading / 2,
    content,
    blank: content.trim() === "",
    comment: content.startsWith("//"),
  };
}

function assertText(value, label, line) {
  const text = value.trim();
  if (!text) {
    fail(`${label} cannot be empty.`, line);
  }
  return text;
}

function assertActorName(value, line) {
  const name = assertText(value, "Actor name", line);
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
  const normalized = String(source ?? "").replace(/\r\n?/g, "\n");
  return {
    lines: normalized.split("\n").map(makeLine),
    index: 0,
    comments: [],
  };
}

function consumeTrivia(cursor) {
  while (cursor.index < cursor.lines.length) {
    const line = cursor.lines[cursor.index];
    if (line.comment) {
      cursor.comments.push({
        type: "comment",
        text: line.content.slice(2).trim(),
        line: line.number,
        indent: line.indent,
      });
      cursor.index += 1;
      continue;
    }
    if (line.blank) {
      cursor.index += 1;
      continue;
    }
    break;
  }
}

function parseProperties(cursor, indent, allowed) {
  const properties = {};

  while (cursor.index < cursor.lines.length) {
    const line = cursor.lines[cursor.index];

    if (line.blank || line.comment) {
      consumeTrivia(cursor);
      continue;
    }

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
    properties[key] = assertText(value, `${key} value`, line.number);
    cursor.index += 1;
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
    new Set(["icon", "tag", "tooltip"]),
  );

  return {
    type: "actor",
    name,
    icon: properties.icon ?? null,
    tag: properties.tag ?? null,
    tooltip: properties.tooltip ?? null,
    line: line.number,
  };
}

function parseMessage(cursor, line, match, path) {
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
    new Set(["tag", "tooltip"]),
  );

  return {
    type: "message",
    id: `item:${path.join(".")}`,
    source,
    target,
    arrow,
    label,
    tag: properties.tag ?? null,
    tooltip: properties.tooltip ?? null,
    line: line.number,
  };
}

function nextSignificantLine(cursor) {
  let index = cursor.index;
  while (index < cursor.lines.length) {
    const line = cursor.lines[index];
    if (!line.blank && !line.comment) {
      return line;
    }
    index += 1;
  }
  return null;
}

function parseSection(cursor, indent, groupPath, sectionIndex) {
  const line = cursor.lines[cursor.index];
  if (line.indent !== indent || !line.content.startsWith("|")) {
    fail("Expected a group section.", line.number);
  }

  const label = assertText(line.content.slice(1), "Section label", line.number);
  cursor.index += 1;
  const items = parseItems(cursor, indent + 1, [...groupPath, sectionIndex]);

  if (items.length === 0) {
    fail("A section must contain at least one timeline item.", line.number);
  }

  return {
    type: "section",
    id: `section:${[...groupPath, sectionIndex].join(".")}`,
    label,
    items,
    line: line.number,
  };
}

function parseGroup(cursor, line, match, path) {
  const groupType = match[1];
  const label = assertText(match[2], "Group label", line.number);
  cursor.index += 1;
  consumeTrivia(cursor);

  const next = nextSignificantLine(cursor);
  if (!next || next.indent <= line.indent) {
    fail("A group must contain at least one timeline item.", line.number);
  }
  if (next.indent !== line.indent + 1) {
    fail("Group contents must be indented by one level.", next.number);
  }

  const groupPath = path;
  const sections = [];
  let items = [];

  if (next.content.startsWith("|")) {
    let sectionIndex = 0;
    while (cursor.index < cursor.lines.length) {
      consumeTrivia(cursor);
      const sectionLine = cursor.lines[cursor.index];
      if (!sectionLine || sectionLine.indent < line.indent + 1) {
        break;
      }
      if (sectionLine.indent !== line.indent + 1) {
        fail("Unexpected indentation in group sections.", sectionLine.number);
      }
      if (!sectionLine.content.startsWith("|")) {
        fail(
          "A group cannot mix direct timeline items and sections.",
          sectionLine.number,
        );
      }
      sections.push(
        parseSection(cursor, line.indent + 1, groupPath, sectionIndex),
      );
      sectionIndex += 1;
    }
  } else {
    items = parseItems(cursor, line.indent + 1, groupPath);
    if (items.length === 0) {
      fail("A group must contain at least one timeline item.", line.number);
    }
  }

  return {
    type: "group",
    id: `item:${path.join(".")}`,
    groupType,
    label,
    items,
    sections,
    line: line.number,
  };
}

function parseGap(cursor, line, path) {
  const label = assertText(line.content.slice(4), "Gap label", line.number);
  cursor.index += 1;
  return {
    type: "gap",
    id: `item:${path.join(".")}`,
    label,
    line: line.number,
  };
}

function parseItems(cursor, indent, parentPath = []) {
  const items = [];

  while (cursor.index < cursor.lines.length) {
    consumeTrivia(cursor);
    const line = cursor.lines[cursor.index];
    if (!line) {
      break;
    }

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

    const path = [...parentPath, items.length];

    if (line.content.startsWith("gap ")) {
      items.push(parseGap(cursor, line, path));
      continue;
    }
    if (line.content === "gap") {
      fail("Gap text cannot be empty.", line.number);
    }

    const messageMatch = line.content.match(ARROW_PATTERN);
    if (messageMatch) {
      items.push(parseMessage(cursor, line, messageMatch, path));
      continue;
    }

    if (
      line.content.includes("->") ||
      line.content.includes("~>") ||
      line.content.includes("->>")
    ) {
      fail("Unsupported or malformed arrow expression.", line.number);
    }

    const groupMatch = line.content.match(GROUP_PATTERN);
    if (groupMatch) {
      items.push(parseGroup(cursor, line, groupMatch, path));
      continue;
    }

    fail("Expected a message, group, or gap.", line.number);
  }

  return items;
}

function visitMessages(items, visitor) {
  for (const item of items) {
    if (item.type === "message") {
      visitor(item);
      continue;
    }
    if (item.type !== "group") {
      continue;
    }
    if (item.sections.length > 0) {
      for (const section of item.sections) {
        visitMessages(section.items, visitor);
      }
    } else {
      visitMessages(item.items, visitor);
    }
  }
}

function resolveActors(explicitActors, items) {
  const byName = new Map();
  for (const actor of explicitActors) {
    if (byName.has(actor.name)) {
      fail(`Duplicate actor "${actor.name}".`, actor.line);
    }
    byName.set(actor.name, actor);
  }

  if (explicitActors.length > 0) {
    visitMessages(items, (message) => {
      for (const name of [message.source, message.target]) {
        if (!byName.has(name)) {
          fail(`Unknown actor "${name}".`, message.line);
        }
      }
    });
    return explicitActors;
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
          line: message.line,
          inferred: true,
        };
        byName.set(name, actor);
        inferred.push(actor);
      }
    }
  });
  return inferred;
}

export function parse(source) {
  const cursor = createCursor(source);
  const explicitActors = [];

  consumeTrivia(cursor);
  while (cursor.index < cursor.lines.length) {
    const line = cursor.lines[cursor.index];
    if (line.indent === 0 && line.content.startsWith("@")) {
      explicitActors.push(parseActor(cursor));
      consumeTrivia(cursor);
      continue;
    }
    break;
  }

  const items = parseItems(cursor, 0);
  consumeTrivia(cursor);

  if (cursor.index < cursor.lines.length) {
    const line = cursor.lines[cursor.index];
    fail("Unexpected content.", line.number);
  }
  if (items.length === 0) {
    fail("A diagram must contain at least one timeline item.", 1);
  }

  const actors = resolveActors(explicitActors, items);
  return {
    type: "diagram",
    actors,
    items,
    comments: cursor.comments,
    explicitActors: explicitActors.length > 0,
  };
}
