import {
  ACTOR_LABEL_MARGIN_X,
  ACTOR_METADATA_MARGIN_X,
  MESSAGE_LABEL_MAX_WIDTH,
  actorLabelWidth,
  messageLabelMetrics,
  metadataMetrics,
  selfMessageWidth,
} from "./metadata.js";
import { textLines } from "./text.js";

const DEFAULTS = {
  actorWidth: 96,
  actorHeight: 48,
  actorMetadataGap: 6,
  actorMetadataHeight: 20,
  actorGap: 70,
  marginX: 58,
  marginTop: 34,
  timelineTopGap: 36,
  messageHeight: 54,
  messageMetadataHeight: 16,
  messageLabelMaxWidth: MESSAGE_LABEL_MAX_WIDTH,
  gapHeight: 60,
  groupHeaderHeight: 30,
  sectionHeaderHeight: 27,
  groupPaddingBottom: 11,
  groupGap: 10,
  bottomPadding: 36,
};

const MINIMUMS = {
  actorWidth: 56,
  actorHeight: 42,
  actorMetadataGap: 4,
  actorMetadataHeight: 20,
  actorGap: 8,
  marginX: 8,
  marginTop: 8,
  timelineTopGap: 8,
  messageHeight: 36,
  messageMetadataHeight: 16,
  messageLabelMaxWidth: 56,
  gapHeight: 40,
  groupHeaderHeight: 24,
  sectionHeaderHeight: 24,
  groupPaddingBottom: 6,
  groupGap: 8,
  bottomPadding: 18,
};

const ACTOR_METADATA_TIMELINE_GAP = 4;
const MESSAGE_LABEL_TOP_EXTENT = 21;
const SELF_MESSAGE_LABEL_TOP_EXTENT = 34;
const SELF_MESSAGE_TOP_PADDING = 13;
const SELF_MESSAGE_METADATA_BOTTOM_EXTENT = 40;
const SELF_MESSAGE_LIFELINE_GAP = 18;
const GROUP_DEPTH_INSET = 9;
const GROUP_CONTENT_INSET = 14;
const GROUP_SELF_MESSAGE_RIGHT_PADDING = 20;
const GROUP_LABEL_LINE_HEIGHT = 13;
const SECTION_LABEL_LINE_HEIGHT = 12;
const GAP_LABEL_LINE_HEIGHT = 12;

function resolveOptions(overrides) {
  const options = { ...DEFAULTS };
  const requested =
    overrides && typeof overrides === "object" ? overrides : {};

  for (const key of Object.keys(DEFAULTS)) {
    const override = requested[key];
    if (!Number.isFinite(override)) {
      continue;
    }
    options[key] = Math.max(MINIMUMS[key], override);
  }

  return options;
}

function firstItemLabelAdjustment(document, options) {
  const item = document.items[0];
  if (item?.type !== "message" || !item.label) {
    return 0;
  }

  const selfMessage = item.source === item.target;
  const topExtent = selfMessage
    ? SELF_MESSAGE_LABEL_TOP_EXTENT
    : MESSAGE_LABEL_TOP_EXTENT;
  const topPadding = selfMessage ? SELF_MESSAGE_TOP_PADDING : 0;
  return topExtent - options.messageHeight / 2 - topPadding;
}

function reserveActorMetadata(document, options) {
  if (!document.actors.some((actor) => actor.tag || actor.tooltip)) {
    return;
  }

  options.timelineTopGap = Math.max(
    options.timelineTopGap,
    options.actorMetadataGap +
      options.actorMetadataHeight +
      ACTOR_METADATA_TIMELINE_GAP +
      firstItemLabelAdjustment(document, options),
  );
}

function collectMessageWidths(
  items,
  selfWidths,
  labelWidths,
  actorIndexes,
  messageLabelMaxWidth,
) {
  for (const item of items) {
    if (item.type === "message") {
      if (item.source === item.target) {
        selfWidths.set(
          item.source,
          Math.max(
            selfWidths.get(item.source) ?? 0,
            selfMessageWidth(item, messageLabelMaxWidth),
          ),
        );
      } else if (item.label) {
        const sourceIndex = actorIndexes.get(item.source);
        const targetIndex = actorIndexes.get(item.target);
        if (
          sourceIndex !== undefined &&
          targetIndex !== undefined
        ) {
          const leftIndex = Math.min(
            sourceIndex,
            targetIndex,
          );
          const rightIndex = Math.max(
            sourceIndex,
            targetIndex,
          );
          const key = `${leftIndex}:${rightIndex}`;
          labelWidths.set(
            key,
            Math.max(
              labelWidths.get(key) ?? 0,
              messageLabelMetrics(
                item.label,
                messageLabelMaxWidth,
              ).width,
            ),
          );
        }
      }
      continue;
    }

    if (item.type !== "group") {
      continue;
    }

    if (item.sections.length > 0) {
      for (const section of item.sections) {
        collectMessageWidths(
          section.items,
          selfWidths,
          labelWidths,
          actorIndexes,
          messageLabelMaxWidth,
        );
      }
    } else {
      collectMessageWidths(
        item.items,
        selfWidths,
        labelWidths,
        actorIndexes,
        messageLabelMaxWidth,
      );
    }
  }
}

function layoutItems(
  items,
  state,
  depth = 0,
  parentId = "root",
  ancestorGroups = [],
) {
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    if (item.type === "message") {
      const selfMessage = item.source === item.target;
      const topPadding = selfMessage
        ? SELF_MESSAGE_TOP_PADDING
        : 0;
      const labelMetrics = messageLabelMetrics(
        item.label,
        state.options.messageLabelMaxWidth,
      );
      const labelAllowance = Math.max(
        0,
        labelMetrics.height - labelMetrics.lineHeight,
      );
      const metadataAllowance =
        item.tag || item.tooltip
          ? selfMessage
            ? Math.max(
                state.options.messageMetadataHeight,
                SELF_MESSAGE_METADATA_BOTTOM_EXTENT -
                  state.options.messageHeight / 2,
              )
            : state.options.messageMetadataHeight
          : 0;
      const height =
        state.options.messageHeight +
        topPadding +
        labelAllowance +
        metadataAllowance;
      const top = state.y;
      const y =
        top +
        state.options.messageHeight / 2 +
        topPadding +
        labelAllowance;
      state.rows.push({
        ...item,
        top,
        bottom: top + height,
        y,
        height,
        depth,
        parentId,
        index,
      });
      if (
        item.source === item.target &&
        ancestorGroups.length > 0
      ) {
        const actor = state.actorByName.get(item.source);
        if (actor) {
          const messageRight =
            actor.centerX +
            selfMessageWidth(
              item,
              state.options.messageLabelMaxWidth,
            );
          for (
            let groupIndex = 0;
            groupIndex < ancestorGroups.length;
            groupIndex += 1
          ) {
            const nestedLevels =
              ancestorGroups.length - groupIndex - 1;
            const requiredRight =
              messageRight +
              GROUP_SELF_MESSAGE_RIGHT_PADDING +
              nestedLevels * GROUP_DEPTH_INSET;
            ancestorGroups[groupIndex].right = Math.max(
              ancestorGroups[groupIndex].right,
              requiredRight,
            );
          }
        }
      }
      state.y += height;
      continue;
    }

    if (item.type === "gap") {
      const top = state.y;
      const labelAllowance =
        Math.max(0, textLines(item.label).length - 1) *
        GAP_LABEL_LINE_HEIGHT;
      const height = state.options.gapHeight + labelAllowance;
      state.rows.push({
        ...item,
        top,
        bottom: top + height,
        y: top + height / 2,
        height,
        depth,
        parentId,
        index,
      });
      state.y += height;
      continue;
    }

    const top = state.y;
    const group = {
      ...item,
      top,
      depth,
      left:
        state.options.marginX + depth * GROUP_DEPTH_INSET,
      right:
        state.width -
        state.options.marginX -
        depth * GROUP_DEPTH_INSET,
      bottom: top,
      height: 0,
      parentId,
      index,
    };
    state.groups.push(group);
    group.headerHeight =
      state.options.groupHeaderHeight +
      Math.max(0, textLines(item.label).length - 1) *
        GROUP_LABEL_LINE_HEIGHT;
    state.y += group.headerHeight;

    if (item.sections.length > 0) {
      for (const section of item.sections) {
        const sectionTop = state.y;
        const headerHeight =
          state.options.sectionHeaderHeight +
          Math.max(0, textLines(section.label).length - 1) *
            SECTION_LABEL_LINE_HEIGHT;
        state.sections.push({
          ...section,
          top: sectionTop,
          y: sectionTop + headerHeight / 2,
          headerHeight,
          depth: depth + 1,
          left: group.left + GROUP_CONTENT_INSET,
          right: group.right - GROUP_CONTENT_INSET,
          parentId: group.id,
          index: item.sections.indexOf(section),
        });
        state.y += headerHeight;
        layoutItems(
          section.items,
          state,
          depth + 1,
          section.id,
          [...ancestorGroups, group],
        );
      }
    } else {
      layoutItems(
        item.items,
        state,
        depth + 1,
        item.id,
        [...ancestorGroups, group],
      );
    }

    for (const section of state.sections) {
      if (section.parentId === group.id) {
        section.right = group.right - GROUP_CONTENT_INSET;
      }
    }
    state.y += state.options.groupPaddingBottom;
    group.bottom = state.y;
    group.height = group.bottom - group.top;
    state.y += state.options.groupGap;
  }
}

export function layoutDiagram(document, overrides = {}) {
  const options = resolveOptions(overrides);
  reserveActorMetadata(document, options);
  const selfMessageWidths = new Map();
  const messageLabelWidths = new Map();
  const actorIndexes = new Map(
    document.actors.map((actor, index) => [
      actor.name,
      index,
    ]),
  );
  collectMessageWidths(
    document.items,
    selfMessageWidths,
    messageLabelWidths,
    actorIndexes,
    options.messageLabelMaxWidth,
  );
  const actorWidths = document.actors.map((actor) =>
    Math.max(
      options.actorWidth,
      actorLabelWidth(actor.name) + ACTOR_LABEL_MARGIN_X * 2,
      metadataMetrics(actor.tag, actor.tooltip).width +
        ACTOR_METADATA_MARGIN_X * 2,
    ),
  );
  const actors = [];
  for (
    let index = 0;
    index < document.actors.length;
    index += 1
  ) {
    const actor = document.actors[index];
    const actorWidth = actorWidths[index];
    let actorX;
    if (index === 0) {
      actorX = options.marginX;
    } else {
      const previousActor = document.actors[index - 1];
      const previousLayoutActor = actors[index - 1];
      actorX =
        previousLayoutActor.x +
        previousLayoutActor.width +
        options.actorGap;
      actorX = Math.max(
        actorX,
        previousLayoutActor.centerX +
          (selfMessageWidths.get(previousActor.name) ?? 0) +
          SELF_MESSAGE_LIFELINE_GAP -
          actorWidth / 2,
      );
      for (
        let previousIndex = 0;
        previousIndex < index;
        previousIndex += 1
      ) {
        const requiredLabelWidth =
          messageLabelWidths.get(
            `${previousIndex}:${index}`,
          ) ?? 0;
        if (requiredLabelWidth > 0) {
          actorX = Math.max(
            actorX,
            actors[previousIndex].centerX +
              requiredLabelWidth -
              actorWidth / 2,
          );
        }
      }
    }
    const centerX = actorX + actorWidth / 2;
    const layoutActor = {
      ...actor,
      id: actor.id ?? `actor:${actor.name}`,
      x: actorX,
      y: options.marginTop,
      centerX,
      width: actorWidth,
      height: options.actorHeight,
    };
    actors.push(layoutActor);
  }
  const rightmostActor = actors.at(-1);
  const actorRight = rightmostActor
    ? rightmostActor.x + rightmostActor.width
    : options.marginX;
  const selfMessageRight = actors.reduce(
    (right, actor) =>
      Math.max(
        right,
        actor.centerX +
          (selfMessageWidths.get(actor.name) ?? 0),
      ),
    actorRight,
  );
  const baseWidth = Math.max(
    420,
    actorRight + options.marginX,
    selfMessageRight + options.marginX,
  );

  const state = {
    options,
    width: baseWidth,
    actorByName: new Map(
      actors.map((actor) => [actor.name, actor]),
    ),
    y:
      options.marginTop +
      options.actorHeight +
      options.timelineTopGap,
    rows: [],
    groups: [],
    sections: [],
  };

  layoutItems(document.items, state);

  const expandedGroupRight = state.groups.reduce(
    (right, group) => Math.max(right, group.right),
    0,
  );
  const width = Math.max(
    baseWidth,
    expandedGroupRight + options.marginX,
  );
  const height = state.y + options.bottomPadding;
  const actorByName = state.actorByName;

  return {
    width,
    height,
    actors,
    actorByName,
    rows: state.rows,
    groups: state.groups,
    sections: state.sections,
    lifelineTop: options.marginTop + options.actorHeight,
    lifelineBottom: height - options.bottomPadding + 8,
    contentLeft: options.marginX,
    contentRight: width - options.marginX,
    options,
  };
}
