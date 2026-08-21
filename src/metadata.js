import {
  estimatedTextWidth,
  graphemes,
  textLines,
} from "./text.js";

const TAG_MAX_LENGTH = 16;
const TAG_FONT_SIZE = 10;
const TAG_MIN_TEXT_WIDTH = 30;
const TAG_HORIZONTAL_PADDING = 20;
const ACTOR_LABEL_FONT_SIZE = 13;
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
  return estimatedTextWidth(name, ACTOR_LABEL_FONT_SIZE);
}

export function metadataMetrics(tag, tooltip) {
  const text = String(tag ?? "");
  const characters = graphemes(text);
  const visibleTag =
    characters.length <= TAG_MAX_LENGTH
      ? text
      : `${characters.slice(0, TAG_MAX_LENGTH - 1).join("")}…`;
  const tagWidth = tag
      ? Math.max(
        TAG_MIN_TEXT_WIDTH,
        estimatedTextWidth(visibleTag, TAG_FONT_SIZE),
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
  const minimumWidth =
    MESSAGE_LABEL_MIN_TEXT_WIDTH +
    MESSAGE_LABEL_HORIZONTAL_PADDING;
  const availableWidth = Math.max(
    minimumWidth,
    Number.isFinite(maxWidth)
      ? maxWidth
      : MESSAGE_LABEL_MAX_WIDTH,
  );
  const maximumTextWidth =
    availableWidth - MESSAGE_LABEL_HORIZONTAL_PADDING;
  const characterWidth =
    MESSAGE_LABEL_FONT_SIZE * MESSAGE_LABEL_WIDTH_FACTOR;
  const maxTextCharacters = Math.max(
    1,
    Math.floor(maximumTextWidth / characterWidth),
  );
  const visibleLines = label
    ? textLines(text).map((line) => {
        const characters = graphemes(line);
        if (characters.length <= maxTextCharacters) {
          return line;
        }
        return maxTextCharacters === 1
          ? "…"
          : `${characters
              .slice(0, maxTextCharacters - 1)
              .join("")}…`;
      })
    : [];
  const longestLineLength = Math.max(
    0,
    ...visibleLines.map((line) => graphemes(line).length),
  );
  const width = label
    ? Math.min(
        availableWidth,
        Math.max(
          MESSAGE_LABEL_MIN_TEXT_WIDTH,
          longestLineLength * characterWidth,
        ) + MESSAGE_LABEL_HORIZONTAL_PADDING,
      )
    : 0;

  const textWidth = label
    ? Math.max(
        MESSAGE_LABEL_MIN_TEXT_WIDTH,
        longestLineLength * characterWidth,
      )
    : 0;

  return {
    visibleLines,
    lineHeight: 13,
    height: visibleLines.length * 13,
    width,
    textWidth,
  };
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
