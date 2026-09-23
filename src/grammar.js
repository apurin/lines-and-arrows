// The hyphen is escaped so the same source also compiles under the `v` flag
// that browsers apply to the HTML `pattern` attribute.
export const GROUP_TYPE_PATTERN_SOURCE = "[a-z][a-z0-9\\-]*";

const GROUP_TYPE_PATTERN = new RegExp(`^${GROUP_TYPE_PATTERN_SOURCE}$`);
export const GROUP_LINE_PATTERN = new RegExp(
  `^(${GROUP_TYPE_PATTERN_SOURCE})(?:\\s+(.+))?$`,
);

export function isGroupType(value) {
  return GROUP_TYPE_PATTERN.test(value) && value !== "gap";
}
