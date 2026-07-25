import {
  ACTOR_LABEL_MARGIN_X,
  ACTOR_METADATA_MARGIN_X,
  actorLabelWidth,
  metadataMetrics,
} from "./metadata.js";

const DEFAULTS = {
  actorWidth: 96,
  actorHeight: 72,
  actorGap: 70,
  marginX: 58,
  marginTop: 34,
  timelineTopGap: 38,
  messageHeight: 58,
  gapHeight: 66,
  groupHeaderHeight: 34,
  sectionHeaderHeight: 30,
  groupPaddingBottom: 14,
  groupGap: 14,
  bottomPadding: 42,
};

function layoutItems(
  items,
  state,
  depth = 0,
  parentId = "root",
) {
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    if (item.type === "message") {
      const metadataAllowance = item.tag || item.tooltip ? 18 : 0;
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
      left: state.options.marginX + depth * 9,
      right: state.width - state.options.marginX - depth * 9,
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
          left: group.left + 14,
          right: group.right - 14,
          parentId: group.id,
          index: item.sections.indexOf(section),
        });
        state.y += state.options.sectionHeaderHeight;
        layoutItems(
          section.items,
          state,
          depth + 1,
          section.id,
        );
      }
    } else {
      layoutItems(item.items, state, depth + 1, item.id);
    }

    state.y += state.options.groupPaddingBottom;
    group.bottom = state.y;
    group.height = group.bottom - group.top;
    state.y += state.options.groupGap;
  }
}

export function layoutDiagram(document, overrides = {}) {
  const options = { ...DEFAULTS, ...overrides };
  const actorWidths = document.actors.map((actor) =>
    Math.max(
      options.actorWidth,
      actorLabelWidth(actor.name) + ACTOR_LABEL_MARGIN_X * 2,
      metadataMetrics(actor.tag, actor.tooltip).width +
        ACTOR_METADATA_MARGIN_X * 2,
    ),
  );
  const actorsWidth = actorWidths.reduce(
    (total, actorWidth) => total + actorWidth,
    0,
  );
  const laneWidth =
    actorsWidth +
    Math.max(0, document.actors.length - 1) * options.actorGap;
  const width = Math.max(
    420,
    options.marginX * 2 + laneWidth,
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
    actorX += actorWidth + options.actorGap;
    return layoutActor;
  });

  const state = {
    options,
    width,
    y:
      options.marginTop +
      options.actorHeight +
      options.timelineTopGap,
    rows: [],
    groups: [],
    sections: [],
  };

  layoutItems(document.items, state);

  const height = state.y + options.bottomPadding;
  const actorByName = new Map(actors.map((actor) => [actor.name, actor]));

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
