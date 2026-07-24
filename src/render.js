import { layoutDiagram } from "./layout.js";
import { parse } from "./parser.js";
import { resolveTheme } from "./theme.js";

const SVG_NS = "http://www.w3.org/2000/svg";

const VIEW_STYLES = `
  :host {
    display: block;
    color-scheme: light dark;
  }

  .la-frame {
    width: 100%;
    overflow: auto;
    background: var(--la-canvas);
  }

  .la-canvas {
    display: block;
    width: 100%;
    height: auto;
    min-width: min(720px, 100%);
    background: var(--la-canvas);
    color: var(--la-text);
    font-family: var(
      --la-font-family,
      ui-sans-serif,
      system-ui,
      -apple-system,
      BlinkMacSystemFont,
      "Segoe UI",
      sans-serif
    );
    text-rendering: geometricPrecision;
  }

  .la-selectable {
    cursor: pointer;
    outline: none;
  }

  .la-lifeline,
  .la-section-line {
    shape-rendering: geometricPrecision;
  }

  .la-actor-shape,
  .la-group-shape,
  .la-message-line,
  .la-gap-rule {
    transition:
      fill 120ms ease,
      stroke 120ms ease,
      opacity 120ms ease;
  }

  .la-actor:hover .la-actor-shape {
    fill: var(--la-actor-hover);
  }

  .la-actor[data-selected="true"] .la-actor-shape {
    fill: var(--la-actor-selected);
  }

  .la-actor:focus-visible .la-focus-ring,
  .la-actor[data-selected="true"] .la-focus-ring {
    opacity: 1;
  }

  .la-message:hover .la-message-line,
  .la-message:focus-visible .la-message-line,
  .la-message[data-selected="true"] .la-message-line,
  .la-message:hover .la-lost-cross,
  .la-message:focus-visible .la-lost-cross,
  .la-message[data-selected="true"] .la-lost-cross {
    stroke: var(--la-selection);
  }

  .la-message:hover .la-message-label,
  .la-message:focus-visible .la-message-label,
  .la-message[data-selected="true"] .la-message-label {
    fill: var(--la-selection);
  }

  .la-message:focus-visible .la-message-focus,
  .la-message[data-selected="true"] .la-message-focus {
    opacity: 0.24;
  }

  .la-group-hit:hover + .la-group-shape,
  .la-group-hit:focus-visible + .la-group-shape,
  .la-group-hit[data-selected="true"] + .la-group-shape {
    stroke: var(--la-selection);
    stroke-opacity: 0.72;
  }

  .la-section:hover .la-section-line,
  .la-section:focus-visible .la-section-line,
  .la-section[data-selected="true"] .la-section-line,
  .la-gap:hover .la-gap-rule,
  .la-gap:focus-visible .la-gap-rule,
  .la-gap[data-selected="true"] .la-gap-rule {
    stroke: var(--la-selection);
  }

  @media (prefers-reduced-motion: reduce) {
    .la-actor-shape,
    .la-group-shape,
    .la-message-line,
    .la-gap-rule {
      transition: none;
    }
  }
`;

function svgElement(name, attributes = {}) {
  const element = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attributes)) {
    if (value === null || value === undefined) {
      continue;
    }
    element.setAttribute(key, String(value));
  }
  return element;
}

function addTitle(parent, text) {
  if (!text) {
    return;
  }
  const title = svgElement("title");
  title.textContent = text;
  parent.append(title);
}

function truncate(text, length) {
  if (text.length <= length) {
    return text;
  }
  return `${text.slice(0, Math.max(1, length - 1))}…`;
}

function textWidth(text, fontSize = 12, minimum = 0) {
  return Math.max(minimum, text.length * fontSize * 0.56);
}

function surfaceForDepth(depth, tokens) {
  if (depth <= 0) {
    return tokens.canvas;
  }
  return (depth - 1) % 2 === 0
    ? tokens.groupFill
    : tokens.groupNestedFill;
}

function rippedEdgePoints(
  left,
  right,
  y,
  amplitude,
  toothWidth = 14,
) {
  const points = [[left, y]];
  let x = left;

  while (x < right) {
    const next = Math.min(x + toothWidth, right);
    points.push([(x + next) / 2, y + amplitude], [next, y]);
    x = next;
  }

  return points;
}

function pointsToPath(points) {
  return points
    .map(([x, y], index) => `${index === 0 ? "M" : "L"} ${x} ${y}`)
    .join(" ");
}

function rippedEdgePath(left, right, y, amplitude) {
  return pointsToPath(rippedEdgePoints(left, right, y, amplitude));
}

function rippedBandPath(left, right, top, bottom) {
  const topPoints = rippedEdgePoints(left, right, top, 4);
  const bottomPoints = rippedEdgePoints(left, right, bottom, -4).reverse();
  return `${pointsToPath([...topPoints, ...bottomPoints])} Z`;
}

function markerId(prefix, kind) {
  return `${prefix}-${kind}`;
}

function appendDefinitions(svg, tokens, prefix) {
  const defs = svgElement("defs");

  for (const [kind, color] of [
    ["arrow", tokens.line],
    ["arrow-selected", tokens.selection],
  ]) {
    const marker = svgElement("marker", {
      id: markerId(prefix, kind),
      markerWidth: 8,
      markerHeight: 8,
      refX: 7,
      refY: 4,
      orient: "auto",
      markerUnits: "strokeWidth",
    });
    marker.append(
      svgElement("path", {
        d: "M 1 1 L 7 4 L 1 7 Z",
        fill: color,
      }),
    );
    defs.append(marker);
  }

  svg.append(defs);
}

function applyTokens(frame, tokens) {
  const properties = {
    "--la-canvas": tokens.canvas,
    "--la-text": tokens.text,
    "--la-muted-text": tokens.mutedText,
    "--la-faint-text": tokens.faintText,
    "--la-line": tokens.line,
    "--la-lifeline": tokens.lifeline,
    "--la-group-fill": tokens.groupFill,
    "--la-group-nested-fill": tokens.groupNestedFill,
    "--la-section-line": tokens.sectionLine,
    "--la-actor": tokens.actor,
    "--la-actor-hover": tokens.actorHover,
    "--la-actor-selected": tokens.actorSelected,
    "--la-actor-text": tokens.actorText,
    "--la-accent": tokens.accent,
    "--la-accent-soft": tokens.accentSoft,
    "--la-tag-fill": tokens.tagFill,
    "--la-tag-text": tokens.tagText,
    "--la-selection": tokens.selection,
  };

  for (const [name, value] of Object.entries(properties)) {
    frame.style.setProperty(name, value);
  }
}

function makeSelectable(group, item, selection, label) {
  group.classList.add("la-selectable");
  group.dataset.laId = item.id;
  group.dataset.laKind = item.type;
  group.dataset.selected = "false";
  group.setAttribute("tabindex", "0");
  group.setAttribute("role", "button");
  group.setAttribute("aria-label", label);
  group.setAttribute("aria-pressed", "false");

  const select = (event) => {
    event.stopPropagation();
    selection.select(item.id, item);
  };

  group.addEventListener("click", select);
  group.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      select(event);
    }
  });
}

function renderTag(parent, tag, tooltip, x, y, tokens, anchor = "middle") {
  if (!tag) {
    return;
  }

  const visible = truncate(tag, 16);
  const width = textWidth(visible, 10, 30) + 20;
  const left =
    anchor === "start" ? x : anchor === "end" ? x - width : x - width / 2;
  const group = svgElement("g", {
    transform: `translate(${left} ${y})`,
  });

  group.append(
    svgElement("rect", {
      width,
      height: 20,
      rx: 10,
      fill: tokens.tagFill,
    }),
  );

  const text = svgElement("text", {
    x: width / 2,
    y: 13.5,
    "text-anchor": "middle",
    "font-size": 10,
    "font-weight": 650,
    fill: tokens.tagText,
  });
  text.textContent = visible;
  group.append(text);
  addTitle(group, tooltip || tag);
  parent.append(group);
}

function renderActor(parent, actor, tokens, options, selection) {
  const group = svgElement("g", {
    class: "la-actor",
    transform: `translate(${actor.x} ${actor.y})`,
  });
  makeSelectable(
    group,
    actor,
    selection,
    `Actor ${actor.name}${actor.tooltip ? `. ${actor.tooltip}` : ""}`,
  );
  addTitle(group, actor.tooltip || actor.name);

  group.append(
    svgElement("rect", {
      class: "la-focus-ring",
      x: -4,
      y: -4,
      width: actor.width + 8,
      height: actor.height + 8,
      rx: 19,
      fill: "none",
      stroke: tokens.selection,
      "stroke-width": 2,
      opacity: 0,
      "pointer-events": "none",
    }),
  );

  group.append(
    svgElement("rect", {
      class: "la-actor-shape",
      width: actor.width,
      height: actor.height,
      rx: 16,
      fill: tokens.actor,
    }),
  );

  const hasIcon = Boolean(actor.icon);
  if (hasIcon) {
    const fallback = svgElement("text", {
      x: actor.width / 2,
      y: 27,
      "text-anchor": "middle",
      "font-size": 17,
      "font-weight": 700,
      fill: tokens.actorText,
      opacity: 0.72,
      "pointer-events": "none",
    });
    fallback.textContent = actor.name.slice(0, 1).toUpperCase();
    group.append(fallback);

    const iconUrl = options.iconResolver?.(actor.icon, tokens.name);
    if (iconUrl) {
      const image = svgElement("image", {
        href: iconUrl,
        x: actor.width / 2 - 11,
        y: 10,
        width: 22,
        height: 22,
        "pointer-events": "none",
      });
      if (tokens.name === "light") {
        image.style.filter = "invert(1) brightness(1.15)";
      }
      image.addEventListener("load", () => {
        fallback.setAttribute("opacity", "0");
      });
      group.append(image);
    }
  }

  const label = svgElement("text", {
    x: actor.width / 2,
    y: hasIcon ? 54 : 40,
    "text-anchor": "middle",
    "font-size": 13,
    "font-weight": 700,
    "letter-spacing": "-0.01em",
    fill: tokens.actorText,
    "pointer-events": "none",
  });
  label.textContent = truncate(actor.name, 15);
  group.append(label);

  if (actor.tag) {
    renderTag(
      group,
      actor.tag,
      actor.tooltip,
      actor.width - 1,
      -8,
      tokens,
      "end",
    );
  }

  parent.append(group);
}

function renderGroupBackground(parent, group, tokens, selection) {
  const selectable = svgElement("g", {
    class: "la-group-hit",
  });
  makeSelectable(
    selectable,
    group,
    selection,
    `${group.groupType} group, ${group.label}`,
  );
  addTitle(selectable, `${group.groupType}: ${group.label}`);

  selectable.append(
    svgElement("rect", {
      x: group.left,
      y: group.top,
      width: group.right - group.left,
      height: group.height,
      rx: 16,
      fill: "transparent",
      "pointer-events": "all",
    }),
  );
  parent.append(selectable);

  parent.append(
    svgElement("rect", {
      class: "la-group-shape",
      x: group.left,
      y: group.top,
      width: group.right - group.left,
      height: group.height,
      rx: 16,
      fill:
        group.depth % 2 === 0
          ? tokens.groupFill
          : tokens.groupNestedFill,
      stroke: tokens.selection,
      "stroke-width": 1,
      "stroke-opacity": 0,
      "pointer-events": "none",
    }),
  );
}

function renderGroupHeader(parent, group, tokens) {
  const x = group.left + 16;
  const y = group.top + 22;

  const type = svgElement("text", {
    x,
    y,
    "font-size": 11,
    "font-weight": 750,
    fill: tokens.text,
    "pointer-events": "none",
  });
  type.textContent = group.groupType;
  parent.append(type);

  const label = svgElement("text", {
    x: x + textWidth(group.groupType, 11) + 10,
    y,
    "font-size": 11,
    "font-weight": 500,
    fill: tokens.mutedText,
    "pointer-events": "none",
  });
  label.textContent = truncate(group.label, 42);
  parent.append(label);
}

function renderSection(parent, section, tokens, selection) {
  const group = svgElement("g", {
    class: "la-section",
  });
  makeSelectable(group, section, selection, `Section ${section.label}`);
  addTitle(group, section.label);

  const lineStart = section.left;
  const lineEnd = section.right;
  const labelWidth = textWidth(section.label, 10, 36) + 16;

  group.append(
    svgElement("line", {
      class: "la-section-line",
      x1: lineStart,
      y1: section.y,
      x2: lineEnd,
      y2: section.y,
      stroke: tokens.sectionLine,
      "stroke-width": 1,
    }),
  );
  group.append(
    svgElement("rect", {
      x: lineStart + 10,
      y: section.y - 10,
      width: labelWidth,
      height: 20,
      rx: 5,
      fill: surfaceForDepth(section.depth, tokens),
    }),
  );
  const label = svgElement("text", {
    x: lineStart + 18,
    y: section.y + 3.5,
    "font-size": 10,
    "font-weight": 650,
    fill: tokens.mutedText,
  });
  label.textContent = truncate(section.label, 28);
  group.append(label);
  parent.append(group);
}

function renderLifelines(parent, layout, tokens) {
  for (const actor of layout.actors) {
    parent.append(
      svgElement("line", {
        class: "la-lifeline",
        x1: actor.centerX,
        y1: layout.lifelineTop,
        x2: actor.centerX,
        y2: layout.lifelineBottom,
        stroke: tokens.actor,
        "stroke-width": 1.75,
        "stroke-linecap": "square",
        "pointer-events": "none",
      }),
    );
  }
}

function messagePath(row, sourceX, targetX) {
  if (sourceX !== targetX) {
    return {
      d: `M ${sourceX} ${row.y} L ${targetX} ${row.y}`,
      labelX: (sourceX + targetX) / 2,
      labelY: row.y - 9,
      endX: targetX,
      endY: row.y,
      direction: Math.sign(targetX - sourceX),
    };
  }

  const loopWidth = 42;
  const top = row.y - 13;
  const bottom = row.y + 13;
  return {
    d: [
      `M ${sourceX} ${top}`,
      `L ${sourceX + loopWidth} ${top}`,
      `L ${sourceX + loopWidth} ${bottom}`,
      `L ${sourceX} ${bottom}`,
    ].join(" "),
    labelX: sourceX + loopWidth / 2,
    labelY: top - 7,
    endX: sourceX,
    endY: bottom,
    direction: -1,
  };
}

function renderLostCross(group, x, y, tokens) {
  const size = 5;
  for (const [x1, y1, x2, y2] of [
    [x - size, y - size, x + size, y + size],
    [x - size, y + size, x + size, y - size],
  ]) {
    group.append(
      svgElement("line", {
        class: "la-lost-cross",
        x1,
        y1,
        x2,
        y2,
        stroke: tokens.line,
        "stroke-width": 1.6,
        "stroke-linecap": "round",
        "pointer-events": "none",
      }),
    );
  }
}

function renderMessage(parent, row, layout, tokens, prefix, selection) {
  const source = layout.actorByName.get(row.source);
  const target = layout.actorByName.get(row.target);
  if (!source || !target) {
    return;
  }

  const group = svgElement("g", {
    class: "la-message",
  });
  makeSelectable(
    group,
    row,
    selection,
    `${row.source} to ${row.target}: ${row.label}${
      row.tooltip ? `. ${row.tooltip}` : ""
    }`,
  );
  addTitle(group, row.tooltip || row.label);

  const geometry = messagePath(row, source.centerX, target.centerX);
  let pathData = geometry.d;
  const hitLeft =
    source.centerX === target.centerX
      ? source.centerX - 8
      : Math.min(source.centerX, target.centerX) - 8;
  const hitWidth =
    source.centerX === target.centerX
      ? 58
      : Math.abs(target.centerX - source.centerX) + 16;

  group.append(
    svgElement("rect", {
      x: hitLeft,
      y: row.y - 26,
      width: hitWidth,
      height: 50,
      fill: "transparent",
      "pointer-events": "all",
    }),
  );

  if (row.arrow === "->x" && source.centerX !== target.centerX) {
    const shortenedTarget = target.centerX - geometry.direction * 9;
    pathData = `M ${source.centerX} ${row.y} L ${shortenedTarget} ${row.y}`;
  }

  group.append(
    svgElement("path", {
      class: "la-message-focus",
      d: pathData,
      fill: "none",
      stroke: tokens.selection,
      "stroke-width": 7,
      opacity: 0,
      "stroke-linecap": "round",
      "pointer-events": "none",
    }),
  );

  group.append(
    svgElement("path", {
      d: pathData,
      fill: "none",
      stroke: "transparent",
      "stroke-width": 18,
      "stroke-linecap": "round",
      "pointer-events": "stroke",
    }),
  );

  const visiblePath = svgElement("path", {
    class: "la-message-line",
    d: pathData,
    fill: "none",
    stroke: tokens.line,
    "stroke-width": 1.5,
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
    "pointer-events": "none",
  });

  if (row.arrow === "-->") {
    visiblePath.setAttribute("stroke-dasharray", "5 5");
  }
  if (row.arrow !== "->x") {
    const normalMarker = `url(#${markerId(prefix, "arrow")})`;
    const selectedMarker = `url(#${markerId(prefix, "arrow-selected")})`;
    visiblePath.setAttribute("marker-end", normalMarker);
    visiblePath.dataset.markerNormal = normalMarker;
    visiblePath.dataset.markerSelected = selectedMarker;
  }
  group.append(visiblePath);

  if (row.arrow === "->x") {
    renderLostCross(group, geometry.endX, geometry.endY, tokens);
  }

  const visibleLabel = truncate(row.label, 46);
  const labelWidth = textWidth(visibleLabel, 11, 40) + 16;
  group.append(
    svgElement("rect", {
      x: geometry.labelX - labelWidth / 2,
      y: geometry.labelY - 12,
      width: labelWidth,
      height: 18,
      rx: 4,
      fill: surfaceForDepth(row.depth, tokens),
      "pointer-events": "none",
    }),
  );

  const label = svgElement("text", {
    class: "la-message-label",
    x: geometry.labelX,
    y: geometry.labelY + 1,
    "text-anchor": "middle",
    "font-size": 11,
    "font-weight": 560,
    fill: tokens.text,
    "pointer-events": "none",
  });
  label.textContent = visibleLabel;
  group.append(label);

  if (row.tag) {
    const isSelfMessage = source.centerX === target.centerX;
    renderTag(
      group,
      row.tag,
      row.tooltip,
      geometry.labelX,
      row.y + (isSelfMessage ? 17 : 7),
      tokens,
      "middle",
    );
  }

  parent.append(group);
}

function renderGap(parent, row, layout, tokens, selection) {
  const group = svgElement("g", {
    class: "la-gap",
  });
  makeSelectable(group, row, selection, `Gap: ${row.label}`);
  addTitle(group, row.label);

  const labelWidth = textWidth(row.label, 10, 48) + 22;
  const centerX = layout.width / 2;
  const topEdge = row.top + 8;
  const bottomEdge = row.top + row.height - 8;
  const topRip = rippedEdgePath(
    layout.contentLeft,
    layout.contentRight,
    topEdge,
    4,
  );
  const bottomRip = rippedEdgePath(
    layout.contentLeft,
    layout.contentRight,
    bottomEdge,
    -4,
  );

  group.append(
    svgElement("rect", {
      x: layout.contentLeft,
      y: row.top,
      width: layout.contentRight - layout.contentLeft,
      height: row.height,
      fill: "transparent",
      "pointer-events": "all",
    }),
  );

  group.append(
    svgElement("path", {
      d: rippedBandPath(
        layout.contentLeft,
        layout.contentRight,
        topEdge,
        bottomEdge,
      ),
      fill: tokens.canvas,
      "fill-opacity": 0.96,
      "pointer-events": "none",
    }),
  );

  for (const edge of [topRip, bottomRip]) {
    group.append(
      svgElement("path", {
        class: "la-gap-rule",
        d: edge,
        fill: "none",
        stroke: tokens.lifeline,
        "stroke-width": 1,
        "stroke-linejoin": "round",
        "pointer-events": "none",
      }),
    );
  }

  group.append(
    svgElement("rect", {
      x: centerX - labelWidth / 2,
      y: row.y - 12,
      width: labelWidth,
      height: 24,
      rx: 7,
      fill: tokens.canvas,
    }),
  );

  const label = svgElement("text", {
    x: centerX,
    y: row.y + 3.5,
    "text-anchor": "middle",
    "font-size": 10,
    "font-weight": 650,
    fill: tokens.mutedText,
  });
  label.textContent = truncate(row.label, 46);
  group.append(label);
  parent.append(group);
}

function createSelectionController(root, options) {
  let selectedId = null;
  let selectedItem = null;

  function apply() {
    root.querySelectorAll("[data-la-id]").forEach((element) => {
      const selected = element.dataset.laId === selectedId;
      element.dataset.selected = String(selected);
      element.setAttribute("aria-pressed", String(selected));
      element
        .querySelectorAll("[data-marker-normal]")
        .forEach((messageLine) => {
          messageLine.setAttribute(
            "marker-end",
            selected
              ? messageLine.dataset.markerSelected
              : messageLine.dataset.markerNormal,
          );
        });
    });
  }

  return {
    select(id, item = null, emit = true) {
      selectedId = id ?? null;
      selectedItem = item;
      apply();

      if (!emit) {
        return;
      }

      const detail = {
        id: selectedId,
        kind: item?.type ?? null,
        item,
      };
      options.onSelect?.(detail);

      const eventTarget = options.eventTarget;
      if (eventTarget?.dispatchEvent && globalThis.CustomEvent) {
        eventTarget.dispatchEvent(
          new CustomEvent("la-select", {
            detail,
            bubbles: true,
            composed: true,
          }),
        );
      }
    },
    clear(emit = true) {
      this.select(null, null, emit);
    },
    get id() {
      return selectedId;
    },
    get item() {
      return selectedItem;
    },
  };
}

let rendererSequence = 0;

export function renderDiagram(target, input, options = {}) {
  if (!target?.replaceChildren) {
    throw new TypeError("renderDiagram requires a DOM container.");
  }

  const documentModel = typeof input === "string" ? parse(input) : input;
  const tokens = resolveTheme(options.theme, globalThis);
  const layout = layoutDiagram(documentModel, options.layout);
  const prefix = `la-${rendererSequence}`;
  rendererSequence += 1;

  const style = document.createElement("style");
  style.textContent = VIEW_STYLES;

  const frame = document.createElement("div");
  frame.className = "la-frame";
  frame.part = "frame";
  frame.dataset.theme = tokens.name;
  applyTokens(frame, tokens);

  const svg = svgElement("svg", {
    class: "la-canvas",
    part: "canvas",
    viewBox: `0 0 ${layout.width} ${layout.height}`,
    role: "group",
    "aria-label": options.label || "Sequence diagram",
    preserveAspectRatio: "xMinYMin meet",
  });
  svg.style.aspectRatio = `${layout.width} / ${layout.height}`;
  appendDefinitions(svg, tokens, prefix);

  const eventTarget = target.host ?? target;
  const selection = createSelectionController(svg, {
    ...options,
    eventTarget,
  });

  for (const group of layout.groups) {
    renderGroupBackground(svg, group, tokens, selection);
  }

  renderLifelines(svg, layout, tokens);

  for (const group of layout.groups) {
    renderGroupHeader(svg, group, tokens);
  }
  for (const section of layout.sections) {
    renderSection(svg, section, tokens, selection);
  }
  for (const row of layout.rows) {
    if (row.type === "message") {
      renderMessage(svg, row, layout, tokens, prefix, selection);
    } else {
      renderGap(svg, row, layout, tokens, selection);
    }
  }
  for (const actor of layout.actors) {
    renderActor(svg, actor, tokens, options, selection);
  }

  svg.addEventListener("click", (event) => {
    if (event.target === svg) {
      selection.clear();
    }
  });

  frame.append(svg);
  target.replaceChildren(style, frame);

  return {
    ast: documentModel,
    layout,
    svg,
    select(id) {
      selection.select(id, null);
    },
    clearSelection() {
      selection.clear();
    },
    get selectedId() {
      return selection.id;
    },
    destroy() {
      target.replaceChildren();
    },
  };
}
