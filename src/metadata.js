const TAG_MAX_LENGTH = 16;
const TAG_FONT_SIZE = 10;
const TAG_MIN_TEXT_WIDTH = 30;
const TAG_HORIZONTAL_PADDING = 20;
const ACTOR_LABEL_FONT_SIZE = 13;
const ACTOR_LABEL_WIDTH_FACTOR = 0.56;
const MESSAGE_LABEL_FONT_SIZE = 11;
const MESSAGE_LABEL_WIDTH_FACTOR = 0.56;
const MESSAGE_LABEL_MIN_TEXT_WIDTH = 40;
const MESSAGE_LABEL_HORIZONTAL_PADDING = 16;
const SELF_MESSAGE_HORIZONTAL_PADDING = 16;

export const ACTOR_METADATA_MARGIN_X = 8;
export const ACTOR_LABEL_MARGIN_X = 16;
export const MESSAGE_LABEL_MAX_WIDTH = 220;
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

export function messageLabelMetrics(
  label,
  maxWidth = MESSAGE_LABEL_MAX_WIDTH,
) {
  const text = String(label ?? "");
  const characters = Array.from(text);
  const characterWidth =
    MESSAGE_LABEL_FONT_SIZE * MESSAGE_LABEL_WIDTH_FACTOR;
  const minimumWidth =
    MESSAGE_LABEL_MIN_TEXT_WIDTH +
    MESSAGE_LABEL_HORIZONTAL_PADDING;
  const availableWidth = Math.max(
    minimumWidth,
    Number.isFinite(maxWidth)
      ? maxWidth
      : MESSAGE_LABEL_MAX_WIDTH,
  );
  const maxTextCharacters = Math.max(
    1,
    Math.floor(
      (availableWidth - MESSAGE_LABEL_HORIZONTAL_PADDING) /
        characterWidth,
    ),
  );
  const visibleLabel =
    characters.length <= maxTextCharacters
      ? text
      : maxTextCharacters === 1
        ? "…"
        : `${characters
            .slice(0, maxTextCharacters - 1)
            .join("")}…`;
  const width = label
    ? Math.min(
        availableWidth,
        Math.max(
          MESSAGE_LABEL_MIN_TEXT_WIDTH,
          Array.from(visibleLabel).length * characterWidth,
        ) + MESSAGE_LABEL_HORIZONTAL_PADDING,
      )
    : 0;

  const textWidth = label
    ? Math.max(
        MESSAGE_LABEL_MIN_TEXT_WIDTH,
        Array.from(visibleLabel).length * characterWidth,
      )
    : 0;

  return { visibleLabel, width, textWidth };
}

export function selfMessageWidth(
  message,
  messageLabelMaxWidth = MESSAGE_LABEL_MAX_WIDTH,
) {
  const contentWidth = Math.max(
    messageLabelMetrics(
      message.label,
      messageLabelMaxWidth,
    ).width,
    metadataMetrics(message.tag, message.tooltip).width,
  );

  return Math.max(
    SELF_MESSAGE_MIN_WIDTH,
    contentWidth + SELF_MESSAGE_HORIZONTAL_PADDING,
  );
}
