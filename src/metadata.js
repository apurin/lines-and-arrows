const TAG_MAX_LENGTH = 16;
const TAG_FONT_SIZE = 10;
const TAG_MIN_TEXT_WIDTH = 30;
const TAG_HORIZONTAL_PADDING = 20;
const ACTOR_LABEL_FONT_SIZE = 13;
const ACTOR_LABEL_WIDTH_FACTOR = 0.56;
const MESSAGE_LABEL_MAX_LENGTH = 46;
const MESSAGE_LABEL_FONT_SIZE = 11;
const MESSAGE_LABEL_MIN_TEXT_WIDTH = 40;
const MESSAGE_LABEL_HORIZONTAL_PADDING = 16;
const SELF_MESSAGE_HORIZONTAL_PADDING = 16;

export const ACTOR_METADATA_MARGIN_X = 8;
export const ACTOR_LABEL_MARGIN_X = 16;
export const SELF_MESSAGE_MIN_WIDTH = 82;

export function actorLabelWidth(name) {
  return (
    Array.from(String(name ?? "")).length *
    ACTOR_LABEL_FONT_SIZE *
    ACTOR_LABEL_WIDTH_FACTOR
  );
}

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
  const triggerSize = tooltip ? 20 : 0;
  const gap = tag && tooltip ? 4 : 0;

  return {
    visibleTag,
    tagWidth,
    triggerSize,
    gap,
    width: tagWidth + gap + triggerSize,
  };
}

export function messageLabelMetrics(label) {
  const text = String(label ?? "");
  const visibleLabel =
    text.length <= MESSAGE_LABEL_MAX_LENGTH
      ? text
      : `${text.slice(0, MESSAGE_LABEL_MAX_LENGTH - 1)}…`;
  const width = label
    ? Math.max(
        MESSAGE_LABEL_MIN_TEXT_WIDTH,
        visibleLabel.length * MESSAGE_LABEL_FONT_SIZE * 0.56,
      ) + MESSAGE_LABEL_HORIZONTAL_PADDING
    : 0;

  return { visibleLabel, width };
}

export function selfMessageWidth(message) {
  const contentWidth = Math.max(
    messageLabelMetrics(message.label).width,
    metadataMetrics(message.tag, message.tooltip).width,
  );

  return Math.max(
    SELF_MESSAGE_MIN_WIDTH,
    contentWidth + SELF_MESSAGE_HORIZONTAL_PADDING,
  );
}
