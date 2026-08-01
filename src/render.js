import { layoutDiagram } from "./layout.js";
import { withDefaultIconOptions } from "./icons.js";
import {
  messageLabelMetrics,
  metadataMetrics,
  selfMessageWidth,
} from "./metadata.js";
import {
  documentSnapshot,
  freezeDocument,
} from "./document.js";
import { parse } from "./parser.js";
import { serialize } from "./serialize.js";
import { textLines } from "./text.js";
import { resolveTheme } from "./theme.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const BRANDING_HREF = "https://lines-and-arrows.dev/";
const BRANDING_LABEL = "Powered by Lines & Arrows";
const BRANDING_FONT_SIZE = 7;
const BRANDING_HEIGHT = 15;
const BRANDING_LIFELINE_OVERLAP = 3;
const BRANDING_BOTTOM_MARGIN = 2;
let tooltipSequence = 0;

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

  .la-frame[data-selectable="true"]
    .la-actor:hover
    .la-actor-shape {
    fill: var(--la-actor-hover);
  }

  .la-frame[data-selectable="true"]
    .la-actor[data-selected="true"]
    .la-actor-shape {
    fill: var(--la-actor-selected);
  }

  .la-frame[data-selectable="true"]
    .la-actor:focus-visible
    .la-focus-ring,
  .la-frame[data-selectable="true"]
    .la-actor[data-selected="true"]
    .la-focus-ring {
    opacity: 1;
  }

  .la-frame[data-selectable="true"]
    .la-message:hover
    .la-message-line,
  .la-frame[data-selectable="true"]
    .la-message:focus-visible
    .la-message-line,
  .la-frame[data-selectable="true"]
    .la-message[data-selected="true"]
    .la-message-line,
  .la-frame[data-selectable="true"]
    .la-message:hover
    .la-lost-cross,
  .la-frame[data-selectable="true"]
    .la-message:focus-visible
    .la-lost-cross,
  .la-frame[data-selectable="true"]
    .la-message[data-selected="true"]
    .la-lost-cross {
    stroke: var(--la-selection);
  }

  .la-frame[data-selectable="true"]
    .la-message:hover
    .la-message-label,
  .la-frame[data-selectable="true"]
    .la-message:focus-visible
    .la-message-label,
  .la-frame[data-selectable="true"]
    .la-message[data-selected="true"]
    .la-message-label {
    fill: var(--la-selection);
  }

  .la-frame[data-selectable="true"]
    .la-message:focus-visible
    .la-message-focus,
  .la-frame[data-selectable="true"]
    .la-message[data-selected="true"]
    .la-message-focus {
    opacity: 0.24;
  }

  .la-tooltip-trigger {
    cursor: help;
    outline: none;
  }

  .la-tooltip-trigger-shape {
    transition:
      fill 100ms ease,
      stroke 100ms ease;
  }

  .la-tooltip-trigger:hover .la-tooltip-trigger-shape,
  .la-tooltip-trigger:focus-visible .la-tooltip-trigger-shape {
    fill: var(--la-accent-soft);
    stroke: var(--la-selection);
  }

  .la-tooltip-popover {
    opacity: 0;
    visibility: hidden;
    pointer-events: none;
  }

  .la-tooltip-popover[data-visible="true"] {
    opacity: 1;
    visibility: visible;
  }

  .la-branding {
    opacity: 0.48;
    outline: none;
    transition: opacity 100ms ease;
  }

  .la-branding:hover,
  .la-branding:focus-visible {
    opacity: 0.78;
  }

  .la-branding-surface {
    fill: var(--la-group-fill);
    fill-opacity: 0.72;
    stroke: var(--la-section-line);
    stroke-opacity: 0.5;
  }

  .la-branding-text {
    fill: var(--la-muted-text);
  }

  .la-branding:focus-visible .la-branding-surface {
    stroke: var(--la-selection);
    stroke-opacity: 0.72;
  }

  .la-frame[data-selectable="true"]
    .la-group-hit:hover
    + .la-group-shape,
  .la-frame[data-selectable="true"]
    .la-group-hit:focus-visible
    + .la-group-shape,
  .la-frame[data-selectable="true"]
    .la-group-hit[data-selected="true"]
    + .la-group-shape {
    stroke: var(--la-selection);
    stroke-opacity: 0.72;
  }

  .la-frame[data-selectable="true"]
    .la-section:hover
    .la-section-line,
  .la-frame[data-selectable="true"]
    .la-section:focus-visible
    .la-section-line,
  .la-frame[data-selectable="true"]
    .la-section[data-selected="true"]
    .la-section-line,
  .la-frame[data-selectable="true"]
    .la-gap:hover
    .la-gap-rule,
  .la-frame[data-selectable="true"]
    .la-gap:focus-visible
    .la-gap-rule,
  .la-frame[data-selectable="true"]
    .la-gap[data-selected="true"]
    .la-gap-rule {
    stroke: var(--la-selection);
  }

  @media (prefers-reduced-motion: reduce) {
    .la-actor-shape,
    .la-group-shape,
    .la-message-line,
    .la-gap-rule,
    .la-tooltip-trigger-shape,
    .la-branding {
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

function appendTextLines(
  text,
  lines,
  x,
  firstY,
  lineHeight,
) {
  for (const [index, line] of lines.entries()) {
    const segment = svgElement("tspan", {
      x,
      y: firstY + index * lineHeight,
    });
    segment.textContent = line;
    text.append(segment);
  }
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

  const tooltipIconFilter = svgElement("filter", {
    id: markerId(prefix, "tooltip-icon-color"),
    "color-interpolation-filters": "sRGB",
  });
  tooltipIconFilter.append(
    svgElement("feFlood", {
      "flood-color": tokens.tagText,
      result: "tooltip-icon-color",
    }),
    svgElement("feComposite", {
      in: "tooltip-icon-color",
      in2: "SourceAlpha",
      operator: "in",
    }),
  );
  defs.append(tooltipIconFilter);

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
  if (!selection.enabled) {
    return false;
  }

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
    selection.select(item.id);
  };

  group.addEventListener("click", select);
  group.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      select(event);
    }
  });
  return true;
}

function wrapTooltip(text, maxWidth, fontSize = 10) {
  const maxCharacters = Math.max(
    8,
    Math.floor(maxWidth / (fontSize * 0.56)),
  );
  const lines = [];
  for (const explicitLine of textLines(String(text).trim())) {
    if (!explicitLine) {
      lines.push("");
      continue;
    }
    const pieces = explicitLine.split(/\s+/).flatMap((word) => {
      if (word.length <= maxCharacters) {
        return [word];
      }
      const chunks = [];
      for (
        let index = 0;
        index < word.length;
        index += maxCharacters
      ) {
        chunks.push(word.slice(index, index + maxCharacters));
      }
      return chunks;
    });
    let current = "";

    for (const piece of pieces) {
      const candidate = current ? `${current} ${piece}` : piece;
      if (current && textWidth(candidate, fontSize) > maxWidth) {
        lines.push(current);
        current = piece;
      } else {
        current = candidate;
      }
    }
    if (current) {
      lines.push(current);
    }
  }
  return lines.length > 0 ? lines : [""];
}

function renderTooltipPopover(
  layer,
  tooltip,
  triggerX,
  triggerY,
  triggerSize,
  tokens,
  side,
  bounds,
) {
  tooltipSequence += 1;
  const id = `la-tooltip-${tooltipSequence}`;
  const availableWidth = Math.max(80, bounds.right - bounds.left);
  const textMaxWidth = Math.min(188, availableWidth - 20);
  const lines = wrapTooltip(tooltip, textMaxWidth);
  const width = Math.min(
    availableWidth,
    Math.max(
      80,
      Math.max(...lines.map((line) => textWidth(line, 10))) + 20,
    ),
  );
  const height = lines.length * 14 + 16;
  const triggerCenter = triggerX + triggerSize / 2;
  const left = Math.max(
    bounds.left,
    Math.min(triggerCenter - width / 2, bounds.right - width),
  );
  const top =
    side === "below"
      ? triggerY + triggerSize + 7
      : triggerY - height - 7;
  const arrowX = Math.max(
    left + 10,
    Math.min(triggerCenter, left + width - 10),
  );
  const popover = svgElement("g", {
    id,
    class: "la-tooltip-popover",
    "data-visible": "false",
    role: "tooltip",
    "aria-label": tooltip,
  });

  popover.append(
    svgElement("rect", {
      x: left,
      y: top,
      width,
      height,
      rx: 7,
      fill: tokens.tooltip,
    }),
    svgElement("path", {
      d:
        side === "below"
          ? `M ${arrowX - 4} ${top} L ${arrowX} ${top - 4} L ${arrowX + 4} ${top} Z`
          : `M ${arrowX - 4} ${top + height} L ${arrowX} ${
              top + height + 4
            } L ${arrowX + 4} ${top + height} Z`,
      fill: tokens.tooltip,
    }),
  );

  const text = svgElement("text", {
    x: left + 10,
    y: top + 13,
    "font-size": 10,
    "font-weight": 560,
    fill: tokens.canvas,
  });
  for (const [index, line] of lines.entries()) {
    const segment = svgElement("tspan", {
      x: left + 10,
      dy: index === 0 ? 0 : 14,
    });
    segment.textContent = line;
    text.append(segment);
  }
  popover.append(text);
  layer.append(popover);
  return { id, popover };
}

function renderMetadata(
  parent,
  tag,
  tooltip,
  tooltipIcon,
  x,
  y,
  tokens,
  options,
) {
  if (!tag && !tooltip) {
    return;
  }

  const {
    visibleTag,
    tagWidth,
    triggerSize,
    gap,
    width,
  } = metadataMetrics(tag, tooltip);
  const left =
    options.anchor === "start"
      ? x
      : options.anchor === "end"
        ? x - width
        : x - width / 2;

  if (tag) {
    const tagGroup = svgElement("g", {
      class: "la-tag",
      transform: `translate(${left} ${y})`,
    });
    tagGroup.append(
      svgElement("rect", {
        width: tagWidth,
        height: 20,
        rx: 10,
        fill: tokens.tagFill,
      }),
    );

    const text = svgElement("text", {
      x: tagWidth / 2,
      y: 13.5,
      "text-anchor": "middle",
      "font-size": 10,
      "font-weight": 650,
      fill: tokens.tagText,
    });
    text.textContent = visibleTag;
    tagGroup.append(text);
    addTitle(tagGroup, tag);
    parent.append(tagGroup);
  }

  if (!tooltip) {
    return;
  }

  const triggerX = left + tagWidth + gap;
  const globalTriggerX = triggerX + options.offsetX;
  const globalTriggerY = y + options.offsetY;
  const { id, popover } = renderTooltipPopover(
    options.tooltipLayer,
    tooltip,
    globalTriggerX,
    globalTriggerY,
    triggerSize,
    tokens,
    options.tooltipSide,
    options.bounds,
  );
  const trigger = svgElement("g", {
    class: "la-tooltip-trigger",
    transform: `translate(${triggerX} ${y})`,
    tabindex: 0,
    role: "button",
    "aria-label": "Show tooltip",
    "aria-describedby": id,
    "aria-expanded": "false",
  });
  trigger.append(
    svgElement("rect", {
      class: "la-tooltip-trigger-shape",
      width: triggerSize,
      height: triggerSize,
      rx: triggerSize / 2,
      fill: tokens.tagFill,
      stroke: "transparent",
      "stroke-width": 1,
    }),
  );

  const fallback = svgElement("text", {
    class: "la-tooltip-trigger-fallback",
    x: triggerSize / 2,
    y: triggerSize / 2 + 3.7,
    "text-anchor": "middle",
    "font-size": 11,
    "font-weight": 750,
    fill: tokens.tagText,
    "pointer-events": "none",
  });
  fallback.textContent = "i";
  trigger.append(fallback);

  const iconUrl = tooltipIcon
    ? options.iconResolver?.(tooltipIcon, tokens.name)
    : null;
  if (iconUrl) {
    const image = svgElement("image", {
      class: "la-tooltip-trigger-icon",
      href: iconUrl,
      x: 3,
      y: 3,
      width: triggerSize - 6,
      height: triggerSize - 6,
      filter: options.tooltipIconFilter,
      "pointer-events": "none",
    });
    image.addEventListener("load", () => {
      fallback.setAttribute("opacity", "0");
    });
    trigger.append(image);
  }

  let hovered = false;
  let focused = false;
  let pinned = false;
  const sync = () => {
    const visible = hovered || focused || pinned;
    popover.dataset.visible = String(visible);
    trigger.setAttribute("aria-expanded", String(visible));
  };
  trigger.addEventListener("pointerenter", () => {
    hovered = true;
    sync();
  });
  trigger.addEventListener("pointerleave", () => {
    hovered = false;
    sync();
  });
  trigger.addEventListener("focus", () => {
    focused = true;
    sync();
  });
  trigger.addEventListener("blur", () => {
    focused = false;
    pinned = false;
    sync();
  });
  trigger.addEventListener("pointerdown", (event) => {
    event.stopPropagation();
  });
  trigger.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    pinned = !pinned;
    sync();
  });
  trigger.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      event.stopPropagation();
      pinned = !pinned;
      sync();
    } else if (event.key === "Escape") {
      pinned = false;
      sync();
      trigger.blur();
    }
  });
  parent.append(trigger);
}

function renderActor(
  parent,
  actor,
  layout,
  tokens,
  options,
  selection,
  tooltipLayer,
) {
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
  addTitle(group, actor.name);

  group.append(
    svgElement("rect", {
      class: "la-focus-ring",
      x: -4,
      y: -4,
      width: actor.width + 8,
      height: actor.height + 8,
      rx: 17,
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
      rx: 14,
      fill: tokens.actor,
    }),
  );

  const hasIcon = Boolean(actor.icon);
  if (hasIcon) {
    const fallback = svgElement("text", {
      x: actor.width / 2,
      y: 19,
      "text-anchor": "middle",
      "font-size": 15,
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
        x: actor.width / 2 - 9,
        y: 4,
        width: 18,
        height: 18,
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
    y: hasIcon ? 39 : 29.5,
    "text-anchor": "middle",
    "font-size": 13,
    "font-weight": 700,
    "letter-spacing": "-0.01em",
    fill: tokens.actorText,
    "pointer-events": "none",
  });
  label.textContent = actor.name;
  group.append(label);

  renderMetadata(
    group,
    actor.tag,
    actor.tooltip,
    actor.tooltipIcon,
    actor.width / 2,
    actor.height + layout.options.actorMetadataGap,
    tokens,
    {
      anchor: "middle",
      offsetX: actor.x,
      offsetY: actor.y,
      tooltipLayer,
      iconResolver: options.iconResolver,
      tooltipIconFilter: options.tooltipIconFilter,
      tooltipSide: "below",
      bounds: {
        left: 8,
        right: layout.width - 8,
      },
    },
  );

  parent.append(group);
}

function renderGroupBackground(parent, group, tokens, selection) {
  const selectable = svgElement("g", {
    class: "la-group-hit",
  });
  const enabled = makeSelectable(
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
      "pointer-events": enabled ? "all" : "none",
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

function renderGroupHeader(
  parent,
  group,
  tokens,
) {
  const surface =
    group.depth % 2 === 0
      ? tokens.groupFill
      : tokens.groupNestedFill;
  const left = group.left + 16;
  const right = group.right - 16;
  const y = group.top + 19;
  const typeWidth = textWidth(group.groupType, 11);
  const headerTextGap = 8;
  const labelX = left + typeWidth + headerTextGap;
  const availableLabelWidth = Math.max(
    36,
    right - labelX,
  );
  const labelCharacters = Math.max(
    6,
    Math.floor(availableLabelWidth / (11 * 0.56)),
  );
  const visibleLines = textLines(group.label).map((line) =>
    truncate(line, labelCharacters),
  );
  const labelWidth = Math.max(
    0,
    ...visibleLines.map((line) => textWidth(line, 11)),
  );
  const header = svgElement("g", {
    class: "la-group-header",
    "pointer-events": "none",
  });
  const backplatePadding = 6;

  header.append(
    svgElement("rect", {
      class: "la-group-type-shape",
      x: left - backplatePadding,
      y: y - 14,
      width: typeWidth + backplatePadding * 2,
      height: 20,
      rx: 5,
      fill: surface,
    }),
  );

  if (visibleLines.some(Boolean)) {
    header.append(
      svgElement("rect", {
        class: "la-group-label-shape",
        x: labelX - backplatePadding,
        y: group.top + 5,
        width: labelWidth + backplatePadding * 2,
        height: visibleLines.length * 13 + 7,
        rx: 5,
        fill: surface,
      }),
    );
  }

  const label = svgElement("text", {
    x: labelX,
    "font-size": 11,
    "font-weight": 650,
    fill: tokens.text,
  });
  appendTextLines(label, visibleLines, labelX, group.top + 19, 13);

  const type = svgElement("text", {
    x: left,
    y,
    "font-size": 11,
    "font-weight": 700,
    fill: tokens.mutedText,
  });
  type.textContent = group.groupType;

  header.append(type, label);
  parent.append(header);
}

function renderSection(parent, section, tokens, selection) {
  const group = svgElement("g", {
    class: "la-section",
  });
  makeSelectable(group, section, selection, `Section ${section.label}`);
  addTitle(group, section.label);

  const lineStart = section.left;
  const lineEnd = section.right;
  const visibleLines = textLines(section.label).map((line) =>
    truncate(line, 28),
  );
  const labelWidth =
    Math.max(
      36,
      ...visibleLines.map((line) => textWidth(line, 10)),
    ) + 16;

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
      y: section.top + 3,
      width: labelWidth,
      height: visibleLines.length * 12 + 8,
      rx: 5,
      fill: surfaceForDepth(section.depth, tokens),
    }),
  );
  const label = svgElement("text", {
    x: lineStart + 18,
    "font-size": 10,
    "font-weight": 650,
    fill: tokens.mutedText,
  });
  appendTextLines(
    label,
    visibleLines,
    lineStart + 18,
    section.top + 16,
    12,
  );
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

function messagePath(
  row,
  sourceX,
  targetX,
  messageLabelMaxWidth,
) {
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

  const loopWidth = selfMessageWidth(
    row,
    messageLabelMaxWidth,
  );
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
    loopWidth,
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

function renderMessage(
  parent,
  row,
  layout,
  tokens,
  prefix,
  selection,
  tooltipLayer,
  options,
) {
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
    `${row.source} to ${row.target}${
      row.label ? `: ${row.label}` : ""
    }${
      row.tooltip ? `. ${row.tooltip}` : ""
    }`,
  );
  addTitle(group, row.label || `${row.source} to ${row.target}`);

  const geometry = messagePath(
    row,
    source.centerX,
    target.centerX,
    layout.options.messageLabelMaxWidth,
  );
  let pathData = geometry.d;
  const hitLeft =
    source.centerX === target.centerX
      ? source.centerX - 8
      : Math.min(source.centerX, target.centerX) - 8;
  const hitWidth =
    source.centerX === target.centerX
      ? geometry.loopWidth + 16
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

    const highlightMarker = () =>
      visiblePath.setAttribute("marker-end", selectedMarker);
    const restoreMarker = () =>
      visiblePath.setAttribute(
        "marker-end",
        group.dataset.selected === "true"
          ? selectedMarker
          : normalMarker,
      );
    if (selection.enabled) {
      group.addEventListener("pointerenter", highlightMarker);
      group.addEventListener("pointerleave", restoreMarker);
      group.addEventListener("focus", highlightMarker);
      group.addEventListener("blur", restoreMarker);
    }
  }
  group.append(visiblePath);

  if (row.arrow === "->x") {
    renderLostCross(group, geometry.endX, geometry.endY, tokens);
  }

  if (row.label) {
    const {
      visibleLines,
      textWidth: labelTextWidth,
      lineHeight,
      height: labelHeight,
    } =
      messageLabelMetrics(
        row.label,
        layout.options.messageLabelMaxWidth,
      );
    const labelPaddingX = 5;

    group.append(
      svgElement("rect", {
        class: "la-message-label-shape",
        x:
          geometry.labelX -
          labelTextWidth / 2 -
          labelPaddingX,
        y: geometry.labelY - labelHeight + 1,
        width: labelTextWidth + labelPaddingX * 2,
        height: labelHeight + 5,
        rx: 4,
        fill: surfaceForDepth(row.depth, tokens),
        "pointer-events": "none",
      }),
    );

    const label = svgElement("text", {
      class: "la-message-label",
      x: geometry.labelX,
      "text-anchor": "middle",
      "font-size": 11,
      "font-weight": 560,
      fill: tokens.text,
      "pointer-events": "none",
    });
    appendTextLines(
      label,
      visibleLines,
      geometry.labelX,
      geometry.labelY -
        (visibleLines.length - 1) * lineHeight +
        1,
      lineHeight,
    );
    group.append(label);
  }

  const isSelfMessage = source.centerX === target.centerX;
  renderMetadata(
    group,
    row.tag,
    row.tooltip,
    row.tooltipIcon,
    geometry.labelX,
    row.y + (isSelfMessage ? 17 : 7),
    tokens,
    {
      anchor: "middle",
      offsetX: 0,
      offsetY: 0,
      tooltipLayer,
      iconResolver: options.iconResolver,
      tooltipIconFilter: options.tooltipIconFilter,
      tooltipSide: "below",
      bounds: {
        left: 8,
        right: layout.width - 8,
      },
    },
  );

  parent.append(group);
}

function renderGap(parent, row, layout, tokens, selection) {
  const group = svgElement("g", {
    class: "la-gap",
  });
  makeSelectable(group, row, selection, `Gap: ${row.label}`);
  addTitle(group, row.label);

  const visibleLines = textLines(row.label).map((line) =>
    truncate(line, 46),
  );
  const labelWidth =
    Math.max(
      48,
      ...visibleLines.map((line) => textWidth(line, 10)),
    ) + 22;
  const labelHeight = visibleLines.length * 12 + 12;
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
      y: row.y - labelHeight / 2,
      width: labelWidth,
      height: labelHeight,
      rx: 7,
      fill: tokens.canvas,
    }),
  );

  const label = svgElement("text", {
    x: centerX,
    "text-anchor": "middle",
    "font-size": 10,
    "font-weight": 650,
    fill: tokens.mutedText,
  });
  appendTextLines(
    label,
    visibleLines,
    centerX,
    row.y -
      ((visibleLines.length - 1) * 12) / 2 +
      3.5,
    12,
  );
  group.append(label);
  parent.append(group);
}

function renderBranding(parent, layout) {
  const width = Math.ceil(
    textWidth(BRANDING_LABEL, BRANDING_FONT_SIZE) + 12,
  );
  const left = (layout.width - width) / 2;
  const top = Math.min(
    layout.lifelineBottom - BRANDING_LIFELINE_OVERLAP,
    layout.height - BRANDING_BOTTOM_MARGIN - BRANDING_HEIGHT,
  );
  const link = svgElement("a", {
    class: "la-branding",
    part: "branding",
    href: BRANDING_HREF,
    target: "_blank",
    rel: "noopener noreferrer",
    "aria-label": `${BRANDING_LABEL}. Open website`,
  });
  const title = svgElement("title");
  title.textContent = "Open the Lines & Arrows website";
  link.append(
    title,
    svgElement("rect", {
      class: "la-branding-surface",
      x: left,
      y: top,
      width,
      height: BRANDING_HEIGHT,
      rx: BRANDING_HEIGHT / 2,
      "stroke-width": 0.75,
    }),
  );
  const label = svgElement("text", {
    class: "la-branding-text",
    x: left + width / 2,
    y: top + 10,
    "text-anchor": "middle",
    "font-size": BRANDING_FONT_SIZE,
    "font-weight": 600,
    "letter-spacing": 0.05,
    "pointer-events": "none",
  });
  label.textContent = BRANDING_LABEL;
  link.append(label);
  link.addEventListener("pointerdown", (event) => {
    event.stopPropagation();
  });
  parent.append(link);
}

function indexSelectableModels(documentModel) {
  const models = new Map();

  for (const actor of documentModel.actors) {
    models.set(actor.id ?? `actor:${actor.name}`, actor);
  }

  function visit(items) {
    for (const item of items) {
      models.set(item.id, item);
      if (item.type !== "group") {
        continue;
      }
      if (item.sections.length > 0) {
        for (const section of item.sections) {
          models.set(section.id, section);
          visit(section.items);
        }
      } else {
        visit(item.items);
      }
    }
  }

  visit(documentModel.items);
  return models;
}

function createSelectionController(root, options) {
  const enabled = options.selectable !== false;
  const models = options.models;
  let selectedId = null;
  let selectedItem = null;

  function apply() {
    root.querySelectorAll("[data-la-id]").forEach((element) => {
      const selected = element.dataset.laId === selectedId;
      const highlighted =
        selected ||
        element.matches(":hover, :focus, :focus-visible");
      element.dataset.selected = String(selected);
      element.setAttribute("aria-pressed", String(selected));
      element
        .querySelectorAll("[data-marker-normal]")
        .forEach((messageLine) => {
          messageLine.setAttribute(
            "marker-end",
            highlighted
              ? messageLine.dataset.markerSelected
              : messageLine.dataset.markerNormal,
          );
        });
    });
  }

  const controller = {
    select(id, emit = true) {
      if (!enabled) {
        return;
      }
      const nextId = id ?? null;
      const item = nextId === null ? null : models.get(nextId);
      if (nextId !== null && !item) {
        throw new RangeError(
          `No selectable diagram element has ID "${nextId}".`,
        );
      }
      selectedId = nextId;
      selectedItem = item ?? null;
      apply();

      if (!emit) {
        return;
      }

      const detail = Object.freeze({
        id: selectedId,
        kind: item?.type ?? null,
        item: item ?? null,
      });
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
      this.select(null, emit);
    },
    get id() {
      return selectedId;
    },
    get item() {
      return selectedItem;
    },
    get enabled() {
      return enabled;
    },
  };

  return controller;
}

let rendererSequence = 0;

export function renderDiagram(target, input, options = {}) {
  if (!target?.replaceChildren) {
    throw new TypeError("renderDiagram requires a DOM container.");
  }
  options = withDefaultIconOptions(options);

  const documentModel =
    typeof input === "string"
      ? freezeDocument(parse(input))
      : documentSnapshot(input);
  if (typeof input !== "string") {
    serialize(documentModel);
  }
  const tokens = resolveTheme(options.theme, globalThis);
  const branding = options.branding !== false;
  const layout = layoutDiagram(documentModel, options.layout);
  const prefix = `la-${rendererSequence}`;
  rendererSequence += 1;

  const style = document.createElement("style");
  style.textContent = VIEW_STYLES;

  const frame = document.createElement("div");
  frame.className = "la-frame";
  frame.part = "frame";
  frame.dataset.theme = tokens.name;
  frame.dataset.selectable = String(options.selectable !== false);
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
  const renderOptions = {
    ...options,
    tooltipIconFilter: `url(#${markerId(
      prefix,
      "tooltip-icon-color",
    )})`,
  };
  const tooltipLayer = svgElement("g", {
    class: "la-tooltip-layer",
    "pointer-events": "none",
  });

  const eventTarget = target.host ?? target;
  const selection = createSelectionController(svg, {
    ...renderOptions,
    eventTarget,
    models: indexSelectableModels(documentModel),
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
      renderMessage(
        svg,
        row,
        layout,
        tokens,
        prefix,
        selection,
        tooltipLayer,
        renderOptions,
      );
    } else {
      renderGap(svg, row, layout, tokens, selection);
    }
  }
  for (const actor of layout.actors) {
    renderActor(
      svg,
      actor,
      layout,
      tokens,
      renderOptions,
      selection,
      tooltipLayer,
    );
  }
  if (branding) {
    renderBranding(svg, layout);
  }
  svg.append(tooltipLayer);
  if (selection.enabled && options.initialSelectedId) {
    selection.select(options.initialSelectedId, false);
  }

  if (selection.enabled) {
    svg.addEventListener("click", (event) => {
      if (event.target === svg) {
        selection.clear();
      }
    });
  }

  frame.append(svg);
  target.replaceChildren(style, frame);

  return {
    get ast() {
      return documentModel;
    },
    layout,
    svg,
    select(id) {
      selection.select(id);
    },
    clearSelection() {
      selection.clear();
    },
    get selectedId() {
      return selection.id;
    },
    destroy() {
      style.remove();
      frame.remove();
    },
  };
}
