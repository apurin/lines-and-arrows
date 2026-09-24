import {
  ROOT_CONTAINER_ID,
  descendantContainerIds,
  findContainerItems,
  findItemLocation,
  findSectionLocation,
  groupSections,
} from "./document.js";
import { GROUP_TYPE_PATTERN_SOURCE } from "./grammar.js";
import {
  phosphorIconCatalog,
  phosphorIconResolver,
  recommendedActorIconNames,
} from "./icons.js";
import {
  SELF_MESSAGE_MIN_WIDTH,
  messageLabelMetrics,
  metadataMetrics,
  selfMessageWidth,
} from "./metadata.js";
import { CONTROL_HIT_SIZE, renderDiagramForEditor } from "./render.js";
import { estimatedTextWidth, graphemes } from "./text.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const TIMELINE_INSERTION_CONTROL_OFFSET = 12;
const TIMELINE_INSERTION_CONTROL_RADIUS = 8;
const ACTOR_INSERTION_CONTROL_HALF_WIDTH = 13;
const SIDE_INSERTION_CONTROL_OFFSET = 20;
const REORDER_HANDLE_RADIUS = 11;
const GROUP_REORDER_HANDLE_RADIUS = 9;
const GROUP_EDITOR_HANDLE_GAP = 1;
const GROUP_EDITOR_LEFT_INSET =
  GROUP_REORDER_HANDLE_RADIUS * 2 + GROUP_EDITOR_HANDLE_GAP;
const GROUP_EDITOR_RIGHT_INSET = 10;
const STATUS_DURATION = 5000;

const EDIT_STYLES = `
  .la-frame[data-mode="edit"] {
    --la-inline-scale: 1;
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

  /*
   * While an item is selected, hover-revealed affordances stay hidden:
   * insertion marks and tooltips would open over the contextual editor, and
   * connection origins would turn a press on a lifeline into a new message.
   * Other items, undo, and redo stay live so one click moves the selection
   * or reverts the last change.
   */
  .la-frame[data-selection-active="true"] .la-insertion-layer,
  .la-frame[data-selection-active="true"] .la-connection-layer,
  .la-frame[data-selection-active="true"] .la-tooltip-layer,
  .la-frame[data-selection-active="true"]
    .la-message-endpoint:not([data-visible="true"]) {
    display: none;
  }

  .la-frame[data-selection-active="true"]
    .la-actor:not([data-selected="true"])
    .la-actor-shape {
    fill: var(--la-actor);
  }

  .la-frame[data-selection-active="true"]
    .la-actor:not([data-selected="true"])
    .la-focus-ring,
  .la-frame[data-selection-active="true"]
    .la-message:not([data-selected="true"])
    .la-message-selection-highlight {
    opacity: 0;
  }

  .la-frame[data-selection-active="true"]
    .la-message:not([data-selected="true"])
    .la-message-line,
  .la-frame[data-selection-active="true"]
    .la-message:not([data-selected="true"])
    .la-lost-cross {
    stroke: var(--la-line);
  }

  .la-frame[data-selection-active="true"]
    .la-message:not([data-selected="true"])
    .la-message-label {
    fill: var(--la-text);
  }

  .la-frame[data-selection-active="true"]
    .la-group-hit:not([data-selected="true"])
    + .la-group-shape {
    stroke-opacity: 0;
  }

  .la-frame[data-selection-active="true"]
    .la-section:not([data-selected="true"])
    .la-section-line {
    stroke: var(--la-section-line);
  }

  .la-frame[data-selection-active="true"]
    .la-gap:not([data-selected="true"])
    .la-gap-rule {
    stroke: var(--la-lifeline);
  }

  .la-frame[data-selection-active="true"]
    .la-tooltip-trigger
    .la-tooltip-trigger-shape {
    fill: var(--la-tag-fill);
    stroke: transparent;
  }

  .la-inline-gap-editor {
    overflow: visible;
  }

  .la-inline-gap-editor-body {
    display: flex;
    box-sizing: border-box;
    width: 100%;
    height: 100%;
    gap: 3px;
    align-items: center;
    flex-direction: column;
    font-family: var(
      --la-font-family,
      ui-sans-serif,
      system-ui,
      sans-serif
    );
  }

  .la-inline-gap-label {
    box-sizing: border-box;
    width: 100%;
    margin: 0;
    padding: 5px 10px;
    overflow: hidden;
    border: 0;
    outline: none;
    background: var(--la-surface);
    color: var(--la-text);
    font: 650 10px/12px var(
      --la-font-family,
      ui-sans-serif,
      system-ui,
      sans-serif
    );
    text-align: center;
    resize: none;
    cursor: text;
  }

  .la-inline-gap-delete {
    position: fixed;
    z-index: 4;
    transform: translate(-50%, -50%);
  }

  .la-inline-delete-control {
    box-sizing: border-box;
    width: calc(
      var(--la-inline-delete-size, 20px) * var(--la-inline-scale)
    );
    height: calc(
      var(--la-inline-delete-size, 20px) * var(--la-inline-scale)
    );
    margin: 0;
    padding: 0;
    cursor: pointer;
    border: 0;
    border-radius: 50%;
    outline: none;
    background: var(--la-danger);
    color: var(--la-danger-text);
  }

  .la-inline-delete-control::before,
  .la-inline-delete-control::after {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 48%;
    height: calc(
      var(--la-inline-delete-cross-thickness, 1.5px) *
        var(--la-inline-scale)
    );
    border-radius: 999px;
    background: currentColor;
    content: "";
  }

  .la-inline-delete-control::before {
    transform: translate(-50%, -50%) rotate(45deg);
  }

  .la-inline-delete-control::after {
    transform: translate(-50%, -50%) rotate(-45deg);
  }

  .la-inline-gap-delete:hover,
  .la-inline-gap-delete:focus-visible,
  .la-inline-actor-delete:hover,
  .la-inline-actor-delete:focus-visible,
  .la-inline-group-delete:hover,
  .la-inline-group-delete:focus-visible,
  .la-inline-section-delete:hover,
  .la-inline-section-delete:focus-visible,
  .la-inline-message-delete:hover,
  .la-inline-message-delete:focus-visible {
    box-shadow: 0 0 0 2px
      color-mix(in srgb, var(--la-danger) 24%, transparent);
  }

  .la-inline-actor-editor {
    position: fixed;
    z-index: 4;
    overflow: visible;
    pointer-events: none;
    font-family: var(
      --la-font-family,
      ui-sans-serif,
      system-ui,
      sans-serif
    );
  }

  .la-inline-actor-editor *,
  .la-inline-actor-editor *::before,
  .la-inline-actor-editor *::after {
    box-sizing: border-box;
  }

  .la-inline-actor-card {
    position: relative;
    width: 100%;
    height: 100%;
  }

  .la-inline-actor-editor .la-inline-actor-icon-picker {
    position: absolute;
    z-index: 7;
    top: calc(4px * var(--la-inline-scale));
    left: 50%;
    pointer-events: auto;
    transform: translateX(-50%);
  }

  .la-inline-actor-icon-picker .la-icon-picker-trigger {
    width: calc(18px * var(--la-inline-scale));
    min-width: calc(18px * var(--la-inline-scale));
    height: calc(18px * var(--la-inline-scale));
    padding: 0;
    border: 0;
    border-radius: 0;
    background: transparent;
    color: var(--la-actor-text);
  }

  .la-inline-actor-icon-picker[data-empty="true"]
    .la-icon-picker-trigger {
    width: calc(20px * var(--la-inline-scale));
    min-width: calc(20px * var(--la-inline-scale));
    height: calc(20px * var(--la-inline-scale));
    padding: 0;
    border: 1px dashed color-mix(
      in srgb,
      var(--la-actor-text) 45%,
      transparent
    );
    border-radius: 50%;
    background: transparent;
    box-shadow: none;
  }

  .la-inline-actor-icon-picker[data-empty="true"]
    > .la-icon-picker-trigger
    .la-icon-glyph,
  .la-inline-actor-icon-picker[data-empty="true"]
    > .la-icon-picker-trigger
    .la-icon-visual {
    width: calc(14px * var(--la-inline-scale));
    height: calc(14px * var(--la-inline-scale));
  }

  .la-inline-actor-icon-picker:not([data-empty="true"])
    > .la-icon-picker-trigger
    .la-icon-glyph,
  .la-inline-actor-icon-picker:not([data-empty="true"])
    > .la-icon-picker-trigger
    .la-icon-visual {
    width: calc(18px * var(--la-inline-scale));
    height: calc(18px * var(--la-inline-scale));
    opacity: 1;
  }

  .la-inline-actor-icon-picker:not([data-empty="true"])
    > .la-icon-picker-trigger[aria-expanded="true"] {
    border: 0;
    background: transparent;
    box-shadow: none;
  }

  .la-inline-actor-icon-picker
    > .la-icon-picker-trigger
    .la-icon-visual {
    filter: var(--la-actor-icon-filter);
  }

  .la-inline-actor-icon-picker[data-empty="true"]
    .la-icon-fallback {
    font-size: 9px;
    font-weight: 700;
  }

  .la-inline-actor-icon-picker .la-icon-picker-popover {
    top: calc(100% + 6px);
    right: auto;
    left: 50%;
    transform: translateX(-50%);
  }

  .la-inline-actor-name {
    position: absolute;
    right: calc(4px * var(--la-inline-scale));
    bottom: calc(5px * var(--la-inline-scale));
    left: calc(4px * var(--la-inline-scale));
    width: auto;
    height: calc(18px * var(--la-inline-scale));
    margin: 0;
    padding: 0;
    pointer-events: auto;
    border: 0;
    outline: none;
    background: transparent;
    color: var(--la-actor-text);
    font: 700 calc(13px * var(--la-inline-scale))/1.1 var(
      --la-font-family,
      ui-sans-serif,
      system-ui,
      sans-serif
    );
    letter-spacing: -0.01em;
    text-align: center;
  }

  .la-inline-actor-metadata {
    position: absolute;
    top: calc(100% + 6px * var(--la-inline-scale));
    left: 50%;
    display: flex;
    gap: calc(4px * var(--la-inline-scale));
    align-items: center;
    pointer-events: auto;
    transform: translateX(
      calc(
        -50% + var(--la-inline-actor-metadata-shift, 0px)
      )
    );
  }

  .la-inline-actor-pill {
    width: auto;
    min-width: var(--la-inline-actor-pill-min-width, 38px);
    height: calc(20px * var(--la-inline-scale));
    margin: 0;
    padding: 0
      calc(10px * var(--la-inline-scale) - 2px);
    border: 1px solid transparent;
    border-radius: calc(10px * var(--la-inline-scale));
    outline: none;
    background: var(--la-tag-fill);
    color: var(--la-tag-text);
    font: 650 calc(10px * var(--la-inline-scale))/1 var(
      --la-font-family,
      ui-sans-serif,
      system-ui,
      sans-serif
    );
    text-align: center;
  }

  .la-inline-actor-pill::placeholder {
    color: var(--la-muted-text);
    opacity: 1;
  }

  .la-inline-actor-pill:placeholder-shown {
    border-color: var(--la-section-line);
    border-style: dashed;
    background: transparent;
  }

  .la-inline-actor-pill:hover,
  .la-inline-actor-pill:focus {
    border-color: var(--la-selection);
  }

  .la-inline-actor-delete {
    position: absolute;
    z-index: 9;
    top: 50%;
    right: calc(-10px * var(--la-inline-scale));
    pointer-events: auto;
    transform: translateY(-50%);
  }

  .la-inline-actor-tooltip-control {
    position: relative;
    flex: none;
    width: calc(20px * var(--la-inline-scale));
    height: calc(20px * var(--la-inline-scale));
  }

  .la-inline-actor-tooltip-trigger {
    display: grid;
    width: 100%;
    height: 100%;
    margin: 0;
    padding: 0;
    place-items: center;
    cursor: pointer;
    border: 1px solid transparent;
    border-radius: 50%;
    outline: none;
    background: var(--la-tag-fill);
    color: var(--la-tag-text);
  }

  .la-inline-actor-tooltip-trigger[data-empty="true"] {
    border-color: var(--la-section-line);
    border-style: dashed;
    background: transparent;
  }

  .la-inline-actor-tooltip-trigger:hover,
  .la-inline-actor-tooltip-trigger:focus-visible,
  .la-inline-actor-tooltip-trigger[aria-expanded="true"] {
    border-color: var(--la-selection);
    background: var(--la-tag-fill);
  }

  .la-inline-actor-tooltip-trigger .la-icon-glyph,
  .la-inline-actor-tooltip-trigger .la-icon-visual {
    width: calc(14px * var(--la-inline-scale));
    height: calc(14px * var(--la-inline-scale));
  }

  .la-inline-actor-tooltip-trigger .la-icon-fallback {
    font-size: calc(11px * var(--la-inline-scale));
    font-weight: 750;
  }

  .la-inline-actor-tooltip-dialog {
    position: absolute;
    z-index: 8;
    top: calc(100% + 9px);
    bottom: auto;
    left: 50%;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 8px;
    width: min(320px, calc(100vw - 16px));
    padding: 8px;
    overflow: visible;
    border: 1px solid var(--la-section-line);
    border-radius: 11px;
    background: var(--la-surface);
    box-shadow: 0 3px 10px
      color-mix(in srgb, var(--la-text) 10%, transparent);
    transform: translateX(
      calc(-50% + var(--la-inline-tooltip-dialog-shift, 0px))
    );
  }

  .la-inline-actor-tooltip-dialog[hidden] {
    display: none;
  }

  .la-inline-actor-tooltip-dialog::before,
  .la-inline-actor-tooltip-dialog::after {
    position: absolute;
    left: calc(
      50% - var(--la-inline-tooltip-dialog-shift, 0px)
    );
    width: 0;
    height: 0;
    content: "";
    transform: translateX(-50%);
  }

  .la-inline-actor-tooltip-dialog::before {
    top: -7px;
    border-bottom: 7px solid var(--la-section-line);
    border-right: 7px solid transparent;
    border-left: 7px solid transparent;
  }

  .la-inline-actor-tooltip-dialog::after {
    top: -5.5px;
    border-bottom: 6px solid var(--la-surface);
    border-right: 6px solid transparent;
    border-left: 6px solid transparent;
  }

  .la-inline-actor-tooltip-text {
    display: block;
    width: 100%;
    min-width: 0;
    height: 52px;
    margin: 0;
    padding: 6px 8px;
    border: 1px solid var(--la-section-line);
    border-radius: 8px;
    outline: none;
    resize: none;
    background: color-mix(
      in srgb,
      var(--la-surface) 82%,
      var(--la-group-fill)
    );
    color: var(--la-text);
    font: 520 11px/1.25 var(
      --la-font-family,
      ui-sans-serif,
      system-ui,
      sans-serif
    );
  }

  .la-inline-actor-tooltip-text:focus {
    border-color: var(--la-selection);
  }

  .la-inline-actor-tooltip-field {
    display: grid;
    min-width: 0;
    gap: 4px;
  }

  .la-inline-actor-tooltip-field > label,
  .la-inline-actor-tooltip-field > span {
    color: var(--la-muted-text);
    font-size: 10px;
    font-weight: 650;
    line-height: 1.2;
  }

  .la-inline-actor-editor .la-icon-search {
    height: 32px;
    margin: 0;
    padding: 6px 8px;
    border: 1px solid var(--la-section-line);
    border-radius: 8px;
    outline: none;
    background: color-mix(
      in srgb,
      var(--la-surface) 82%,
      var(--la-group-fill)
    );
    color: var(--la-text);
    font: 520 11px/1.2 var(
      --la-font-family,
      ui-sans-serif,
      system-ui,
      sans-serif
    );
  }

  .la-inline-actor-editor .la-edit-error {
    position: absolute;
    top: calc(100% + 6px * var(--la-inline-scale) + 24px);
    left: 50%;
    width: max-content;
    max-width: 220px;
    margin: 0;
    padding: 3px 6px;
    border-radius: 6px;
    background: var(--la-surface);
    text-align: center;
    transform: translateX(-50%);
  }

  .la-inline-group-editor {
    position: fixed;
    z-index: 5;
    overflow: visible;
    pointer-events: none;
    font-family: var(
      --la-font-family,
      ui-sans-serif,
      system-ui,
      sans-serif
    );
  }

  .la-inline-group-editor *,
  .la-inline-group-editor *::before,
  .la-inline-group-editor *::after {
    box-sizing: border-box;
  }

  .la-inline-group-row {
    position: absolute;
    display: flex;
    gap: calc(5px * var(--la-inline-scale));
    align-items: center;
    pointer-events: auto;
  }

  .la-inline-group-field {
    display: flex;
    min-width: 0;
    height: calc(20px * var(--la-inline-scale));
    gap: calc(4px * var(--la-inline-scale));
    align-items: center;
    flex: none;
  }

  .la-inline-group-label-field {
    flex: 1 1 auto;
  }

  .la-inline-group-field-name {
    color: var(--la-muted-text);
    font-size: calc(9px * var(--la-inline-scale));
    font-weight: 650;
    line-height: 1;
    white-space: nowrap;
  }

  .la-inline-group-type,
  .la-inline-group-label,
  .la-inline-group-action {
    height: calc(20px * var(--la-inline-scale));
    margin: 0;
    outline: none;
    color: var(--la-text);
    font: 650 calc(11px * var(--la-inline-scale))/1 var(
      --la-font-family,
      ui-sans-serif,
      system-ui,
      sans-serif
    );
  }

  .la-inline-group-type {
    flex: none;
    padding: 0 calc(8px * var(--la-inline-scale));
    appearance: none;
    border: 0;
    border-radius: calc(10px * var(--la-inline-scale));
    background: color-mix(
      in srgb,
      var(--la-surface) 76%,
      var(--la-group-fill)
    );
    color: var(--la-text);
    text-align: center;
  }

  .la-inline-group-label {
    min-width: 0;
    padding: calc(
        (
            20px * var(--la-inline-scale) -
              11px * var(--la-inline-scale)
          ) /
          2
      )
      calc(8px * var(--la-inline-scale));
    overflow: hidden;
    flex: 1 1 auto;
    appearance: none;
    border: 0;
    border-radius: calc(10px * var(--la-inline-scale));
    resize: none;
    background: color-mix(
      in srgb,
      var(--la-surface) 76%,
      var(--la-group-fill)
    );
    text-align: left;
    white-space: pre;
  }

  .la-inline-group-actions {
    display: flex;
    gap: calc(4px * var(--la-inline-scale));
    align-items: center;
    margin-left: auto;
    flex: none;
  }

  .la-inline-group-action {
    padding: 0 calc(9px * var(--la-inline-scale));
    cursor: pointer;
    border: 1px solid color-mix(
      in srgb,
      var(--la-selection) 34%,
      var(--la-section-line)
    );
    border-radius: calc(10px * var(--la-inline-scale));
    background: color-mix(
      in srgb,
      var(--la-accent-soft) 58%,
      var(--la-surface)
    );
    color: var(--la-text);
  }

  .la-inline-group-action:hover,
  .la-inline-group-action:focus-visible {
    border-color: var(--la-selection);
    color: var(--la-text);
  }

  .la-inline-group-action:hover,
  .la-inline-group-action:focus-visible {
    background: var(--la-accent-soft);
  }

  .la-inline-group-delete {
    position: relative;
    flex: none;
    pointer-events: auto;
  }

  .la-inline-group-editor .la-edit-error {
    position: absolute;
    top: calc(100% + 5px);
    left: 50%;
    width: max-content;
    max-width: 220px;
    margin: 0;
    padding: 3px 6px;
    border-radius: 6px;
    background: var(--la-surface);
    text-align: center;
    transform: translateX(-50%);
  }

  .la-inline-section-editor {
    position: fixed;
    z-index: 5;
    display: flex;
    gap: calc(4px * var(--la-inline-scale));
    align-items: center;
    overflow: visible;
    pointer-events: none;
    font-family: var(
      --la-font-family,
      ui-sans-serif,
      system-ui,
      sans-serif
    );
  }

  .la-inline-section-editor *,
  .la-inline-section-editor *::before,
  .la-inline-section-editor *::after {
    box-sizing: border-box;
  }

  .la-inline-section-label {
    min-width: 0;
    height: 100%;
    margin: 0;
    padding: calc(4px * var(--la-inline-scale))
      calc(8px * var(--la-inline-scale));
    overflow: hidden;
    flex: none;
    pointer-events: auto;
    appearance: none;
    border: 0;
    border-radius: calc(10px * var(--la-inline-scale));
    outline: none;
    resize: none;
    background: color-mix(
      in srgb,
      var(--la-surface) 76%,
      var(--la-group-fill)
    );
    color: var(--la-text);
    font: 650 calc(10px * var(--la-inline-scale))/calc(
        12px * var(--la-inline-scale)
      ) var(
        --la-font-family,
        ui-sans-serif,
        system-ui,
        sans-serif
      );
    text-align: left;
    white-space: pre;
  }

  .la-inline-section-delete {
    position: relative;
    margin-left: auto;
    flex: none;
    pointer-events: auto;
  }

  .la-inline-section-editor .la-edit-error {
    position: absolute;
    top: calc(100% + 5px);
    left: 50%;
    width: max-content;
    max-width: 220px;
    margin: 0;
    padding: 3px 6px;
    border-radius: 6px;
    background: var(--la-surface);
    text-align: center;
    transform: translateX(-50%);
  }

  .la-inline-message-editor {
    position: fixed;
    z-index: 4;
    overflow: visible;
    pointer-events: none;
    font-family: var(
      --la-font-family,
      ui-sans-serif,
      system-ui,
      sans-serif
    );
  }

  .la-inline-message-editor *,
  .la-inline-message-editor *::before,
  .la-inline-message-editor *::after {
    box-sizing: border-box;
  }

  .la-inline-message-label {
    position: absolute;
    margin: 0;
    padding: 2px 5px;
    overflow: hidden;
    pointer-events: auto;
    border: 0;
    outline: none;
    resize: none;
    background: transparent;
    color: var(--la-text);
    font: 560 calc(11px * var(--la-inline-scale))/calc(
        13px * var(--la-inline-scale)
      ) var(
        --la-font-family,
        ui-sans-serif,
        system-ui,
        sans-serif
      );
    text-align: center;
    white-space: pre;
  }

  .la-inline-message-label::placeholder {
    color: var(--la-muted-text);
    opacity: 1;
  }

  .la-inline-message-delete {
    --la-inline-delete-size: 16px;
    --la-inline-delete-cross-thickness: 1.25px;
    position: absolute;
    z-index: 9;
    pointer-events: auto;
    transform: translate(-50%, -50%);
  }

  .la-inline-message-metadata {
    position: absolute;
    display: flex;
    gap: calc(4px * var(--la-inline-scale));
    align-items: center;
    pointer-events: auto;
    transform: translateX(
      calc(
        -50% + var(--la-inline-message-metadata-shift, 0px)
      )
    );
  }

  .la-inline-message-toolbar {
    /* Transparent borders widen each 18 px control to a 24 px target. */
    --la-inline-hit-inset: max(
      0px,
      (24px - 18px * var(--la-inline-scale)) / 2
    );
    position: absolute;
    z-index: 6;
    display: flex;
    gap: calc(4px * var(--la-inline-scale));
    align-items: center;
    pointer-events: auto;
    transform: translate(
      calc(-50% + var(--la-inline-message-toolbar-shift, 0px)),
      -50%
    );
  }

  .la-inline-message-arrow-styles {
    display: flex;
    gap: calc(3px * var(--la-inline-scale));
    align-items: center;
  }

  .la-inline-message-endpoint {
    box-sizing: border-box;
    max-width: calc(
      96px * var(--la-inline-scale) + var(--la-inline-hit-inset) * 2
    );
    height: calc(
      18px * var(--la-inline-scale) + var(--la-inline-hit-inset) * 2
    );
    margin: 0;
    padding: 0 calc(4px * var(--la-inline-scale));
    cursor: pointer;
    border: var(--la-inline-hit-inset) solid transparent;
    border-radius: calc(
      9px * var(--la-inline-scale) + var(--la-inline-hit-inset)
    );
    outline: none;
    background: var(--la-surface);
    background-clip: padding-box;
    box-shadow: inset 0 0 0 1px var(--la-section-line);
    color: var(--la-text);
    font: 560 calc(10px * var(--la-inline-scale)) / 1 var(
        --la-font-family,
        ui-sans-serif,
        system-ui,
        sans-serif
      );
    text-overflow: ellipsis;
  }

  .la-inline-message-endpoint:hover,
  .la-inline-message-endpoint:focus-visible {
    box-shadow: inset 0 0 0 1px var(--la-selection);
  }

  .la-inline-message-arrow-style {
    display: grid;
    width: calc(
      18px * var(--la-inline-scale) + var(--la-inline-hit-inset) * 2
    );
    min-width: calc(
      18px * var(--la-inline-scale) + var(--la-inline-hit-inset) * 2
    );
    height: calc(
      18px * var(--la-inline-scale) + var(--la-inline-hit-inset) * 2
    );
    margin: 0;
    padding: 0;
    place-items: center;
    cursor: pointer;
    border: var(--la-inline-hit-inset) solid transparent;
    border-radius: 50%;
    outline: none;
    background: var(--la-surface);
    background-clip: padding-box;
    box-shadow: inset 0 0 0 1px var(--la-section-line);
    color: var(--la-muted-text);
  }

  .la-inline-message-arrow-style:hover,
  .la-inline-message-arrow-style:focus-visible {
    box-shadow: inset 0 0 0 1px var(--la-selection);
    color: var(--la-text);
  }

  .la-inline-message-arrow-style[aria-pressed="true"] {
    box-shadow: inset 0 0 0 1px var(--la-selection);
    background: var(--la-accent-soft);
    background-clip: padding-box;
    color: var(--la-text);
  }

  .la-inline-message-arrow-style svg {
    width: calc(14px * var(--la-inline-scale));
    height: calc(12px * var(--la-inline-scale));
    overflow: visible;
  }

  .la-inline-message-editor .la-icon-search {
    height: 32px;
    margin: 0;
    padding: 6px 8px;
    border: 1px solid var(--la-section-line);
    border-radius: 8px;
    outline: none;
    background: color-mix(
      in srgb,
      var(--la-surface) 82%,
      var(--la-group-fill)
    );
    color: var(--la-text);
    font: 520 11px/1.2 var(
      --la-font-family,
      ui-sans-serif,
      system-ui,
      sans-serif
    );
  }

  .la-inline-message-editor .la-edit-error {
    position: absolute;
    top: calc(100% + 6px);
    left: 50%;
    width: max-content;
    max-width: 220px;
    margin: 0;
    padding: 3px 6px;
    border-radius: 6px;
    background: var(--la-surface);
    text-align: center;
    transform: translateX(-50%);
  }

  .la-insertion {
    cursor: pointer;
    outline: none;
  }

  .la-insertion[data-control-only="true"] {
    cursor: default;
  }

  .la-insertion[data-control-only="true"]
    .la-insertion-circle {
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
  .la-insertion[data-menu-open="true"] .la-insertion-line,
  .la-insertion[data-menu-open="true"] .la-insertion-circle,
  .la-insertion[data-menu-open="true"] .la-insertion-plus,
  .la-insertion:focus-within .la-insertion-line,
  .la-insertion:focus-within .la-insertion-circle,
  .la-insertion:focus-within .la-insertion-plus,
  .la-insertion:focus-visible .la-insertion-line,
  .la-insertion:focus-visible .la-insertion-circle,
  .la-insertion:focus-visible .la-insertion-plus {
    opacity: 1;
  }

  .la-reorder-handle {
    cursor: grab;
    opacity: 0;
    pointer-events: none;
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
    position: fixed;
    z-index: 3;
    inset: auto;
    box-sizing: border-box;
    overflow: visible;
    width: min(292px, calc(100vw - 16px));
    margin: 0;
    padding: 12px;
    border: 1px solid var(--la-section-line);
    border-radius: 14px;
    background: var(--la-surface);
    color: var(--la-text);
    box-shadow: 0 3px 12px
      color-mix(in srgb, var(--la-text) 8%, transparent);
    font: 500 12px/1.35 var(
      --la-font-family,
      ui-sans-serif,
      system-ui,
      sans-serif
    );
  }

  .la-edit-popover[data-variant="insert"] {
    --la-insertion-control-size: calc(
      16px * var(--la-inline-scale)
    );
    width: max-content;
    padding:
      5px
      5px
      5px
      calc(var(--la-insertion-control-size) / 2 + 3px);
    border: 1px solid var(--la-selection);
    border-radius: 10px;
    -webkit-mask-image: radial-gradient(
      circle at left center,
      transparent 0
        calc(var(--la-insertion-control-size) / 2 - 0.5px),
      black calc(var(--la-insertion-control-size) / 2 + 0.5px)
    );
    mask-image: radial-gradient(
      circle at left center,
      transparent 0
        calc(var(--la-insertion-control-size) / 2 - 0.5px),
      black calc(var(--la-insertion-control-size) / 2 + 0.5px)
    );
  }

  .la-edit-header {
    display: flex;
    min-height: 22px;
    align-items: center;
    gap: 8px;
    margin: 0 0 10px;
  }

  .la-edit-title {
    display: block;
    flex: 1;
    margin: 0;
    font-size: 12px;
    font-weight: 700;
  }

  .la-edit-close {
    display: grid;
    flex: none;
    width: 22px;
    height: 22px;
    padding: 0;
    place-items: center;
    border: 0;
    border-radius: 6px;
    outline: none;
    background: transparent;
    color: var(--la-muted-text);
    font: 600 18px/1 var(
      --la-font-family,
      ui-sans-serif,
      system-ui,
      sans-serif
    );
    cursor: pointer;
  }

  .la-edit-close:hover,
  .la-edit-close:focus-visible {
    background: var(--la-accent-soft);
    color: var(--la-text);
  }

  .la-icon-picker {
    position: relative;
  }

  .la-icon-selector {
    min-width: 0;
  }

  .la-icon-picker-trigger,
  .la-icon-picker-clear,
  .la-icon-option,
  .la-insert-option {
    display: grid;
    box-sizing: border-box;
    padding: 0;
    place-items: center;
    border: 1px solid var(--la-section-line);
    outline: none;
    background: color-mix(
      in srgb,
      var(--la-surface) 82%,
      var(--la-group-fill)
    );
    color: var(--la-text);
    cursor: pointer;
  }

  .la-icon-picker-trigger {
    width: 32px;
    height: 32px;
    border-radius: 8px;
  }

  .la-icon-picker-trigger:hover,
  .la-icon-picker-trigger:focus-visible,
  .la-icon-picker-clear:hover,
  .la-icon-picker-clear:focus-visible,
  .la-icon-option:hover,
  .la-icon-option:focus-visible,
  .la-insert-option:hover,
  .la-insert-option:focus-visible {
    border-color: var(--la-selection);
  }

  .la-icon-picker-trigger[aria-expanded="true"],
  .la-icon-option[aria-selected="true"] {
    border-color: var(--la-selection);
    background: var(--la-accent-soft);
    box-shadow: inset 0 0 0 1px
      color-mix(in srgb, var(--la-selection) 18%, transparent);
  }

  .la-icon-picker-popover {
    position: absolute;
    z-index: 6;
    top: calc(100% + 6px);
    right: 0;
    box-sizing: border-box;
    width: 304px;
    padding: 8px;
    border: 1px solid var(--la-section-line);
    border-radius: 11px;
    background: var(--la-surface);
    box-shadow: 0 3px 10px
      color-mix(in srgb, var(--la-text) 10%, transparent);
  }

  .la-icon-picker-popover[hidden],
  .la-icon-option[hidden],
  .la-icon-picker-empty[hidden] {
    display: none;
  }

  .la-icon-search {
    min-width: 0;
    font-weight: 520;
  }

  .la-icon-picker-toolbar {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 32px;
    gap: 6px;
  }

  .la-icon-picker-clear {
    width: 32px;
    height: 32px;
    border-radius: 8px;
  }

  .la-icon-grid {
    display: grid;
    grid-template-columns: repeat(8, 32px);
    gap: 4px;
    margin-top: 7px;
  }

  .la-icon-grid-divider {
    grid-column: 1 / -1;
    height: 6px;
  }

  .la-icon-option {
    width: 32px;
    height: 32px;
    border-radius: 7px;
  }

  .la-insert-picker {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 4px;
  }

  .la-insert-option {
    display: flex;
    width: auto;
    min-width: 76px;
    height: 32px;
    gap: 6px;
    padding: 0 9px;
    align-items: center;
    justify-content: center;
    border-radius: 7px;
  }

  .la-insert-option-label {
    font-size: 11px;
    font-weight: 650;
    line-height: 1;
  }

  .la-insert-option:disabled {
    border-color: var(--la-section-line);
    cursor: not-allowed;
    opacity: 0.45;
  }

  .la-icon-visual {
    display: block;
    width: 16px;
    height: 16px;
    object-fit: contain;
    opacity: 0.82;
  }

  .la-icon-glyph {
    display: grid;
    width: 16px;
    height: 16px;
    place-items: center;
  }

  .la-icon-glyph > * {
    grid-area: 1 / 1;
  }

  .la-frame[data-theme="dark"] .la-icon-visual {
    filter: invert(1) brightness(1.16);
  }

  .la-icon-fallback {
    font-size: 12px;
    font-weight: 750;
    line-height: 1;
  }

  .la-icon-picker-current {
    margin: 0 2px 6px;
    overflow-wrap: anywhere;
    color: var(--la-muted-text);
    font-size: 10px;
    font-weight: 560;
  }

  .la-icon-picker-empty {
    margin: 8px 2px 2px;
    color: var(--la-muted-text);
    font-size: 10px;
    font-weight: 560;
    text-align: center;
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

  .la-edit-status {
    position: absolute;
    z-index: 6;
    top: 8px;
    left: 50%;
    box-sizing: border-box;
    width: max-content;
    max-width: min(360px, calc(100% - 16px));
    margin: 0;
    padding: 6px 10px;
    border: 1px solid
      color-mix(in srgb, var(--la-danger) 40%, var(--la-section-line));
    border-radius: 8px;
    background: var(--la-surface);
    color: var(--la-danger);
    box-shadow: 0 3px 10px
      color-mix(in srgb, var(--la-text) 10%, transparent);
    font: 600 11px/1.35 var(
      --la-font-family,
      ui-sans-serif,
      system-ui,
      sans-serif
    );
    text-align: center;
    pointer-events: none;
    transform: translateX(-50%);
  }

  /* The live region stays rendered while empty so screen readers announce
     the next message placed in it. */
  .la-edit-status:empty {
    padding: 0;
    border: 0;
    box-shadow: none;
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
const iconCatalog = phosphorIconCatalog.map((name) => {
  const label = name.split("-").join(" ");
  return { name, label, search: `${name} ${label}` };
});
const iconsByName = new Map(iconCatalog.map((icon) => [icon.name, icon]));
const primaryIconRecommendations = recommendedActorIconNames
  .slice(0, 16)
  .map((name) => iconsByName.get(name));
const secondaryIconRecommendations = recommendedActorIconNames
  .slice(16, 48)
  .map((name) => iconsByName.get(name));

// Inline editors and the gap editor's delete control, which sits outside it.
const INLINE_EDITOR_SELECTOR = [
  ".la-inline-actor-editor",
  ".la-inline-group-editor",
  ".la-inline-section-editor",
  ".la-inline-message-editor",
  ".la-inline-gap-editor",
  ".la-inline-gap-delete",
].join(", ");

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
  return point.matrixTransform(svg.getScreenCTM().inverse());
}

function timelineEntries(layout) {
  return [...layout.rows, ...layout.groups].sort(
    (first, second) =>
      first.top - second.top || first.depth - second.depth,
  );
}

function containerBounds(layout, parentId) {
  const controlX = Math.max(
    ACTOR_INSERTION_CONTROL_HALF_WIDTH,
    layout.contentLeft - SIDE_INSERTION_CONTROL_OFFSET,
  );
  if (parentId === ROOT_CONTAINER_ID) {
    return {
      left: layout.contentLeft,
      right: layout.contentRight,
      depth: 0,
      controlX,
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
      controlX,
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
      controlX,
    };
  }
  return null;
}

function timelineSlots(layout) {
  const byParent = new Map();
  for (const entry of timelineEntries(layout)) {
    if (!byParent.has(entry.parentId)) {
      byParent.set(entry.parentId, []);
    }
    byParent.get(entry.parentId).push(entry);
  }

  const slots = [];
  for (const [parentId, entries] of byParent) {
    const bounds = containerBounds(layout, parentId);
    if (!bounds || entries.length === 0) {
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
  const { actors } = layout;
  if (actors.length === 0) {
    return [];
  }

  const slots = [];
  for (let index = 0; index <= actors.length; index += 1) {
    let x;
    if (index === 0) {
      x = actors[0].x - SIDE_INSERTION_CONTROL_OFFSET;
    } else if (index === actors.length) {
      const last = actors[actors.length - 1];
      x = last.x + last.width + SIDE_INSERTION_CONTROL_OFFSET;
    } else {
      const previous = actors[index - 1];
      x = (previous.x + previous.width + actors[index].x) / 2;
    }
    x = Math.max(
      ACTOR_INSERTION_CONTROL_HALF_WIDTH,
      Math.min(
        layout.width - ACTOR_INSERTION_CONTROL_HALF_WIDTH,
        x,
      ),
    );
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

function removePopover(frame) {
  const popover = frame?.querySelector(".la-edit-popover");
  if (!popover) {
    return;
  }
  if (popover.insertionTrigger) {
    delete popover.insertionTrigger.dataset.menuOpen;
  }
  popover.cleanupPositioning();
  popover.hidePopover();
  popover.remove();
}

// Pressing an inline editor's button keeps focus in the editor's field, so
// no engine commits typed text before the button acts. Otherwise WebKit
// would focus the frame, and Chrome and Firefox the button. Focus elsewhere
// moves as usual.
function keepFieldFocus(container, fields = container) {
  container.addEventListener("mousedown", (event) => {
    const active = container.getRootNode().activeElement;
    if (
      event.target.closest("button") &&
      fields.contains(active) &&
      active.matches("input, textarea, select")
    ) {
      event.preventDefault();
    }
  });
}

function inlineContainer(className, label) {
  const container = document.createElement("div");
  container.className = className;
  container.setAttribute("role", "group");
  container.setAttribute("aria-label", label);
  return container;
}

// A one-line text input, or a textarea that starts with one row.
function inlineField(tagName, className, field, label, value, placeholder) {
  const control = document.createElement(tagName);
  if (tagName === "input") {
    control.type = "text";
  } else {
    control.rows = 1;
  }
  control.className = className;
  control.dataset.field = field;
  if (placeholder) {
    control.placeholder = placeholder;
  }
  control.setAttribute("aria-label", label);
  control.value = value;
  return control;
}

function inlineDeleteControl(kind, label) {
  const control = document.createElement("button");
  control.type = "button";
  control.className = `la-inline-delete-control la-inline-${kind}-delete`;
  control.setAttribute("aria-label", label);
  return control;
}

// Hides the rendered elements an inline editor covers and returns the
// function that shows them again.
function hideElements(elements) {
  const previous = elements.map((element) => element.style.visibility);
  for (const element of elements) {
    element.style.visibility = "hidden";
  }
  return () => {
    elements.forEach((element, index) => {
      element.style.visibility = previous[index];
    });
  };
}

function sizeTagPill(control) {
  const width = control.value
    ? metadataMetrics(control.value, false).tagWidth
    : 50;
  control.style.width = `calc(${width}px * var(--la-inline-scale))`;
}

// Shifts an element sideways, through a CSS property on target, until it
// sits inside both the frame and the viewport.
function keepInside(frame, element, property, target = element) {
  target.style.setProperty(property, "0px");
  const rect = element.getBoundingClientRect();
  const frameRect = frame.getBoundingClientRect();
  const leftBoundary = Math.max(8, frameRect.left + 8);
  const rightBoundary = Math.min(innerWidth - 8, frameRect.right - 8);
  let shift = 0;
  if (rect.left < leftBoundary) {
    shift = leftBoundary - rect.left;
  } else if (rect.right > rightBoundary) {
    shift = rightBoundary - rect.right;
  }
  target.style.setProperty(property, `${shift}px`);
}

function removeContextualEditor(frame) {
  removePopover(frame);
  frame?.querySelectorAll(INLINE_EDITOR_SELECTOR).forEach((element) => {
    element.cleanup?.();
    element.remove();
  });
}

function positionPopover(popover, frame, layout, anchor) {
  if (!popover.isConnected) {
    return;
  }
  const svg = frame.querySelector(".la-canvas");
  const svgRect = svg.getBoundingClientRect();
  if (popover.dataset.variant === "insert") {
    const diagramScale = svgRect.width / layout.width;
    popover.style.setProperty(
      "--la-inline-scale",
      String(diagramScale),
    );
  }
  const popoverRect = popover.getBoundingClientRect();
  const viewportWidth = innerWidth;
  const viewportHeight = innerHeight;
  const padding = 8;
  const gap = 10;
  const anchorX =
    svgRect.left + (anchor.x / layout.width) * svgRect.width;
  const anchorY =
    svgRect.top + (anchor.y / layout.height) * svgRect.height;
  let preferredLeft;
  let preferredTop;

  if (popover.dataset.placement === "center-left") {
    preferredLeft = anchorX;
    preferredTop = anchorY - popoverRect.height / 2;
  } else {
    const spaceBelow = viewportHeight - padding - anchorY - gap;
    const spaceAbove = anchorY - gap - padding;
    const below =
      spaceBelow >= popoverRect.height || spaceBelow >= spaceAbove;
    preferredLeft = anchorX - popoverRect.width / 2;
    preferredTop = below
      ? anchorY + gap
      : anchorY - gap - popoverRect.height;
  }
  const maxLeft = Math.max(
    padding,
    viewportWidth - padding - popoverRect.width,
  );
  const maxTop = Math.max(
    padding,
    viewportHeight - padding - popoverRect.height,
  );
  popover.style.left = `${Math.max(
    padding,
    Math.min(preferredLeft, maxLeft),
  )}px`;
  popover.style.top = `${Math.max(padding, Math.min(preferredTop, maxTop))}px`;
}

function observePosition(element, position) {
  let frame = null;
  const reposition = () => {
    if (frame !== null) {
      return;
    }
    frame = requestAnimationFrame(() => {
      frame = null;
      position();
    });
  };
  const resizeObserver = new ResizeObserver(reposition);
  resizeObserver.observe(element);
  // The frame scrolls horizontally below the editor's minimum scale. Its
  // scroll events stay inside the shadow root and never reach the window.
  const scrollingFrame = element.closest(".la-frame");
  scrollingFrame?.addEventListener("scroll", reposition);
  globalThis.addEventListener("scroll", reposition, true);
  globalThis.addEventListener("resize", reposition);

  return {
    reposition,
    disconnect() {
      resizeObserver.disconnect();
      scrollingFrame?.removeEventListener("scroll", reposition);
      globalThis.removeEventListener("scroll", reposition, true);
      globalThis.removeEventListener("resize", reposition);
      if (frame !== null) {
        cancelAnimationFrame(frame);
      }
    },
  };
}

function addPopover(
  frame,
  layout,
  anchor,
  title,
  popoverOptions = {},
) {
  removePopover(frame);
  const popover = document.createElement("div");
  popover.className = "la-edit-popover";
  popover.setAttribute("popover", "manual");
  popover.dataset.placement =
    popoverOptions.placement ?? "vertical";
  if (popoverOptions.variant) {
    popover.dataset.variant = popoverOptions.variant;
  }
  if (popoverOptions.label) {
    popover.setAttribute("role", "dialog");
    popover.setAttribute("aria-label", popoverOptions.label);
  }

  if (title) {
    const header = document.createElement("div");
    header.className = "la-edit-header";
    const heading = document.createElement("strong");
    heading.className = "la-edit-title";
    heading.textContent = title;
    header.append(heading);

    if (popoverOptions.closable) {
      const close = document.createElement("button");
      close.type = "button";
      close.className = "la-edit-close";
      close.setAttribute("aria-label", "Close dialog");
      close.textContent = "×";
      close.addEventListener("click", () => {
        removePopover(frame);
        if (!close.isConnected) {
          frame.focus({ preventScroll: true });
        }
      });
      header.append(close);
    }

    popover.append(header);
  }
  frame.append(popover);
  popover.showPopover();

  const positioning = observePosition(popover, () =>
    positionPopover(popover, frame, layout, anchor),
  );
  popover.cleanupPositioning = () => {
    positioning.disconnect();
  };
  queueMicrotask(() => positionPopover(popover, frame, layout, anchor));
  return popover;
}

function addInsertionPicker(popover, actions) {
  const frame = popover.closest(".la-frame");
  const theme = frame.dataset.theme;
  const picker = document.createElement("div");
  picker.className = "la-insert-picker";
  picker.setAttribute("role", "group");
  picker.setAttribute("aria-label", "Timeline item type");

  for (const action of actions) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "la-insert-option";
    button.setAttribute("aria-label", action.label);
    button.disabled = action.disabled === true;
    button.append(
      iconVisual(
        action.icon,
        theme,
        action.fallback,
      ),
    );
    const label = document.createElement("span");
    label.className = "la-insert-option-label";
    label.textContent = action.visibleLabel ?? action.label;
    button.append(label);
    button.addEventListener("click", action.run);
    picker.append(button);
  }

  popover.append(picker);
}

function normalizeGroupTypeInput(value) {
  return String(value ?? "")
    .toLocaleLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^[^a-z]+/, "");
}

function iconVisual(
  name,
  theme,
  fallbackText,
) {
  const visual = document.createElement("span");
  visual.className = "la-icon-glyph";
  visual.setAttribute("aria-hidden", "true");

  const fallback = document.createElement("span");
  fallback.className = "la-icon-fallback";
  fallback.textContent = fallbackText;
  visual.append(fallback);

  const url = name ? phosphorIconResolver(name, theme) : null;
  if (!url) {
    return visual;
  }

  const image = document.createElement("img");
  image.className = "la-icon-visual";
  image.alt = "";
  image.addEventListener("load", () => {
    fallback.hidden = true;
  });
  image.addEventListener("error", () => {
    image.remove();
  });
  image.src = url;
  visual.append(image);
  return visual;
}

function createIconSelector(
  container,
  currentName,
  onSelect,
  options,
) {
  const catalog = iconCatalog;
  const frame = container.closest(".la-frame");
  const theme = frame.dataset.theme;
  const selector = document.createElement("div");
  selector.className = "la-icon-selector";
  selector.setAttribute("role", "group");
  selector.setAttribute(
    "aria-label",
    options.selectorLabel ?? options.label,
  );

  const search = document.createElement("input");
  search.type = "search";
  search.className = "la-icon-search";
  search.placeholder = "Search icons";
  search.setAttribute("aria-label", "Search icons");

  const clear = document.createElement("button");
  clear.type = "button";
  clear.className = "la-icon-picker-clear";
  clear.setAttribute("aria-label", options.clearLabel);
  clear.append(
    iconVisual(
      "x-circle",
      theme,
      "×",
    ),
  );
  clear.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    onSelect(null);
  });

  const toolbar = document.createElement("div");
  toolbar.className = "la-icon-picker-toolbar";
  toolbar.append(search, clear);
  if (currentName) {
    const current = document.createElement("p");
    current.className = "la-icon-picker-current";
    current.textContent = `Current: ${currentName}`;
    selector.append(current);
  }

  const grid = document.createElement("div");
  grid.className = "la-icon-grid";
  grid.setAttribute("role", "listbox");
  grid.setAttribute("aria-label", "Available icons");

  const appendOption = (icon) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "la-icon-option";
    button.setAttribute("role", "option");
    button.setAttribute("aria-label", icon.label);
    button.setAttribute(
      "aria-selected",
      String(currentName === icon.name),
    );
    button.append(
      iconVisual(
        icon.name,
        theme,
        graphemes(icon.label)[0]?.toUpperCase() ?? "",
      ),
    );
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      onSelect(icon.name);
    });
    grid.append(button);
  };

  const empty = document.createElement("p");
  empty.className = "la-icon-picker-empty";
  empty.hidden = true;

  const renderOptions = () => {
    const query = search.value.trim().toLocaleLowerCase();
    grid.replaceChildren();

    if (!query) {
      for (const icon of primaryIconRecommendations) {
        appendOption(icon);
      }
      const divider = document.createElement("span");
      divider.className = "la-icon-grid-divider";
      divider.setAttribute("aria-hidden", "true");
      grid.append(divider);
      for (const icon of secondaryIconRecommendations) {
        appendOption(icon);
      }
      empty.hidden = true;
      return;
    }

    const matches = catalog
      .filter((icon) => icon.search.includes(query))
      .slice(0, 48);
    for (const icon of matches) {
      appendOption(icon);
    }
    empty.textContent = "No matching icons";
    empty.hidden = matches.length > 0;
  };
  search.addEventListener("input", renderOptions);

  selector.resetSearch = () => {
    search.value = "";
    renderOptions();
  };
  selector.focusSearch = () => search.focus();

  selector.append(toolbar, grid, empty);
  renderOptions();
  return selector;
}

function createInlineTooltipEditor(frame, model, owner, field) {
  const wrapper = document.createElement("div");
  wrapper.className = "la-inline-actor-tooltip-control";

  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "la-inline-actor-tooltip-trigger";
  trigger.setAttribute("aria-label", `Edit ${owner} tooltip`);
  trigger.setAttribute("aria-haspopup", "dialog");
  trigger.setAttribute("aria-expanded", "false");
  trigger.dataset.empty = String(!model.tooltip);
  trigger.append(
    iconVisual(
      model.tooltipIcon,
      frame.dataset.theme ?? "light",
      "i",
    ),
  );

  const dialog = document.createElement("div");
  dialog.className = "la-inline-actor-tooltip-dialog";
  dialog.hidden = true;
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-label", `Edit ${owner} tooltip`);

  const control = inlineField(
    "textarea",
    "la-inline-actor-tooltip-text",
    field,
    `${owner} tooltip text`,
    model.tooltip ?? "",
  );
  control.rows = 2;
  fieldSequence += 1;
  control.id = `la-field-${fieldSequence}`;

  const textField = document.createElement("div");
  textField.className = "la-inline-actor-tooltip-field";
  const label = document.createElement("label");
  label.htmlFor = control.id;
  label.textContent = "Tooltip";
  textField.append(label, control);
  wrapper.append(trigger, dialog);

  return { wrapper, trigger, dialog, control, textField };
}

function appendTooltipIconSelector(
  container,
  tooltip,
  model,
  focusField,
  commit,
) {
  const selector = createIconSelector(
    container,
    model.tooltipIcon,
    (tooltipIcon) => commit({ tooltipIcon }, focusField),
    {
      label: "Choose tooltip icon",
      selectorLabel: "Tooltip icon selector",
      clearLabel: "Default information icon",
      defaultText: "i",
    },
  );
  selector.classList.add("la-inline-tooltip-icon-selector");

  const field = document.createElement("div");
  field.className = "la-inline-actor-tooltip-field";
  const label = document.createElement("span");
  label.textContent = "Icon";
  field.append(label, selector);
  tooltip.dialog.append(tooltip.textField, field);
}

function bindInlineTooltipEditor({
  frame,
  tooltip,
  model,
  dirtyFields,
  commit,
  selectedFocus,
  beforeOpen,
}) {
  let open = false;
  const position = () => {
    if (open && !tooltip.dialog.hidden) {
      keepInside(frame, tooltip.dialog, "--la-inline-tooltip-dialog-shift");
    }
  };
  const close = (
    commitChanges = true,
    restoreFocus = false,
    deferDraw = false,
  ) => {
    if (!open) {
      return "unchanged";
    }
    open = false;
    tooltip.dialog.hidden = true;
    tooltip.trigger.setAttribute("aria-expanded", "false");
    frame.removeEventListener("pointerdown", onOutsidePointerDown);
    const result = commitChanges
      ? commit({}, null, deferDraw)
      : "unchanged";
    if (restoreFocus && result !== "changed") {
      queueMicrotask(() => tooltip.trigger.focus());
    }
    return result;
  };
  const onOutsidePointerDown = (event) => {
    if (tooltip.wrapper.contains(event.target)) {
      return;
    }
    close(false);
    commit({}, null, true);
  };
  const show = (focusText = true) => {
    if (open) {
      return;
    }
    beforeOpen?.();
    open = true;
    tooltip.dialog.hidden = false;
    tooltip.trigger.setAttribute("aria-expanded", "true");
    frame.addEventListener("pointerdown", onOutsidePointerDown);
    queueMicrotask(() => {
      position();
      if (focusText) {
        tooltip.control.focus();
      }
    });
  };

  tooltip.control.addEventListener("input", () => {
    dirtyFields.add("tooltip");
    tooltip.trigger.dataset.empty = String(
      !tooltip.control.value.trim(),
    );
  });
  tooltip.trigger.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (open) {
      close(true, true);
    } else {
      show();
    }
  });
  tooltip.control.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      tooltip.control.value = model.tooltip ?? "";
      dirtyFields.delete("tooltip");
      tooltip.trigger.dataset.empty = String(!model.tooltip);
      close(false, true);
      return;
    }
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      event.stopPropagation();
      if (commit() === "unchanged") {
        close(false, true);
      }
      return;
    }
    event.stopPropagation();
  });
  if (selectedFocus) {
    show(false);
  }

  return {
    position,
    close,
    get open() {
      return open;
    },
    cleanup() {
      frame.removeEventListener("pointerdown", onOutsidePointerDown);
    },
  };
}

function createIconPicker(
  popover,
  currentName,
  onSelect,
  options,
) {
  const frame = popover.closest(".la-frame");
  const theme = frame.dataset.theme;
  const picker = document.createElement("div");
  picker.className = "la-icon-picker";

  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "la-icon-picker-trigger";
  trigger.dataset.field = options.field;
  // Unknown identifiers render the fallback, so the stored name stays
  // reachable through the accessible name, the hover title, and the panel.
  trigger.setAttribute(
    "aria-label",
    currentName
      ? `${options.label}, currently ${currentName}`
      : options.label,
  );
  trigger.setAttribute("aria-haspopup", "dialog");
  trigger.setAttribute("aria-expanded", "false");
  if (currentName) {
    trigger.title = currentName;
  }
  const triggerIconName = currentName || options.defaultIcon || null;
  trigger.append(
    iconVisual(
      triggerIconName,
      theme,
      currentName
        ? graphemes(currentName)[0]?.toUpperCase() ?? ""
        : options.defaultText,
    ),
  );

  const panel = document.createElement("div");
  panel.className = "la-icon-picker-popover";
  panel.hidden = true;
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", options.label);

  const selector = createIconSelector(
    popover,
    currentName,
    onSelect,
    options,
  );
  selector.classList.add("la-icon-picker-selector");

  const close = (restoreFocus = false) => {
    if (panel.hidden) {
      return;
    }
    frame.removeEventListener(
      "pointerdown",
      onOutsidePointerDown,
    );
    panel.hidden = true;
    trigger.setAttribute("aria-expanded", "false");
    if (restoreFocus) {
      trigger.focus();
    }
  };
  picker.closePicker = close;

  const onOutsidePointerDown = (event) => {
    if (!picker.contains(event.target)) {
      close();
    }
  };

  const open = () => {
    for (const other of popover.querySelectorAll(
      ".la-icon-picker",
    )) {
      if (other !== picker) {
        other.closePicker();
      }
    }
    selector.resetSearch();
    panel.hidden = false;
    trigger.setAttribute("aria-expanded", "true");
    frame.addEventListener(
      "pointerdown",
      onOutsidePointerDown,
    );
    queueMicrotask(() => selector.focusSearch());
  };
  picker.openPicker = open;

  trigger.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (panel.hidden) {
      open();
    } else {
      close(true);
    }
  });
  panel.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close(true);
    }
  });
  const dispose = () => {
    frame.removeEventListener(
      "pointerdown",
      onOutsidePointerDown,
    );
    panel.hidden = true;
    trigger.setAttribute("aria-expanded", "false");
  };
  picker.cleanup = dispose;

  panel.append(selector);
  picker.append(trigger, panel);
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

function insertionMark(
  slot,
  label,
  onActivate,
  direction = "horizontal",
  interactionOptions = {},
) {
  const group = svgElement("g", {
    class: "la-insertion",
  });
  if (interactionOptions.controlOnly) {
    group.dataset.controlOnly = "true";
  } else {
    group.setAttribute("tabindex", "0");
    group.setAttribute("role", "button");
    group.setAttribute("aria-label", label);
  }
  let hoverTarget = group;

  if (direction === "horizontal") {
    const controlX =
      slot.controlX ??
      slot.left + TIMELINE_INSERTION_CONTROL_OFFSET;
    const hitLeft = Math.min(slot.left, controlX - 10);
    // A transparent stroke, centered on the edge, widens the pointer target
    // to CONTROL_HIT_SIZE without changing the visible circle.
    const circle = svgElement("circle", {
      class: "la-insertion-circle",
      cx: controlX,
      cy: slot.y,
      r: TIMELINE_INSERTION_CONTROL_RADIUS,
      fill: "var(--la-selection)",
      stroke: "transparent",
      "stroke-width":
        CONTROL_HIT_SIZE - TIMELINE_INSERTION_CONTROL_RADIUS * 2,
      "pointer-events": "all",
    });
    if (interactionOptions.controlOnly) {
      circle.setAttribute("tabindex", "0");
      circle.setAttribute("role", "button");
      circle.setAttribute("aria-label", label);
    }
    group.append(
      svgElement("rect", {
        x: hitLeft,
        y: slot.y - 9,
        width: slot.right - hitLeft,
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
      circle,
    );
    hoverTarget = circle;
    const plus = svgElement("text", {
      class: "la-insertion-plus",
      x: controlX,
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
        x: slot.x - ACTOR_INSERTION_CONTROL_HALF_WIDTH,
        y: slot.y - 27,
        width: ACTOR_INSERTION_CONTROL_HALF_WIDTH * 2,
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

  const activate = (event, mode) => {
    event.preventDefault();
    event.stopPropagation();
    onActivate(group, mode, hoverTarget);
  };
  const activationTarget =
    interactionOptions.controlOnly ? hoverTarget : group;
  activationTarget.addEventListener("click", (event) =>
    activate(event, "pointer"),
  );
  activationTarget.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      activate(event, "keyboard");
    }
  });
  if (interactionOptions.activateOnHover) {
    hoverTarget.addEventListener("pointerenter", () =>
      onActivate(group, "hover", hoverTarget),
    );
    hoverTarget.addEventListener("pointerleave", () =>
      interactionOptions.onPointerLeave?.(group, hoverTarget),
    );
  }
  return group;
}

function reorderHandle(
  ownerId,
  x,
  y,
  onPointerDown,
  radius = REORDER_HANDLE_RADIUS,
) {
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
      r: radius,
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
      fill: "var(--la-surface)",
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

const FOCUSABLE_CONTROL_SELECTOR =
  "a[href], button, input, select, textarea, [tabindex], [contenteditable]";

const OWNER_SELECTOR = "[data-la-id], [data-la-group-header-id]";

function ownerSelector(owner) {
  return owner.dataset.laId !== undefined
    ? `[data-la-id="${CSS.escape(owner.dataset.laId)}"]`
    : `[data-la-group-header-id="${CSS.escape(
        owner.dataset.laGroupHeaderId,
      )}"]`;
}

// Editing forms layered over the diagram. Tab keeps their own DOM order.
const OVERLAY_SELECTOR = `.la-edit-popover, ${INLINE_EDITOR_SELECTOR}`;

// checkVisibility misses SVG content inside a display: none group, such as
// the insertion layer while something is selected; it has no client rects.
function isTabbable(element) {
  return (
    element.tabIndex >= 0 &&
    element.disabled !== true &&
    element.getClientRects().length > 0 &&
    element.checkVisibility({ visibilityProperty: true })
  );
}

function tabbableControls(container) {
  return [...container.querySelectorAll(FOCUSABLE_CONTROL_SELECTOR)].filter(
    isTabbable,
  );
}

// The element a control follows in the Tab order: the diagram item that owns
// it, the insertion mark that opened a popover, or the selected item for its
// inline editor. Controls without an anchor are placed by their position.
function focusAnchor(element, candidates, selectedElement) {
  const overlay = element.closest(OVERLAY_SELECTOR);
  const anchor = overlay
    ? overlay.insertionTrigger ?? selectedElement
    : element.parentElement?.closest(OWNER_SELECTOR);
  if (!anchor) {
    return null;
  }
  const resolved = candidates.has(anchor)
    ? anchor
    : [...anchor.querySelectorAll(FOCUSABLE_CONTROL_SELECTOR)].find(
        (control) => candidates.has(control),
      );
  return resolved && resolved !== element ? resolved : null;
}

// Firefox counts strokes in SVG client rects, so wide transparent hit strokes
// would merge rows there. Fill boxes match in every engine.
function layoutRect(element) {
  if (!(element instanceof SVGGraphicsElement)) {
    return element.getBoundingClientRect();
  }
  const box = element.getBBox();
  const matrix = element.getScreenCTM();
  const start = new DOMPoint(box.x, box.y).matrixTransform(matrix);
  return { left: start.x, top: start.y, height: box.height * matrix.d };
}

// SVG layers put messages before actors and insertion marks last, so the DOM
// order does not match what people see. Tab instead follows the layout:
// visual rows from top to bottom (the header, actors with their insertion
// marks, then timeline rows and the marks between them), left to right within
// a row. Two controls share a row when their vertical centers are closer than
// half the height of the smaller one.
function layoutFocusOrder(frame, selectedElement) {
  const candidates = tabbableControls(frame);
  const candidateSet = new Set(candidates);
  const followers = new Map();
  const roots = [];
  for (const element of candidates) {
    const anchor = focusAnchor(element, candidateSet, selectedElement);
    if (anchor) {
      if (!followers.has(anchor)) {
        followers.set(anchor, []);
      }
      followers.get(anchor).push(element);
    } else {
      roots.push(element);
    }
  }

  const boxes = roots
    .map((element) => {
      const rect = layoutRect(element);
      return {
        element,
        left: rect.left,
        height: rect.height,
        center: rect.top + rect.height / 2,
      };
    })
    .sort((first, second) => first.center - second.center);
  const rows = [];
  for (const box of boxes) {
    const row = rows.at(-1);
    if (
      row &&
      Math.abs(box.center - row.center) <
        Math.min(box.height, row.height) / 2
    ) {
      row.boxes.push(box);
    } else {
      rows.push({ center: box.center, height: box.height, boxes: [box] });
    }
  }

  const order = [];
  const visited = new Set();
  const append = (element) => {
    if (visited.has(element)) {
      return;
    }
    visited.add(element);
    order.push(element);
    for (const follower of followers.get(element) ?? []) {
      append(follower);
    }
  };
  for (const row of rows) {
    row.boxes.sort((first, second) => first.left - second.left);
    for (const box of row.boxes) {
      append(box.element);
    }
  }
  return order;
}

// Leaving forward cannot be left to the browser: its next control in DOM
// order may still be inside the frame. For this one keystroke every other
// frame control leaves the sequential order, so the browser moves past the
// element. The focused control keeps its place; Chrome restarts from the
// frame when the starting point itself is no longer tabbable. The order is
// restored as soon as focus leaves, once the browser has chosen its target.
function releaseFocusForward(frame, current) {
  const controls = [
    ...frame.querySelectorAll(FOCUSABLE_CONTROL_SELECTOR),
  ]
    .filter((control) => control !== current)
    .map((control) => [control, control.getAttribute("tabindex")]);
  for (const [control] of controls) {
    control.setAttribute("tabindex", "-1");
  }
  let restored = false;
  const restore = () => {
    if (restored) {
      return;
    }
    restored = true;
    current.removeEventListener("focusout", restore);
    for (const [control, tabIndex] of controls) {
      if (tabIndex === null) {
        control.removeAttribute("tabindex");
      } else {
        control.setAttribute("tabindex", tabIndex);
      }
    }
  };
  current.addEventListener("focusout", restore);
  setTimeout(restore, 0);
}

function canReceiveFocus(element) {
  return (
    element.disabled !== true &&
    element.getAttribute("aria-disabled") !== "true"
  );
}

function focusElement(element) {
  element.focus({ preventScroll: true });
  if (element.getRootNode().activeElement !== element) {
    return false;
  }
  const placeCaretAtEnd =
    element.classList.contains("la-inline-actor-name") ||
    element.classList.contains("la-inline-group-label") ||
    element.classList.contains("la-inline-message-label");
  if (placeCaretAtEnd) {
    const end = element.value.length;
    element.setSelectionRange(end, end);
  } else if (
    element.classList.contains("la-inline-gap-label") ||
    element.classList.contains("la-inline-group-type") ||
    element.classList.contains("la-inline-section-label")
  ) {
    element.select();
  }
  return true;
}

// Text fields own an undo stack. A select has none, so diagram undo and redo
// keep working while one of the message endpoint selects has focus.
function isEditableField(element) {
  return (
    element.matches("input, textarea") ||
    element.isContentEditable === true
  );
}

// Touch has no hover, so a touch drags only from an affordance that is
// visible: a selected actor or the handles of the selected item. Hover-only
// connection origins and endpoints of unselected messages cover lifelines,
// and claiming touches there would stop the page from scrolling.
function startsTouchDrag(handle) {
  return (
    handle.dataset.visible === "true" ||
    handle.dataset.selected === "true"
  );
}

function applySelectedVisuals(svg, ids) {
  const selected = new Set(ids);
  const hasSelection = selected.size > 0;
  const frame = svg.closest(".la-frame");
  if (frame) {
    frame.dataset.selectionActive = String(hasSelection);
  }
  svg.querySelectorAll("[data-la-id]").forEach((element) => {
    const isSelected = selected.has(element.dataset.laId);
    const isHighlighted =
      isSelected ||
      (!hasSelection &&
        element.matches(":hover, :focus, :focus-visible"));
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
    element.setAttribute(
      "tabindex",
      hasSelection && !isSelected ? "-1" : "0",
    );
    element.querySelectorAll("[tabindex]").forEach((control) => {
      control.setAttribute(
        "tabindex",
        hasSelection && !isSelected ? "-1" : "0",
      );
    });
  });
  svg.querySelectorAll(".la-group-part-hit").forEach((control) => {
    control.setAttribute("tabindex", hasSelection ? "-1" : "0");
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

export function renderEditor(target, editor, options = {}) {
  let selectedIds = [];
  let baseController = null;
  let destroyed = false;
  let activeCancel = null;
  let transient = null;
  let pendingFocus = null;
  // Commits the open inline editor's typed text, focused or not. An
  // editor's focusout also commits unless the editor is disposed, since
  // Chrome fires focusout when a removal or Escape detaches its field.
  let flushInlineEdit = null;
  let pendingInlineDraw = null;
  let pressActive = false;
  let statusTimer = null;
  let inlineDrawAfterPress = null;
  // Set between a Shift+Tab keydown and the next key or pointer event, the
  // window within which the browser moves focus for that keystroke.
  let reverseTabPending = false;
  const trackReverseTab = (event) => {
    reverseTabPending =
      event.type === "keydown" && event.key === "Tab" && event.shiftKey;
  };
  for (const type of ["keydown", "keyup", "pointerdown"]) {
    globalThis.addEventListener(type, trackReverseTab, true);
  }

  function notifyChange() {
    const detail = Object.freeze({
      source: editor.source,
    });
    options.onChange?.(detail);
  }

  function clearStatus() {
    clearTimeout(statusTimer);
    statusTimer = null;
  }

  // Errors without a popover, such as a refused keyboard delete or drop,
  // are explained in the frame's status line until the next redraw.
  function showStatus(error) {
    const frame = baseController?.svg?.closest(".la-frame");
    const status = frame?.querySelector(".la-edit-status");
    if (!status) {
      return;
    }
    clearStatus();
    // Sit below the header row so the status never covers undo and redo.
    const actions = frame.querySelector(".la-header-actions");
    if (actions) {
      const top =
        actions.getBoundingClientRect().bottom -
        frame.getBoundingClientRect().top +
        frame.scrollTop +
        6;
      status.style.top = `${top}px`;
    }
    status.textContent =
      error instanceof Error ? error.message : "The edit could not be applied.";
    statusTimer = setTimeout(() => {
      statusTimer = null;
      status.textContent = "";
    }, STATUS_DURATION);
  }

  function notifyError(error, popover = null) {
    if (popover) {
      showError(popover, error);
    } else {
      showStatus(error);
    }
    options.onError?.(error);
  }

  function run(
    command,
    selection = undefined,
    popover = null,
    focusField = null,
    errorResult = null,
  ) {
    if (destroyed) {
      return errorResult;
    }
    const previousDocument = editor.document;
    try {
      const result = command();
      if (editor.document === previousDocument) {
        return result;
      }
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
      return errorResult;
    }
  }

  // A refused removal keeps the inline editor's typed text pending.
  function runRemoval(command, popover = null) {
    return run(
      () => {
        command();
        return true;
      },
      [],
      popover,
      null,
      false,
    );
  }

  function focusPendingField(frame, defer = false) {
    if (!pendingFocus) {
      return false;
    }
    const field = frame.querySelector(
      `[data-field="${CSS.escape(pendingFocus)}"]`,
    );
    pendingFocus = null;
    if (!field || !canReceiveFocus(field)) {
      return false;
    }
    if (defer) {
      queueMicrotask(() => {
        if (field.isConnected) {
          focusElement(field);
        }
      });
      return true;
    }
    return focusElement(field);
  }

  // Redraws replace the frame, so focus is described by a key that
  // survives the swap: a data-field, a selectable's model id, the frame, or
  // a control's class, position, and label.
  function captureFocus(frame) {
    if (!frame?.isConnected) {
      return null;
    }
    const active = frame.getRootNode().activeElement;
    if (!active || !frame.contains(active)) {
      return null;
    }
    if (active === frame) {
      return { frame: true };
    }
    if (active.classList.contains("la-selectable")) {
      return { id: active.dataset.laId };
    }
    if (active.dataset.field) {
      return {
        field: active.dataset.field,
        history: active.classList.contains("la-history-control"),
      };
    }
    const className = active.classList[0];
    if (!className) {
      return { frame: true };
    }
    // Controls such as tooltip triggers repeat per item, so they are
    // located within the diagram item that owns them.
    const owner = active.closest(OWNER_SELECTOR);
    const scope = owner ?? frame;
    return {
      owner: owner ? ownerSelector(owner) : null,
      className,
      index: [
        ...scope.querySelectorAll(`.${CSS.escape(className)}`),
      ].indexOf(active),
      label: active.getAttribute("aria-label"),
    };
  }

  function restoreFocus(frame, key) {
    if (!key || !frame.isConnected) {
      return;
    }
    const selectable = (id) =>
      frame.querySelector(
        `.la-selectable[data-la-id="${CSS.escape(id)}"]`,
      );
    const candidates = [];
    if (key.field) {
      candidates.push(
        frame.querySelector(`[data-field="${CSS.escape(key.field)}"]`),
      );
    }
    if (key.history) {
      candidates.push(...frame.querySelectorAll(".la-history-control"));
    }
    if (key.id) {
      candidates.push(selectable(key.id));
    }
    const scope = key.owner ? frame.querySelector(key.owner) : frame;
    if (key.className && scope) {
      const match = scope.querySelectorAll(
        `.${CSS.escape(key.className)}`,
      )[key.index];
      if (match?.getAttribute("aria-label") === key.label) {
        candidates.push(match);
      }
    }
    candidates.push(...selectedIds.map(selectable), frame);
    for (const candidate of candidates) {
      if (
        candidate &&
        canReceiveFocus(candidate) &&
        focusElement(candidate)
      ) {
        return;
      }
    }
  }

  // Selection shortcuts act only from the frame itself or from a selected
  // element; buttons and fields inside or around it keep their own keys.
  function targetsSelection(frame, target) {
    if (target === frame) {
      return true;
    }
    const selectable = target.closest(".la-selectable");
    return (
      selectable !== null &&
      selectedIds.includes(selectable.dataset.laId) &&
      target.closest(FOCUSABLE_CONTROL_SELECTOR) === selectable
    );
  }

  function moveFocusInLayoutOrder(frame, event) {
    const current = event.target;
    const moveAlong = (controls) => {
      const step = event.shiftKey ? -1 : 1;
      for (
        let position = controls.indexOf(current) + step;
        position >= 0 && position < controls.length;
        position += step
      ) {
        const next = controls[position];
        next.focus();
        if (frame.getRootNode().activeElement === next) {
          event.preventDefault();
          // As sequential navigation does, select a text field's value.
          if (next instanceof HTMLInputElement) {
            next.select();
          }
          return true;
        }
      }
      return false;
    };
    // Editing forms keep their DOM order, but Safari's own Tab skips their
    // buttons by default, so the element moves focus within them as well.
    const overlay = current.closest(OVERLAY_SELECTOR);
    if (overlay) {
      const controls = tabbableControls(overlay);
      if (!controls.includes(current) || moveAlong(controls)) {
        return;
      }
    }
    const selectedElement = selectedIds.length
      ? frame.querySelector(
          `.la-selectable[data-la-id="${CSS.escape(selectedIds[0])}"]`,
        )
      : null;
    const order = [frame, ...layoutFocusOrder(frame, selectedElement)];
    if (!order.includes(current) || moveAlong(order)) {
      return;
    }
    if (!event.shiftKey) {
      releaseFocusForward(frame, current);
    }
  }

  // Shift+Tab from after the element enters at the frame's last control in
  // DOM order, which is not the end of the layout order. Keyboard entry from
  // a later element moves on to the last control in layout order instead.
  // Only a pending Shift+Tab counts: clicks and host scripts that focus a
  // control keep it, even when the browser marks it :focus-visible.
  function enterFromEnd(frame, event) {
    const from = event.relatedTarget;
    if (!reverseTabPending || !from || frame.contains(from)) {
      return;
    }
    let host = frame;
    while (
      host.getRootNode() !== from.getRootNode() &&
      host.getRootNode().host
    ) {
      host = host.getRootNode().host;
    }
    const position = host.compareDocumentPosition(from);
    if (
      host.getRootNode() !== from.getRootNode() ||
      host.contains(from) ||
      !(position & Node.DOCUMENT_POSITION_FOLLOWING)
    ) {
      return;
    }
    const selectedElement = selectedIds.length
      ? frame.querySelector(
          `.la-selectable[data-la-id="${CSS.escape(selectedIds[0])}"]`,
        )
      : null;
    const last = layoutFocusOrder(frame, selectedElement).at(-1);
    if (last && last !== event.target) {
      last.focus();
    }
  }

  function cancelInlineEditor(event, frame) {
    event.preventDefault();
    event.stopPropagation();
    pendingFocus = null;
    transient = null;
    selectedIds = [];
    removeContextualEditor(frame);
    applySelectedVisuals(baseController.svg, selectedIds);
    frame.focus();
  }

  function activateModel(id, focusField = null) {
    const model = selectedModel(editor.document, id);
    if (!model) {
      return;
    }
    transient = null;
    selectedIds = [id];
    pendingFocus =
      focusField ??
      (model.type === "gap"
        ? "gap-label"
        : model.type === "actor"
          ? "actor-name"
          : model.type === "group"
            ? "group-label"
            : model.type === "section"
              ? "section-label"
              : "message-label");
    const { svg, layout } = baseController;
    applySelectedVisuals(svg, selectedIds);
    const frame = svg.closest(".la-frame");
    contextualEditor(frame, layout);
    focusPendingField(frame, true);
  }

  function cancelInlineDraw() {
    if (pendingInlineDraw !== null) {
      clearTimeout(pendingInlineDraw);
      pendingInlineDraw = null;
    }
    inlineDrawAfterPress = null;
  }

  // A focusout commit redraws on a timer. While a press is held, the redraw
  // waits for its release so the press's click still reaches the element it
  // started on, such as another item that should become selected.
  function scheduleInlineDraw(frame) {
    cancelInlineDraw();
    const redraw = () => {
      pendingInlineDraw = null;
      if (destroyed) {
        return;
      }
      // The selection may have moved to an editor with new typed text.
      flushInlineEdit?.(true);
      if (frame.querySelector(".la-inline-gap-label:focus")) {
        pendingFocus = "gap-label";
      }
      draw();
    };
    if (pressActive) {
      inlineDrawAfterPress = redraw;
      return;
    }
    pendingInlineDraw = setTimeout(redraw, 0);
  }

  function trackPress(event) {
    if (event.button !== 0 || pressActive) {
      return;
    }
    pressActive = true;
    // A press can also end without pointerup, when a context menu opens or
    // the window loses focus.
    const release = () => {
      globalThis.removeEventListener("pointerup", release, true);
      globalThis.removeEventListener("pointercancel", release, true);
      globalThis.removeEventListener("contextmenu", release, true);
      globalThis.removeEventListener("blur", release);
      // The click follows pointerup within the same task.
      setTimeout(() => {
        pressActive = false;
        const redraw = inlineDrawAfterPress;
        inlineDrawAfterPress = null;
        redraw?.();
      }, 0);
    };
    globalThis.addEventListener("pointerup", release, true);
    globalThis.addEventListener("pointercancel", release, true);
    globalThis.addEventListener("contextmenu", release, true);
    globalThis.addEventListener("blur", release);
  }

  // Enter commits a field and Escape closes its editor. In a textarea,
  // Shift+Enter adds a line. Other keys stay with the field.
  function bindInlineKeys(frame, control, enter) {
    control.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        cancelInlineEditor(event, frame);
        return;
      }
      if (
        event.key === "Enter" &&
        !(event.shiftKey && control.localName === "textarea")
      ) {
        event.preventDefault();
        event.stopPropagation();
        enter();
        return;
      }
      event.stopPropagation();
    });
  }

  // Presses and clicks inside an inline editor stay there, and focus that
  // leaves it, other than to the outside element, commits. The returned
  // function disposes the editor.
  function bindInlineContainer(container, leave, pointerDown, outside) {
    let disposed = false;
    container.addEventListener("pointerdown", (event) => {
      pointerDown?.(event);
      event.stopPropagation();
    });
    container.addEventListener("click", (event) => {
      event.stopPropagation();
    });
    container.addEventListener("focusout", (event) => {
      if (
        disposed ||
        container.contains(event.relatedTarget) ||
        outside?.contains(event.relatedTarget)
      ) {
        return;
      }
      leave();
    });
    return () => {
      disposed = true;
      flushInlineEdit = null;
    };
  }

  // The shared wiring of the actor, group, section, and message editors.
  // Edited fields join the patch, and Enter or Escape in a field of
  // `fields` commits or cancels; `trackedFields`, such as selects and the
  // tooltip text, track their own edits and keys. A commit that leaves the
  // document unchanged reloads every field from it. A field marked
  // keepTyped keeps its text when the item has no such value; the others
  // become empty.
  function inlineEditorSession(frame, container, config) {
    const { id, update, remove, deleteControl, reloaded } = config;
    const fields = [...config.fields, ...(config.trackedFields ?? [])];
    const dirty = new Set();
    frame.append(container);
    keepFieldFocus(container);

    const commit = (
      extraPatch = {},
      focusField = null,
      deferDraw = false,
    ) => {
      if (destroyed) {
        return "unchanged";
      }
      const previousDocument = editor.document;
      const patch = { ...extraPatch };
      for (const [key, control] of fields) {
        if (dirty.has(key)) {
          patch[key] = control.value;
        }
      }
      if (Object.keys(patch).length === 0) {
        return "unchanged";
      }
      try {
        update(patch);
        if (editor.document === previousDocument) {
          const current = selectedModel(editor.document, id);
          for (const [key, control, keepTyped] of fields) {
            control.value =
              current?.[key] ?? (keepTyped ? control.value : "");
          }
          dirty.clear();
          reloaded?.();
          return "unchanged";
        }
        dirty.clear();
        selectedIds = [id];
        transient = null;
        pendingFocus = focusField;
        notifyChange();
        if (deferDraw) {
          scheduleInlineDraw(frame);
        } else {
          draw();
        }
        return "changed";
      } catch (error) {
        notifyError(error, container);
        return "error";
      }
    };
    flushInlineEdit = (deferDraw) => commit({}, null, deferDraw);

    for (const [key, control] of config.fields) {
      control.addEventListener("input", () => {
        dirty.add(key);
      });
      bindInlineKeys(frame, control, () => commit());
    }
    deleteControl.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      runRemoval(remove);
    });
    const dispose = bindInlineContainer(
      container,
      () => {
        config.leave?.();
        commit({}, null, true);
      },
      config.pointerDown,
    );

    return {
      commit,
      dirty,
      // Positions the editor now and whenever the diagram moves.
      start(observed, position, cleanup) {
        const place = () => {
          if (container.isConnected) {
            position();
          }
        };
        const positioning = observePosition(observed, place);
        container.cleanup = () => {
          dispose();
          positioning.disconnect();
          cleanup();
        };
        place();
      },
    };
  }

  function addInlineActorEditor(frame, layout, model) {
    const actor = layout.actors.find(
      (candidate) => candidate.id === model.id,
    );
    const actorElement = frame.querySelector(
      `[data-la-id="${CSS.escape(model.id)}"]`,
    );
    const actorShape = actorElement?.querySelector(
      ".la-actor-shape",
    );
    if (!actor || !actorElement || !actorShape) {
      return;
    }

    const restoreHidden = hideElements([
      ...actorElement.querySelectorAll(
        ".la-actor-icon-trigger, .la-actor-icon-fallback, .la-actor-icon, .la-actor-label, .la-tag, .la-tooltip-trigger",
      ),
    ]);

    const inlineEditor = inlineContainer(
      "la-inline-actor-editor",
      `Edit actor ${model.name}`,
    );

    const card = document.createElement("div");
    card.className = "la-inline-actor-card";

    const nameControl = inlineField(
      "input",
      "la-inline-actor-name",
      "actor-name",
      "Actor name",
      model.name,
    );

    const metadata = document.createElement("div");
    metadata.className = "la-inline-actor-metadata";

    const tagControl = inlineField(
      "input",
      "la-inline-actor-pill",
      "actor-tag",
      "Actor tag",
      model.tag ?? "",
      "Tag",
    );
    sizeTagPill(tagControl);
    tagControl.addEventListener("input", () => sizeTagPill(tagControl));

    const tooltip = createInlineTooltipEditor(
      frame,
      model,
      "actor",
      "actor-tooltip-text",
    );

    const deleteControl = inlineDeleteControl(
      "actor",
      "Delete actor and messages",
    );

    metadata.append(tagControl, tooltip.wrapper);
    card.append(nameControl, deleteControl);
    inlineEditor.append(card, metadata);

    const { commit, dirty, start } = inlineEditorSession(
      frame,
      inlineEditor,
      {
        id: model.id,
        update: (patch) => editor.updateActor(model.id, patch),
        remove: () => editor.removeActor(model.id),
        deleteControl,
        fields: [
          ["name", nameControl, true],
          ["tag", tagControl],
        ],
        trackedFields: [["tooltip", tooltip.control]],
        reloaded: () => sizeTagPill(tagControl),
        pointerDown: (event) => {
          if (!iconPicker.contains(event.target)) {
            iconPicker.closePicker();
          }
          if (
            tooltipEditor.open &&
            !tooltip.wrapper.contains(event.target)
          ) {
            tooltipEditor.close(false);
          }
        },
        leave: () => tooltipEditor.close(false),
      },
    );

    const iconPicker = createIconPicker(
      inlineEditor,
      model.icon,
      (icon) => {
        const result = commit({ icon }, "actor-icon-trigger");
        if (result === "unchanged") {
          iconPicker.closePicker(true);
        }
      },
      {
        label: "Choose actor icon",
        clearLabel: "No actor icon",
        defaultIcon: "user",
        defaultText: "+",
        field: "actor-icon-trigger",
      },
    );
    iconPicker.classList.add("la-inline-actor-icon-picker");
    iconPicker.dataset.empty = String(!model.icon);
    card.prepend(iconPicker);
    if (pendingFocus === "actor-icon") {
      iconPicker.openPicker();
    }

    appendTooltipIconSelector(
      inlineEditor,
      tooltip,
      model,
      "actor-tooltip-text",
      commit,
    );

    const tooltipEditor = bindInlineTooltipEditor({
      frame,
      tooltip,
      model,
      dirtyFields: dirty,
      commit,
      selectedFocus: pendingFocus === "actor-tooltip-text",
      beforeOpen: () => iconPicker.closePicker(),
    });

    start(
      actorShape.ownerSVGElement,
      () => {
        const rect = actorShape.getBoundingClientRect();
        const scale = rect.height / actor.height;
        inlineEditor.style.left = `${rect.left}px`;
        inlineEditor.style.top = `${rect.top}px`;
        inlineEditor.style.width = `${rect.width}px`;
        inlineEditor.style.height = `${rect.height}px`;
        inlineEditor.style.setProperty(
          "--la-inline-scale",
          String(scale),
        );
        keepInside(
          frame,
          metadata,
          "--la-inline-actor-metadata-shift",
          inlineEditor,
        );
        tooltipEditor.position();
      },
      () => {
        tooltipEditor.cleanup();
        iconPicker.cleanup();
        restoreHidden();
      },
    );
  }

  function addInlineGroupEditor(frame, layout, model) {
    const group = layout.groups.find(
      (candidate) => candidate.id === model.id,
    );
    const header = frame.querySelector(
      `[data-la-group-header-id="${CSS.escape(model.id)}"]`,
    );
    const svg = header?.ownerSVGElement;
    if (!group || !header || !svg) {
      return;
    }

    const restoreHidden = hideElements([header]);

    const inlineEditor = inlineContainer(
      "la-inline-group-editor",
      `Edit ${model.groupType} group${model.label ? `, ${model.label}` : ""}`,
    );

    const row = document.createElement("div");
    row.className = "la-inline-group-row";

    const groupField = (name, control) => {
      const field = document.createElement("div");
      field.className = "la-inline-group-field";
      const fieldName = document.createElement("span");
      fieldName.className = "la-inline-group-field-name";
      fieldName.textContent = name;
      fieldName.setAttribute("aria-hidden", "true");
      field.append(fieldName, control);
      return field;
    };

    const typeControl = inlineField(
      "input",
      "la-inline-group-type",
      "group-type",
      "Group type",
      model.groupType,
      "Type",
    );
    typeControl.pattern = GROUP_TYPE_PATTERN_SOURCE;
    const typeField = groupField("Type", typeControl);

    const labelControl = inlineField(
      "textarea",
      "la-inline-group-label",
      "group-label",
      "Group label",
      model.label ?? "",
      "Label",
    );
    const labelField = groupField("Label", labelControl);
    labelField.classList.add("la-inline-group-label-field");

    const actions = document.createElement("div");
    actions.className = "la-inline-group-actions";

    const addSectionControl = document.createElement("button");
    addSectionControl.type = "button";
    addSectionControl.className = "la-inline-group-action";
    addSectionControl.textContent = "Add section";

    const ungroupControl = document.createElement("button");
    ungroupControl.type = "button";
    ungroupControl.className = "la-inline-group-action";
    ungroupControl.textContent = "Ungroup";

    const deleteControl = inlineDeleteControl(
      "group",
      "Delete group and contents",
    );

    actions.append(addSectionControl, ungroupControl, deleteControl);
    row.append(typeField, labelField, actions);
    inlineEditor.append(row);

    const sizeTypePill = () => {
      const content = typeControl.value || typeControl.placeholder;
      const width = Math.min(
        120,
        Math.max(52, estimatedTextWidth(content, 11) + 18),
      );
      typeControl.style.width =
        `calc(${width}px * var(--la-inline-scale))`;
    };
    sizeTypePill();

    typeControl.addEventListener("input", () => {
      const normalized = normalizeGroupTypeInput(typeControl.value);
      if (typeControl.value !== normalized) {
        typeControl.value = normalized;
      }
      sizeTypePill();
    });

    const { commit, start } = inlineEditorSession(frame, inlineEditor, {
      id: model.id,
      update: (patch) => editor.updateItem(model.id, patch),
      remove: () => editor.removeItem(model.id),
      deleteControl,
      fields: [
        ["groupType", typeControl, true],
        ["label", labelControl, true],
      ],
      reloaded: sizeTypePill,
    });

    const flushBeforeAction = () => commit({}, null, true) !== "error";
    addSectionControl.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (!flushBeforeAction()) {
        return;
      }
      const current = findItemLocation(editor.document, model.id)?.item;
      run(
        () =>
          current && groupSections(current)
            ? editor.addSection(model.id)
            : editor.convertGroupToSections(model.id),
        [model.id],
      );
    });
    ungroupControl.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (!flushBeforeAction()) {
        return;
      }
      run(() => editor.ungroup(model.id));
    });

    start(
      svg,
      () => {
        const svgRect = svg.getBoundingClientRect();
        const diagramScale = svgRect.width / layout.width;
        inlineEditor.style.left = `${
          svgRect.left +
          (group.left + GROUP_EDITOR_LEFT_INSET) * diagramScale
        }px`;
        inlineEditor.style.top = `${
          svgRect.top + (group.top + 5) * diagramScale
        }px`;
        inlineEditor.style.width = `${
          (group.right -
            group.left -
            GROUP_EDITOR_LEFT_INSET -
            GROUP_EDITOR_RIGHT_INSET) *
          diagramScale
        }px`;
        inlineEditor.style.height = `${20 * diagramScale}px`;
        row.style.inset = "0";
        inlineEditor.style.setProperty(
          "--la-inline-scale",
          String(diagramScale),
        );
      },
      restoreHidden,
    );
  }

  function addInlineSectionEditor(frame, layout, model) {
    const section = layout.sections.find(
      (candidate) => candidate.id === model.id,
    );
    const sectionElement = frame.querySelector(
      `[data-la-id="${CSS.escape(model.id)}"]`,
    );
    const svg = sectionElement?.ownerSVGElement;
    const label = sectionElement?.querySelector(".la-section-label");
    if (!section || !sectionElement || !svg || !label) {
      return;
    }
    const rightRule = Array.from(
      sectionElement.querySelectorAll(".la-section-line"),
    ).find(
      (line) => Number(line.getAttribute("x1")) > section.left,
    );

    const previousRightRuleStart = rightRule?.getAttribute("x1");
    const restoreHidden = hideElements([label]);

    const inlineEditor = inlineContainer(
      "la-inline-section-editor",
      `Edit section ${model.label}`,
    );

    const labelControl = inlineField(
      "textarea",
      "la-inline-section-label",
      "section-label",
      "Section label",
      model.label,
    );
    labelControl.rows = Math.max(1, model.label.split("\n").length);
    labelControl.wrap = "off";

    const deleteControl = inlineDeleteControl("section", "Delete section");

    inlineEditor.append(labelControl, deleteControl);

    const labelLeft = section.left + 10;
    const ruleGap = 4;
    const sizeLabel = () => {
      const longestLineWidth = Math.max(
        5.6,
        ...labelControl.value
          .split("\n")
          .map((line) => estimatedTextWidth(line, 10)),
      );
      const availableWidth = Math.max(
        20,
        section.right - section.left - 44,
      );
      const labelWidth = Math.min(
        availableWidth,
        Math.max(52, longestLineWidth + 16),
      );
      labelControl.style.width =
        `calc(${labelWidth}px * var(--la-inline-scale))`;
      rightRule?.setAttribute(
        "x1",
        String(labelLeft + labelWidth + ruleGap),
      );
    };
    sizeLabel();
    labelControl.addEventListener("input", sizeLabel);

    const { start } = inlineEditorSession(frame, inlineEditor, {
      id: model.id,
      update: (patch) => editor.updateSection(model.id, patch),
      remove: () => editor.removeSection(model.id),
      deleteControl,
      fields: [["label", labelControl, true]],
    });

    start(
      svg,
      () => {
        const svgRect = svg.getBoundingClientRect();
        const diagramScale = svgRect.width / layout.width;
        const editorHeight = section.headerHeight - 7;
        inlineEditor.style.left = `${
          svgRect.left + (section.left + 10) * diagramScale
        }px`;
        inlineEditor.style.top = `${
          svgRect.top + (section.top + 3) * diagramScale
        }px`;
        inlineEditor.style.width = `${
          (section.right - section.left) * diagramScale
        }px`;
        inlineEditor.style.height = `${editorHeight * diagramScale}px`;
        inlineEditor.style.setProperty(
          "--la-inline-scale",
          String(diagramScale),
        );
      },
      () => {
        restoreHidden();
        if (rightRule && previousRightRuleStart !== null) {
          rightRule.setAttribute("x1", previousRightRuleStart);
        }
      },
    );
  }

  function addInlineMessageEditor(frame, layout, model) {
    const row = layout.rows.find(
      (candidate) => candidate.id === model.id,
    );
    const messageElement = frame.querySelector(
      `[data-la-id="${CSS.escape(model.id)}"]`,
    );
    const svg = messageElement?.ownerSVGElement;
    const source = row
      ? layout.actorByName.get(row.source)
      : null;
    const target = row
      ? layout.actorByName.get(row.target)
      : null;
    if (!row || !messageElement || !svg || !source || !target) {
      return;
    }

    const restoreHidden = hideElements([
      ...messageElement.querySelectorAll(
        ".la-message-label, .la-tag, .la-tooltip-trigger",
      ),
    ]);

    const inlineEditor = inlineContainer(
      "la-inline-message-editor",
      `Edit arrow from ${model.source} to ${model.target}`,
    );

    const labelControl = inlineField(
      "textarea",
      "la-inline-message-label",
      "message-label",
      "Arrow label",
      model.label ?? "",
      "Label",
    );
    labelControl.addEventListener("input", () => positionEditor());

    const deleteControl = inlineDeleteControl("message", "Delete arrow");

    const metadata = document.createElement("div");
    metadata.className = "la-inline-message-metadata";

    const tagControl = inlineField(
      "input",
      "la-inline-actor-pill",
      "message-tag",
      "Arrow tag",
      model.tag ?? "",
      "Tag",
    );
    sizeTagPill(tagControl);
    tagControl.addEventListener("input", () => sizeTagPill(tagControl));

    const tooltip = createInlineTooltipEditor(
      frame,
      model,
      "arrow",
      "message-tooltip-text",
    );

    metadata.append(tagControl, tooltip.wrapper);
    inlineEditor.append(
      labelControl,
      deleteControl,
      metadata,
    );

    // Endpoints can also be dragged; these controls are the keyboard path.
    const endpointControl = (endpoint) => {
      const control = document.createElement("select");
      control.className = "la-inline-message-endpoint";
      control.dataset.field = `message-${endpoint}`;
      control.setAttribute(
        "aria-label",
        endpoint === "source" ? "Arrow source" : "Arrow target",
      );
      for (const actor of editor.document.actors) {
        const option = document.createElement("option");
        option.value = actor.name;
        option.textContent = actor.name;
        control.append(option);
      }
      control.value = model[endpoint];
      // A closed select changes its value on every arrow key or type-ahead
      // letter. Keyboard changes wait for Enter or for focus to leave the
      // editor, like the text fields, so one choice is one undo step; a
      // choice from the open list applies at once.
      let typing = false;
      control.addEventListener("change", () => {
        if (typing) {
          dirty.add(endpoint);
        } else {
          dirty.delete(endpoint);
          commit({ [endpoint]: control.value }, `message-${endpoint}`);
        }
      });
      control.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
          cancelInlineEditor(event, frame);
          return;
        }
        if (event.key === "Enter") {
          event.preventDefault();
          event.stopPropagation();
          commit({}, `message-${endpoint}`);
          return;
        }
        typing = true;
      });
      control.addEventListener("keyup", () => {
        typing = false;
      });
      control.addEventListener("pointerdown", () => {
        typing = false;
      });
      return control;
    };
    const sourceControl = endpointControl("source");
    const targetControl = endpointControl("target");

    const { commit, dirty, start } = inlineEditorSession(
      frame,
      inlineEditor,
      {
        id: model.id,
        update: (patch) => editor.updateItem(model.id, patch),
        remove: () => editor.removeItem(model.id),
        deleteControl,
        fields: [
          ["label", labelControl],
          ["tag", tagControl],
        ],
        trackedFields: [
          ["tooltip", tooltip.control],
          ["source", sourceControl, true],
          ["target", targetControl, true],
        ],
        reloaded: () => sizeTagPill(tagControl),
        pointerDown: (event) => {
          if (
            tooltipEditor.open &&
            !tooltip.wrapper.contains(event.target)
          ) {
            tooltipEditor.close(false);
          }
        },
        leave: () => tooltipEditor.close(false),
      },
    );

    const arrowStyles = document.createElement("div");
    arrowStyles.className = "la-inline-message-arrow-styles";
    arrowStyles.setAttribute("role", "group");
    arrowStyles.setAttribute("aria-label", "Arrow type");
    const arrowPointsLeft = source.centerX >= target.centerX;
    for (const option of [
      { value: "->", label: "Solid arrow" },
      { value: "-->", label: "Dashed arrow" },
      { value: "->x", label: "Lost message" },
    ]) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "la-inline-message-arrow-style";
      button.dataset.field = `message-arrow-${option.value}`;
      button.setAttribute("aria-label", option.label);
      button.setAttribute(
        "aria-pressed",
        String(model.arrow === option.value),
      );

      const preview = svgElement("svg", {
        viewBox: "0 0 24 16",
        "aria-hidden": "true",
      });
      if (arrowPointsLeft) {
        preview.style.transform = "scaleX(-1)";
      }
      const lineEnd = option.value === "->x" ? 16 : 20;
      const line = svgElement("line", {
        x1: 3,
        y1: 8,
        x2: lineEnd,
        y2: 8,
        stroke: "currentColor",
        "stroke-width": 1.5,
        "stroke-linecap": "round",
      });
      if (option.value === "-->") {
        line.setAttribute("stroke-dasharray", "3 3");
      }
      preview.append(line);
      if (option.value === "->x") {
        preview.append(
          svgElement("path", {
            d: "M 16.5 4.5 L 22 11.5 M 22 4.5 L 16.5 11.5",
            fill: "none",
            stroke: "currentColor",
            "stroke-width": 1.5,
            "stroke-linecap": "round",
          }),
        );
      } else {
        preview.append(
          svgElement("path", {
            d: "M 16 4 L 21 8 L 16 12",
            fill: "none",
            stroke: "currentColor",
            "stroke-width": 1.5,
            "stroke-linecap": "round",
            "stroke-linejoin": "round",
          }),
        );
      }
      button.append(preview);
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        commit(
          { arrow: option.value },
          `message-arrow-${option.value}`,
        );
      });
      arrowStyles.append(button);
    }

    const toolbar = document.createElement("div");
    toolbar.className = "la-inline-message-toolbar";
    // Each endpoint control sits on its actor's side of the arrow.
    if (source.centerX > target.centerX) {
      toolbar.append(targetControl, arrowStyles, sourceControl);
    } else {
      toolbar.append(sourceControl, arrowStyles, targetControl);
    }
    // The toolbar sits above the label, so it comes first in Tab order too.
    inlineEditor.prepend(toolbar);

    appendTooltipIconSelector(
      inlineEditor,
      tooltip,
      model,
      "message-tooltip-text",
      commit,
    );

    const tooltipEditor = bindInlineTooltipEditor({
      frame,
      tooltip,
      model,
      dirtyFields: dirty,
      commit,
      selectedFocus: pendingFocus === "message-tooltip-text",
    });

    const positionEditor = () => {
      const svgRect = svg.getBoundingClientRect();
      const diagramScale = svgRect.width / layout.width;
      inlineEditor.style.left = `${svgRect.left}px`;
      inlineEditor.style.top = `${svgRect.top}px`;
      inlineEditor.style.width = `${svgRect.width}px`;
      inlineEditor.style.height = `${svgRect.height}px`;
      inlineEditor.style.setProperty(
        "--la-inline-scale",
        String(diagramScale),
      );

      const selfMessage = source.centerX === target.centerX;
      const loopWidth = selfMessage
        ? selfMessageWidth(
            row,
            layout.options.messageLabelMaxWidth,
          )
        : 0;
      const labelX = selfMessage
        ? source.centerX + loopWidth / 2
        : (source.centerX + target.centerX) / 2;
      const labelY = selfMessage ? row.y - 20 : row.y - 7;
      // Match the rendered label, which may use the full arrow span.
      const labelSpan = selfMessage
        ? loopWidth
        : Math.abs(target.centerX - source.centerX);
      const labelMetrics = messageLabelMetrics(
        labelControl.value,
        labelSpan,
      );
      const labelTextHeight = Math.max(13, labelMetrics.height);
      const labelWidth = Math.max(
        60,
        (labelMetrics.textWidth || 50) + 10,
      );
      const labelHeight = Math.max(18, labelTextHeight + 5);
      const labelTop = labelY - labelTextHeight + 1;
      labelControl.style.left = `${
        (labelX - labelWidth / 2) * diagramScale
      }px`;
      labelControl.style.top = `${labelTop * diagramScale}px`;
      labelControl.style.width = `${labelWidth * diagramScale}px`;
      labelControl.style.height = `${labelHeight * diagramScale}px`;
      const deleteSize = 16;
      const deleteGap = 12;
      const arrowRight = selfMessage
        ? source.centerX + loopWidth
        : Math.max(source.centerX, target.centerX);
      deleteControl.style.left = `${
        (arrowRight + deleteGap + deleteSize / 2) * diagramScale
      }px`;
      deleteControl.style.top = `${row.y * diagramScale}px`;

      metadata.style.left = `${labelX * diagramScale}px`;
      metadata.style.top = `${
        (row.y + (selfMessage ? 18 : 5)) * diagramScale
      }px`;

      toolbar.style.left = `${labelX * diagramScale}px`;
      toolbar.style.top = `${(labelTop - 12) * diagramScale}px`;

      keepInside(frame, metadata, "--la-inline-message-metadata-shift");
      keepInside(frame, toolbar, "--la-inline-message-toolbar-shift");
      tooltipEditor.position();
    };

    start(svg, positionEditor, () => {
      tooltipEditor.cleanup();
      restoreHidden();
    });
  }

  function addInlineGapEditor(frame, layout, model) {
    const row = layout.rows.find(
      (candidate) => candidate.id === model.id,
    );
    const gap = frame.querySelector(
      `[data-la-id="${CSS.escape(model.id)}"]`,
    );
    if (!row || !gap) {
      return;
    }
    const svg = gap.ownerSVGElement;

    const label = gap.querySelector(".la-gap-label");
    const restoreHidden = hideElements([label]);

    const lines = String(model.label).split("\n");
    const availableWidth = Math.max(
      56,
      layout.contentRight - layout.contentLeft - 20,
    );
    const measuredWidth = label.getBBox().width + 22;
    const width = Math.min(
      availableWidth,
      Math.max(88, measuredWidth),
    );
    let labelHeight = Math.max(24, lines.length * 12 + 12);
    const inlineEditor = svgElement("g", {
      class: "la-inline-gap-editor",
    });
    const labelEditor = svgElement("foreignObject", {
      x: layout.width / 2 - width / 2,
      y: row.y - labelHeight / 2,
      width,
      height: labelHeight,
      overflow: "visible",
    });

    const body = inlineContainer("la-inline-gap-editor-body", "Edit gap");

    const control = inlineField(
      "textarea",
      "la-inline-gap-label",
      "gap-label",
      "Gap label",
      model.label,
    );
    control.rows = lines.length;
    control.wrap = "off";
    control.style.height = `${labelHeight}px`;

    const deleteControl = inlineDeleteControl("gap", "Delete gap");

    const positionDeleteControl = () => {
      if (!deleteControl.isConnected) {
        return;
      }
      const point = svg.createSVGPoint();
      point.x = layout.contentRight;
      point.y = row.y;
      const screenPoint = point.matrixTransform(svg.getScreenCTM());
      const scale = svg.getBoundingClientRect().width / layout.width;
      deleteControl.style.setProperty(
        "--la-inline-scale",
        String(scale),
      );
      deleteControl.style.left = `${screenPoint.x}px`;
      deleteControl.style.top = `${screenPoint.y}px`;
    };
    const positioning = observePosition(svg, positionDeleteControl);
    const repositionDeleteControl = positioning.reposition;
    deleteControl.cleanup = () => {
      positioning.disconnect();
    };
    control.addEventListener("input", () => {
      const lineCount = control.value.split("\n").length;
      const nextHeight = Math.max(24, lineCount * 12 + 12);
      if (nextHeight === labelHeight) {
        return;
      }
      labelHeight = nextHeight;
      labelEditor.setAttribute("y", row.y - labelHeight / 2);
      labelEditor.setAttribute("height", labelHeight);
      control.rows = lineCount;
      control.style.height = `${labelHeight}px`;
      repositionDeleteControl();
    });

    let committedValue = model.label;
    const commit = (focusAfter = false, deferDraw = false) => {
      if (destroyed || control.value === committedValue) {
        return;
      }
      if (!control.value.trim()) {
        if (focusAfter) {
          showError(body, new Error("Gap label cannot be empty."));
        } else {
          control.value = committedValue;
        }
        return;
      }
      const previousDocument = editor.document;
      try {
        editor.updateItem(model.id, { label: control.value });
        if (editor.document === previousDocument) {
          return;
        }
        committedValue = control.value;
        transient = null;
        notifyChange();
        if (deferDraw) {
          scheduleInlineDraw(frame);
        } else {
          selectedIds = [model.id];
          pendingFocus = focusAfter ? "gap-label" : null;
          draw();
        }
      } catch (error) {
        notifyError(error, body);
      }
    };
    flushInlineEdit = (deferDraw) => commit(false, deferDraw);

    const dispose = bindInlineContainer(
      body,
      () => commit(false, true),
      null,
      deleteControl,
    );
    inlineEditor.cleanup = () => {
      dispose();
      restoreHidden();
    };
    bindInlineKeys(frame, control, () => commit(true));
    const deleteGap = (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (!runRemoval(() => editor.removeItem(model.id))) {
        // The delete control sits outside the label editor, so focus
        // returns to the label, whose blur commits a pending edit.
        control.focus({ preventScroll: true });
      }
    };
    deleteControl.addEventListener("pointerdown", (event) => {
      event.stopPropagation();
    });
    deleteControl.addEventListener("click", deleteGap);
    keepFieldFocus(deleteControl, body);

    body.append(control);
    labelEditor.append(body);
    inlineEditor.append(labelEditor);
    gap.append(inlineEditor);
    frame.append(deleteControl);
    queueMicrotask(repositionDeleteControl);
  }

  function contextualEditor(frame, layout) {
    const active = frame.getRootNode().activeElement;
    removeContextualEditor(frame);
    if (active && !active.isConnected && frame.isConnected) {
      frame.focus({ preventScroll: true });
    }

    if (transient?.type === "insert") {
      const popover = addPopover(
        frame,
        layout,
        transient.anchor,
        null,
        {
          placement: "center-left",
          variant: "insert",
          label: "Add timeline item",
        },
      );
      if (transient.trigger) {
        transient.trigger.dataset.menuOpen = "true";
        popover.insertionTrigger = transient.trigger;
      }
      if (transient.dismissOnPointerLeave) {
        const hoveredTransient = transient;
        popover.addEventListener("pointerenter", () => {
          if (transient === hoveredTransient) {
            transient.menuHovered = true;
          }
        });
        popover.addEventListener("pointerleave", () => {
          if (transient === hoveredTransient) {
            transient.menuHovered = false;
            transient.close();
          }
        });
      }
      // Messages, and groups that start with one, need an actor.
      const needsActor = editor.document.actors.length === 0;
      addInsertionPicker(popover, [
        {
          label: "Add message",
          visibleLabel: "Message",
          icon: "arrow-right",
          fallback: "→",
          disabled: needsActor,
          run: () =>
            run(
              () =>
                editor.addItem(
                  transient.slot.parentId,
                  transient.slot.index,
                  "message",
                ),
              undefined,
              popover,
              "message-label",
            ),
        },
        {
          label: "Add group",
          visibleLabel: "Group",
          icon: "rectangle-dashed",
          fallback: "□",
          disabled: needsActor,
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
              "group-label",
            ),
        },
        {
          label: "Add gap",
          visibleLabel: "Gap",
          icon: "wave-sawtooth",
          fallback: "〰",
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
              "gap-label",
            ),
        },
      ]);
      return;
    }

    if (selectedIds.length > 1) {
      const first = findItemLocation(editor.document, selectedIds[0]);
      const entriesById = new Map(
        timelineEntries(layout).map((entry) => [entry.id, entry]),
      );
      const anchor = {
        x: layout.width / 2,
        y: Math.max(
          ...selectedIds.map(
            (id) =>
              entriesById.get(id)?.bottom ?? 0,
          ),
        ),
      };
      const popover = addPopover(
        frame,
        layout,
        anchor,
        `${selectedIds.length} items selected`,
        { closable: true },
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
              "group-label",
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
    if (model.type === "gap") {
      addInlineGapEditor(frame, layout, model);
      return;
    }
    if (model.type === "actor") {
      addInlineActorEditor(frame, layout, model);
      return;
    }
    if (model.type === "message") {
      addInlineMessageEditor(frame, layout, model);
      return;
    }
    if (model.type === "group") {
      addInlineGroupEditor(frame, layout, model);
      return;
    }
    if (model.type === "section") {
      addInlineSectionEditor(frame, layout, model);
    }
  }

  function startDrag(handle, event, move, drop) {
    if (
      event.button !== 0 ||
      (event.pointerType === "touch" && !startsTouchDrag(handle))
    ) {
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
    handle.setPointerCapture(event.pointerId);

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
      candidate = move(point, start);
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
          `L ${source.centerX + SELF_MESSAGE_MIN_WIDTH} ${top}`,
          `L ${source.centerX + SELF_MESSAGE_MIN_WIDTH} ${bottom}`,
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
        fill: "var(--la-surface)",
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
    frame.prepend(editStyle);
    frame.dataset.mode = "edit";
    frame.tabIndex = 0;
    const status = document.createElement("p");
    status.className = "la-edit-status";
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    frame.append(status);
    for (const group of layout.groups) {
      const element = svg.querySelector(`[data-la-id="${CSS.escape(group.id)}"]`);
      element?.querySelector("rect")?.setAttribute(
        "height",
        layout.options.groupHeaderHeight,
      );
    }

    const timelineInsertionSlots = timelineSlots(layout);
    const insertionLayer = svgElement("g", {
      class: "la-insertion-layer",
    });
    const handleLayer = svgElement("g", {
      class: "la-handle-layer",
    });
    const connectionLayer = svgElement("g", {
      class: "la-connection-layer",
    });

    const closeInsertionPickerAfterHover = (
      trigger,
      hoverTarget,
    ) => {
      const close = () => {
        if (destroyed) {
          return;
        }
        if (
          transient?.type !== "insert" ||
          transient.trigger !== trigger ||
          transient.hoverTarget !== hoverTarget ||
          !transient.dismissOnPointerLeave
        ) {
          return;
        }
        if (
          transient.triggerHovered ||
          transient.menuHovered
        ) {
          return;
        }
        transient = null;
        contextualEditor(frame, layout);
      };
      setTimeout(close, 0);
    };

    for (const slot of timelineInsertionSlots) {
      insertionLayer.append(
        insertionMark(
          slot,
          "Add timeline item here",
          (trigger, mode, hoverTarget) => {
            if (
              mode === "pointer" &&
              transient?.type === "insert" &&
              transient.trigger === trigger
            ) {
              return;
            }
            const controlX =
              slot.controlX ??
              slot.left + TIMELINE_INSERTION_CONTROL_OFFSET;
            transient = {
              type: "insert",
              slot,
              trigger,
              hoverTarget,
              triggerHovered: mode !== "keyboard",
              menuHovered: false,
              dismissOnPointerLeave: mode !== "keyboard",
              close: () =>
                closeInsertionPickerAfterHover(
                  trigger,
                  hoverTarget,
                ),
              anchor: {
                x: controlX,
                y: slot.y,
              },
            };
            if (mode !== "hover") {
              selectedIds = [];
              applySelectedVisuals(svg, selectedIds);
            }
            contextualEditor(frame, layout);
            if (mode === "keyboard") {
              frame
                .querySelector(".la-insert-option:enabled")
                ?.focus({ preventScroll: true });
            }
          },
          "horizontal",
          {
            activateOnHover: true,
            controlOnly: true,
            onPointerLeave: (trigger, hoverTarget) => {
              if (
                transient?.type === "insert" &&
                transient.trigger === trigger &&
                transient.hoverTarget === hoverTarget
              ) {
                transient.triggerHovered = false;
              }
              closeInsertionPickerAfterHover(
                trigger,
                hoverTarget,
              );
            },
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
              "actor-name",
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
              (point) => {
                const target = nearestActor(layout, point.x);
                setConnectionOriginDirection(
                  origin,
                  point.x < source.centerX ? "left" : "right",
                );
                showConnectionPreview(
                  svg,
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
          (point) => {
            const slots = actorSlots(layout);
            const slot = slots.reduce((best, current) =>
              !best ||
              Math.abs(point.x - current.x) <
                Math.abs(point.x - best.x)
                ? current
                : best,
            null);
            showDragLine(
              svg,
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
      const handleRadius =
        entry.type === "group"
          ? GROUP_REORDER_HANDLE_RADIUS
          : REORDER_HANDLE_RADIUS;
      let x = layout.contentLeft - 8;
      if (entry.type === "group") {
        x = entry.left + handleRadius;
      } else if (entry.type === "message") {
        const source = layout.actorByName.get(entry.source);
        const target = layout.actorByName.get(entry.target);
        x = Math.min(source.centerX, target.centerX) - 22;
      }
      x = Math.max(handleRadius, x);
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
          const invalidParents = descendantContainerIds(
            sourceLocation.item,
          );
          startDrag(
            handle,
            event,
            (point, start) => {
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
                showDragLine(svg, slot);
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
        handleRadius,
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
                (point) => {
                  const candidate = nearestActor(layout, point.x);
                  const previewSource =
                    endpoint === "source" ? candidate : source;
                  const previewTarget =
                    endpoint === "target" ? candidate : target;
                  showConnectionPreview(
                    svg,
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
            () => activateModel(entry.id),
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
            (point) => {
              const slots = sectionSlots(layout, section.parentId);
              const slot = slots.reduce((best, current) =>
                !best ||
                Math.abs(point.y - current.y) <
                  Math.abs(point.y - best.y)
                  ? current
                  : best,
              null);
              if (slot) {
                showDragLine(svg, slot);
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

    frame.addEventListener("pointerdown", trackPress, true);

    // Chromium ignores touch-action on SVG descendants, and touch-action on
    // the frame would stop every touch on the diagram from scrolling the
    // page. Instead, once pointerdown has started a drag, this listener
    // cancels the drag's touchmove events so the browser does not take the
    // gesture over for panning and cancel the pointer. It is non-passive and
    // scoped to the frame, since Chromium makes touch listeners on the
    // window, document, and body passive by default. Touches that start
    // anywhere else still scroll the page.
    frame.addEventListener(
      "touchmove",
      (event) => {
        if (frame.dataset.dragging === "true" && event.cancelable) {
          event.preventDefault();
        }
      },
      { passive: false },
    );

    // Swallows the click that ends a press the canvas already handled. A
    // press that ends in pointercancel, or is released outside the canvas,
    // produces no click here, so each new press starts unsuppressed.
    let suppressClick = false;
    svg.addEventListener(
      "click",
      (event) => {
        if (suppressClick) {
          suppressClick = false;
          event.preventDefault();
          event.stopImmediatePropagation();
          return;
        }
        // Pressing a header control commits typed text and defers the
        // redraw past this click. Redraw first and replay the click on the
        // new control, so a copy dialog or confirmation is not replaced.
        const control = event.target.closest(".la-header-control");
        if (!control) {
          return;
        }
        // A shown inline error already reports the rejected text.
        if (!frame.querySelector(".la-edit-error")) {
          flushInlineEdit?.(true);
        }
        if (pendingInlineDraw === null && !inlineDrawAfterPress) {
          return;
        }
        event.preventDefault();
        event.stopImmediatePropagation();
        draw();
        if (control.getAttribute("aria-disabled") !== "true") {
          baseController.svg
            .querySelector(`[data-field="${control.dataset.field}"]`)
            ?.dispatchEvent(new MouseEvent("click"));
        }
      },
      true,
    );
    svg.addEventListener(
      "pointercancel",
      () => {
        suppressClick = false;
      },
      true,
    );

    svg.addEventListener(
      "pointerdown",
      (event) => {
        suppressClick = false;
        if (event.button !== 0 || selectedIds.length === 0) {
          return;
        }
        const owner = event.target.closest(
          "[data-la-id], [data-owner-id]",
        );
        const ownerId = owner?.dataset.laId ?? owner?.dataset.ownerId;
        if (
          (ownerId && selectedIds.includes(ownerId)) ||
          event.target.closest(".la-header-control")
        ) {
          return;
        }

        activeCancel?.();
        flushInlineEdit?.(true);
        const keepsSelection = frame.querySelector(".la-edit-error");
        // Another item's own click selects it, so the switch takes one
        // click; only a press on empty canvas clears the selection here.
        if (
          !keepsSelection &&
          event.target.closest(".la-selectable, .la-group-part-hit")
        ) {
          return;
        }

        suppressClick = true;
        event.preventDefault();
        event.stopImmediatePropagation();
        if (keepsSelection) {
          return;
        }

        transient = null;
        selectedIds = [];
        applySelectedVisuals(svg, selectedIds);
        contextualEditor(frame, layout);
      },
      true,
    );

    svg.addEventListener("pointerdown", (event) => {
      if (
        event.button !== 0 ||
        event.target.closest("[data-la-id]") ||
        event.target.closest(".la-insertion") ||
        event.target.closest(".la-header-control")
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
      svg.setPointerCapture(event.pointerId);

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

        const items = findContainerItems(
          editor.document,
          candidate.entries[0].parentId,
        );
        const indices = candidate.entries
          .map((entry) =>
            items.findIndex((item) => item.id === entry.id),
          )
          .filter((index) => index >= 0)
          .sort((first, second) => first - second);
        if (indices.length === 0) {
          return;
        }
        selectedIds = items
          .slice(indices[0], indices[indices.length - 1] + 1)
          .map((item) => item.id);
        transient = null;
        applySelectedVisuals(svg, selectedIds);
        contextualEditor(frame, layout);
      };

      activeCancel = cancel;
      globalThis.addEventListener("pointermove", onMove);
      globalThis.addEventListener("pointerup", onUp);
      globalThis.addEventListener("pointercancel", cancel);
    });

    frame.addEventListener("focusin", (event) => enterFromEnd(frame, event));

    // Tab is captured: editing fields stop their keys from reaching here.
    frame.addEventListener(
      "keydown",
      (event) => {
        if (
          event.key === "Tab" &&
          !event.isComposing &&
          !event.metaKey &&
          !event.ctrlKey &&
          !event.altKey
        ) {
          moveFocusInLayoutOrder(frame, event);
        }
      },
      true,
    );

    frame.addEventListener("keydown", (event) => {
      // Text fields keep the browser's own undo stack and key handling.
      const editing = isEditableField(event.target);
      const command = event.metaKey || event.ctrlKey;

      if (!editing && command && event.key.toLowerCase() === "z") {
        event.preventDefault();
        run(
          () => (event.shiftKey ? editor.redo() : editor.undo()),
          [],
        );
        return;
      }
      if (!editing && command && event.key.toLowerCase() === "y") {
        event.preventDefault();
        run(() => editor.redo(), []);
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        // Closing the insertion picker from inside returns to its mark.
        const insertionControl =
          transient?.type === "insert" &&
          event.target.closest(".la-edit-popover")
            ? transient.hoverTarget
            : null;
        activeCancel?.();
        transient = null;
        selectedIds = [];
        applySelectedVisuals(svg, selectedIds);
        contextualEditor(frame, layout);
        if (insertionControl?.isConnected) {
          focusElement(insertionControl);
        }
        return;
      }
      if (
        targetsSelection(frame, event.target) &&
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
      if (
        targetsSelection(frame, event.target) &&
        event.altKey &&
        selectedIds.length === 1
      ) {
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
    cancelInlineDraw();
    clearStatus();

    const previousFrame = baseController?.svg?.closest(".la-frame");
    const previousFocus = captureFocus(previousFrame);
    removeContextualEditor(previousFrame);
    baseController?.destroy();
    baseController = renderDiagramForEditor(
      target,
      editor.document,
      // Header actions read the source on activation.
      () => editor.source,
      options,
      activateModel,
      [
        {
          label: "Undo",
          icon: "arrow-counter-clockwise",
          fallback: "↶",
          className: "la-history-control",
          field: "history-undo",
          keyShortcuts: "Control+Z Meta+Z",
          disabled: !editor.canUndo,
          onActivate: () =>
            run(
              () => editor.undo(),
              [],
              null,
              "history-undo",
            ),
        },
        {
          label: "Redo",
          icon: "arrow-clockwise",
          fallback: "↷",
          className: "la-history-control",
          field: "history-redo",
          keyShortcuts:
            "Control+Shift+Z Meta+Shift+Z Control+Y Meta+Y",
          disabled: !editor.canRedo,
          onActivate: () =>
            run(
              () => editor.redo(),
              [],
              null,
              "history-redo",
            ),
        },
      ],
    );

    const frame = baseController.svg.closest(".la-frame");
    decorate(frame, baseController.svg, baseController.layout);
    applySelectedVisuals(baseController.svg, selectedIds);
    contextualEditor(frame, baseController.layout);
    if (!focusPendingField(frame)) {
      restoreFocus(frame, previousFocus);
    }
  }

  draw();

  return {
    commitPending() {
      if (destroyed) {
        return;
      }
      baseController?.svg
        ?.closest(".la-frame")
        ?.querySelector(":focus")
        ?.blur();
      flushInlineEdit?.(false);
    },
    destroy() {
      destroyed = true;
      transient = null;
      for (const type of ["keydown", "keyup", "pointerdown"]) {
        globalThis.removeEventListener(type, trackReverseTab, true);
      }
      activeCancel?.();
      cancelInlineDraw();
      clearStatus();
      const frame = baseController?.svg?.closest(".la-frame");
      removeContextualEditor(frame);
      baseController?.destroy();
    },
  };
}
