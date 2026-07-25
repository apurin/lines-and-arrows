const TAG_MAX_LENGTH = 16;
const TAG_FONT_SIZE = 10;
const TAG_MIN_TEXT_WIDTH = 30;
const TAG_HORIZONTAL_PADDING = 20;

export const ACTOR_METADATA_MARGIN_X = 8;

export function metadataMetrics(tag, tooltip) {
  const text = String(tag ?? "");
  const visibleTag =
    text.length <= TAG_MAX_LENGTH
      ? text
      : `${text.slice(0, TAG_MAX_LENGTH - 1)}…`;
  const tagWidth = tag
    ? Math.max(
        TAG_MIN_TEXT_WIDTH,
        visibleTag.length * TAG_FONT_SIZE * 0.56,
      ) + TAG_HORIZONTAL_PADDING
    : 0;
  const triggerSize = tooltip ? 18 : 0;
  const gap = tag && tooltip ? 4 : 0;

  return {
    visibleTag,
    tagWidth,
    triggerSize,
    gap,
    width: tagWidth + gap + triggerSize,
  };
}
