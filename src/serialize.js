import { groupSections, visitMessages } from "./document.js";
import { parse } from "./parser.js";
import { encodeText } from "./text.js";
import { isGroupType } from "./grammar.js";

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

  const needsDeclarations =
    document.actors.length !== referencedActorNames.length ||
    document.actors.some(
      (actor, index) => actor.name !== referencedActorNames[index],
    ) ||
    document.actors.some(
      (actor) =>
        actor.icon ||
        actor.tag ||
        actor.tooltip ||
        actor.tooltipIcon,
    );

  if (needsDeclarations) {
    blocks.push(
      document.actors
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
  parse(source);
  return source;
}
