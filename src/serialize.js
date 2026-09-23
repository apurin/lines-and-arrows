import { groupSections, visitMessages } from "./document.js";
import { parse } from "./parser.js";
import { encodeText } from "./text.js";
import {
  ARROW_PATTERN,
  MESSAGE_PROPERTY_LINE_PATTERN,
  actorNameProblem,
  groupLabelStartsWithArrow,
  isGroupType,
} from "./grammar.js";

const ACTOR_FIELDS = ["name", "icon", "tag", "tooltip", "tooltipIcon"];
const MESSAGE_FIELDS = [
  "source",
  "target",
  "label",
  "tag",
  "tooltip",
  "tooltipIcon",
];

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

function requireText(value, path) {
  requireString(value, path);
  if (!value.trim()) {
    throw new TypeError(`${path} cannot be empty.`);
  }
}

function requireOptionalText(value, path) {
  if (value !== null && value !== undefined) {
    requireText(value, path);
  }
}

// Mirrors the parser's reading of a line shaped like both a message and a
// group, so a group whose label contains an arrow is written unambiguously.
function assertGroupHeadReadsAsGroup(group, path) {
  if (group.label === null || group.label === undefined) {
    return;
  }
  const label = sourceText(group.label);
  if (groupLabelStartsWithArrow(group.groupType, label)) {
    throw new TypeError(`${path}.label cannot start with an arrow.`);
  }
  if (!ARROW_PATTERN.test(`${group.groupType} ${label}`)) {
    return;
  }
  const [first] = group.body;
  const firstLine =
    first?.type === "message"
      ? sourceText(first.source)
      : first?.type === "group"
        ? String(first.groupType)
        : "";
  if (MESSAGE_PROPERTY_LINE_PATTERN.test(firstLine)) {
    throw new TypeError(
      `${path}.body[0] would read as a message property because ${path}.label contains an arrow.`,
    );
  }
}

function assertTimelineStructure(items, path) {
  requireArray(items, path);

  items.forEach((item, index) => {
    const itemPath = `${path}[${index}]`;
    if (!item || typeof item !== "object") {
      throw new TypeError(`${itemPath} must be a timeline item.`);
    }
    if (item.type === "message") {
      requireText(item.source, `${itemPath}.source`);
      requireText(item.target, `${itemPath}.target`);
      requireString(item.arrow, `${itemPath}.arrow`);
      requireOptionalText(item.label, `${itemPath}.label`);
      requireOptionalText(item.tag, `${itemPath}.tag`);
      requireOptionalText(item.tooltip, `${itemPath}.tooltip`);
      requireOptionalText(
        item.tooltipIcon,
        `${itemPath}.tooltipIcon`,
      );
      return;
    }
    if (item.type === "gap") {
      requireText(item.label, `${itemPath}.label`);
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
    requireOptionalText(item.label, `${itemPath}.label`);
    requireArray(item.body, `${itemPath}.body`);
    if (item.body.length === 0) {
      throw new TypeError(
        `${itemPath}.body must contain at least one item or section.`,
      );
    }
    assertGroupHeadReadsAsGroup(item, itemPath);

    const sections = groupSections(item);
    if (!sections) {
      if (item.body.some((child) => child?.type === "section")) {
        throw new TypeError(
          `${itemPath}.body cannot mix timeline items and sections.`,
        );
      }
      assertTimelineStructure(item.body, `${itemPath}.body`);
      return;
    }
    sections.forEach((section, sectionIndex) => {
      const sectionPath = `${itemPath}.body[${sectionIndex}]`;
      if (
        !section ||
        typeof section !== "object" ||
        section.type !== "section"
      ) {
        throw new TypeError(`${sectionPath} must be a section.`);
      }
      requireText(section.label, `${sectionPath}.label`);
      if (!Array.isArray(section.items) || section.items.length === 0) {
        throw new TypeError(
          `${sectionPath}.items must contain at least one timeline item.`,
        );
      }
      assertTimelineStructure(
        section.items,
        `${sectionPath}.items`,
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

  requireArray(document.comments, "document.comments");
  document.comments.forEach((comment, index) => {
    const path = `document.comments[${index}]`;
    requireString(comment, path);
    if (/[\r\n]/.test(comment)) {
      throw new TypeError(`${path} must stay on one line.`);
    }
  });
  requireArray(document.actors, "document.actors");
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
    requireText(actor.name, `document.actors[${index}].name`);
    const nameProblem = actorNameProblem(actor.name.trim());
    if (nameProblem) {
      throw new TypeError(
        `document.actors[${index}].name is invalid. ${nameProblem}`,
      );
    }
    if (actorNames.has(actor.name)) {
      throw new TypeError(`Duplicate actor "${actor.name}".`);
    }
    actorNames.add(actor.name);
    requireOptionalText(actor.icon, `document.actors[${index}].icon`);
    requireOptionalText(actor.tag, `document.actors[${index}].tag`);
    requireOptionalText(
      actor.tooltip,
      `document.actors[${index}].tooltip`,
    );
    requireOptionalText(
      actor.tooltipIcon,
      `document.actors[${index}].tooltipIcon`,
    );
  });
  assertTimelineStructure(document.items, "document.items");

  const inferredNames = [];
  const seenNames = new Set();
  visitMessages(document.items, (message) => {
    for (const name of [message.source, message.target]) {
      if (!seenNames.has(name)) {
        seenNames.add(name);
        inferredNames.push(name);
      }
    }
  });

  for (const name of inferredNames) {
    if (!actorNames.has(name)) {
      throw new TypeError(
        `Unknown actor "${name}".`,
      );
    }
  }
  return inferredNames;
}

function sourceText(value) {
  return encodeText(String(value ?? "").trim());
}

// Text as the parser reads it back after sourceText() writes it.
function readBackText(value) {
  if (value === null || value === undefined) {
    return null;
  }
  const text = String(value).trim();
  if (!text) {
    return null;
  }
  return text.includes("\r") ? text.replace(/\r\n?/g, "\n") : text;
}

// Each helper returns null when both sides match, or the path suffix of the
// first difference ("" when the compared value itself differs). Paths are
// only built on the failure path.
function fieldsDifference(expected, actual, fields) {
  for (const field of fields) {
    if (readBackText(expected[field]) !== readBackText(actual[field])) {
      return `.${field}`;
    }
  }
  return null;
}

function listDifference(expected, actual, compare) {
  const length = Math.max(expected.length, actual.length);
  for (let index = 0; index < length; index += 1) {
    const difference =
      index < expected.length && index < actual.length
        ? compare(expected[index], actual[index])
        : "";
    if (difference !== null) {
      return `[${index}]${difference}`;
    }
  }
  return null;
}

function itemDifference(expected, actual) {
  if (expected.type !== actual.type) {
    return ".type";
  }
  if (expected.type === "message") {
    if (expected.arrow !== actual.arrow) {
      return ".arrow";
    }
    return fieldsDifference(expected, actual, MESSAGE_FIELDS);
  }
  if (expected.type === "gap") {
    return fieldsDifference(expected, actual, ["label"]);
  }
  if (expected.groupType !== actual.groupType) {
    return ".groupType";
  }
  const label = fieldsDifference(expected, actual, ["label"]);
  if (label !== null) {
    return label;
  }
  const expectedSections = groupSections(expected) !== null;
  if (expectedSections !== (groupSections(actual) !== null)) {
    return ".body";
  }
  const body = listDifference(
    expected.body,
    actual.body,
    expectedSections ? sectionDifference : itemDifference,
  );
  return body === null ? null : `.body${body}`;
}

function sectionDifference(expected, actual) {
  const label = fieldsDifference(expected, actual, ["label"]);
  if (label !== null) {
    return label;
  }
  const items = listDifference(expected.items, actual.items, itemDifference);
  return items === null ? null : `.items${items}`;
}

function actorDifference(expected, actual) {
  return fieldsDifference(expected, actual, ACTOR_FIELDS);
}

function commentDifference(expected, actual) {
  return expected.trim() === actual ? null : "";
}

// Compares the public syntax shape of a validated document with the
// document parsed from its source. Editor IDs, parser lines, and other
// fields are ignored; null and undefined are equivalent.
export function roundTripDifference(document, reparsed) {
  for (const [key, compare] of [
    ["comments", commentDifference],
    ["actors", actorDifference],
    ["items", itemDifference],
  ]) {
    const difference = listDifference(
      document[key],
      reparsed[key],
      compare,
    );
    if (difference !== null) {
      return `document.${key}${difference}`;
    }
  }
  return null;
}

function declarationCount(actors, referencedActorNames) {
  let minimum = 0;
  actors.forEach((actor, index) => {
    if (
      actor.icon ||
      actor.tag ||
      actor.tooltip ||
      actor.tooltipIcon
    ) {
      minimum = index + 1;
    }
  });

  for (let count = minimum; count <= actors.length; count += 1) {
    const declared = actors.slice(0, count);
    const declaredNames = new Set(declared.map((actor) => actor.name));
    const resolvedNames = [
      ...declaredNames,
      ...referencedActorNames.filter((name) => !declaredNames.has(name)),
    ];
    if (
      resolvedNames.length === actors.length &&
      actors.every((actor, index) => actor.name === resolvedNames[index])
    ) {
      return count;
    }
  }

  return actors.length;
}

function propertyLines(item, names, indent) {
  const prefix = "  ".repeat(indent);
  const lines = [];

  for (const name of names) {
    const property =
      name === "tooltip-icon" ? "tooltipIcon" : name;
    const value = item[property];
    if (value !== null && value !== undefined && String(value).trim()) {
      lines.push(`${prefix}${name} ${sourceText(value)}`);
    }
  }

  return lines;
}

function timelineLines(items, indent) {
  const prefix = "  ".repeat(indent);
  const lines = [];

  for (const item of items) {
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
    const sections = groupSections(item);
    if (sections) {
      for (const section of sections) {
        lines.push(
          `${"  ".repeat(indent + 1)}| ${sourceText(section.label)}`,
        );
        lines.push(...timelineLines(section.items, indent + 2));
      }
    } else {
      lines.push(...timelineLines(item.body, indent + 1));
    }
  }

  return lines;
}

export function serialize(document) {
  const referencedActorNames = assertDocumentStructure(document);
  const blocks = [];
  const comments = document.comments
    .map((comment) => {
      const text = comment.trim();
      return `//${text ? ` ${text}` : ""}`;
    })
    .join("\n");

  if (comments) {
    blocks.push(comments);
  }

  const declaredActorCount = declarationCount(
    document.actors,
    referencedActorNames,
  );

  if (declaredActorCount > 0) {
    blocks.push(
      document.actors
        .slice(0, declaredActorCount)
        .map((actor) =>
          [
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
  const source = `${blocks.filter(Boolean).join("\n\n")}\n`;

  // Programmatic ASTs must round-trip through the same grammar as source.
  const difference = roundTripDifference(document, parse(source));
  if (difference !== null) {
    throw new TypeError(
      `Serialized source reads back differently at ${difference}.`,
    );
  }
  return source;
}
