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
import { resolvePaletteTheme, resolveTheme } from "./theme.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const BRANDING_HREF = "https://lines-and-arrows.dev/";
const BRANDING_LABEL = "Powered by Lines & Arrows";
const BRANDING_FONT_SIZE = 7;
const BRANDING_HEIGHT = 15;
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
    .la-message-selection-highlight,
  .la-frame[data-selectable="true"]
    .la-message[data-selected="true"]
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

function groupHeaderGeometry(group) {
  const left = group.left + 16;
  const right = group.right - 16;
  const y = group.top + 19;
  const typeWidth = textWidth(group.groupType, 11);
  const headerTextGap = 8;
  const labelX = left + typeWidth + headerTextGap;
  const availableLabelWidth = Math.max(36, right - labelX);
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
  return {
    left,
    y,
    typeWidth,
    labelX,
    visibleLines,
    labelWidth,
    backplatePadding: 6,
  };
}

function sectionLabelGeometry(section) {
  const visibleLines = textLines(section.label).map((line) =>
    truncate(line, 28),
  );
  const labelWidth =
    Math.max(
      36,
      ...visibleLines.map((line) => textWidth(line, 10)),
    ) + 16;
  return {
    visibleLines,
    labelWidth,
    x: section.left + 10,
    y: section.top + 3,
    height: visibleLines.length * 12 + 8,
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

function renderTooltipPopover(layer, tooltip) {
  tooltipSequence += 1;
  const id = `la-tooltip-${tooltipSequence}`;
  const popover = document.createElement("div");
  popover.id = id;
  popover.className = "la-tooltip-popover";
  popover.dataset.visible = "false";
  popover.setAttribute("part", "tooltip");
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
  const viewportWidth =
    globalThis.innerWidth ?? document.documentElement.clientWidth;
  const viewportHeight =
    globalThis.innerHeight ?? document.documentElement.clientHeight;
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
  if (typeof popover.showPopover !== "function") {
    popover.removeAttribute("popover");
    return;
  }

  try {
    if (visible && !popover.matches(":popover-open")) {
      popover.showPopover();
    } else if (!visible && popover.matches(":popover-open")) {
      popover.hidePopover();
    }
  } catch {
    popover.removeAttribute("popover");
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
  let tracking = false;
  const position = () => positionTooltipPopover(popover, trigger);
  const setTracking = (enabled) => {
    if (tracking === enabled) {
      return;
    }
    tracking = enabled;
    const action = enabled ? "addEventListener" : "removeEventListener";
    globalThis[action]?.("scroll", position, true);
    globalThis[action]?.("resize", position);
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
) {
  const activatePart =
    selection.enabled &&
    typeof options.actorPartActivatesSelection === "function"
      ? (part) => options.actorPartActivatesSelection(actor.id, part)
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
    fallback.textContent = actor.name.slice(0, 1).toUpperCase();
    iconParent.append(fallback);

    const iconUrl = options.iconResolver?.(actor.icon, tokens.name);
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
  options,
  selection,
) {
  const activatePart =
    selection.enabled &&
    typeof options.groupPartActivatesSelection === "function"
      ? (part) => options.groupPartActivatesSelection(group.id, part)
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
  const { visibleLines, labelWidth } = sectionLabelGeometry(section);

  for (const [x1, x2] of [
    [lineStart, lineStart + 6],
    [lineStart + 10 + labelWidth + 4, lineEnd],
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
        stroke: tokens.lifeline,
        "stroke-width": 2.5,
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
) {
  const source = layout.actorByName.get(row.source);
  const target = layout.actorByName.get(row.target);
  if (!source || !target) {
    return;
  }

  const activatePart =
    selection.enabled &&
    typeof options.messagePartActivatesSelection === "function"
      ? (part) => options.messagePartActivatesSelection(row.id, part)
      : null;

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

  const focusPath = svgElement("path", {
    class: "la-message-focus",
    d: pathData,
    fill: "none",
    stroke: tokens.selection,
    "stroke-width": 7,
    "stroke-linecap": "round",
  });
  selectionHighlight.append(focusPath);
  group.append(selectionHighlight);

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
  makeSelectable(group, row, selection, `Gap: ${row.label}`);
  const visibleLines = textLines(row.label).map((line) =>
    truncate(line, 46),
  );
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
    textWidth(BRANDING_LABEL, BRANDING_FONT_SIZE) + 12,
  );
  const left = (layout.width - width) / 2;
  const top = Math.max(
    0,
    (layout.options.marginTop - BRANDING_HEIGHT) / 2,
  );
  const link = svgElement("a", {
    class: "la-branding",
    part: "branding",
    href: BRANDING_HREF,
    target: "_blank",
    rel: "noopener noreferrer",
    "aria-label": `${BRANDING_LABEL}. Open website`,
  });
  link.append(
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
  const baseTheme = resolveTheme(options.theme, globalThis);
  const usesPalette =
    options.palette !== null && options.palette !== undefined;
  const canvasBackground = options.canvasBackground ?? "solid";
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
    actorIconFilter: `url(#${markerId(
      prefix,
      "actor-icon-color",
    )})`,
    tooltipIconFilter: `url(#${markerId(
      prefix,
      "tooltip-icon-color",
    )})`,
  };
  frame.style.setProperty(
    "--la-actor-icon-filter",
    renderOptions.actorIconFilter,
  );
  const tooltipLayer = document.createElement("div");
  tooltipLayer.className = "la-tooltip-layer";
  tooltipLayer.cleanups = [];

  const eventTarget = target.host ?? target;
  const selection = createSelectionController(svg, {
    ...renderOptions,
    eventTarget,
    models: indexSelectableModels(documentModel),
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
      renderOptions,
      selection,
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

  frame.append(svg, tooltipLayer);
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
      for (const cleanup of tooltipLayer.cleanups) {
        cleanup();
      }
      style.remove();
      frame.remove();
    },
  };
}
