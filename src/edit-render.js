import {
  DiagramEditor,
  ROOT_CONTAINER_ID,
  findItemLocation,
  findSectionLocation,
  getContainer,
} from "./editor.js";
import { renderDiagram } from "./render.js";

const SVG_NS = "http://www.w3.org/2000/svg";

const EDIT_STYLES = `
  .la-frame[data-mode="edit"] {
    position: relative;
  }

  .la-frame[data-mode="edit"]:focus-visible {
    outline: none;
    box-shadow: inset 0 0 0 1px
      color-mix(in srgb, var(--la-selection) 35%, transparent);
  }

  .la-frame[data-mode="edit"] .la-selectable[data-selected="true"] {
    cursor: grab;
  }

  .la-insertion {
    cursor: pointer;
    outline: none;
  }

  .la-insertion-line,
  .la-insertion-circle,
  .la-insertion-plus {
    opacity: 0;
    transition: opacity 100ms ease;
  }

  .la-insertion:hover .la-insertion-line,
  .la-insertion:hover .la-insertion-circle,
  .la-insertion:hover .la-insertion-plus,
  .la-insertion:focus-visible .la-insertion-line,
  .la-insertion:focus-visible .la-insertion-circle,
  .la-insertion:focus-visible .la-insertion-plus {
    opacity: 1;
  }

  .la-reorder-handle {
    cursor: grab;
    opacity: 0;
    pointer-events: none;
    touch-action: none;
    transition: opacity 100ms ease;
  }

  .la-reorder-handle[data-visible="true"] {
    opacity: 1;
    pointer-events: all;
  }

  .la-reorder-handle:active,
  .la-frame[data-dragging="true"] .la-selectable[data-selected="true"] {
    cursor: grabbing;
  }

  .la-drag-line {
    pointer-events: none;
  }

  .la-connection-origin {
    cursor: crosshair;
    touch-action: none;
  }

  .la-connection-origin-visible {
    opacity: 0;
    transition: opacity 100ms ease;
  }

  .la-connection-origin:hover .la-connection-origin-visible,
  .la-connection-origin:focus-visible .la-connection-origin-visible,
  .la-frame[data-dragging="true"]
    .la-connection-origin[data-drag-source="true"]
    .la-connection-origin-visible {
    opacity: 1;
  }

  .la-frame[data-dragging="true"]
    .la-connection-origin:not([data-drag-source="true"])
    .la-connection-origin-visible {
    opacity: 0;
  }

  .la-message-endpoint {
    cursor: ew-resize;
    touch-action: none;
  }

  .la-message-endpoint-visible {
    opacity: 0;
    transition: opacity 100ms ease;
  }

  .la-message-endpoint:hover .la-message-endpoint-visible,
  .la-message-endpoint[data-visible="true"]
    .la-message-endpoint-visible,
  .la-message-endpoint[data-drag-source="true"]
    .la-message-endpoint-visible {
    opacity: 1;
  }

  .la-connection-preview {
    pointer-events: none;
  }

  .la-marquee {
    pointer-events: none;
  }

  .la-edit-popover {
    position: absolute;
    z-index: 3;
    box-sizing: border-box;
    width: min(292px, calc(100% - 16px));
    padding: 12px;
    border: 1px solid var(--la-section-line);
    border-radius: 14px;
    background: var(--la-canvas);
    color: var(--la-text);
    box-shadow: 0 14px 36px color-mix(in srgb, var(--la-text) 16%, transparent);
    font: 500 12px/1.35 var(
      --la-font-family,
      ui-sans-serif,
      system-ui,
      sans-serif
    );
  }

  .la-edit-popover[data-side="below"] {
    transform: translate(-50%, 10px);
  }

  .la-edit-popover[data-side="above"] {
    transform: translate(-50%, calc(-100% - 10px));
  }

  .la-edit-title {
    display: block;
    margin: 0 0 10px;
    font-size: 12px;
    font-weight: 700;
  }

  .la-edit-field {
    display: grid;
    gap: 4px;
    margin-top: 8px;
    color: var(--la-muted-text);
    font-size: 10px;
    font-weight: 650;
  }

  .la-edit-popover[data-titleless="true"]
    > .la-edit-field:first-child {
    margin-top: 0;
  }

  .la-edit-field input,
  .la-edit-field select,
  .la-edit-field textarea {
    box-sizing: border-box;
    width: 100%;
    min-height: 32px;
    margin: 0;
    padding: 6px 8px;
    border: 1px solid var(--la-section-line);
    border-radius: 8px;
    outline: none;
    background: color-mix(in srgb, var(--la-canvas) 82%, var(--la-group-fill));
    color: var(--la-text);
    font: inherit;
  }

  .la-edit-field textarea {
    min-height: 54px;
    resize: vertical;
  }

  .la-edit-field input:focus,
  .la-edit-field select:focus,
  .la-edit-field textarea:focus {
    border-color: var(--la-selection);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--la-selection) 18%, transparent);
  }

  .la-arrow-picker {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 6px;
  }

  .la-arrow-option {
    display: grid;
    min-width: 0;
    min-height: 34px;
    padding: 5px 7px;
    place-items: center;
    border: 1px solid var(--la-section-line);
    border-radius: 8px;
    outline: none;
    background: color-mix(
      in srgb,
      var(--la-canvas) 82%,
      var(--la-group-fill)
    );
    color: var(--la-muted-text);
    cursor: pointer;
  }

  .la-arrow-option:hover,
  .la-arrow-option:focus-visible {
    border-color: var(--la-selection);
    color: var(--la-text);
  }

  .la-arrow-option:active {
    transform: translateY(1px);
  }

  .la-arrow-option[aria-pressed="true"] {
    border-color: var(--la-selection);
    background: var(--la-accent-soft);
    color: var(--la-selection);
    box-shadow: inset 0 0 0 1px
      color-mix(in srgb, var(--la-selection) 22%, transparent);
  }

  .la-arrow-option svg {
    display: block;
    width: 100%;
    height: 18px;
    overflow: visible;
  }

  .la-edit-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 10px;
  }

  .la-edit-button {
    min-height: 30px;
    padding: 0 9px;
    border: 1px solid var(--la-section-line);
    border-radius: 8px;
    background: var(--la-group-fill);
    color: var(--la-text);
    font: inherit;
    font-weight: 650;
    cursor: pointer;
  }

  .la-edit-button:hover,
  .la-edit-button:focus-visible {
    border-color: var(--la-selection);
  }

  .la-edit-button[data-primary="true"] {
    border-color: var(--la-actor);
    background: var(--la-actor);
    color: var(--la-actor-text);
  }

  .la-edit-button[data-danger="true"] {
    color: var(--la-danger);
  }

  .la-edit-error {
    margin: 8px 0 0;
    color: var(--la-danger);
    font-size: 11px;
  }

  @media (prefers-reduced-motion: reduce) {
    .la-insertion-line,
    .la-insertion-circle,
    .la-insertion-plus,
    .la-reorder-handle,
    .la-connection-origin-visible,
    .la-message-endpoint-visible {
      transition: none;
    }
  }
`;

let fieldSequence = 0;

function svgElement(name, attributes = {}) {
  const element = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attributes)) {
    if (value !== null && value !== undefined) {
      element.setAttribute(key, String(value));
    }
  }
  return element;
}

function eventPoint(svg, event) {
  const point = svg.createSVGPoint();
  point.x = event.clientX;
  point.y = event.clientY;
  const matrix = svg.getScreenCTM();
  return matrix ? point.matrixTransform(matrix.inverse()) : point;
}

function timelineEntries(layout) {
  return [...layout.rows, ...layout.groups].sort(
    (first, second) =>
      first.top - second.top || first.depth - second.depth,
  );
}

function containerBounds(layout, parentId) {
  if (parentId === ROOT_CONTAINER_ID) {
    return {
      left: layout.contentLeft,
      right: layout.contentRight,
      depth: 0,
    };
  }

  const section = layout.sections.find(
    (candidate) => candidate.id === parentId,
  );
  if (section) {
    return {
      left: section.left,
      right: section.right,
      depth: section.depth,
    };
  }

  const group = layout.groups.find(
    (candidate) => candidate.id === parentId,
  );
  if (group) {
    return {
      left: group.left + 14,
      right: group.right - 14,
      depth: group.depth + 1,
    };
  }
  return null;
}

function timelineSlots(document, layout) {
  const byParent = new Map();
  for (const entry of timelineEntries(layout)) {
    if (!byParent.has(entry.parentId)) {
      byParent.set(entry.parentId, []);
    }
    byParent.get(entry.parentId).push(entry);
  }

  const slots = [];
  for (const [parentId, entries] of byParent) {
    const container = getContainer(document, parentId);
    const bounds = containerBounds(layout, parentId);
    if (!container || !bounds || entries.length === 0) {
      continue;
    }
    entries.sort((first, second) => first.index - second.index);

    for (let index = 0; index <= entries.length; index += 1) {
      let y;
      if (index === 0) {
        y = entries[0].top;
      } else if (index === entries.length) {
        y = entries[entries.length - 1].bottom;
      } else {
        y = (entries[index - 1].bottom + entries[index].top) / 2;
      }
      slots.push({
        parentId,
        index,
        y,
        ...bounds,
      });
    }
  }
  return slots.sort(
    (first, second) =>
      first.depth - second.depth || first.y - second.y,
  );
}

function actorSlots(layout) {
  const { actors, options } = layout;
  if (actors.length === 0) {
    return [];
  }

  const slots = [];
  for (let index = 0; index <= actors.length; index += 1) {
    let x;
    if (index === 0) {
      x = actors[0].x - options.actorGap / 2;
    } else if (index === actors.length) {
      const last = actors[actors.length - 1];
      x = last.x + last.width + options.actorGap / 2;
    } else {
      const previous = actors[index - 1];
      x = (previous.x + previous.width + actors[index].x) / 2;
    }
    slots.push({
      index,
      x,
      y: actors[0].y + actors[0].height / 2,
    });
  }
  return slots;
}

function sectionSlots(layout, groupId) {
  const sections = layout.sections
    .filter((section) => section.parentId === groupId)
    .sort((first, second) => first.index - second.index);
  const group = layout.groups.find((candidate) => candidate.id === groupId);
  if (!group || sections.length === 0) {
    return [];
  }

  const slots = [];
  for (let index = 0; index <= sections.length; index += 1) {
    let y;
    if (index === 0) {
      y = sections[0].top;
    } else if (index === sections.length) {
      y = group.bottom - layout.options.groupPaddingBottom;
    } else {
      y = sections[index].top;
    }
    slots.push({
      index,
      y,
      left: sections[0].left,
      right: sections[0].right,
    });
  }
  return slots;
}

function itemAndDescendantContainers(item, result = new Set()) {
  if (item.type !== "group") {
    return result;
  }
  result.add(item.id);
  if (item.sections.length > 0) {
    for (const section of item.sections) {
      result.add(section.id);
      for (const child of section.items) {
        itemAndDescendantContainers(child, result);
      }
    }
  } else {
    for (const child of item.items) {
      itemAndDescendantContainers(child, result);
    }
  }
  return result;
}

function selectedModel(document, id) {
  const actor = document.actors.find((candidate) => candidate.id === id);
  if (actor) {
    return actor;
  }
  const item = findItemLocation(document, id)?.item;
  if (item) {
    return item;
  }
  return findSectionLocation(document, id)?.section ?? null;
}

function anchorFor(layout, id) {
  const actor = layout.actors.find((candidate) => candidate.id === id);
  if (actor) {
    return {
      x: actor.centerX,
      y: actor.y + actor.height,
    };
  }

  const row = layout.rows.find((candidate) => candidate.id === id);
  if (row) {
    if (row.type === "message") {
      const source = layout.actorByName.get(row.source);
      const target = layout.actorByName.get(row.target);
      if (source && target) {
        return {
          x:
            source.centerX === target.centerX
              ? source.centerX + 21
              : (source.centerX + target.centerX) / 2,
          y: row.y + 14,
        };
      }
    }
    return {
      x: layout.width / 2,
      y: row.bottom,
    };
  }

  const group = layout.groups.find((candidate) => candidate.id === id);
  if (group) {
    return {
      x: group.left + Math.min(150, (group.right - group.left) / 2),
      y: group.top + 28,
    };
  }

  const section = layout.sections.find(
    (candidate) => candidate.id === id,
  );
  if (section) {
    return {
      x: section.left + Math.min(130, (section.right - section.left) / 2),
      y: section.y + 10,
    };
  }

  return {
    x: layout.width / 2,
    y: 20,
  };
}

function addPopover(frame, layout, anchor, title) {
  frame.querySelector(".la-edit-popover")?.remove();
  const popover = document.createElement("div");
  popover.className = "la-edit-popover";
  popover.part = "editor";
  popover.style.left = `clamp(154px, ${
    (anchor.x / layout.width) * 100
  }%, calc(100% - 154px))`;
  popover.style.top = `${(anchor.y / layout.height) * 100}%`;
  popover.dataset.side =
    anchor.y > layout.height * 0.68 ? "above" : "below";

  if (title) {
    const heading = document.createElement("strong");
    heading.className = "la-edit-title";
    heading.textContent = title;
    popover.append(heading);
  } else {
    popover.dataset.titleless = "true";
  }
  frame.append(popover);
  return popover;
}

function addField(popover, label, value, onChange, options = {}) {
  fieldSequence += 1;
  const wrapper = document.createElement("label");
  wrapper.className = "la-edit-field";
  const text = document.createElement("span");
  text.textContent = label;
  wrapper.append(text);

  let control;
  if (options.choices) {
    control = document.createElement("select");
    for (const choice of options.choices) {
      const option = document.createElement("option");
      option.value = typeof choice === "string" ? choice : choice.value;
      option.textContent =
        typeof choice === "string" ? choice : choice.label;
      control.append(option);
    }
  } else if (options.multiline) {
    control = document.createElement("textarea");
    control.rows = 2;
  } else {
    control = document.createElement("input");
    control.type = "text";
  }

  control.id = `la-field-${fieldSequence}`;
  control.dataset.field = label;
  control.value = value ?? "";
  let committedValue = control.value;
  const commit = () => {
    if (control.value === committedValue) {
      return;
    }
    committedValue = control.value;
    onChange(control.value);
  };
  control.addEventListener("change", commit);
  control.addEventListener("blur", commit);
  control.addEventListener("keydown", (event) => {
    const shouldCommit =
      (!options.multiline && event.key === "Enter") ||
      (options.multiline &&
        event.key === "Enter" &&
        (event.metaKey || event.ctrlKey));
    if (shouldCommit) {
      event.preventDefault();
      commit();
    }
  });
  wrapper.append(control);
  popover.append(wrapper);
  return control;
}

function addArrowPicker(popover, value, onChange) {
  const wrapper = document.createElement("div");
  wrapper.className = "la-edit-field";

  const label = document.createElement("span");
  label.textContent = "Arrow";
  wrapper.append(label);

  const picker = document.createElement("div");
  picker.className = "la-arrow-picker";
  picker.setAttribute("role", "group");
  picker.setAttribute("aria-label", "Arrow type");

  for (const option of [
    { value: "->", label: "Solid arrow" },
    { value: "-->", label: "Dashed arrow" },
    { value: "->x", label: "Lost message" },
  ]) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "la-arrow-option";
    button.setAttribute("aria-label", option.label);
    button.setAttribute("aria-pressed", String(value === option.value));

    const preview = svgElement("svg", {
      viewBox: "0 0 48 18",
      "aria-hidden": "true",
    });
    const line = svgElement("line", {
      x1: 4,
      y1: 9,
      x2: option.value === "->x" ? 38 : 42,
      y2: 9,
      stroke: "currentColor",
      "stroke-width": 1.75,
      "stroke-linecap": "round",
    });
    if (option.value === "-->") {
      line.setAttribute("stroke-dasharray", "4 4");
    }
    preview.append(line);

    if (option.value === "->x") {
      preview.append(
        svgElement("path", {
          d: "M 37 4 L 45 14 M 45 4 L 37 14",
          fill: "none",
          stroke: "currentColor",
          "stroke-width": 1.75,
          "stroke-linecap": "round",
        }),
      );
    } else {
      preview.append(
        svgElement("path", {
          d: "M 37 4 L 43 9 L 37 14",
          fill: "none",
          stroke: "currentColor",
          "stroke-width": 1.75,
          "stroke-linecap": "round",
          "stroke-linejoin": "round",
        }),
      );
    }

    button.append(preview);
    button.addEventListener("click", () => {
      if (option.value !== value) {
        onChange(option.value);
      }
    });
    picker.append(button);
  }

  wrapper.append(picker);
  popover.append(wrapper);
  return picker;
}

function addActions(popover, actions) {
  const row = document.createElement("div");
  row.className = "la-edit-actions";
  for (const action of actions) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "la-edit-button";
    button.textContent = action.label;
    if (action.primary) {
      button.dataset.primary = "true";
    }
    if (action.danger) {
      button.dataset.danger = "true";
    }
    if (action.disabled) {
      button.disabled = true;
    }
    button.addEventListener("click", action.run);
    row.append(button);
  }
  popover.append(row);
}

function showError(popover, error) {
  popover.querySelector(".la-edit-error")?.remove();
  const message = document.createElement("p");
  message.className = "la-edit-error";
  message.setAttribute("role", "alert");
  message.textContent =
    error instanceof Error ? error.message : "The edit could not be applied.";
  popover.append(message);
}

function insertionMark(slot, label, onActivate, direction = "horizontal") {
  const group = svgElement("g", {
    class: "la-insertion",
    tabindex: 0,
    role: "button",
    "aria-label": label,
  });

  if (direction === "horizontal") {
    group.append(
      svgElement("rect", {
        x: slot.left,
        y: slot.y - 9,
        width: slot.right - slot.left,
        height: 18,
        fill: "transparent",
        "pointer-events": "all",
      }),
      svgElement("line", {
        class: "la-insertion-line",
        x1: slot.left,
        y1: slot.y,
        x2: slot.right,
        y2: slot.y,
        stroke: "var(--la-selection)",
        "stroke-width": 1.5,
        "stroke-dasharray": "3 4",
        "pointer-events": "none",
      }),
      svgElement("circle", {
        class: "la-insertion-circle",
        cx: slot.left + 12,
        cy: slot.y,
        r: 8,
        fill: "var(--la-selection)",
        "pointer-events": "none",
      }),
    );
    const plus = svgElement("text", {
      class: "la-insertion-plus",
      x: slot.left + 12,
      y: slot.y + 3.5,
      "text-anchor": "middle",
      "font-size": 12,
      "font-weight": 700,
      fill: "var(--la-actor-text)",
      "pointer-events": "none",
    });
    plus.textContent = "+";
    group.append(plus);
  } else {
    group.append(
      svgElement("rect", {
        x: slot.x - 13,
        y: slot.y - 27,
        width: 26,
        height: 54,
        fill: "transparent",
        "pointer-events": "all",
      }),
      svgElement("line", {
        class: "la-insertion-line",
        x1: slot.x,
        y1: slot.y - 22,
        x2: slot.x,
        y2: slot.y + 22,
        stroke: "var(--la-selection)",
        "stroke-width": 1.5,
        "stroke-dasharray": "3 4",
        "pointer-events": "none",
      }),
      svgElement("circle", {
        class: "la-insertion-circle",
        cx: slot.x,
        cy: slot.y,
        r: 8,
        fill: "var(--la-selection)",
        "pointer-events": "none",
      }),
    );
    const plus = svgElement("text", {
      class: "la-insertion-plus",
      x: slot.x,
      y: slot.y + 3.5,
      "text-anchor": "middle",
      "font-size": 12,
      "font-weight": 700,
      fill: "var(--la-actor-text)",
      "pointer-events": "none",
    });
    plus.textContent = "+";
    group.append(plus);
  }

  const activate = (event) => {
    event.preventDefault();
    event.stopPropagation();
    onActivate();
  };
  group.addEventListener("click", activate);
  group.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      activate(event);
    }
  });
  return group;
}

function reorderHandle(ownerId, x, y, onPointerDown) {
  const group = svgElement("g", {
    class: "la-reorder-handle",
    "data-owner-id": ownerId,
    "data-visible": "false",
    "aria-hidden": "true",
  });
  group.append(
    svgElement("circle", {
      cx: x,
      cy: y,
      r: 11,
      fill: "transparent",
      "pointer-events": "all",
    }),
    ...[
      [-2.25, -2.25],
      [2.25, -2.25],
      [-2.25, 2.25],
      [2.25, 2.25],
    ].map(([offsetX, offsetY]) =>
      svgElement("circle", {
        cx: x + offsetX,
        cy: y + offsetY,
        r: 1.25,
        fill: "var(--la-selection)",
        "pointer-events": "none",
      }),
    ),
  );
  group.addEventListener("pointerdown", onPointerDown);
  return group;
}

function connectionOriginIconPath(x, y, direction) {
  const sign = direction === "left" ? -1 : 1;
  const tailX = x - sign * 3;
  const tipX = x + sign * 3;
  return [
    `M ${tailX} ${y}`,
    `L ${tipX} ${y}`,
    `M ${x} ${y - 3}`,
    `L ${tipX} ${y}`,
    `L ${x} ${y + 3}`,
  ].join(" ");
}

function setConnectionOriginDirection(group, direction) {
  const icon = group.querySelector(".la-connection-origin-icon");
  if (!icon || group.dataset.direction === direction) {
    return;
  }
  icon.setAttribute(
    "d",
    connectionOriginIconPath(
      Number(group.dataset.centerX),
      Number(group.dataset.centerY),
      direction,
    ),
  );
  group.dataset.direction = direction;
}

function connectionOrigin(
  actor,
  slot,
  onPointerDown,
  defaultDirection = "right",
) {
  const group = svgElement("g", {
    class: "la-connection-origin",
    "data-center-x": actor.centerX,
    "data-center-y": slot.y,
    "data-default-direction": defaultDirection,
    "data-direction": defaultDirection,
    "aria-label": `Drag from ${actor.name} to add a connection`,
  });
  group.append(
    svgElement("circle", {
      cx: actor.centerX,
      cy: slot.y,
      r: 12,
      fill: "transparent",
      "pointer-events": "all",
    }),
    svgElement("circle", {
      class: "la-connection-origin-visible",
      cx: actor.centerX,
      cy: slot.y,
      r: 7,
      fill: "var(--la-selection)",
      "pointer-events": "none",
    }),
    svgElement("path", {
      class:
        "la-connection-origin-visible la-connection-origin-icon",
      d: connectionOriginIconPath(
        actor.centerX,
        slot.y,
        defaultDirection,
      ),
      fill: "none",
      stroke: "var(--la-actor-text)",
      "stroke-width": 1.35,
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
      "pointer-events": "none",
    }),
  );
  group.addEventListener("pointerdown", onPointerDown);
  return group;
}

function messageEndpoint(
  ownerId,
  endpoint,
  x,
  y,
  onPointerDown,
  onActivate,
) {
  const group = svgElement("g", {
    class: "la-message-endpoint",
    "data-owner-id": ownerId,
    "data-endpoint": endpoint,
    "data-visible": "false",
    "aria-label": `Drag the ${endpoint} endpoint to another actor`,
  });
  group.append(
    svgElement("circle", {
      cx: x,
      cy: y,
      r: 11,
      fill: "transparent",
      "pointer-events": "all",
    }),
    svgElement("circle", {
      class: "la-message-endpoint-visible",
      cx: x,
      cy: y,
      r: 3.5,
      fill: "var(--la-canvas)",
      stroke: "var(--la-selection)",
      "stroke-width": 1.75,
      "pointer-events": "none",
    }),
  );
  group.addEventListener("pointerdown", onPointerDown);
  group.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    onActivate();
  });
  return group;
}

function applySelectedVisuals(svg, ids) {
  const selected = new Set(ids);
  svg.querySelectorAll("[data-la-id]").forEach((element) => {
    const isSelected = selected.has(element.dataset.laId);
    const isHighlighted =
      isSelected ||
      element.matches(":hover, :focus, :focus-visible");
    element.dataset.selected = String(isSelected);
    element.setAttribute("aria-pressed", String(isSelected));
    element.querySelectorAll("[data-marker-normal]").forEach((line) => {
      line.setAttribute(
        "marker-end",
        isHighlighted
          ? line.dataset.markerSelected
          : line.dataset.markerNormal,
      );
    });
  });
  svg.querySelectorAll(".la-reorder-handle").forEach((handle) => {
    handle.dataset.visible = String(
      selected.has(handle.dataset.ownerId),
    );
  });
  svg.querySelectorAll(".la-message-endpoint").forEach((handle) => {
    handle.dataset.visible = String(
      selected.has(handle.dataset.ownerId),
    );
  });
}

export function renderEditor(target, input, options = {}) {
  if (!target?.replaceChildren) {
    throw new TypeError("renderEditor requires a DOM container.");
  }

  const editor =
    options.editor instanceof DiagramEditor
      ? options.editor
      : new DiagramEditor(input);
  let selectedIds = [];
  let baseController = null;
  let destroyed = false;
  let activeCancel = null;
  let transient = null;
  let pendingFocus = null;

  const eventTarget = target.host ?? target;

  function notifyChange() {
    const detail = {
      source: editor.source,
      ast: editor.document,
      command: editor.lastCommand,
      canUndo: editor.canUndo,
      canRedo: editor.canRedo,
    };
    options.onChange?.(detail);
    if (eventTarget?.dispatchEvent && globalThis.CustomEvent) {
      eventTarget.dispatchEvent(
        new CustomEvent("la-change", {
          detail,
          bubbles: true,
          composed: true,
        }),
      );
    }
  }

  function notifyError(error, popover = null) {
    if (popover) {
      showError(popover, error);
    }
    options.onError?.(error);
    if (eventTarget?.dispatchEvent && globalThis.CustomEvent) {
      eventTarget.dispatchEvent(
        new CustomEvent("la-error", {
          detail: { error },
          bubbles: true,
          composed: true,
        }),
      );
    }
  }

  function run(
    command,
    selection = undefined,
    popover = null,
    focusField = null,
  ) {
    try {
      const result = command();
      selectedIds =
        selection === undefined
          ? result
            ? [result]
            : []
          : selection;
      transient = null;
      pendingFocus = focusField;
      notifyChange();
      draw();
      return result;
    } catch (error) {
      notifyError(error, popover);
      return null;
    }
  }

  function contextualEditor(frame, layout) {
    frame.querySelector(".la-edit-popover")?.remove();

    if (transient?.type === "insert") {
      const popover = addPopover(
        frame,
        layout,
        transient.anchor,
        "Add timeline item",
      );
      addActions(popover, [
        {
          label: "Gap",
          primary: true,
          run: () =>
            run(
              () =>
                editor.addItem(
                  transient.slot.parentId,
                  transient.slot.index,
                  "gap",
                ),
              undefined,
              popover,
              "Label",
            ),
        },
        {
          label: "Group",
          run: () =>
            run(
              () =>
                editor.addItem(
                  transient.slot.parentId,
                  transient.slot.index,
                  "group",
                ),
              undefined,
              popover,
              "Label",
            ),
        },
      ]);
      return;
    }

    if (selectedIds.length > 1) {
      const locations = selectedIds
        .map((id) => findItemLocation(editor.document, id))
        .filter(Boolean);
      const first = locations[0];
      const anchor = {
        x: layout.width / 2,
        y: Math.max(
          ...selectedIds.map(
            (id) =>
              timelineEntries(layout).find((entry) => entry.id === id)
                ?.bottom ?? 0,
          ),
        ),
      };
      const popover = addPopover(
        frame,
        layout,
        anchor,
        `${selectedIds.length} items selected`,
      );
      addActions(popover, [
        {
          label: "Group",
          primary: true,
          run: () =>
            run(
              () =>
                editor.wrapItems(
                  first.parentId,
                  selectedIds,
                  "group",
                  "New group",
                ),
              undefined,
              popover,
              "Label",
            ),
        },
        {
          label: "Delete",
          danger: true,
          run: () =>
            run(
              () => editor.removeItems(selectedIds),
              [],
              popover,
            ),
        },
      ]);
      return;
    }

    const id = selectedIds[0];
    if (!id) {
      return;
    }
    const model = selectedModel(editor.document, id);
    if (!model) {
      return;
    }
    const popover = addPopover(
      frame,
      layout,
      anchorFor(layout, id),
      model.type === "actor"
        ? "Actor"
        : model.type === "message"
          ? null
          : model.type === "gap"
            ? "Gap"
            : model.type === "section"
              ? "Section"
              : "Group",
    );

    if (model.type === "actor") {
      addField(popover, "Name", model.name, (value) =>
        run(
          () => editor.updateActor(id, { name: value }),
          undefined,
          popover,
        ),
      );
      addField(popover, "Icon", model.icon, (value) =>
        run(
          () => editor.updateActor(id, { icon: value }),
          undefined,
          popover,
        ),
      );
      addField(popover, "Tag", model.tag, (value) =>
        run(
          () => editor.updateActor(id, { tag: value }),
          undefined,
          popover,
        ),
      );
      addField(
        popover,
        "Tooltip",
        model.tooltip,
        (value) =>
          run(
            () => editor.updateActor(id, { tooltip: value }),
            undefined,
            popover,
          ),
      );
      addActions(popover, [
        {
          label: "Delete actor and messages",
          danger: true,
          run: () =>
            run(() => editor.removeActor(id), [], popover),
        },
      ]);
      return;
    }

    if (model.type === "message") {
      addArrowPicker(
        popover,
        model.arrow,
        (value) =>
          run(
            () => editor.updateItem(id, { arrow: value }),
            undefined,
            popover,
          ),
      );
      addField(popover, "Label", model.label, (value) =>
        run(
          () => editor.updateItem(id, { label: value }),
          undefined,
          popover,
        ),
      );
      addField(popover, "Tag", model.tag, (value) =>
        run(
          () => editor.updateItem(id, { tag: value }),
          undefined,
          popover,
        ),
      );
      addField(
        popover,
        "Tooltip",
        model.tooltip,
        (value) =>
          run(
            () => editor.updateItem(id, { tooltip: value }),
            undefined,
            popover,
          ),
      );
      addActions(popover, [
        {
          label: "Delete",
          danger: true,
          run: () =>
            run(() => editor.removeItem(id), [], popover),
        },
      ]);
      return;
    }

    if (model.type === "gap") {
      addField(popover, "Label", model.label, (value) =>
        run(
          () => editor.updateItem(id, { label: value }),
          undefined,
          popover,
        ),
      );
      addActions(popover, [
        {
          label: "Delete",
          danger: true,
          run: () =>
            run(() => editor.removeItem(id), [], popover),
        },
      ]);
      return;
    }

    if (model.type === "group") {
      addField(popover, "Type", model.groupType, (value) =>
        run(
          () => editor.updateItem(id, { groupType: value }),
          undefined,
          popover,
        ),
      );
      addField(popover, "Label", model.label, (value) =>
        run(
          () => editor.updateItem(id, { label: value }),
          undefined,
          popover,
        ),
      );
      const actions = [];
      if (model.sections.length === 0) {
        actions.push({
          label: "Create sections",
          run: () =>
            run(
              () => editor.convertGroupToSections(id),
              undefined,
              popover,
            ),
        });
      } else {
        actions.push({
          label: "Add section",
          run: () =>
            run(
              () => editor.addSection(id),
              undefined,
              popover,
            ),
        });
      }
      actions.push(
        {
          label: "Ungroup",
          run: () =>
            run(() => editor.ungroup(id), undefined, popover),
        },
        {
          label: "Delete group",
          danger: true,
          run: () =>
            run(() => editor.removeItem(id), [], popover),
        },
      );
      addActions(popover, actions);
      return;
    }

    addField(popover, "Label", model.label, (value) =>
      run(
        () => editor.updateSection(id, { label: value }),
        undefined,
        popover,
      ),
    );
    const sectionLocation = findSectionLocation(editor.document, id);
    addActions(popover, [
      {
        label: "Add section",
        run: () =>
          run(
            () =>
              editor.addSection(
                sectionLocation.groupId,
                sectionLocation.index + 1,
              ),
            undefined,
            popover,
          ),
      },
      {
        label: "Remove section",
        danger: true,
        run: () =>
          run(() => editor.removeSection(id), undefined, popover),
      },
    ]);
  }

  function startDrag(handle, event, move, drop) {
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const frame = handle.closest(".la-frame");
    const svg = handle.ownerSVGElement;
    const start = eventPoint(svg, event);
    let moved = false;
    let candidate = null;

    frame.dataset.dragging = "true";
    handle.dataset.dragSource = "true";
    try {
      handle.setPointerCapture?.(event.pointerId);
    } catch {
      // Window listeners below keep SVG dragging working without capture.
    }

    const finish = () => {
      frame.dataset.dragging = "false";
      svg.querySelector(".la-drag-line")?.remove();
      svg.querySelector(".la-connection-preview")?.remove();
      handle.dataset.dragSource = "false";
      if (handle.classList.contains("la-connection-origin")) {
        setConnectionOriginDirection(
          handle,
          handle.dataset.defaultDirection,
        );
      }
      globalThis.removeEventListener("pointermove", onMove);
      globalThis.removeEventListener("pointerup", onUp);
      globalThis.removeEventListener("pointercancel", cancel);
      activeCancel = null;
    };

    const cancel = () => {
      candidate = null;
      finish();
    };

    const onMove = (moveEvent) => {
      const point = eventPoint(svg, moveEvent);
      if (
        !moved &&
        Math.hypot(point.x - start.x, point.y - start.y) < 3
      ) {
        return;
      }
      moved = true;
      candidate = move(point, start, svg);
    };

    const onUp = () => {
      finish();
      if (moved && candidate) {
        drop(candidate);
      }
    };

    activeCancel = cancel;
    globalThis.addEventListener("pointermove", onMove);
    globalThis.addEventListener("pointerup", onUp);
    globalThis.addEventListener("pointercancel", cancel);
  }

  function showDragLine(svg, slot, vertical = false) {
    svg.querySelector(".la-drag-line")?.remove();
    const line = vertical
      ? svgElement("line", {
          class: "la-drag-line",
          x1: slot.x,
          y1: slot.top,
          x2: slot.x,
          y2: slot.bottom,
          stroke: "var(--la-selection)",
          "stroke-width": 2,
        })
      : svgElement("line", {
          class: "la-drag-line",
          x1: slot.left,
          y1: slot.y,
          x2: slot.right,
          y2: slot.y,
          stroke: "var(--la-selection)",
          "stroke-width": 2,
        });
    svg.append(line);
  }

  function nearestActor(layout, x) {
    return layout.actors.reduce(
      (best, actor) =>
        !best ||
        Math.abs(x - actor.centerX) <
          Math.abs(x - best.centerX)
          ? actor
          : best,
      null,
    );
  }

  function showConnectionPreview(
    svg,
    source,
    target,
    y,
    arrow = "->",
  ) {
    svg.querySelector(".la-connection-preview")?.remove();
    const group = svgElement("g", {
      class: "la-connection-preview",
    });
    const selfMessage = source.centerX === target.centerX;
    const top = y - 13;
    const bottom = y + 13;
    const pathData = selfMessage
      ? [
          `M ${source.centerX} ${top}`,
          `L ${source.centerX + 42} ${top}`,
          `L ${source.centerX + 42} ${bottom}`,
          `L ${target.centerX} ${bottom}`,
        ].join(" ")
      : `M ${source.centerX} ${y} L ${target.centerX} ${y}`;
    const path = svgElement("path", {
      d: pathData,
      fill: "none",
      stroke: "var(--la-selection)",
      "stroke-width": 2,
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
    });
    if (arrow === "-->") {
      path.setAttribute("stroke-dasharray", "5 5");
    }
    if (arrow !== "->x") {
      const marker = svg.querySelector(
        'marker[id$="-arrow-selected"]',
      );
      if (marker) {
        path.setAttribute("marker-end", `url(#${marker.id})`);
      }
    }
    group.append(
      path,
      svgElement("circle", {
        cx: target.centerX,
        cy: selfMessage ? bottom : y,
        r: 6,
        fill: "var(--la-canvas)",
        stroke: "var(--la-selection)",
        "stroke-width": 1.5,
      }),
    );
    const originLayer = svg.querySelector(".la-connection-layer");
    if (originLayer) {
      svg.insertBefore(group, originLayer);
    } else {
      svg.append(group);
    }
  }

  function decorate(frame, svg, layout) {
    const editStyle = document.createElement("style");
    editStyle.textContent = EDIT_STYLES;
    target.insertBefore(editStyle, frame);
    frame.dataset.mode = "edit";
    frame.tabIndex = 0;
    frame.style.setProperty(
      "--la-danger",
      options.dangerColor ??
        (frame.dataset.theme === "dark" ? "#FF8FA0" : "#B4384A"),
    );

    for (const group of layout.groups) {
      const element = svg.querySelector(`[data-la-id="${CSS.escape(group.id)}"]`);
      element?.querySelector("rect")?.setAttribute(
        "height",
        layout.options.groupHeaderHeight,
      );
    }

    const timelineInsertionSlots = timelineSlots(editor.document, layout);
    const insertionLayer = svgElement("g", {
      class: "la-insertion-layer",
    });
    const handleLayer = svgElement("g", {
      class: "la-handle-layer",
    });
    const connectionLayer = svgElement("g", {
      class: "la-connection-layer",
    });
    for (const slot of timelineInsertionSlots) {
      insertionLayer.append(
        insertionMark(
          slot,
          "Add timeline item here",
          () => {
            transient = {
              type: "insert",
              slot,
              anchor: { x: slot.left + 16, y: slot.y },
            };
            selectedIds = [];
            applySelectedVisuals(svg, selectedIds);
            contextualEditor(frame, layout);
          },
        ),
      );
    }

    for (const slot of actorSlots(layout)) {
      insertionLayer.append(
        insertionMark(
          slot,
          "Add actor here",
          () =>
            run(
              () => editor.addActor(slot.index),
              undefined,
              null,
              "Name",
            ),
          "vertical",
        ),
      );
    }
    svg.append(insertionLayer);

    for (const slot of timelineInsertionSlots) {
      for (const source of layout.actors) {
        const defaultDirection =
          source.id === layout.actors[layout.actors.length - 1].id
            ? "left"
            : "right";
        let origin;
        origin = connectionOrigin(
          source,
          slot,
          (event) =>
            startDrag(
              origin,
              event,
              (point, _start, activeSvg) => {
                const target = nearestActor(layout, point.x);
                setConnectionOriginDirection(
                  origin,
                  point.x < source.centerX ? "left" : "right",
                );
                showConnectionPreview(
                  activeSvg,
                  source,
                  target,
                  slot.y,
                );
                return target;
              },
              (target) =>
                run(() =>
                  editor.addMessage(slot.parentId, slot.index, {
                    source: source.name,
                    target: target.name,
                  }),
                ),
            ),
          defaultDirection,
        );
        connectionLayer.append(origin);
      }
    }
    svg.append(connectionLayer);

    for (const actor of layout.actors) {
      const element = svg.querySelector(
        `[data-la-id="${CSS.escape(actor.id)}"]`,
      );
      if (!element) {
        continue;
      }
      element.classList.add("la-draggable-actor");
      element.setAttribute(
        "aria-keyshortcuts",
        "Alt+ArrowLeft Alt+ArrowRight",
      );
      element.addEventListener("pointerdown", (event) => {
        if (!selectedIds.includes(actor.id)) {
          return;
        }
        startDrag(
          element,
          event,
          (point, _start, activeSvg) => {
            const slots = actorSlots(layout);
            const slot = slots.reduce((best, current) =>
              !best ||
              Math.abs(point.x - current.x) <
                Math.abs(point.x - best.x)
                ? current
                : best,
            null);
            showDragLine(
              activeSvg,
              {
                x: slot.x,
                top: actor.y - 8,
                bottom: layout.lifelineTop + 18,
              },
              true,
            );
            return slot;
          },
          (slot) =>
            run(() => editor.moveActor(actor.id, slot.index)),
        );
      });
    }

    const slots = timelineInsertionSlots;
    for (const entry of timelineEntries(layout)) {
      const element = svg.querySelector(
        `[data-la-id="${CSS.escape(entry.id)}"]`,
      );
      if (!element) {
        continue;
      }
      let x = entry.left ? entry.left - 8 : layout.contentLeft - 8;
      if (entry.type === "message") {
        const source = layout.actorByName.get(entry.source);
        const target = layout.actorByName.get(entry.target);
        x = Math.min(source.centerX, target.centerX) - 22;
      }
      const y =
        entry.type === "group"
          ? entry.top + layout.options.groupHeaderHeight / 2
          : entry.y;
      const handle = reorderHandle(
        entry.id,
        x,
        y,
        (event) => {
          const sourceLocation = findItemLocation(
            editor.document,
            entry.id,
          );
          const invalidParents = itemAndDescendantContainers(
            sourceLocation.item,
          );
          startDrag(
            handle,
            event,
            (point, start, activeSvg) => {
              const desiredDepth = Math.max(
                0,
                entry.depth + Math.round((point.x - start.x) / 38),
              );
              const candidates = slots.filter(
                (slot) => !invalidParents.has(slot.parentId),
              );
              const slot = candidates.reduce((best, current) => {
                const score =
                  Math.abs(point.y - current.y) +
                  Math.abs(desiredDepth - current.depth) * 34;
                if (!best || score < best.score) {
                  return { ...current, score };
                }
                return best;
              }, null);
              if (slot) {
                showDragLine(activeSvg, slot);
              }
              return slot;
            },
            (slot) =>
              run(() =>
                editor.moveItem(
                  entry.id,
                  slot.parentId,
                  slot.index,
                ),
              ),
          );
        },
      );
      element.setAttribute(
        "aria-keyshortcuts",
        "Alt+ArrowUp Alt+ArrowDown",
      );
      handleLayer.append(handle);

      if (entry.type === "message") {
        const source = layout.actorByName.get(entry.source);
        const target = layout.actorByName.get(entry.target);
        const selfMessage = source.centerX === target.centerX;
        for (const endpoint of ["source", "target"]) {
          const endpointActor = endpoint === "source" ? source : target;
          const endpointY = selfMessage
            ? entry.y + (endpoint === "source" ? -13 : 13)
            : entry.y;
          let endpointHandle;
          endpointHandle = messageEndpoint(
            entry.id,
            endpoint,
            endpointActor.centerX,
            endpointY,
            (event) =>
              startDrag(
                endpointHandle,
                event,
                (point, _start, activeSvg) => {
                  const candidate = nearestActor(layout, point.x);
                  const previewSource =
                    endpoint === "source" ? candidate : source;
                  const previewTarget =
                    endpoint === "target" ? candidate : target;
                  showConnectionPreview(
                    activeSvg,
                    previewSource,
                    previewTarget,
                    entry.y,
                    entry.arrow,
                  );
                  return candidate;
                },
                (candidate) =>
                  run(() =>
                    editor.updateItem(entry.id, {
                      [endpoint]: candidate.name,
                    }),
                  ),
              ),
            () => baseController.select(entry.id),
          );
          handleLayer.append(endpointHandle);
        }
      }
    }

    for (const section of layout.sections) {
      const element = svg.querySelector(
        `[data-la-id="${CSS.escape(section.id)}"]`,
      );
      if (!element) {
        continue;
      }
      const handle = reorderHandle(
        section.id,
        section.left - 8,
        section.y,
        (event) =>
          startDrag(
            handle,
            event,
            (point, _start, activeSvg) => {
              const slots = sectionSlots(layout, section.parentId);
              const slot = slots.reduce((best, current) =>
                !best ||
                Math.abs(point.y - current.y) <
                  Math.abs(point.y - best.y)
                  ? current
                  : best,
              null);
              if (slot) {
                showDragLine(activeSvg, slot);
              }
              return slot;
            },
            (slot) =>
              run(() => editor.moveSection(section.id, slot.index)),
          ),
      );
      element.setAttribute(
        "aria-keyshortcuts",
        "Alt+ArrowUp Alt+ArrowDown",
      );
      handleLayer.append(handle);
    }
    svg.append(handleLayer);
    const tooltipLayer = svg.querySelector(".la-tooltip-layer");
    if (tooltipLayer) {
      svg.append(tooltipLayer);
    }

    let suppressClick = false;
    svg.addEventListener(
      "click",
      (event) => {
        if (suppressClick) {
          suppressClick = false;
          event.preventDefault();
          event.stopImmediatePropagation();
        }
      },
      true,
    );

    svg.addEventListener("pointerdown", (event) => {
      if (
        event.button !== 0 ||
        event.target.closest?.("[data-la-id]") ||
        event.target.closest?.(".la-insertion")
      ) {
        return;
      }
      const start = eventPoint(svg, event);
      const marquee = svgElement("rect", {
        class: "la-marquee",
        x: start.x,
        y: start.y,
        width: 0,
        height: 0,
        rx: 5,
        fill: "var(--la-accent-soft)",
        "fill-opacity": 0.5,
        stroke: "var(--la-selection)",
        "stroke-width": 1,
        "stroke-dasharray": "4 4",
      });
      svg.append(marquee);
      svg.setPointerCapture?.(event.pointerId);

      const cancel = () => {
        marquee.remove();
        globalThis.removeEventListener("pointermove", onMove);
        globalThis.removeEventListener("pointerup", onUp);
        globalThis.removeEventListener("pointercancel", cancel);
        activeCancel = null;
      };

      const onMove = (moveEvent) => {
        const point = eventPoint(svg, moveEvent);
        marquee.setAttribute("x", Math.min(start.x, point.x));
        marquee.setAttribute("y", Math.min(start.y, point.y));
        marquee.setAttribute("width", Math.abs(point.x - start.x));
        marquee.setAttribute("height", Math.abs(point.y - start.y));
      };

      const onUp = (upEvent) => {
        const end = eventPoint(svg, upEvent);
        const top = Math.min(start.y, end.y);
        const bottom = Math.max(start.y, end.y);
        const width = Math.abs(end.x - start.x);
        const height = Math.abs(end.y - start.y);
        cancel();

        if (width < 4 && height < 4) {
          return;
        }
        suppressClick = true;
        const byParent = new Map();
        for (const entry of timelineEntries(layout)) {
          if (entry.bottom < top || entry.top > bottom) {
            continue;
          }
          const bounds = containerBounds(layout, entry.parentId);
          if (!bounds) {
            continue;
          }
          if (!byParent.has(entry.parentId)) {
            byParent.set(entry.parentId, {
              entries: [],
              distance: Math.abs(start.x - bounds.left),
              depth: bounds.depth,
            });
          }
          byParent.get(entry.parentId).entries.push(entry);
        }

        const candidate = [...byParent.values()].sort(
          (first, second) =>
            first.distance - second.distance ||
            second.entries.length - first.entries.length ||
            second.depth - first.depth,
        )[0];
        if (!candidate) {
          return;
        }

        const container = getContainer(
          editor.document,
          candidate.entries[0].parentId,
        );
        const indices = candidate.entries
          .map((entry) =>
            container.items.findIndex((item) => item.id === entry.id),
          )
          .filter((index) => index >= 0)
          .sort((first, second) => first - second);
        if (indices.length === 0) {
          return;
        }
        selectedIds = container.items
          .slice(indices[0], indices[indices.length - 1] + 1)
          .map((item) => item.id);
        transient = null;
        applySelectedVisuals(svg, selectedIds);
        contextualEditor(frame, layout);
        const detail = {
          ids: [...selectedIds],
          kind: "range",
          items: selectedIds.map(
            (id) => findItemLocation(editor.document, id).item,
          ),
        };
        options.onSelect?.(detail);
        if (eventTarget?.dispatchEvent && globalThis.CustomEvent) {
          eventTarget.dispatchEvent(
            new CustomEvent("la-select", {
              detail,
              bubbles: true,
              composed: true,
            }),
          );
        }
      };

      activeCancel = cancel;
      globalThis.addEventListener("pointermove", onMove);
      globalThis.addEventListener("pointerup", onUp);
      globalThis.addEventListener("pointercancel", cancel);
    });

    frame.addEventListener("keydown", (event) => {
      const editing = event.target.matches?.("input, textarea, select");
      const command = event.metaKey || event.ctrlKey;

      if (command && event.key.toLowerCase() === "z") {
        event.preventDefault();
        run(
          () => (event.shiftKey ? editor.redo() : editor.undo()),
          [],
        );
        return;
      }
      if (command && event.key.toLowerCase() === "y") {
        event.preventDefault();
        run(() => editor.redo(), []);
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        activeCancel?.();
        transient = null;
        selectedIds = [];
        applySelectedVisuals(svg, selectedIds);
        contextualEditor(frame, layout);
        return;
      }
      if (
        !editing &&
        (event.key === "Delete" || event.key === "Backspace") &&
        selectedIds.length > 0
      ) {
        event.preventDefault();
        const model = selectedModel(editor.document, selectedIds[0]);
        if (selectedIds.length > 1) {
          run(() => editor.removeItems(selectedIds), []);
        } else if (model.type === "actor") {
          run(() => editor.removeActor(model.id), []);
        } else if (model.type === "section") {
          run(() => editor.removeSection(model.id));
        } else {
          run(() => editor.removeItem(model.id), []);
        }
        return;
      }
      if (!editing && event.altKey && selectedIds.length === 1) {
        const id = selectedIds[0];
        const actorIndex = editor.document.actors.findIndex(
          (actor) => actor.id === id,
        );
        if (
          actorIndex >= 0 &&
          (event.key === "ArrowLeft" || event.key === "ArrowRight")
        ) {
          event.preventDefault();
          const target =
            event.key === "ArrowLeft" ? actorIndex - 1 : actorIndex + 2;
          run(() => editor.moveActor(id, target));
          return;
        }

        const section = findSectionLocation(editor.document, id);
        if (
          section &&
          (event.key === "ArrowUp" || event.key === "ArrowDown")
        ) {
          event.preventDefault();
          const target =
            event.key === "ArrowUp" ? section.index - 1 : section.index + 2;
          run(() => editor.moveSection(id, target));
          return;
        }

        const item = findItemLocation(editor.document, id);
        if (
          item &&
          (event.key === "ArrowUp" || event.key === "ArrowDown")
        ) {
          event.preventDefault();
          const target =
            event.key === "ArrowUp" ? item.index - 1 : item.index + 2;
          run(() => editor.moveItem(id, item.parentId, target));
        }
      }
    });
  }

  function draw() {
    if (destroyed) {
      return;
    }

    baseController = renderDiagram(target, editor.document, {
      ...options,
      initialSelectedId:
        selectedIds.length === 1 ? selectedIds[0] : null,
      onSelect(detail) {
        transient = null;
        selectedIds = detail.id ? [detail.id] : [];
        applySelectedVisuals(baseController.svg, selectedIds);
        const frame = target.querySelector(".la-frame");
        contextualEditor(frame, baseController.layout);
        options.onSelect?.(detail);
      },
    });

    const frame = target.querySelector(".la-frame");
    frame.dataset.mode = "edit";
    decorate(frame, baseController.svg, baseController.layout);
    applySelectedVisuals(baseController.svg, selectedIds);
    contextualEditor(frame, baseController.layout);
    if (pendingFocus) {
      frame
        .querySelector(
          `[data-field="${CSS.escape(pendingFocus)}"]`,
        )
        ?.focus();
      pendingFocus = null;
    }
  }

  draw();

  return {
    editor,
    get ast() {
      return editor.document;
    },
    get source() {
      return editor.source;
    },
    get layout() {
      return baseController.layout;
    },
    get svg() {
      return baseController.svg;
    },
    get selectedId() {
      return selectedIds.length === 1 ? selectedIds[0] : null;
    },
    get selectedIds() {
      return [...selectedIds];
    },
    get canUndo() {
      return editor.canUndo;
    },
    get canRedo() {
      return editor.canRedo;
    },
    select(id) {
      transient = null;
      selectedIds = id ? [id] : [];
      draw();
    },
    clearSelection() {
      transient = null;
      selectedIds = [];
      draw();
    },
    undo() {
      return run(() => editor.undo(), []);
    },
    redo() {
      return run(() => editor.redo(), []);
    },
    replaceSource(source) {
      return run(() => editor.replaceSource(source), []);
    },
    destroy() {
      destroyed = true;
      activeCancel?.();
      baseController?.destroy();
    },
  };
}
