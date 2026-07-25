function propertyLines(item, names, indent) {
  const prefix = "  ".repeat(indent);
  const lines = [];

  for (const name of names) {
    const property =
      name === "tooltip-icon" ? "tooltipIcon" : name;
    const value = item[property];
    if (value !== null && value !== undefined && String(value).trim()) {
      lines.push(`${prefix}${name} ${String(value).trim()}`);
    }
  }

  return lines;
}

function timelineLines(items, indent) {
  const prefix = "  ".repeat(indent);
  const lines = [];

  for (const item of items) {
    if (item.type === "message") {
      const label = String(item.label ?? "").trim();
      lines.push(
        `${prefix}${item.source} ${item.arrow} ${item.target}${
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
      lines.push(`${prefix}gap ${item.label}`);
      continue;
    }

    lines.push(`${prefix}${item.groupType} ${item.label}`);
    if (item.sections.length > 0) {
      for (const section of item.sections) {
        lines.push(`${"  ".repeat(indent + 1)}| ${section.label}`);
        lines.push(...timelineLines(section.items, indent + 2));
      }
    } else {
      lines.push(...timelineLines(item.items, indent + 1));
    }
  }

  return lines;
}

export function serialize(document) {
  const blocks = [];
  const comments = (document.comments ?? [])
    .map((comment) => `//${comment.text ? ` ${comment.text}` : ""}`)
    .join("\n");

  if (comments) {
    blocks.push(comments);
  }

  const needsDeclarations =
    document.explicitActors ||
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
            `@${actor.name}`,
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
  return `${blocks.filter(Boolean).join("\n\n")}\n`;
}
