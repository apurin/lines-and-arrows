import {
  layoutDiagram,
  layoutDiagramForEditor,
  layoutDiagramWithoutHeader,
} from "./layout.js";
import { phosphorIconResolver } from "./icons.js";
import {
  messageLabelMetrics,
  metadataMetrics,
  selfMessageWidth,
} from "./metadata.js";
import { assignStructuralIds } from "./document.js";
import { parse } from "./parser.js";
import { serialize } from "./serialize.js";
import {
  estimatedTextWidth,
  graphemes,
  textLines,
  truncateTextToWidth,
} from "./text.js";
import { resolvePaletteTheme, resolveTheme } from "./theme.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const BRANDING_HREF = "https://lines-and-arrows.dev/";
const BRANDING_LABEL = "Powered by Lines & Arrows";
const BRANDING_FONT_SIZE = 7;
const SOURCE_ATTRIBUTION = `// Powered by ${BRANDING_HREF}`;
const HEADER_CONTROL_SIZE = 18;
const HEADER_CONTROL_GAP = 2;
const LIFELINE_LABEL_MIN_ROWS = 6;
const LIFELINE_LABEL_BASELINE_OFFSET = 14;
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

  .la-actor.la-selectable:hover
    .la-actor-shape {
    fill: var(--la-actor-hover);
  }

  .la-actor.la-selectable[data-selected="true"]
    .la-actor-shape {
    fill: var(--la-actor-selected);
  }

  .la-actor.la-selectable:focus-visible
    .la-focus-ring {
    opacity: 1;
  }

  .la-message.la-selectable:hover
    .la-message-line,
  .la-message.la-selectable:focus-visible
    .la-message-line,
  .la-message.la-selectable[data-selected="true"]
    .la-message-line,
  .la-message.la-selectable:hover
    .la-lost-cross,
  .la-message.la-selectable:focus-visible
    .la-lost-cross,
  .la-message.la-selectable[data-selected="true"]
    .la-lost-cross {
    stroke: var(--la-selection);
  }

  .la-message.la-selectable:hover
    .la-message-label,
  .la-message.la-selectable:focus-visible
    .la-message-label,
  .la-message.la-selectable[data-selected="true"]
    .la-message-label {
    fill: var(--la-selection);
  }

  .la-message.la-selectable:focus-visible
    .la-message-selection-highlight,
  .la-message.la-selectable[data-selected="true"]
    .la-message-selection-highlight {
    opacity: 0.26;
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
    position: fixed;
    z-index: 4;
    inset: auto;
    display: none;
    box-sizing: border-box;
    max-width: min(208px, calc(100vw - 16px));
    margin: 0;
    padding: 8px 10px;
    overflow: visible;
    border: 0;
    border-radius: 7px;
    background: var(--la-tooltip);
    color: var(--la-tooltip-text);
    box-shadow: 0 3px 12px
      color-mix(in srgb, var(--la-text) 10%, transparent);
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    font: 560 10px/1.4 var(
      --la-font-family,
      ui-sans-serif,
      system-ui,
      sans-serif
    );
    pointer-events: none;
  }

  .la-tooltip-popover[data-visible="true"],
  .la-tooltip-popover:popover-open {
    display: block;
  }

  .la-tooltip-popover::before {
    content: "";
    position: absolute;
    left: var(--la-tooltip-arrow-x, 50%);
    width: 8px;
    height: 8px;
    background: inherit;
    transform: translateX(-50%) rotate(45deg);
  }

  .la-tooltip-popover[data-side="below"]::before {
    top: -4px;
  }

  .la-tooltip-popover[data-side="above"]::before {
    bottom: -4px;
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
    fill: transparent;
    stroke: transparent;
  }

  .la-branding-text {
    fill: var(--la-muted-text);
  }

  .la-branding:focus-visible .la-branding-surface {
    stroke: var(--la-selection);
    stroke-opacity: 0.55;
  }

  .la-header-control {
    cursor: pointer;
    outline: none;
  }

  .la-header-control-surface {
    fill: transparent;
    stroke: transparent;
    transition:
      fill 100ms ease,
      stroke 100ms ease;
  }

  .la-header-control-icon,
  .la-header-control-fallback {
    opacity: 0.68;
    transition: opacity 100ms ease;
  }

  .la-header-control-fallback {
    fill: var(--la-muted-text);
  }

  .la-header-control:not([aria-disabled="true"]):hover
    .la-header-control-surface,
  .la-header-control:not([aria-disabled="true"]):focus-visible
    .la-header-control-surface {
    fill: var(--la-accent-soft);
    stroke: color-mix(
      in srgb,
      var(--la-selection) 32%,
      transparent
    );
  }

  .la-header-control:not([aria-disabled="true"]):hover
    .la-header-control-icon,
  .la-header-control:not([aria-disabled="true"]):hover
    .la-header-control-fallback,
  .la-header-control:not([aria-disabled="true"]):focus-visible
    .la-header-control-icon,
  .la-header-control:not([aria-disabled="true"]):focus-visible
    .la-header-control-fallback,
  .la-header-control[data-copied="true"]
    .la-header-control-icon,
  .la-header-control[data-copied="true"]
    .la-header-control-fallback {
    opacity: 1;
  }

  .la-header-control[aria-disabled="true"] {
    cursor: default;
  }

  .la-header-control[aria-disabled="true"]
    .la-header-control-icon,
  .la-header-control[aria-disabled="true"]
    .la-header-control-fallback {
    opacity: 0.26;
  }

  .la-group-hit.la-selectable:hover
    + .la-group-shape,
  .la-group-hit.la-selectable:focus-visible
    + .la-group-shape,
  .la-group-hit.la-selectable[data-selected="true"]
    + .la-group-shape {
    stroke: var(--la-selection);
    stroke-opacity: 0.72;
  }

  .la-section.la-selectable:hover
    .la-section-line,
  .la-section.la-selectable:focus-visible
    .la-section-line,
  .la-section.la-selectable[data-selected="true"]
    .la-section-line,
  .la-gap.la-selectable:hover
    .la-gap-rule,
  .la-gap.la-selectable:focus-visible
    .la-gap-rule,
  .la-gap.la-selectable[data-selected="true"]
    .la-gap-rule {
    stroke: var(--la-selection);
  }

  @media (prefers-reduced-motion: reduce) {
    .la-actor-shape,
    .la-group-shape,
    .la-message-line,
    .la-gap-rule,
    .la-tooltip-trigger-shape,
    .la-branding,
    .la-header-control-surface,
    .la-header-control-icon,
    .la-header-control-fallback {
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

function textWidth(text, fontSize = 12, minimum = 0) {
  return Math.max(minimum, estimatedTextWidth(text, fontSize));
}

function textMeasurer(fontSize, fontWeight) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  context.font = [
    `${fontWeight} ${fontSize}px system-ui`,
    "-apple-system",
    "BlinkMacSystemFont",
    '"Segoe UI"',
    "sans-serif",
  ].join(", ");
  return (text) => context.measureText(text).width;
}

function truncateToWidth(text, maximumWidth, measure) {
  if (measure(text) <= maximumWidth) {
    return text;
  }

  const characters = graphemes(text);
  let lower = 0;
  let upper = characters.length;
  while (lower < upper) {
    const middle = Math.ceil((lower + upper) / 2);
    if (
      measure(`${characters.slice(0, middle).join("")}…`) <=
      maximumWidth
    ) {
      lower = middle;
    } else {
      upper = middle - 1;
    }
  }
  return `${characters.slice(0, lower).join("")}…`;
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

function groupHeaderGeometry(group) {
  const left = group.left + 16;
  const right = group.right - 16;
  const y = group.top + 19;
  const typeWidth = textWidth(group.groupType, 11);
  const headerTextGap = 8;
  const labelX = left + typeWidth + headerTextGap;
  const backplatePadding = 6;
  const availableLabelWidth = Math.max(
    36,
    right - labelX - backplatePadding,
  );
  const visibleLines = textLines(group.label).map((line) =>
    truncateTextToWidth(line, availableLabelWidth, 11),
  );
  const labelWidth = Math.max(
    0,
    ...visibleLines.map((line) => textWidth(line, 11)),
  );
  return {
    left,
    y,
    typeWidth,
    labelX,
    visibleLines,
    labelWidth,
    backplatePadding,
  };
}

function sectionLabelGeometry(section) {
  const fontSize = 10;
  const measure = textMeasurer(fontSize, 650);
  const lineGap = 4;
  const leftLineWidth = 6;
  const rightLineMinimum = 8;
  const labelX = section.left + leftLineWidth + lineGap;
  const availableLabelWidth = Math.max(
    fontSize * 0.56,
    section.right - rightLineMinimum - lineGap - labelX,
  );
  const visibleLines = textLines(section.label).map((line) =>
    truncateToWidth(line, availableLabelWidth, measure),
  );
  const labelWidth = Math.max(
    0,
    ...visibleLines.map((line) => measure(line)),
  );
  return {
    visibleLines,
    labelWidth,
    labelX,
    leftLineEnd: labelX - lineGap,
    rightLineStart: labelX + labelWidth + lineGap,
  };
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

function appendColorFilter(defs, id, color) {
  const filter = svgElement("filter", {
    id,
    "color-interpolation-filters": "sRGB",
  });
  filter.append(
    svgElement("feFlood", {
      "flood-color": color,
      result: `${id}-color`,
    }),
    svgElement("feComposite", {
      in: `${id}-color`,
      in2: "SourceAlpha",
      operator: "in",
    }),
  );
  defs.append(filter);
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
      refX: 6,
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

  appendColorFilter(
    defs,
    markerId(prefix, "tooltip-icon-color"),
    tokens.tagText,
  );
  appendColorFilter(
    defs,
    markerId(prefix, "actor-icon-color"),
    tokens.actorText,
  );

  svg.append(defs);
}

function appendCutoutMask(svg, id, layout, cutouts) {
  const defs = svg.querySelector("defs");
  if (!defs || cutouts.length === 0) {
    return null;
  }
  const mask = svgElement("mask", {
    id,
    maskUnits: "userSpaceOnUse",
    x: 0,
    y: 0,
    width: layout.width,
    height: layout.height,
  });
  mask.append(
    svgElement("rect", {
      x: 0,
      y: 0,
      width: layout.width,
      height: layout.height,
      fill: "white",
    }),
  );
  for (const cutout of cutouts) {
    mask.append(
      svgElement(cutout.type, {
        ...cutout.attributes,
        fill: "black",
      }),
    );
  }
  defs.append(mask);
  return `url(#${id})`;
}

function appendGapMask(svg, layout, prefix) {
  const cutouts = layout.rows
    .filter((row) => row.type === "gap")
    .map((row) => ({
      type: "path",
      attributes: {
        d: rippedBandPath(
          layout.contentLeft,
          layout.contentRight,
          row.top + 8,
          row.top + row.height - 8,
        ),
      },
    }));
  return appendCutoutMask(
    svg,
    markerId(prefix, "gap-cutouts"),
    layout,
    cutouts,
  );
}

function applyTokens(frame, tokens) {
  const properties = {
    "--la-canvas": tokens.canvas,
    "--la-surface": tokens.surface,
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
    "--la-tooltip": tokens.tooltip,
    "--la-tooltip-text": tokens.tooltipText,
    "--la-selection": tokens.selection,
    "--la-danger": tokens.danger,
    "--la-danger-text": tokens.dangerText,
  };

  for (const [name, value] of Object.entries(properties)) {
    frame.style.setProperty(name, value);
  }
}

function makeSelectable(group, item, selection, label) {
  if (!selection.canSelect(item)) {
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
    } else if (event.key === "Escape" && selection.mode === "actors") {
      event.preventDefault();
      event.stopPropagation();
      selection.clear();
      group.blur();
    }
  });
  return true;
}

function renderTooltipPopover(layer, tooltip) {
  tooltipSequence += 1;
  const id = `la-tooltip-${tooltipSequence}`;
  const popover = document.createElement("div");
  popover.id = id;
  popover.className = "la-tooltip-popover";
  popover.dataset.visible = "false";
  popover.setAttribute("popover", "manual");
  popover.setAttribute("role", "tooltip");
  popover.textContent = tooltip;
  layer.append(popover);
  return { id, popover };
}

function positionTooltipPopover(popover, trigger) {
  if (!popover.isConnected || !trigger.isConnected) {
    return;
  }
  const triggerRect = trigger.getBoundingClientRect();
  const popoverRect = popover.getBoundingClientRect();
  const viewportWidth = innerWidth;
  const viewportHeight = innerHeight;
  const padding = 8;
  const gap = 7;
  const triggerCenter = triggerRect.left + triggerRect.width / 2;
  const spaceBelow = viewportHeight - padding - triggerRect.bottom - gap;
  const spaceAbove = triggerRect.top - gap - padding;
  const side =
    spaceBelow >= popoverRect.height || spaceBelow >= spaceAbove
      ? "below"
      : "above";
  const preferredLeft = triggerCenter - popoverRect.width / 2;
  const maxLeft = Math.max(
    padding,
    viewportWidth - padding - popoverRect.width,
  );
  const left = Math.max(padding, Math.min(preferredLeft, maxLeft));
  const preferredTop =
    side === "below"
      ? triggerRect.bottom + gap
      : triggerRect.top - gap - popoverRect.height;
  const maxTop = Math.max(
    padding,
    viewportHeight - padding - popoverRect.height,
  );
  const top = Math.max(padding, Math.min(preferredTop, maxTop));
  const arrowX = Math.max(
    10,
    Math.min(triggerCenter - left, popoverRect.width - 10),
  );

  popover.style.left = `${left}px`;
  popover.style.top = `${top}px`;
  popover.style.setProperty("--la-tooltip-arrow-x", `${arrowX}px`);
  popover.dataset.side = side;
}

function setTooltipPopoverVisible(popover, visible) {
  popover.dataset.visible = String(visible);
  if (visible && !popover.matches(":popover-open")) {
    popover.showPopover();
  } else if (!visible && popover.matches(":popover-open")) {
    popover.hidePopover();
  }
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
    if (options.onTagActivate) {
      tagGroup.setAttribute("tabindex", "0");
      tagGroup.setAttribute("role", "button");
      tagGroup.setAttribute(
        "aria-label",
        options.tagActivateLabel ?? "Edit tag",
      );
      tagGroup.addEventListener("pointerdown", (event) => {
        event.stopPropagation();
      });
      tagGroup.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        options.onTagActivate();
      });
      tagGroup.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          event.stopPropagation();
          options.onTagActivate();
        }
      });
    }
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
    parent.append(tagGroup);
  }

  if (!tooltip) {
    return;
  }

  const triggerX = left + tagWidth + gap;
  const { id, popover } = renderTooltipPopover(
    options.tooltipLayer,
    tooltip,
  );
  const trigger = svgElement("g", {
    class: "la-tooltip-trigger",
    transform: `translate(${triggerX} ${y})`,
    tabindex: 0,
    role: "button",
    "aria-label": options.onTooltipActivate
      ? options.tooltipActivateLabel ?? "Edit tooltip"
      : "Show tooltip",
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
    ? options.iconResolver(tooltipIcon, tokens.name)
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
  let tracking = false;
  const position = () => positionTooltipPopover(popover, trigger);
  const setTracking = (enabled) => {
    if (tracking === enabled) {
      return;
    }
    tracking = enabled;
    if (enabled) {
      globalThis.addEventListener("scroll", position, true);
      globalThis.addEventListener("resize", position);
    } else {
      globalThis.removeEventListener("scroll", position, true);
      globalThis.removeEventListener("resize", position);
    }
  };
  const sync = () => {
    const visible = hovered || focused || pinned;
    setTooltipPopoverVisible(popover, visible);
    trigger.setAttribute("aria-expanded", String(visible));
    setTracking(visible);
    if (visible) {
      position();
    }
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
    if (options.onTooltipActivate) {
      options.onTooltipActivate();
      return;
    }
    pinned = !pinned;
    sync();
  });
  trigger.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      event.stopPropagation();
      if (options.onTooltipActivate) {
        options.onTooltipActivate();
        return;
      }
      pinned = !pinned;
      sync();
    } else if (event.key === "Escape") {
      pinned = false;
      sync();
      trigger.blur();
    }
  });
  options.tooltipLayer.cleanups.push(() => {
    setTracking(false);
    setTooltipPopoverVisible(popover, false);
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
  editActivate,
) {
  const activatePart = editActivate
    ? (part) => editActivate(actor.id, part)
    : null;
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
  group.append(
    svgElement("rect", {
      class: "la-focus-ring",
      x: 1,
      y: 1,
      width: actor.width - 2,
      height: actor.height - 2,
      rx: 13,
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
    const iconParent = activatePart
      ? svgElement("g", {
          class: "la-actor-icon-trigger",
          tabindex: 0,
          role: "button",
          "aria-label": "Edit actor icon",
        })
      : group;
    if (activatePart) {
      iconParent.append(
        svgElement("rect", {
          x: actor.width / 2 - 10,
          y: 3,
          width: 20,
          height: 20,
          rx: 10,
          fill: "transparent",
        }),
      );
      iconParent.addEventListener("pointerdown", (event) => {
        event.stopPropagation();
      });
      iconParent.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        activatePart("actor-icon");
      });
      iconParent.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          event.stopPropagation();
          activatePart("actor-icon");
        }
      });
    }
    const fallback = svgElement("text", {
      class: "la-actor-icon-fallback",
      x: actor.width / 2,
      y: 19,
      "text-anchor": "middle",
      "font-size": 15,
      "font-weight": 700,
      fill: tokens.actorText,
      opacity: 0.72,
      "pointer-events": "none",
    });
    fallback.textContent = graphemes(actor.name)[0]?.toUpperCase() ?? "";
    iconParent.append(fallback);

    const iconUrl = options.iconResolver(actor.icon, tokens.name);
    if (iconUrl) {
      const image = svgElement("image", {
        class: "la-actor-icon",
        href: iconUrl,
        x: actor.width / 2 - 9,
        y: 4,
        width: 18,
        height: 18,
        filter: options.actorIconFilter,
        "pointer-events": "none",
      });
      image.addEventListener("load", () => {
        fallback.setAttribute("opacity", "0");
      });
      iconParent.append(image);
    }
    if (activatePart) {
      group.append(iconParent);
    }
  }

  const label = svgElement("text", {
    class: "la-actor-label",
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
      tooltipLayer,
      iconResolver: options.iconResolver,
      tooltipIconFilter: options.tooltipIconFilter,
      onTagActivate: activatePart
        ? () => activatePart("actor-tag")
        : null,
      tagActivateLabel: "Edit actor tag",
      onTooltipActivate: activatePart
        ? () => activatePart("actor-tooltip-text")
        : null,
      tooltipActivateLabel: "Edit actor tooltip",
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
    `${group.groupType} group${group.label ? `, ${group.label}` : ""}`,
  );
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
  editActivate,
) {
  const activatePart = editActivate
    ? (part) => editActivate(group.id, part)
    : null;
  const {
    left,
    y,
    typeWidth,
    labelX,
    visibleLines,
    labelWidth,
    backplatePadding,
  } = groupHeaderGeometry(group);
  const header = svgElement("g", {
    class: "la-group-header",
    "data-la-group-header-id": group.id,
  });
  if (!activatePart) {
    header.setAttribute("pointer-events", "none");
  }
  header.append(
    svgElement("rect", {
      class: "la-group-type-shape",
      x: left - backplatePadding,
      y: y - 14,
      width: typeWidth + backplatePadding * 2,
      height: 20,
      rx: 5,
      fill: "transparent",
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
        fill: "transparent",
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
  if (activatePart) {
    const addPartHitTarget = (
      x,
      targetY,
      width,
      height,
      labelText,
      part,
    ) => {
      const hit = svgElement("rect", {
        class: "la-group-part-hit",
        x,
        y: targetY,
        width,
        height,
        rx: 5,
        fill: "transparent",
        "pointer-events": "all",
        tabindex: 0,
        role: "button",
        "aria-label": labelText,
      });
      const activate = (event) => {
        event.preventDefault();
        event.stopPropagation();
        activatePart(part);
      };
      hit.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        event.stopPropagation();
      });
      hit.addEventListener("click", activate);
      hit.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          activate(event);
        }
      });
      header.append(hit);
    };
    addPartHitTarget(
      left - backplatePadding,
      y - 14,
      typeWidth + backplatePadding * 2,
      20,
      "Edit group type",
      "group-type",
    );
    if (group.label) {
      addPartHitTarget(
        labelX - backplatePadding,
        group.top + 5,
        labelWidth + backplatePadding * 2,
        Math.max(20, visibleLines.length * 13 + 7),
        "Edit group label",
        "group-label",
      );
    }
  }
  parent.append(header);
}

function renderSection(parent, section, tokens, selection) {
  const group = svgElement("g", {
    class: "la-section",
  });
  makeSelectable(group, section, selection, `Section ${section.label}`);
  const lineStart = section.left;
  const lineEnd = section.right;
  const {
    visibleLines,
    labelX,
    leftLineEnd,
    rightLineStart,
  } = sectionLabelGeometry(section);

  for (const [x1, x2] of [
    [lineStart, leftLineEnd],
    [rightLineStart, lineEnd],
  ]) {
    if (x2 <= x1) {
      continue;
    }
    group.append(
      svgElement("line", {
        class: "la-section-line",
        x1,
        y1: section.y,
        x2,
        y2: section.y,
        stroke: tokens.sectionLine,
        "stroke-width": 1,
      }),
    );
  }
  const label = svgElement("text", {
    class: "la-section-label",
    x: labelX,
    "font-size": 10,
    "font-weight": 650,
    fill: tokens.mutedText,
  });
  appendTextLines(
    label,
    visibleLines,
    labelX,
    section.top + 16,
    12,
  );
  group.append(label);
  parent.append(group);
}

function renderLifelines(parent, layout, tokens) {
  const showActorLabels =
    layout.rows.length >= LIFELINE_LABEL_MIN_ROWS;
  for (const actor of layout.actors) {
    parent.append(
      svgElement("line", {
        class: "la-lifeline",
        x1: actor.centerX,
        y1: layout.lifelineTop,
        x2: actor.centerX,
        y2: layout.lifelineBottom,
        stroke: tokens.lifeline,
        "stroke-width": 2.5,
        "stroke-linecap": "square",
        "pointer-events": "none",
      }),
    );
    if (!showActorLabels) {
      continue;
    }
    const label = svgElement("text", {
      class: "la-lifeline-label",
      x: actor.centerX,
      y:
        layout.lifelineBottom +
        LIFELINE_LABEL_BASELINE_OFFSET,
      "text-anchor": "middle",
      "font-size": 8,
      "font-weight": 650,
      fill: tokens.mutedText,
      opacity: 0.48,
      "aria-hidden": "true",
      "pointer-events": "none",
    });
    label.textContent = actor.name;
    parent.append(label);
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
    labelY: top - 9,
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
  editActivate,
) {
  const source = layout.actorByName.get(row.source);
  const target = layout.actorByName.get(row.target);
  if (!source || !target) {
    return;
  }

  const activatePart = editActivate
    ? (part) => editActivate(row.id, part)
    : null;

  const group = svgElement("g", {
    class: "la-message",
  });
  const selectable = makeSelectable(
    group,
    row,
    selection,
    `${row.source} to ${row.target}${
      row.label ? `: ${row.label}` : ""
    }${
      row.tooltip ? `. ${row.tooltip}` : ""
    }`,
  );
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
      "pointer-events": selectable ? "all" : "none",
    }),
  );

  if (row.arrow === "->x" && source.centerX !== target.centerX) {
    const shortenedTarget = target.centerX - geometry.direction * 9;
    pathData = `M ${source.centerX} ${row.y} L ${shortenedTarget} ${row.y}`;
  }

  if (selectable) {
    const selfMessage = source.centerX === target.centerX;
    const sourceY = selfMessage ? row.y - 13 : row.y;
    const selectionHighlight = svgElement("g", {
      class: "la-message-selection-highlight",
      opacity: 0,
      "pointer-events": "none",
    });
    for (const [x, y] of [
      [source.centerX, sourceY],
      [geometry.endX, geometry.endY],
    ]) {
      selectionHighlight.append(
        svgElement("circle", {
          class: "la-message-endpoint-highlight",
          cx: x,
          cy: y,
          r: 8,
          fill: tokens.selection,
        }),
      );
    }

    selectionHighlight.append(
      svgElement("path", {
        class: "la-message-focus",
        d: pathData,
        fill: "none",
        stroke: tokens.selection,
        "stroke-width": 7,
        "stroke-linecap": "round",
      }),
    );
    group.append(selectionHighlight);
  }

  group.append(
    svgElement("path", {
      d: pathData,
      fill: "none",
      stroke: "transparent",
      "stroke-width": 18,
      "stroke-linecap": "round",
      "pointer-events": selectable ? "stroke" : "none",
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
    visiblePath.setAttribute("marker-end", normalMarker);
    if (selectable) {
      const selectedMarker = `url(#${markerId(
        prefix,
        "arrow-selected",
      )})`;
      visiblePath.dataset.markerNormal = normalMarker;
      visiblePath.dataset.markerSelected = selectedMarker;

      const highlightMarker = () => {
        const frame = group.closest(".la-frame");
        if (
          frame?.dataset.selectionActive === "true" &&
          group.dataset.selected !== "true"
        ) {
          return;
        }
        visiblePath.setAttribute("marker-end", selectedMarker);
      };
      const restoreMarker = () =>
        visiblePath.setAttribute(
          "marker-end",
          group.dataset.selected === "true"
            ? selectedMarker
            : normalMarker,
        );
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
      lineHeight,
    } =
      messageLabelMetrics(
        row.label,
        layout.options.messageLabelMaxWidth,
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
    row.y + (isSelfMessage ? 20 : 7),
    tokens,
    {
      anchor: "middle",
      tooltipLayer,
      iconResolver: options.iconResolver,
      tooltipIconFilter: options.tooltipIconFilter,
      onTagActivate: activatePart
        ? () => activatePart("message-tag")
        : null,
      tagActivateLabel: "Edit arrow tag",
      onTooltipActivate: activatePart
        ? () => activatePart("message-tooltip-text")
        : null,
      tooltipActivateLabel: "Edit arrow tooltip",
    },
  );

  parent.append(group);
}

function renderGap(parent, row, layout, tokens, selection) {
  const group = svgElement("g", {
    class: "la-gap",
  });
  const selectable = makeSelectable(
    group,
    row,
    selection,
    `Gap: ${row.label}`,
  );
  const visibleLines = textLines(row.label).map((line) =>
    truncateTextToWidth(
      line,
      layout.contentRight - layout.contentLeft - 20,
      10,
    ),
  );
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
      "pointer-events": selectable ? "all" : "none",
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

  const label = svgElement("text", {
    class: "la-gap-label",
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
    textWidth(BRANDING_LABEL, BRANDING_FONT_SIZE),
  );
  const centerX = layout.width / 2;
  const top = Math.max(2, (layout.options.marginTop - 16) / 2);
  const link = svgElement("a", {
    class: "la-branding",
    href: BRANDING_HREF,
    target: "_blank",
    rel: "noopener noreferrer",
    "aria-label": `${BRANDING_LABEL}. Open website`,
  });
  link.append(
    svgElement("rect", {
      class: "la-branding-surface",
      x: centerX - width / 2 - 3,
      y: top,
      width: width + 6,
      height: 16,
      rx: 4,
      "stroke-width": 0.75,
    }),
  );
  const label = svgElement("text", {
    class: "la-branding-text",
    x: centerX,
    y: top + 10.5,
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

function sourceWithAttribution(source) {
  const canonical = String(source ?? "").replace(/\r\n?/g, "\n");
  const body = canonical
    .split("\n")
    .filter((line) => line !== SOURCE_ATTRIBUTION)
    .join("\n")
    .replace(/^\n+/, "");
  return `${SOURCE_ATTRIBUTION}\n${body}`;
}

async function writeClipboardText(source) {
  await navigator.clipboard.writeText(source);
}

function renderHeaderControl(
  parent,
  action,
  x,
  y,
  tokens,
  options,
  cleanups,
) {
  const disabled = action.disabled === true;
  const control = svgElement("g", {
    class: ["la-header-control", action.className]
      .filter(Boolean)
      .join(" "),
    transform: `translate(${x} ${y})`,
    role: "button",
    tabindex: disabled ? -1 : 0,
    "aria-label": action.label,
    "aria-disabled": String(disabled),
    "aria-keyshortcuts": action.keyShortcuts,
    "data-field": action.field,
  });
  const title = svgElement("title");
  title.textContent = action.label;
  control.append(
    title,
    svgElement("rect", {
      class: "la-header-control-surface",
      x: 0.5,
      y: 0.5,
      width: HEADER_CONTROL_SIZE - 1,
      height: HEADER_CONTROL_SIZE - 1,
      rx: 5,
      "stroke-width": 1,
      "pointer-events": "all",
    }),
  );

  const fallback = svgElement("text", {
    class: "la-header-control-fallback",
    x: HEADER_CONTROL_SIZE / 2,
    y: HEADER_CONTROL_SIZE / 2 + 3.4,
    "text-anchor": "middle",
    "font-size": action.fallbackFontSize ?? 11,
    "font-weight": 700,
    "pointer-events": "none",
  });
  fallback.textContent = action.fallback;
  control.append(fallback);

  const iconUrl = options.iconResolver(action.icon, tokens.name);
  if (iconUrl) {
    const image = svgElement("image", {
      class: "la-header-control-icon",
      href: iconUrl,
      x: 3,
      y: 3,
      width: HEADER_CONTROL_SIZE - 6,
      height: HEADER_CONTROL_SIZE - 6,
      filter: options.tooltipIconFilter,
      "pointer-events": "none",
    });
    image.addEventListener("load", () => {
      fallback.setAttribute("display", "none");
    });
    image.addEventListener("error", () => {
      image.remove();
    });
    control.append(image);
  }

  const activate = async (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (disabled) {
      return;
    }
    try {
      await action.onActivate?.(control, title);
    } catch {
      control.dataset.copyFailed = "true";
      control.setAttribute("aria-label", "Copy failed");
      title.textContent = "Copy failed";
    }
  };
  control.addEventListener("pointerdown", (event) => {
    event.stopPropagation();
  });
  control.addEventListener("click", activate);
  control.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      void activate(event);
    }
  });
  parent.append(control);
  cleanups.push(() => action.cleanup?.());
}

function renderHeader(
  parent,
  layout,
  tokens,
  options,
  headerActions,
  source,
  branding,
  cleanups,
) {
  const actions = [...headerActions];
  let copyResetTimer = null;
  if (options.copySource !== false) {
    actions.push({
      label: "Copy source",
      icon: "copy",
      fallback: "⧉",
      className: "la-copy-source",
      field: "copy-source",
      async onActivate(control, title) {
        await writeClipboardText(sourceWithAttribution(source));
        control.dataset.copied = "true";
        control.setAttribute("aria-label", "Source copied");
        title.textContent = "Source copied";
        clearTimeout(copyResetTimer);
        copyResetTimer = setTimeout(() => {
          control.dataset.copied = "false";
          control.setAttribute("aria-label", "Copy source");
          title.textContent = "Copy source";
        }, 1600);
      },
      cleanup() {
        clearTimeout(copyResetTimer);
      },
    });
  }

  if (!branding && actions.length === 0) {
    return;
  }

  const header = svgElement("g", {
    class: "la-diagram-header",
    role: "group",
    "aria-label": "Diagram actions",
  });
  if (branding) {
    renderBranding(header, layout);
  }

  if (actions.length > 0) {
    const actionsWidth =
      actions.length * HEADER_CONTROL_SIZE +
      Math.max(0, actions.length - 1) * HEADER_CONTROL_GAP;
    const top = Math.max(
      2,
      (layout.options.marginTop - HEADER_CONTROL_SIZE) / 2,
    );
    const actionsGroup = svgElement("g", {
      class: "la-header-actions",
      role: "group",
      "aria-label": "Diagram controls",
    });
    actions.forEach((action, index) => {
      renderHeaderControl(
        actionsGroup,
        action,
        layout.contentRight - actionsWidth +
          index * (HEADER_CONTROL_SIZE + HEADER_CONTROL_GAP),
        top,
        tokens,
        options,
        cleanups,
      );
    });
    header.append(actionsGroup);
  }
  parent.append(header);
}

function actorDetails(actor) {
  return Object.freeze({
    name: actor.name,
    icon: actor.icon ?? null,
    tag: actor.tag ?? null,
    tooltip: actor.tooltip ?? null,
    tooltipIcon: actor.tooltipIcon ?? null,
  });
}

function createViewSelection(root, options) {
  const mode = options.selectionMode;
  if (mode === "none") {
    return {
      canSelect() {
        return false;
      },
      selectActor() {
        throw new Error("Actor selection is not enabled.");
      },
      mode,
    };
  }
  const models = new Map(
    options.actors.map((actor) => [actor.id, actor]),
  );

  let selectedId = null;

  function apply() {
    root
      .querySelectorAll(".la-selectable[data-la-id]")
      .forEach((element) => {
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

  return {
    select(id, emit = true) {
      const nextId = id ?? null;
      const item = nextId === null ? null : models.get(nextId);
      if (nextId !== null && item?.type !== "actor") {
        throw new RangeError(
          `No selectable diagram element has ID "${nextId}".`,
        );
      }
      if (mode === "actors" && nextId === selectedId) {
        return;
      }
      selectedId = nextId;
      apply();

      if (emit) {
        options.onActorSelect?.(item ? actorDetails(item) : null);
      }
    },
    selectActor(name, emit = true) {
      if (name === null) {
        this.clear(emit);
        return;
      }
      if (typeof name !== "string" || !name.trim()) {
        throw new TypeError(
          "selectActor requires an actor name or null.",
        );
      }
      for (const [id, item] of models) {
        if (item.type === "actor" && item.name === name) {
          this.select(id, emit);
          return;
        }
      }
      throw new RangeError(`No actor named "${name}" exists.`);
    },
    clear(emit = true) {
      this.select(null, emit);
    },
    canSelect(item) {
      return item.type === "actor";
    },
    mode,
  };
}

let rendererSequence = 0;

function renderDiagramSurface(
  target,
  documentModel,
  source,
  options,
  selectionMode,
  onEditActivate = null,
  headerActions = [],
) {
  if (!target?.replaceChildren) {
    throw new TypeError("renderDiagram requires a DOM container.");
  }
  const baseTheme = resolveTheme(options.theme);
  const usesPalette =
    options.palette !== null && options.palette !== undefined;
  const canvasBackground = options.canvasBackground ?? "transparent";
  if (canvasBackground !== "solid" && canvasBackground !== "transparent") {
    throw new TypeError(
      'canvasBackground must be either "solid" or "transparent".',
    );
  }
  const tokens =
    usesPalette || canvasBackground === "transparent"
      ? resolvePaletteTheme(
          baseTheme,
          options.palette ?? {},
          canvasBackground,
        )
      : baseTheme;
  const branding = options.branding !== false;
  const copySource = options.copySource !== false;
  const hasHeader =
    branding ||
    copySource ||
    headerActions.length > 0;
  const layout =
    selectionMode === "editor"
      ? layoutDiagramForEditor(documentModel)
      : hasHeader
        ? layoutDiagram(documentModel)
        : layoutDiagramWithoutHeader(documentModel);
  const prefix = `la-${rendererSequence}`;
  rendererSequence += 1;

  const style = document.createElement("style");
  style.textContent = VIEW_STYLES;

  const frame = document.createElement("div");
  frame.className = "la-frame";
  frame.dataset.theme = tokens.name;
  applyTokens(frame, tokens);

  const svg = svgElement("svg", {
    class: "la-canvas",
    viewBox: `0 0 ${layout.width} ${layout.height}`,
    role: "group",
    "aria-label": options.label || "Sequence diagram",
    preserveAspectRatio: "xMinYMin meet",
  });
  svg.style.aspectRatio = `${layout.width} / ${layout.height}`;
  appendDefinitions(svg, tokens, prefix);
  const renderOptions = {
    ...options,
    iconResolver: phosphorIconResolver,
    actorIconFilter: `url(#${markerId(
      prefix,
      "actor-icon-color",
    )})`,
    tooltipIconFilter: `url(#${markerId(
      prefix,
      "tooltip-icon-color",
    )})`,
  };
  const editActivate =
    selectionMode === "editor" ? onEditActivate : null;
  frame.style.setProperty(
    "--la-actor-icon-filter",
    renderOptions.actorIconFilter,
  );
  const tooltipLayer = document.createElement("div");
  tooltipLayer.className = "la-tooltip-layer";
  tooltipLayer.cleanups = [];

  const selection =
    selectionMode === "editor"
      ? {
          canSelect() {
            return true;
          },
          select(id) {
            editActivate(id);
          },
          mode: "editor",
        }
      : createViewSelection(svg, {
          ...renderOptions,
          actors: documentModel.actors,
          selectionMode,
        });

  const gapMask = appendGapMask(svg, layout, prefix);
  const groupLayer = svgElement("g", { class: "la-group-layer" });
  const lifelineLayer = svgElement("g", { class: "la-lifeline-layer" });
  const headerLayer = svgElement("g", { class: "la-header-layer" });
  if (gapMask) {
    groupLayer.setAttribute("mask", gapMask);
    lifelineLayer.setAttribute("mask", gapMask);
  }
  for (const group of layout.groups) {
    renderGroupBackground(groupLayer, group, tokens, selection);
  }
  renderLifelines(lifelineLayer, layout, tokens);
  for (const group of layout.groups) {
    renderGroupHeader(
      headerLayer,
      group,
      tokens,
      editActivate,
    );
  }
  for (const section of layout.sections) {
    renderSection(headerLayer, section, tokens, selection);
  }
  svg.append(lifelineLayer, groupLayer, headerLayer);
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
        editActivate,
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
      editActivate,
    );
  }
  renderHeader(
    svg,
    layout,
    tokens,
    renderOptions,
    headerActions,
    source,
    branding,
    tooltipLayer.cleanups,
  );
  if (selectionMode === "actors") {
    svg.addEventListener("click", (event) => {
      if (
        !event.target.closest(
          ".la-actor, .la-tooltip-trigger, .la-branding",
        )
      ) {
        selection.clear();
      }
    });
  }

  frame.append(svg, tooltipLayer);
  target.replaceChildren(style, frame);

  let destroyed = false;
  const commonController = {
    layout,
    svg,
    destroy() {
      if (destroyed) {
        return;
      }
      destroyed = true;
      for (const cleanup of tooltipLayer.cleanups) {
        cleanup();
      }
      style.remove();
      frame.remove();
    },
  };

  if (selectionMode === "editor") {
    return commonController;
  }

  return {
    ...commonController,
    selectActor(name, emit = true) {
      selection.selectActor(name, emit);
    },
  };
}

function renderSourceDiagram(
  target,
  source,
  options,
  selectedActorName = null,
) {
  if (typeof source !== "string") {
    throw new TypeError("renderDiagram requires diagram source text.");
  }
  const documentModel = assignStructuralIds(parse(source));
  const controller = renderDiagramSurface(
    target,
    documentModel,
    options.copySource === false ? "" : serialize(documentModel),
    options,
    options.selectableActors === true ? "actors" : "none",
  );
  if (selectedActorName && options.selectableActors === true) {
    controller.selectActor(selectedActorName, false);
  }
  return {
    svg: controller.svg,
    selectActor(name) {
      controller.selectActor(name);
    },
    destroy() {
      controller.destroy();
    },
  };
}

export function renderDiagram(target, source, options = {}) {
  return renderSourceDiagram(target, source, options);
}

export function renderDiagramForElement(
  target,
  source,
  options,
  selectedActorName,
) {
  return renderSourceDiagram(target, source, options, selectedActorName);
}

export function renderDiagramForEditor(
  target,
  documentModel,
  source,
  options = {},
  onActivate,
  headerActions = [],
) {
  return renderDiagramSurface(
    target,
    documentModel,
    source,
    options,
    "editor",
    onActivate,
    headerActions,
  );
}
