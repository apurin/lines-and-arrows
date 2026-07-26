import {
  ACTOR_LABEL_MARGIN_X,
  ACTOR_METADATA_MARGIN_X,
  actorLabelWidth,
  metadataMetrics,
  selfMessageWidth,
} from "./metadata.js";

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
  gapHeight: 60,
  groupHeaderHeight: 30,
  sectionHeaderHeight: 27,
  groupPaddingBottom: 11,
  groupGap: 10,
  bottomPadding: 36,
};

const SELF_MESSAGE_LIFELINE_GAP = 18;
const GROUP_DEPTH_INSET = 9;
const GROUP_CONTENT_INSET = 14;
const GROUP_SELF_MESSAGE_RIGHT_PADDING = 20;

function collectSelfMessageWidths(items, widths) {
  for (const item of items) {
    if (item.type === "message") {
      if (item.source === item.target) {
        widths.set(
          item.source,
          Math.max(
            widths.get(item.source) ?? 0,
            selfMessageWidth(item),
          ),
        );
      }
      continue;
    }

    if (item.type !== "group") {
      continue;
    }

    if (item.sections.length > 0) {
      for (const section of item.sections) {
        collectSelfMessageWidths(section.items, widths);
      }
    } else {
      collectSelfMessageWidths(item.items, widths);
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
      const metadataAllowance =
        item.tag || item.tooltip
          ? state.options.messageMetadataHeight
          : 0;
      const height = state.options.messageHeight + metadataAllowance;
      const top = state.y;
      const y = top + state.options.messageHeight / 2;
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
            actor.centerX + selfMessageWidth(item);
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
      const height = state.options.gapHeight;
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
    state.y += state.options.groupHeaderHeight;

    if (item.sections.length > 0) {
      for (const section of item.sections) {
        const sectionTop = state.y;
        state.sections.push({
          ...section,
          top: sectionTop,
          y: sectionTop + state.options.sectionHeaderHeight / 2,
          depth: depth + 1,
          left: group.left + GROUP_CONTENT_INSET,
          right: group.right - GROUP_CONTENT_INSET,
          parentId: group.id,
          index: item.sections.indexOf(section),
        });
        state.y += state.options.sectionHeaderHeight;
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
  const options = { ...DEFAULTS, ...overrides };
  const selfMessageWidths = new Map();
  collectSelfMessageWidths(document.items, selfMessageWidths);
  const actorWidths = document.actors.map((actor) =>
    Math.max(
      options.actorWidth,
      actorLabelWidth(actor.name) + ACTOR_LABEL_MARGIN_X * 2,
      metadataMetrics(actor.tag, actor.tooltip).width +
        ACTOR_METADATA_MARGIN_X * 2,
    ),
  );
  let actorX = options.marginX;
  const actors = document.actors.map((actor, index) => {
    const actorWidth = actorWidths[index];
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
    const nextActorWidth = actorWidths[index + 1];
    const defaultNextX =
      actorX + actorWidth + options.actorGap;
    if (nextActorWidth === undefined) {
      actorX = defaultNextX;
    } else {
      const loopWidth = selfMessageWidths.get(actor.name) ?? 0;
      const nextXAfterLoop =
        centerX +
        loopWidth +
        SELF_MESSAGE_LIFELINE_GAP -
        nextActorWidth / 2;
      actorX = Math.max(defaultNextX, nextXAfterLoop);
    }
    return layoutActor;
  });
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
