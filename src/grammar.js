const GROUP_TYPE_PATTERN = /^[a-z][a-z0-9-]*$/;
export const GROUP_LINE_PATTERN = /^([a-z][a-z0-9-]*)(?:\s+(.+))?$/;

export function isGroupType(value) {
  return GROUP_TYPE_PATTERN.test(value) && value !== "gap";
}
