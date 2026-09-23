export const ARROW_PATTERN =
  /^(.*?)\s+(-->|->x|->)\s+([^:]+?)(?::\s*(.*))?$/;
export const MESSAGE_PROPERTY_LINE_PATTERN =
  /^(?:tag|tooltip|tooltip-icon)(?: |$)/;
// The hyphen is escaped so the same source also compiles under the `v` flag
// that browsers apply to the HTML `pattern` attribute.
export const GROUP_TYPE_PATTERN_SOURCE = "[a-z][a-z0-9\\-]*";

const GROUP_TYPE_PATTERN = new RegExp(`^${GROUP_TYPE_PATTERN_SOURCE}$`);
const ACTOR_FORBIDDEN_PATTERN = /:|-->|->x|->/;
const RESERVED_ACTOR_NAME_PATTERN = /^gap(?:\s|$)/;
export const GROUP_LINE_PATTERN = new RegExp(
  `^(${GROUP_TYPE_PATTERN_SOURCE})(?:\\s+(.+))?$`,
);

export function isGroupType(value) {
  return GROUP_TYPE_PATTERN.test(value) && value !== "gap";
}

// A group line whose label starts with an arrow ("critical -> B") reads as a
// message from the group type. Pass the label as it is written in source.
export function groupLabelStartsWithArrow(groupType, label) {
  const message = `${groupType} ${label}`.match(ARROW_PATTERN);
  return message !== null && !/\s/.test(message[1]);
}

// Returns why a trimmed, single-line actor name cannot be written as source,
// or null when it can.
export function actorNameProblem(name) {
  if (
    ACTOR_FORBIDDEN_PATTERN.test(name) ||
    name.startsWith("@") ||
    name.startsWith("|") ||
    name.startsWith("//")
  ) {
    return `Invalid actor name "${name}".`;
  }
  if (RESERVED_ACTOR_NAME_PATTERN.test(name)) {
    return `Actor name "${name}" cannot start with the reserved word "gap".`;
  }
  return null;
}
