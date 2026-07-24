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

function layoutItems(items, state, depth = 0) {
  for (const item of items) {
    if (item.type === "message") {
      const tagAllowance = item.tag ? 18 : 0;
      const height = state.options.messageHeight + tagAllowance;
      const y = state.y + state.options.messageHeight / 2;
      state.rows.push({ ...item, y, height, depth });
      state.y += height;
      continue;
    }

    if (item.type === "gap") {
      const top = state.y;
      const height = state.options.gapHeight;
      state.rows.push({
        ...item,
        top,
        y: top + height / 2,
        height,
        depth,
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
        });
        state.y += state.options.sectionHeaderHeight;
        layoutItems(section.items, state, depth + 1);
      }
    } else {
      layoutItems(item.items, state, depth + 1);
    }

    state.y += state.options.groupPaddingBottom;
    group.bottom = state.y;
    group.height = group.bottom - group.top;
    state.y += state.options.groupGap;
  }
}

export function layoutDiagram(document, overrides = {}) {
  const options = { ...DEFAULTS, ...overrides };
  const actorStride = options.actorWidth + options.actorGap;
  const laneWidth =
    document.actors.length > 1
      ? (document.actors.length - 1) * actorStride
      : options.actorWidth;
  const width = Math.max(
    420,
    options.marginX * 2 + laneWidth + options.actorWidth,
  );

  const actors = document.actors.map((actor, index) => {
    const centerX =
      options.marginX + options.actorWidth / 2 + index * actorStride;
    return {
      ...actor,
      id: `actor:${actor.name}`,
      x: centerX - options.actorWidth / 2,
      y: options.marginTop,
      centerX,
      width: options.actorWidth,
      height: options.actorHeight,
    };
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
