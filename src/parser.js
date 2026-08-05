import { decodeText } from "./text.js";

const ARROW_PATTERN =
  /^(.*?)\s+(-->|->x|->)\s+([^:]+?)(?::\s*(.*))?$/;
const GROUP_PATTERN = /^([a-z][a-z0-9-]*)(?:\s+(.+))?$/;
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
      raw,
      number: index + 1,
      indent: 0,
      content: "",
      blank: true,
      comment: false,
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
    raw,
    number: index + 1,
    indent: leading / 2,
    content,
    blank: content.trim() === "",
    comment: content.startsWith("//"),
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
  const normalized = String(source ?? "").replace(/\r\n?/g, "\n");
  return {
    lines: normalized.split("\n").map(makeLine),
    index: 0,
  };
}

function consumeTrivia(cursor, minimumIndent = 0) {
  const comments = [];

  while (cursor.index < cursor.lines.length) {
    const line = cursor.lines[cursor.index];
    if (line.comment) {
      if (line.indent < minimumIndent) {
        break;
      }
      comments.push({
        type: "comment",
        text: line.content.slice(2).trim(),
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

  return comments;
}

function relativeComments(comments, ownerIndent) {
  return comments.map((comment) => ({
    type: "comment",
    text: comment.text,
    indent: comment.indent - ownerIndent,
  }));
}

function parseProperties(cursor, indent, allowed) {
  const properties = {};
  const propertyComments = [];
  const ownerIndent = indent - 1;
  let after = "header";

  function attach(comments) {
    propertyComments.push(
      ...relativeComments(comments, ownerIndent).map((comment) => ({
        ...comment,
        after,
      })),
    );
  }

  attach(consumeTrivia(cursor, indent));

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
    after = key;
    attach(consumeTrivia(cursor, indent));
  }

  return { properties, propertyComments };
}

function parseActor(cursor, leadingComments = []) {
  const line = cursor.lines[cursor.index];
  const name = assertActorName(line.content.slice(1), line.number);
  cursor.index += 1;

  const { properties, propertyComments } = parseProperties(
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
    leadingComments: relativeComments(leadingComments, line.indent),
    propertyComments,
  };
}

function parseMessage(cursor, line, match, path, leadingComments = []) {
  const source = assertActorName(match[1], line.number);
  const arrow = match[2];
  const target = assertActorName(match[3], line.number);
  const label =
    match[4] === undefined
      ? null
      : assertText(match[4], "Message label", line.number);
  cursor.index += 1;

  const { properties, propertyComments } = parseProperties(
    cursor,
    line.indent + 1,
    new Set(["tag", "tooltip", "tooltip-icon"]),
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
    tooltipIcon: properties["tooltip-icon"] ?? null,
    line: line.number,
    leadingComments: relativeComments(leadingComments, line.indent),
    propertyComments,
  };
}

function parseSection(
  cursor,
  indent,
  groupPath,
  sectionIndex,
  leadingComments = [],
) {
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
  const bodyComments = consumeTrivia(cursor, indent + 1);
  const parsedBody = parseItems(
    cursor,
    indent + 1,
    [...groupPath, sectionIndex],
    bodyComments,
    indent,
  );

  if (parsedBody.items.length === 0) {
    fail("A section must contain at least one timeline item.", line.number);
  }

  return {
    type: "section",
    id: `section:${[...groupPath, sectionIndex].join(".")}`,
    label,
    items: parsedBody.items,
    line: line.number,
    leadingComments: relativeComments(leadingComments, line.indent),
    bodyTrailingComments: parsedBody.trailingComments,
  };
}

function parseSections(
  cursor,
  indent,
  groupPath,
  initialComments,
  ownerIndent,
) {
  const sections = [];
  let pendingComments = initialComments;

  while (cursor.index < cursor.lines.length) {
    const sectionLine = cursor.lines[cursor.index];
    if (!sectionLine || sectionLine.indent < indent) {
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
    sections.push(
      parseSection(
        cursor,
        indent,
        groupPath,
        sections.length,
        pendingComments,
      ),
    );
    pendingComments = consumeTrivia(cursor, indent);
  }

  return {
    sections,
    trailingComments: relativeComments(pendingComments, ownerIndent),
  };
}

function parseGroup(cursor, line, match, path, leadingComments = []) {
  const groupType = match[1];
  const label = optionalText(match[2]);
  cursor.index += 1;
  const bodyIndent = line.indent + 1;
  const bodyComments = consumeTrivia(cursor, bodyIndent);

  const next = cursor.lines[cursor.index];
  if (!next || next.indent <= line.indent) {
    fail("A group must contain at least one timeline item.", line.number);
  }
  if (next.indent !== bodyIndent) {
    fail("Group contents must be indented by one level.", next.number);
  }

  const groupPath = path;
  let sections = [];
  let items = [];
  let bodyTrailingComments = [];

  if (next.content.startsWith("|")) {
    const parsedSections = parseSections(
      cursor,
      bodyIndent,
      groupPath,
      bodyComments,
      line.indent,
    );
    sections = parsedSections.sections;
    bodyTrailingComments = parsedSections.trailingComments;
  } else {
    const parsedBody = parseItems(
      cursor,
      bodyIndent,
      groupPath,
      bodyComments,
      line.indent,
    );
    items = parsedBody.items;
    bodyTrailingComments = parsedBody.trailingComments;
    if (items.length === 0) {
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
    id: `item:${path.join(".")}`,
    groupType,
    label,
    items,
    sections,
    line: line.number,
    leadingComments: relativeComments(leadingComments, line.indent),
    bodyTrailingComments,
  };
}

function parseGap(cursor, line, path, leadingComments = []) {
  const label = assertText(line.content.slice(4), "Gap label", line.number);
  cursor.index += 1;

  let nextIndex = cursor.index;
  while (
    cursor.lines[nextIndex]?.blank ||
    cursor.lines[nextIndex]?.comment
  ) {
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
    id: `item:${path.join(".")}`,
    label,
    line: line.number,
    leadingComments: relativeComments(leadingComments, line.indent),
  };
}

function parseItems(
  cursor,
  indent,
  parentPath = [],
  initialComments,
  ownerIndent = Math.max(0, indent - 1),
) {
  const items = [];
  let pendingComments =
    initialComments ?? consumeTrivia(cursor, indent);

  while (cursor.index < cursor.lines.length) {
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
      items.push(parseGap(cursor, line, path, pendingComments));
      pendingComments = consumeTrivia(cursor, indent);
      continue;
    }
    if (line.content === "gap") {
      fail("Gap text cannot be empty.", line.number);
    }

    const messageMatch = line.content.match(ARROW_PATTERN);
    if (messageMatch) {
      items.push(
        parseMessage(cursor, line, messageMatch, path, pendingComments),
      );
      pendingComments = consumeTrivia(cursor, indent);
      continue;
    }

    if (line.content.includes("->")) {
      fail("Unsupported or malformed arrow expression.", line.number);
    }

    const groupMatch = line.content.trimEnd().match(GROUP_PATTERN);
    if (groupMatch) {
      items.push(
        parseGroup(cursor, line, groupMatch, path, pendingComments),
      );
      pendingComments = consumeTrivia(cursor, indent);
      continue;
    }

    fail("Expected a message, group, or gap.", line.number);
  }

  return {
    items,
    trailingComments: relativeComments(pendingComments, ownerIndent),
  };
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
          tooltipIcon: null,
          line: message.line,
          inferred: true,
          leadingComments: [],
          propertyComments: [],
        };
        byName.set(name, actor);
        inferred.push(actor);
      }
    }
  });
  return inferred;
}

function publicActor(actor) {
  const { line: _line, ...result } = actor;
  return result;
}

function publicItem(item) {
  const { line: _line, ...result } = item;
  if (item.type !== "group") {
    return result;
  }

  return {
    ...result,
    items: item.items.map(publicItem),
    sections: item.sections.map((section) => {
      const { line: _sectionLine, ...publicSection } = section;
      return {
        ...publicSection,
        items: section.items.map(publicItem),
      };
    }),
  };
}

export function parse(source) {
  const cursor = createCursor(source);
  const explicitActors = [];
  const leadingComments = relativeComments(
    consumeTrivia(cursor, 0),
    0,
  );
  let pendingComments = [];

  while (cursor.index < cursor.lines.length) {
    const line = cursor.lines[cursor.index];
    if (line.indent === 0 && line.content.startsWith("@")) {
      explicitActors.push(parseActor(cursor, pendingComments));
      pendingComments = consumeTrivia(cursor, 0);
      continue;
    }
    break;
  }

  const parsedTimeline = parseItems(
    cursor,
    0,
    [],
    pendingComments,
    0,
  );

  if (cursor.index < cursor.lines.length) {
    const line = cursor.lines[cursor.index];
    fail("Unexpected content.", line.number);
  }
  if (parsedTimeline.items.length === 0) {
    fail("A diagram must contain at least one timeline item.", 1);
  }

  const actors = resolveActors(explicitActors, parsedTimeline.items);
  return {
    type: "diagram",
    actors: actors.map(publicActor),
    items: parsedTimeline.items.map(publicItem),
    leadingComments,
    trailingComments: parsedTimeline.trailingComments,
    explicitActors: explicitActors.length > 0,
  };
}
