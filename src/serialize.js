import { parse } from "./parser.js";
import { encodeText } from "./text.js";
import {
  isGroupType,
  MAX_NESTING_DEPTH,
} from "./grammar.js";

function requireArray(value, path) {
  if (!Array.isArray(value)) {
    throw new TypeError(`${path} must be an array.`);
  }
}

function requireString(value, path) {
  if (typeof value !== "string") {
    throw new TypeError(`${path} must be a string.`);
  }
}

function requireOptionalString(value, path) {
  if (value !== null && value !== undefined) {
    requireString(value, path);
  }
}

function commentList(owner, property, path, options = {}) {
  const value = owner[property];
  if (value === undefined) {
    return [];
  }
  requireArray(value, `${path}.${property}`);
  value.forEach((comment, index) => {
    const commentPath = `${path}.${property}[${index}]`;
    if (
      !comment ||
      typeof comment !== "object" ||
      comment.type !== "comment"
    ) {
      throw new TypeError(`${commentPath} must be a comment.`);
    }
    requireString(comment.text, `${commentPath}.text`);
    if (
      !Number.isInteger(comment.indent) ||
      comment.indent < 0
    ) {
      throw new TypeError(
        `${commentPath}.indent must be a non-negative integer.`,
      );
    }
    if (options.anchors && !options.anchors.includes(comment.after)) {
      throw new TypeError(
        `${commentPath}.after must name a supported property anchor.`,
      );
    }
  });
  return value;
}

function assertTimelineStructure(items, path, depth = 0) {
  requireArray(items, path);

  items.forEach((item, index) => {
    const itemPath = `${path}[${index}]`;
    if (!item || typeof item !== "object") {
      throw new TypeError(`${itemPath} must be a timeline item.`);
    }
    if (item.type === "message") {
      requireString(item.source, `${itemPath}.source`);
      requireString(item.target, `${itemPath}.target`);
      requireString(item.arrow, `${itemPath}.arrow`);
      requireOptionalString(item.label, `${itemPath}.label`);
      requireOptionalString(item.tag, `${itemPath}.tag`);
      requireOptionalString(item.tooltip, `${itemPath}.tooltip`);
      requireOptionalString(
        item.tooltipIcon,
        `${itemPath}.tooltipIcon`,
      );
      commentList(item, "leadingComments", itemPath);
      commentList(item, "propertyComments", itemPath, {
        anchors: ["header", "tag", "tooltip", "tooltip-icon"],
      });
      return;
    }
    if (item.type === "gap") {
      requireString(item.label, `${itemPath}.label`);
      commentList(item, "leadingComments", itemPath);
      return;
    }
    if (item.type !== "group") {
      throw new TypeError(
        `${itemPath} has unsupported type "${String(item.type)}".`,
      );
    }

    requireString(item.groupType, `${itemPath}.groupType`);
    if (!isGroupType(item.groupType)) {
      throw new TypeError(
        `${itemPath}.groupType must start with a lowercase letter, contain only lowercase letters, numbers, or hyphens, and cannot be the reserved "gap" keyword.`,
      );
    }
    if (depth >= MAX_NESTING_DEPTH) {
      throw new TypeError(
        `${itemPath} exceeds the maximum group nesting depth of ${MAX_NESTING_DEPTH}.`,
      );
    }
    requireOptionalString(item.label, `${itemPath}.label`);
    commentList(item, "leadingComments", itemPath);
    commentList(item, "bodyTrailingComments", itemPath);
    requireArray(item.items, `${itemPath}.items`);
    requireArray(item.sections, `${itemPath}.sections`);
    if (item.items.length > 0 && item.sections.length > 0) {
      throw new TypeError(
        `${itemPath} cannot contain both direct items and sections.`,
      );
    }

    assertTimelineStructure(item.items, `${itemPath}.items`, depth + 1);
    item.sections.forEach((section, sectionIndex) => {
      const sectionPath = `${itemPath}.sections[${sectionIndex}]`;
      if (
        !section ||
        typeof section !== "object" ||
        section.type !== "section"
      ) {
        throw new TypeError(`${sectionPath} must be a section.`);
      }
      requireString(section.label, `${sectionPath}.label`);
      commentList(section, "leadingComments", sectionPath);
      commentList(section, "bodyTrailingComments", sectionPath);
      assertTimelineStructure(
        section.items,
        `${sectionPath}.items`,
        depth + 1,
      );
    });
  });
}

function assertDocumentStructure(document) {
  if (
    !document ||
    typeof document !== "object" ||
    document.type !== "diagram"
  ) {
    throw new TypeError('A document must have type "diagram".');
  }

  requireArray(document.actors, "document.actors");
  if (typeof document.explicitActors !== "boolean") {
    throw new TypeError("document.explicitActors must be a boolean.");
  }
  const actorNames = new Set();
  document.actors.forEach((actor, index) => {
    if (
      !actor ||
      typeof actor !== "object" ||
      actor.type !== "actor"
    ) {
      throw new TypeError(
        `document.actors[${index}] must be an actor.`,
      );
    }
    requireString(actor.name, `document.actors[${index}].name`);
    if (actorNames.has(actor.name)) {
      throw new TypeError(`Duplicate actor "${actor.name}".`);
    }
    actorNames.add(actor.name);
    requireOptionalString(actor.icon, `document.actors[${index}].icon`);
    requireOptionalString(actor.tag, `document.actors[${index}].tag`);
    requireOptionalString(
      actor.tooltip,
      `document.actors[${index}].tooltip`,
    );
    requireOptionalString(
      actor.tooltipIcon,
      `document.actors[${index}].tooltipIcon`,
    );
    commentList(actor, "leadingComments", `document.actors[${index}]`);
    commentList(actor, "propertyComments", `document.actors[${index}]`, {
      anchors: [
        "header",
        "icon",
        "tag",
        "tooltip",
        "tooltip-icon",
      ],
    });
  });
  commentList(document, "leadingComments", "document");
  commentList(document, "trailingComments", "document");
  assertTimelineStructure(document.items, "document.items");

  const inferredNames = [];
  const seenNames = new Set();
  const visitMessages = (items) => {
    for (const item of items) {
      if (item.type === "message") {
        for (const name of [item.source, item.target]) {
          if (!seenNames.has(name)) {
            seenNames.add(name);
            inferredNames.push(name);
          }
        }
        continue;
      }
      if (item.type !== "group") {
        continue;
      }
      if (item.sections.length > 0) {
        for (const section of item.sections) {
          visitMessages(section.items);
        }
      } else {
        visitMessages(item.items);
      }
    }
  };
  visitMessages(document.items);

  if (document.explicitActors) {
    if (document.actors.length === 0) {
      throw new TypeError(
        "document.actors must contain at least one actor when document.explicitActors is true.",
      );
    }
    for (const name of inferredNames) {
      if (!actorNames.has(name)) {
        throw new TypeError(
          `Unknown actor "${name}" while document.explicitActors is true.`,
        );
      }
    }
    return;
  }

  const actualNames = document.actors.map((actor) => actor.name);
  if (
    actualNames.length !== inferredNames.length ||
    actualNames.some((name, index) => name !== inferredNames[index])
  ) {
    throw new TypeError(
      "document.actors must exactly match first-use actor order when document.explicitActors is false.",
    );
  }
  document.actors.forEach((actor, index) => {
    if (
      actor.icon ||
      actor.tag ||
      actor.tooltip ||
      actor.tooltipIcon ||
      actor.leadingComments?.length > 0 ||
      actor.propertyComments?.length > 0
    ) {
      throw new TypeError(
        `document.actors[${index}] has declaration-only data; set document.explicitActors to true to preserve it.`,
      );
    }
  });
}

function sourceText(value) {
  return encodeText(String(value ?? "").trim());
}

function commentLines(comments, ownerIndent) {
  return comments.map((comment) => {
    const prefix = "  ".repeat(ownerIndent + comment.indent);
    return `${prefix}//${comment.text ? ` ${comment.text}` : ""}`;
  });
}

function propertyLines(item, names, indent) {
  const prefix = "  ".repeat(indent);
  const lines = [];
  const ownerIndent = indent - 1;
  const comments = item.propertyComments ?? [];

  lines.push(
    ...commentLines(
      comments.filter((comment) => comment.after === "header"),
      ownerIndent,
    ),
  );

  for (const name of names) {
    const property =
      name === "tooltip-icon" ? "tooltipIcon" : name;
    const value = item[property];
    if (value !== null && value !== undefined && String(value).trim()) {
      lines.push(`${prefix}${name} ${sourceText(value)}`);
    }
    lines.push(
      ...commentLines(
        comments.filter((comment) => comment.after === name),
        ownerIndent,
      ),
    );
  }

  return lines;
}

function timelineLines(items, indent) {
  const prefix = "  ".repeat(indent);
  const lines = [];

  for (const item of items) {
    lines.push(
      ...commentLines(item.leadingComments ?? [], indent),
    );

    if (item.type === "message") {
      const label = sourceText(item.label);
      lines.push(
        `${prefix}${sourceText(item.source)} ${item.arrow} ${sourceText(item.target)}${
          label ? `: ${label}` : ""
        }`,
      );
      lines.push(
        ...propertyLines(
          item,
          ["tag", "tooltip", "tooltip-icon"],
          indent + 1,
        ),
      );
      continue;
    }

    if (item.type === "gap") {
      lines.push(`${prefix}gap ${sourceText(item.label)}`);
      continue;
    }

    const label = sourceText(item.label);
    lines.push(
      `${prefix}${item.groupType}${label ? ` ${label}` : ""}`,
    );
    if (item.sections.length > 0) {
      for (const section of item.sections) {
        lines.push(
          ...commentLines(
            section.leadingComments ?? [],
            indent + 1,
          ),
        );
        lines.push(
          `${"  ".repeat(indent + 1)}| ${sourceText(section.label)}`,
        );
        lines.push(...timelineLines(section.items, indent + 2));
        lines.push(
          ...commentLines(
            section.bodyTrailingComments ?? [],
            indent + 1,
          ),
        );
      }
    } else {
      lines.push(...timelineLines(item.items, indent + 1));
    }
    lines.push(
      ...commentLines(item.bodyTrailingComments ?? [], indent),
    );
  }

  return lines;
}

export function serialize(document) {
  assertDocumentStructure(document);
  const blocks = [];
  const leadingComments = commentLines(
    document.leadingComments ?? [],
    0,
  ).join("\n");

  if (leadingComments) {
    blocks.push(leadingComments);
  }

  const needsDeclarations =
    document.explicitActors ||
    document.actors.some(
      (actor) =>
        actor.icon ||
        actor.tag ||
        actor.tooltip ||
        actor.tooltipIcon ||
        actor.leadingComments?.length > 0 ||
        actor.propertyComments?.length > 0,
    );

  if (needsDeclarations) {
    blocks.push(
      document.actors
        .map((actor) =>
          [
            ...commentLines(actor.leadingComments ?? [], 0),
            `@${sourceText(actor.name)}`,
            ...propertyLines(
              actor,
              ["icon", "tag", "tooltip", "tooltip-icon"],
              1,
            ),
          ].join("\n"),
        )
        .join("\n\n"),
    );
  }

  blocks.push(timelineLines(document.items, 0).join("\n"));
  const trailingComments = commentLines(
    document.trailingComments ?? [],
    0,
  ).join("\n");
  if (trailingComments) {
    blocks.push(trailingComments);
  }
  const source = `${blocks.filter(Boolean).join("\n\n")}\n`;

  // Programmatic ASTs must round-trip through the same grammar as source.
  parse(source);
  return source;
}
