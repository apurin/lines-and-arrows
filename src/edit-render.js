import {
  ROOT_CONTAINER_ID,
  descendantContainerIds,
  findItemLocation,
  findSectionLocation,
  getContainer,
} from "./document.js";
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
import { renderDiagramForEditor } from "./render.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const TIMELINE_INSERTION_CONTROL_OFFSET = 12;
const TIMELINE_INSERTION_CONTROL_RADIUS = 8;
const ACTOR_INSERTION_CONTROL_HALF_WIDTH = 13;
const REORDER_HANDLE_RADIUS = 11;
const GROUP_REORDER_HANDLE_RADIUS = 9;
const GROUP_EDITOR_HANDLE_GAP = 1;
const GROUP_EDITOR_LEFT_INSET =
  GROUP_REORDER_HANDLE_RADIUS * 2 + GROUP_EDITOR_HANDLE_GAP;
const GROUP_EDITOR_RIGHT_INSET = 10;

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

  .la-frame[data-selection-active="true"] .la-insertion-layer,
  .la-frame[data-selection-active="true"] .la-connection-layer,
  .la-frame[data-selection-active="true"] .la-history-control,
  .la-frame[data-selection-active="true"] .la-tooltip-layer {
    display: none;
  }

  .la-frame[data-selection-active="true"]
    .la-selectable:not([data-selected="true"]),
  .la-frame[data-selection-active="true"]
    .la-selectable:not([data-selected="true"])
    *,
  .la-frame[data-selection-active="true"] .la-group-part-hit,
  .la-frame[data-selection-active="true"]
    .la-message-endpoint:not([data-visible="true"]) {
    pointer-events: none;
  }

  .la-frame[data-selection-active="true"]
    .la-selectable:not([data-selected="true"]),
  .la-frame[data-selection-active="true"]
    .la-selectable:not([data-selected="true"])
    * {
    cursor: default;
  }

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
    width: var(--la-inline-delete-size, 20px);
    height: var(--la-inline-delete-size, 20px);
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
    height: var(--la-inline-delete-cross-thickness, 1.5px);
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
    top: var(--la-inline-actor-icon-top, 4px);
    left: 50%;
    pointer-events: auto;
    transform: translateX(-50%);
  }

  .la-inline-actor-icon-picker .la-icon-picker-trigger {
    width: var(--la-inline-actor-icon-size, 18px);
    min-width: var(--la-inline-actor-icon-size, 18px);
    height: var(--la-inline-actor-icon-size, 18px);
    padding: 0;
    border: 0;
    border-radius: 0;
    background: transparent;
    color: var(--la-actor-text);
  }

  .la-inline-actor-icon-picker[data-empty="true"]
    .la-icon-picker-trigger {
    width: var(--la-inline-actor-icon-placeholder-size, 20px);
    min-width: var(--la-inline-actor-icon-placeholder-size, 20px);
    height: var(--la-inline-actor-icon-placeholder-size, 20px);
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
    width: var(--la-inline-actor-icon-placeholder-glyph-size, 14px);
    height: var(--la-inline-actor-icon-placeholder-glyph-size, 14px);
  }

  .la-inline-actor-icon-picker:not([data-empty="true"])
    > .la-icon-picker-trigger
    .la-icon-glyph,
  .la-inline-actor-icon-picker:not([data-empty="true"])
    > .la-icon-picker-trigger
    .la-icon-visual {
    width: var(--la-inline-actor-icon-size, 18px);
    height: var(--la-inline-actor-icon-size, 18px);
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
    right: var(--la-inline-actor-name-inset, 4px);
    bottom: var(--la-inline-actor-name-bottom, 5px);
    left: var(--la-inline-actor-name-inset, 4px);
    width: auto;
    height: var(--la-inline-actor-name-height, 18px);
    margin: 0;
    padding: 0;
    pointer-events: auto;
    border: 0;
    outline: none;
    background: transparent;
    color: var(--la-actor-text);
    font: 700 var(--la-inline-actor-name-font-size, 13px)/1.1 var(
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
    top: calc(100% + var(--la-inline-actor-metadata-gap, 6px));
    left: 50%;
    display: flex;
    gap: var(--la-inline-actor-pill-gap, 4px);
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
    height: var(--la-inline-actor-pill-height, 20px);
    margin: 0;
    padding: 0
      calc(var(--la-inline-actor-pill-padding, 10px) - 2px);
    border: 1px solid transparent;
    border-radius: var(--la-inline-actor-pill-radius, 10px);
    outline: none;
    background: var(--la-tag-fill);
    color: var(--la-tag-text);
    font: 650 var(--la-inline-actor-pill-font-size, 10px)/1 var(
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
    right: calc(0px - var(--la-inline-delete-size, 20px) / 2);
    pointer-events: auto;
    transform: translateY(-50%);
  }

  .la-inline-actor-tooltip-control {
    position: relative;
    flex: none;
    width: var(--la-inline-actor-tooltip-size, 20px);
    height: var(--la-inline-actor-tooltip-size, 20px);
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
    width: var(--la-inline-actor-tooltip-icon-size, 14px);
    height: var(--la-inline-actor-tooltip-icon-size, 14px);
  }

  .la-inline-actor-tooltip-trigger .la-icon-fallback {
    font-size: var(--la-inline-actor-tooltip-font-size, 11px);
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
    top: calc(100% + var(--la-inline-actor-metadata-gap, 6px) + 24px);
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
    gap: var(--la-inline-group-gap, 5px);
    align-items: center;
    pointer-events: auto;
  }

  .la-inline-group-field {
    display: flex;
    min-width: 0;
    height: var(--la-inline-group-control-height, 20px);
    gap: var(--la-inline-group-field-gap, 4px);
    align-items: center;
    flex: none;
  }

  .la-inline-group-label-field {
    flex: 1 1 auto;
  }

  .la-inline-group-field-name {
    color: var(--la-muted-text);
    font-size: var(--la-inline-group-caption-font-size, 9px);
    font-weight: 650;
    line-height: 1;
    white-space: nowrap;
  }

  .la-inline-group-type,
  .la-inline-group-label,
  .la-inline-group-action {
    height: var(--la-inline-group-control-height, 20px);
    margin: 0;
    outline: none;
    color: var(--la-text);
    font: 650 var(--la-inline-group-font-size, 11px)/1 var(
      --la-font-family,
      ui-sans-serif,
      system-ui,
      sans-serif
    );
  }

  .la-inline-group-type {
    flex: none;
    padding: 0 var(--la-inline-group-pill-padding, 8px);
    appearance: none;
    border: 0;
    border-radius: var(--la-inline-group-pill-radius, 10px);
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
            var(--la-inline-group-control-height, 20px) -
              var(--la-inline-group-font-size, 11px)
          ) /
          2
      )
      var(--la-inline-group-pill-padding, 8px);
    overflow: hidden;
    flex: 1 1 auto;
    appearance: none;
    border: 0;
    border-radius: var(--la-inline-group-pill-radius, 10px);
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
    gap: var(--la-inline-group-action-gap, 4px);
    align-items: center;
    margin-left: auto;
    flex: none;
  }

  .la-inline-group-action {
    padding: 0 var(--la-inline-group-action-padding, 9px);
    cursor: pointer;
    border: 1px solid color-mix(
      in srgb,
      var(--la-selection) 34%,
      var(--la-section-line)
    );
    border-radius: var(--la-inline-group-pill-radius, 10px);
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
    gap: var(--la-inline-section-gap, 4px);
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
    padding: var(--la-inline-section-padding-y, 4px)
      var(--la-inline-section-padding-x, 8px);
    overflow: hidden;
    flex: none;
    pointer-events: auto;
    appearance: none;
    border: 0;
    border-radius: var(--la-inline-section-radius, 10px);
    outline: none;
    resize: none;
    background: color-mix(
      in srgb,
      var(--la-surface) 76%,
      var(--la-group-fill)
    );
    color: var(--la-text);
    font: 650 var(--la-inline-section-font-size, 10px)/var(
        --la-inline-section-line-height,
        12px
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
    font: 560 var(--la-inline-message-label-font-size, 11px)/var(
        --la-inline-message-label-line-height,
        13px
      ) var(
        --la-font-family,
        ui-sans-serif,
        system-ui,
        sans-serif
      );
    text-align: center;
  }

  .la-inline-message-label::placeholder {
    color: var(--la-muted-text);
    opacity: 1;
  }

  .la-inline-message-delete {
    position: absolute;
    z-index: 9;
    pointer-events: auto;
    transform: translate(-50%, -50%);
  }

  .la-inline-message-metadata {
    position: absolute;
    display: flex;
    gap: var(--la-inline-message-pill-gap, 4px);
    align-items: center;
    pointer-events: auto;
    transform: translateX(
      calc(
        -50% + var(--la-inline-message-metadata-shift, 0px)
      )
    );
  }

  .la-inline-message-arrow-styles {
    position: absolute;
    z-index: 6;
    display: flex;
    gap: var(--la-inline-message-arrow-gap, 3px);
    align-items: center;
    pointer-events: auto;
    transform: translateY(-50%);
  }

  .la-inline-message-arrow-style {
    display: grid;
    width: var(--la-inline-message-arrow-size, 18px);
    min-width: var(--la-inline-message-arrow-size, 18px);
    height: var(--la-inline-message-arrow-size, 18px);
    margin: 0;
    padding: 0;
    place-items: center;
    cursor: pointer;
    border: 1px solid var(--la-section-line);
    border-radius: 50%;
    outline: none;
    background: var(--la-surface);
    color: var(--la-muted-text);
  }

  .la-inline-message-arrow-style:hover,
  .la-inline-message-arrow-style:focus-visible {
    border-color: var(--la-selection);
    color: var(--la-text);
  }

  .la-inline-message-arrow-style[aria-pressed="true"] {
    border-color: var(--la-selection);
    background: var(--la-accent-soft);
    color: var(--la-text);
  }

  .la-inline-message-arrow-style svg {
    width: var(--la-inline-message-arrow-icon-width, 14px);
    height: var(--la-inline-message-arrow-icon-height, 12px);
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
    --la-insertion-control-size: 16px;
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
    grid-template-columns: repeat(2, minmax(0, 1fr));
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

  .la-edit-actions[data-nowrap="true"] {
    flex-wrap: nowrap;
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
    TIMELINE_INSERTION_CONTROL_RADIUS + 2,
    layout.contentLeft - TIMELINE_INSERTION_CONTROL_OFFSET,
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

function removeInlineGapEditor(frame) {
  const inlineEditor = frame?.querySelector(
    ".la-inline-gap-editor",
  );
  if (inlineEditor) {
    inlineEditor.cleanup?.();
    inlineEditor.remove();
  }
  const deleteControl = frame?.querySelector(
    ".la-inline-gap-delete",
  );
  deleteControl?.cleanup?.();
  deleteControl?.remove();
}

function removeInlineEditor(frame, selector) {
  const inlineEditor = frame?.querySelector(selector);
  inlineEditor?.cleanup();
  inlineEditor?.remove();
}

function removeInlineActorEditor(frame) {
  removeInlineEditor(frame, ".la-inline-actor-editor");
}

function removeInlineGroupEditor(frame) {
  removeInlineEditor(frame, ".la-inline-group-editor");
}

function removeInlineSectionEditor(frame) {
  removeInlineEditor(frame, ".la-inline-section-editor");
}

function removeInlineMessageEditor(frame) {
  removeInlineEditor(frame, ".la-inline-message-editor");
}

function removeContextualEditor(frame) {
  removePopover(frame);
  removeInlineGapEditor(frame);
  removeInlineActorEditor(frame);
  removeInlineGroupEditor(frame);
  removeInlineSectionEditor(frame);
  removeInlineMessageEditor(frame);
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
      "--la-insertion-control-size",
      `${TIMELINE_INSERTION_CONTROL_RADIUS * 2 * diagramScale}px`,
    );
  }
  const popoverRect = popover.getBoundingClientRect();
  const viewportWidth = innerWidth;
  const viewportHeight = innerHeight;
  const padding = 8;
  const placement = popover.dataset.placement ?? "vertical";
  const gap =
    placement === "right"
      ? 16
      : placement === "above" &&
          popover.dataset.variant === "insert"
        ? 7
        : 10;
  const anchorX =
    svgRect.left + (anchor.x / layout.width) * svgRect.width;
  const anchorY =
    svgRect.top + (anchor.y / layout.height) * svgRect.height;
  let side;
  let preferredLeft;
  let preferredTop;

  if (placement === "right") {
    const spaceRight = viewportWidth - padding - anchorX - gap;
    const spaceLeft = anchorX - gap - padding;
    side =
      spaceRight >= popoverRect.width || spaceRight >= spaceLeft
        ? "right"
        : "left";
    preferredLeft =
      side === "right"
        ? anchorX + gap
        : anchorX - gap - popoverRect.width;
    preferredTop = anchorY - popoverRect.height / 2;
  } else if (placement === "center-left") {
    side = "center-left";
    preferredLeft = anchorX;
    preferredTop = anchorY - popoverRect.height / 2;
  } else {
    const spaceBelow = viewportHeight - padding - anchorY - gap;
    const spaceAbove = anchorY - gap - padding;
    side =
      placement === "above"
        ? "above"
        : spaceBelow >= popoverRect.height ||
            spaceBelow >= spaceAbove
          ? "below"
          : "above";
    preferredLeft = anchorX - popoverRect.width / 2;
    preferredTop =
      side === "below"
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
  const left = Math.max(
    padding,
    Math.min(preferredLeft, maxLeft),
  );
  const top = Math.max(padding, Math.min(preferredTop, maxTop));

  popover.style.left = `${left}px`;
  popover.style.top = `${top}px`;
  popover.dataset.side = side;

  const visibleNestedOverlays = [
    ...popover.querySelectorAll(
      ".la-icon-picker-popover:not([hidden])",
    ),
  ];
  if (!visibleNestedOverlays.length) {
    return;
  }

  const overlayRects = [
    popover.getBoundingClientRect(),
    ...visibleNestedOverlays.map((overlay) =>
      overlay.getBoundingClientRect(),
    ),
  ];
  const bounds = {
    left: Math.min(...overlayRects.map((rect) => rect.left)),
    right: Math.max(...overlayRects.map((rect) => rect.right)),
    top: Math.min(...overlayRects.map((rect) => rect.top)),
    bottom: Math.max(...overlayRects.map((rect) => rect.bottom)),
  };
  const availableWidth = viewportWidth - padding * 2;
  const availableHeight = viewportHeight - padding * 2;
  const boundsWidth = bounds.right - bounds.left;
  const boundsHeight = bounds.bottom - bounds.top;
  let correctionX = 0;
  let correctionY = 0;

  if (boundsWidth <= availableWidth) {
    if (bounds.left < padding) {
      correctionX = padding - bounds.left;
    } else if (bounds.right > viewportWidth - padding) {
      correctionX = viewportWidth - padding - bounds.right;
    }
  }
  if (boundsHeight <= availableHeight) {
    if (bounds.top < padding) {
      correctionY = padding - bounds.top;
    } else if (bounds.bottom > viewportHeight - padding) {
      correctionY = viewportHeight - padding - bounds.bottom;
    }
  }

  if (correctionX || correctionY) {
    popover.style.left = `${left + correctionX}px`;
    popover.style.top = `${top + correctionY}px`;
  }
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
  globalThis.addEventListener("scroll", reposition, true);
  globalThis.addEventListener("resize", reposition);

  return {
    reposition,
    disconnect() {
      resizeObserver.disconnect();
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
  popover.part = "editor";
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
      close.addEventListener("click", () => removePopover(frame));
      header.append(close);
    }

    popover.append(header);
  }
  frame.append(popover);
  popover.showPopover();

  const positioning = observePosition(popover, () =>
    positionPopover(popover, frame, layout, anchor),
  );
  popover.repositionOverlay = positioning.reposition;
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
        icon.label.slice(0, 1).toUpperCase(),
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
      if (
        primaryIconRecommendations.length &&
        secondaryIconRecommendations.length
      ) {
        const divider = document.createElement("span");
        divider.className = "la-icon-grid-divider";
        divider.setAttribute("aria-hidden", "true");
        grid.append(divider);
      }
      for (const icon of secondaryIconRecommendations) {
        appendOption(icon);
      }

      const count =
        primaryIconRecommendations.length +
        secondaryIconRecommendations.length;
      empty.textContent = "No recommended icons available";
      empty.hidden = count > 0;
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

  const control = document.createElement("textarea");
  control.className = "la-inline-actor-tooltip-text";
  control.dataset.field = field;
  control.rows = 2;
  fieldSequence += 1;
  control.id = `la-field-${fieldSequence}`;
  control.setAttribute("aria-label", `${owner} tooltip text`);
  control.value = model.tooltip ?? "";

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

function positionInlineTooltipDialog(frame, dialog) {
  dialog.style.setProperty("--la-inline-tooltip-dialog-shift", "0px");
  const dialogRect = dialog.getBoundingClientRect();
  const frameRect = frame.getBoundingClientRect();
  const leftBoundary = Math.max(8, frameRect.left + 8);
  const rightBoundary = Math.min(innerWidth - 8, frameRect.right - 8);
  let shift = 0;
  if (dialogRect.left < leftBoundary) {
    shift = leftBoundary - dialogRect.left;
  } else if (dialogRect.right > rightBoundary) {
    shift = rightBoundary - dialogRect.right;
  }
  dialog.style.setProperty(
    "--la-inline-tooltip-dialog-shift",
    `${shift}px`,
  );
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
      positionInlineTooltipDialog(frame, tooltip.dialog);
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
  trigger.setAttribute("aria-label", options.label);
  trigger.setAttribute("aria-haspopup", "dialog");
  trigger.setAttribute("aria-expanded", "false");
  const triggerIconName = currentName || options.defaultIcon || null;
  trigger.append(
    iconVisual(
      triggerIconName,
      theme,
      currentName
        ? currentName.slice(0, 1).toUpperCase()
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

  const close = (commit = true, restoreFocus = false) => {
    if (panel.hidden) {
      return;
    }
    frame.removeEventListener(
      "pointerdown",
      onOutsidePointerDown,
    );
    panel.hidden = true;
    trigger.setAttribute("aria-expanded", "false");
    popover.repositionOverlay?.();
    if (commit) {
      options.onClose?.();
    }
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
    popover.repositionOverlay?.();
    if (options.focusOnOpen !== false) {
      queueMicrotask(() => selector.focusSearch());
    }
  };
  picker.openPicker = open;

  trigger.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (panel.hidden) {
      open();
    } else {
      close(true, true);
    }
  });
  panel.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close(true, true);
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

function addActions(popover, actions, options = {}) {
  const row = document.createElement("div");
  row.className = "la-edit-actions";
  if (options.nowrap) {
    row.dataset.nowrap = "true";
  }
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
    const circle = svgElement("circle", {
      class: "la-insertion-circle",
      cx: controlX,
      cy: slot.y,
      r: TIMELINE_INSERTION_CONTROL_RADIUS,
      fill: "var(--la-selection)",
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
  if (!target?.replaceChildren) {
    throw new TypeError("renderEditor requires a DOM container.");
  }
  let selectedIds = [];
  let baseController = null;
  let destroyed = false;
  let activeCancel = null;
  let transient = null;
  let pendingFocus = null;
  let pendingInlineDraw = null;

  function notifyChange() {
    const detail = Object.freeze({
      source: editor.source,
    });
    options.onChange?.(detail);
  }

  function notifyError(error, popover = null) {
    if (popover) {
      showError(popover, error);
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

  function focusPendingField(frame, defer = false) {
    if (!pendingFocus) {
      return;
    }
    const field = frame.querySelector(
      `[data-field="${CSS.escape(pendingFocus)}"]`,
    );
    pendingFocus = null;
    if (!field) {
      return;
    }
    const focus = () => {
      if (!field.isConnected) {
        return;
      }
      field.focus({ preventScroll: true });
      const placeCaretAtEnd =
        field.classList.contains("la-inline-actor-name") ||
        field.classList.contains("la-inline-group-label") ||
        field.classList.contains("la-inline-message-label");
      if (placeCaretAtEnd && field.setSelectionRange) {
        const end = field.value.length;
        field.setSelectionRange(end, end);
      } else if (
        field.classList.contains("la-inline-gap-label") ||
        field.classList.contains("la-inline-group-type") ||
        field.classList.contains("la-inline-section-label")
      ) {
        field.select();
      }
    };
    if (defer) {
      queueMicrotask(focus);
    } else {
      focus();
    }
  }

  function scheduleInlineDraw(frame) {
    if (pendingInlineDraw !== null) {
      clearTimeout(pendingInlineDraw);
    }
    const redraw = () => {
      pendingInlineDraw = null;
      if (destroyed) {
        return;
      }
      if (frame.querySelector(".la-inline-gap-label:focus")) {
        pendingFocus = "gap-label";
      }
      draw();
    };
    pendingInlineDraw = setTimeout(redraw, 0);
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

    const hiddenElements = [
      ...actorElement.querySelectorAll(
        ".la-actor-icon-trigger, .la-actor-icon-fallback, .la-actor-icon, .la-actor-label, .la-tag, .la-tooltip-trigger",
      ),
    ];
    const previousVisibility = hiddenElements.map(
      (element) => element.style.visibility,
    );
    for (const element of hiddenElements) {
      element.style.visibility = "hidden";
    }

    const inlineEditor = document.createElement("div");
    inlineEditor.className = "la-inline-actor-editor";
    inlineEditor.setAttribute("role", "group");
    inlineEditor.setAttribute("aria-label", `Edit actor ${model.name}`);

    const card = document.createElement("div");
    card.className = "la-inline-actor-card";

    const nameControl = document.createElement("input");
    nameControl.type = "text";
    nameControl.className = "la-inline-actor-name";
    nameControl.dataset.field = "actor-name";
    nameControl.setAttribute("aria-label", "Actor name");
    nameControl.value = model.name;

    const metadata = document.createElement("div");
    metadata.className = "la-inline-actor-metadata";

    const tagControl = document.createElement("input");
    tagControl.type = "text";
    tagControl.className = "la-inline-actor-pill";
    tagControl.dataset.field = "actor-tag";
    tagControl.placeholder = "Tag";
    tagControl.setAttribute("aria-label", "Actor tag");
    tagControl.value = model.tag ?? "";

    const tooltip = createInlineTooltipEditor(
      frame,
      model,
      "actor",
      "actor-tooltip-text",
    );
    const {
      wrapper: tooltipWrapper,
      control: tooltipControl,
    } = tooltip;

    const deleteControl = document.createElement("button");
    deleteControl.type = "button";
    deleteControl.className =
      "la-inline-delete-control la-inline-actor-delete";
    deleteControl.setAttribute("aria-label", "Delete actor and messages");

    const dirtyFields = new Set();

    let metadataScale = 1;
    const sizeMetadataPills = () => {
      const width = tagControl.value
        ? metadataMetrics(tagControl.value, false).tagWidth
        : 50;
      tagControl.style.width = `${width * metadataScale}px`;
    };
    sizeMetadataPills();
    nameControl.addEventListener("input", () => {
      dirtyFields.add("name");
    });
    tagControl.addEventListener("input", () => {
      dirtyFields.add("tag");
      sizeMetadataPills();
    });

    metadata.append(tagControl, tooltipWrapper);
    card.append(nameControl, deleteControl);
    inlineEditor.append(card, metadata);
    frame.append(inlineEditor);

    let cancelled = false;
    const commit = (
      extraPatch = {},
      focusField = null,
      deferDraw = false,
    ) => {
      const previousDocument = editor.document;
      const patch = { ...extraPatch };
      if (dirtyFields.has("name")) {
        patch.name = nameControl.value;
      }
      if (dirtyFields.has("tag")) {
        patch.tag = tagControl.value;
      }
      if (dirtyFields.has("tooltip")) {
        patch.tooltip = tooltipControl.value;
      }
      if (Object.keys(patch).length === 0) {
        return "unchanged";
      }
      try {
        editor.updateActor(model.id, patch);
        if (editor.document === previousDocument) {
          const current = editor.document.actors.find(
            (actor) => actor.id === model.id,
          );
          nameControl.value = current?.name ?? nameControl.value;
          tagControl.value = current?.tag ?? "";
          tooltipControl.value = current?.tooltip ?? "";
          dirtyFields.clear();
          sizeMetadataPills();
          return "unchanged";
        }
        dirtyFields.clear();
        selectedIds = [model.id];
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
        notifyError(error, inlineEditor);
        return "error";
      }
    };

    const iconPicker = createIconPicker(
      inlineEditor,
      model.icon,
      (icon) => {
        const result = commit({ icon });
        if (result === "unchanged") {
          iconPicker.closePicker(false, true);
        }
      },
      {
        label: "Choose actor icon",
        clearLabel: "No actor icon",
        defaultIcon: "user",
        defaultText: "+",
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
      dirtyFields,
      commit,
      selectedFocus: pendingFocus === "actor-tooltip-text",
      beforeOpen: () => iconPicker.closePicker(),
    });

    const positionEditor = () => {
      if (!inlineEditor.isConnected) {
        return;
      }
      const rect = actorShape.getBoundingClientRect();
      const scale = rect.height / actor.height;
      metadataScale = scale;
      sizeMetadataPills();
      inlineEditor.style.left = `${rect.left}px`;
      inlineEditor.style.top = `${rect.top}px`;
      inlineEditor.style.width = `${rect.width}px`;
      inlineEditor.style.height = `${rect.height}px`;
      inlineEditor.style.setProperty(
        "--la-inline-actor-metadata-gap",
        `${layout.options.actorMetadataGap * scale}px`,
      );
      inlineEditor.style.setProperty(
        "--la-inline-actor-pill-gap",
        `${4 * scale}px`,
      );
      inlineEditor.style.setProperty(
        "--la-inline-actor-pill-height",
        `${20 * scale}px`,
      );
      inlineEditor.style.setProperty(
        "--la-inline-actor-pill-padding",
        `${10 * scale}px`,
      );
      inlineEditor.style.setProperty(
        "--la-inline-actor-pill-radius",
        `${10 * scale}px`,
      );
      inlineEditor.style.setProperty(
        "--la-inline-actor-pill-font-size",
        `${10 * scale}px`,
      );
      inlineEditor.style.setProperty(
        "--la-inline-actor-name-inset",
        `${4 * scale}px`,
      );
      inlineEditor.style.setProperty(
        "--la-inline-actor-name-bottom",
        `${5 * scale}px`,
      );
      inlineEditor.style.setProperty(
        "--la-inline-actor-name-height",
        `${18 * scale}px`,
      );
      inlineEditor.style.setProperty(
        "--la-inline-actor-name-font-size",
        `${13 * scale}px`,
      );
      inlineEditor.style.setProperty(
        "--la-inline-delete-size",
        `${20 * scale}px`,
      );
      inlineEditor.style.setProperty(
        "--la-inline-delete-cross-thickness",
        `${1.5 * scale}px`,
      );
      inlineEditor.style.setProperty(
        "--la-inline-actor-tooltip-size",
        `${20 * scale}px`,
      );
      inlineEditor.style.setProperty(
        "--la-inline-actor-tooltip-icon-size",
        `${14 * scale}px`,
      );
      inlineEditor.style.setProperty(
        "--la-inline-actor-tooltip-font-size",
        `${11 * scale}px`,
      );
      inlineEditor.style.setProperty(
        "--la-inline-actor-metadata-shift",
        "0px",
      );
      inlineEditor.style.setProperty(
        "--la-inline-actor-icon-size",
        `${18 * scale}px`,
      );
      inlineEditor.style.setProperty(
        "--la-inline-actor-icon-placeholder-size",
        `${20 * scale}px`,
      );
      inlineEditor.style.setProperty(
        "--la-inline-actor-icon-placeholder-glyph-size",
        `${14 * scale}px`,
      );
      inlineEditor.style.setProperty(
        "--la-inline-actor-icon-top",
        `${4 * scale}px`,
      );
      const metadataRect = metadata.getBoundingClientRect();
      const frameRect = frame.getBoundingClientRect();
      const viewportWidth = innerWidth;
      const leftBoundary = Math.max(8, frameRect.left + 8);
      const rightBoundary = Math.min(
        viewportWidth - 8,
        frameRect.right - 8,
      );
      let metadataShift = 0;
      if (metadataRect.left < leftBoundary) {
        metadataShift = leftBoundary - metadataRect.left;
      } else if (metadataRect.right > rightBoundary) {
        metadataShift = rightBoundary - metadataRect.right;
      }
      inlineEditor.style.setProperty(
        "--la-inline-actor-metadata-shift",
        `${metadataShift}px`,
      );
      tooltipEditor.position();
    };
    const positioning = observePosition(
      actorShape.ownerSVGElement,
      positionEditor,
    );

    inlineEditor.addEventListener("pointerdown", (event) => {
      if (!iconPicker.contains(event.target)) {
        iconPicker.closePicker();
      }
      if (
        tooltipEditor.open &&
        !tooltipWrapper.contains(event.target)
      ) {
        tooltipEditor.close(false);
      }
      event.stopPropagation();
    });
    inlineEditor.addEventListener("click", (event) => {
      event.stopPropagation();
    });
    inlineEditor.addEventListener("focusout", (event) => {
      if (
        cancelled ||
        inlineEditor.contains(event.relatedTarget)
      ) {
        return;
      }
      tooltipEditor.close(false);
      commit({}, null, true);
    });

    for (const control of [nameControl, tagControl]) {
      control.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          cancelled = true;
          pendingFocus = null;
          selectedIds = [];
          removeInlineActorEditor(frame);
          applySelectedVisuals(baseController.svg, selectedIds);
          contextualEditor(frame, layout);
          frame.focus();
          return;
        }
        if (event.key === "Enter") {
          event.preventDefault();
          event.stopPropagation();
          commit();
          return;
        }
        event.stopPropagation();
      });
    }

    deleteControl.addEventListener("pointerdown", (event) => {
      cancelled = true;
      event.stopPropagation();
    });
    deleteControl.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      run(() => editor.removeActor(model.id), []);
    });

    inlineEditor.cleanup = () => {
      positioning.disconnect();
      tooltipEditor.cleanup();
      iconPicker.cleanup();
      for (let index = 0; index < hiddenElements.length; index += 1) {
        hiddenElements[index].style.visibility =
          previousVisibility[index];
      }
    };
    positionEditor();
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

    const previousVisibility = header.style.visibility;
    header.style.visibility = "hidden";

    const inlineEditor = document.createElement("div");
    inlineEditor.className = "la-inline-group-editor";
    inlineEditor.setAttribute("role", "group");
    inlineEditor.setAttribute(
      "aria-label",
      `Edit ${model.groupType} group${model.label ? `, ${model.label}` : ""}`,
    );

    const row = document.createElement("div");
    row.className = "la-inline-group-row";

    const typeControl = document.createElement("input");
    typeControl.type = "text";
    typeControl.className = "la-inline-group-type";
    typeControl.dataset.field = "group-type";
    typeControl.placeholder = "Type";
    typeControl.pattern = "[a-z][a-z0-9-]*";
    typeControl.setAttribute("aria-label", "Group type");
    typeControl.value = model.groupType;

    const typeField = document.createElement("div");
    typeField.className = "la-inline-group-field";
    const typeFieldName = document.createElement("span");
    typeFieldName.className = "la-inline-group-field-name";
    typeFieldName.textContent = "Type";
    typeFieldName.setAttribute("aria-hidden", "true");
    typeField.append(typeFieldName, typeControl);

    const labelControl = document.createElement("textarea");
    labelControl.className = "la-inline-group-label";
    labelControl.dataset.field = "group-label";
    labelControl.rows = 1;
    labelControl.placeholder = "Label";
    labelControl.setAttribute("aria-label", "Group label");
    labelControl.value = model.label ?? "";

    const labelField = document.createElement("div");
    labelField.className =
      "la-inline-group-field la-inline-group-label-field";
    const labelFieldName = document.createElement("span");
    labelFieldName.className = "la-inline-group-field-name";
    labelFieldName.textContent = "Label";
    labelFieldName.setAttribute("aria-hidden", "true");
    labelField.append(labelFieldName, labelControl);

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

    const deleteControl = document.createElement("button");
    deleteControl.type = "button";
    deleteControl.className =
      "la-inline-delete-control la-inline-group-delete";
    deleteControl.setAttribute("aria-label", "Delete group and contents");

    actions.append(addSectionControl, ungroupControl, deleteControl);
    row.append(typeField, labelField, actions);
    inlineEditor.append(row);
    frame.append(inlineEditor);

    const dirtyFields = new Set();
    let diagramScale = 1;
    const sizeTypePill = () => {
      const content = typeControl.value || typeControl.placeholder;
      const width = Math.min(
        120,
        Math.max(52, Array.from(content).length * 6.2 + 18),
      );
      typeControl.style.width = `${width * diagramScale}px`;
    };
    sizeTypePill();

    typeControl.addEventListener("input", () => {
      const normalized = normalizeGroupTypeInput(typeControl.value);
      if (typeControl.value !== normalized) {
        typeControl.value = normalized;
      }
      dirtyFields.add("type");
      sizeTypePill();
    });
    labelControl.addEventListener("input", () => {
      dirtyFields.add("label");
    });

    let cancelled = false;
    const commit = (
      focusField = null,
      deferDraw = false,
    ) => {
      const previousDocument = editor.document;
      const patch = {};
      if (dirtyFields.has("type")) {
        patch.groupType = typeControl.value;
      }
      if (dirtyFields.has("label")) {
        patch.label = labelControl.value;
      }
      if (Object.keys(patch).length === 0) {
        return "unchanged";
      }
      try {
        editor.updateItem(model.id, patch);
        if (editor.document === previousDocument) {
          const current = findItemLocation(
            editor.document,
            model.id,
          )?.item;
          typeControl.value = current?.groupType ?? typeControl.value;
          labelControl.value = current?.label ?? labelControl.value;
          dirtyFields.clear();
          sizeTypePill();
          return "unchanged";
        }
        dirtyFields.clear();
        selectedIds = [model.id];
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
        notifyError(error, inlineEditor);
        return "error";
      }
    };

    const flushBeforeAction = () => commit(null, true) !== "error";
    addSectionControl.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (!flushBeforeAction()) {
        return;
      }
      const current = findItemLocation(editor.document, model.id)?.item;
      run(
        () =>
          current?.sections.length > 0
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
    deleteControl.addEventListener("pointerdown", (event) => {
      cancelled = true;
      event.stopPropagation();
    });
    deleteControl.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      run(() => editor.removeItem(model.id), []);
    });

    const cancelInlineEdit = (event) => {
      event.preventDefault();
      event.stopPropagation();
      cancelled = true;
      pendingFocus = null;
      selectedIds = [];
      removeInlineGroupEditor(frame);
      applySelectedVisuals(baseController.svg, selectedIds);
      contextualEditor(frame, layout);
      frame.focus();
    };
    typeControl.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        cancelInlineEdit(event);
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        event.stopPropagation();
        commit();
        return;
      }
      event.stopPropagation();
    });
    labelControl.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        cancelInlineEdit(event);
        return;
      }
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        event.stopPropagation();
        commit();
        return;
      }
      event.stopPropagation();
    });

    const positionEditor = () => {
      if (!inlineEditor.isConnected) {
        return;
      }
      const svgRect = svg.getBoundingClientRect();
      diagramScale = svgRect.width / layout.width;
      sizeTypePill();
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
        "--la-inline-group-gap",
        `${5 * diagramScale}px`,
      );
      inlineEditor.style.setProperty(
        "--la-inline-group-action-gap",
        `${4 * diagramScale}px`,
      );
      inlineEditor.style.setProperty(
        "--la-inline-group-field-gap",
        `${4 * diagramScale}px`,
      );
      inlineEditor.style.setProperty(
        "--la-inline-group-control-height",
        `${20 * diagramScale}px`,
      );
      inlineEditor.style.setProperty(
        "--la-inline-group-font-size",
        `${11 * diagramScale}px`,
      );
      inlineEditor.style.setProperty(
        "--la-inline-group-caption-font-size",
        `${9 * diagramScale}px`,
      );
      inlineEditor.style.setProperty(
        "--la-inline-group-pill-padding",
        `${8 * diagramScale}px`,
      );
      inlineEditor.style.setProperty(
        "--la-inline-group-action-padding",
        `${9 * diagramScale}px`,
      );
      inlineEditor.style.setProperty(
        "--la-inline-group-pill-radius",
        `${10 * diagramScale}px`,
      );
      inlineEditor.style.setProperty(
        "--la-inline-delete-size",
        `${20 * diagramScale}px`,
      );
      inlineEditor.style.setProperty(
        "--la-inline-delete-cross-thickness",
        `${1.5 * diagramScale}px`,
      );
    };

    const positioning = observePosition(svg, positionEditor);

    inlineEditor.addEventListener("pointerdown", (event) => {
      event.stopPropagation();
    });
    inlineEditor.addEventListener("click", (event) => {
      event.stopPropagation();
    });
    inlineEditor.addEventListener("focusout", (event) => {
      if (
        cancelled ||
        inlineEditor.contains(event.relatedTarget)
      ) {
        return;
      }
      commit(null, true);
    });

    inlineEditor.cleanup = () => {
      positioning.disconnect();
      header.style.visibility = previousVisibility;
    };
    positionEditor();
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

    const previousVisibility = label.style.visibility;
    const previousRightRuleStart = rightRule?.getAttribute("x1");
    label.style.visibility = "hidden";

    const inlineEditor = document.createElement("div");
    inlineEditor.className = "la-inline-section-editor";
    inlineEditor.setAttribute("role", "group");
    inlineEditor.setAttribute("aria-label", `Edit section ${model.label}`);

    const labelControl = document.createElement("textarea");
    labelControl.className = "la-inline-section-label";
    labelControl.dataset.field = "section-label";
    labelControl.rows = Math.max(1, model.label.split("\n").length);
    labelControl.wrap = "off";
    labelControl.setAttribute("aria-label", "Section label");
    labelControl.value = model.label;

    const deleteControl = document.createElement("button");
    deleteControl.type = "button";
    deleteControl.className =
      "la-inline-delete-control la-inline-section-delete";
    deleteControl.setAttribute("aria-label", "Delete section");

    inlineEditor.append(labelControl, deleteControl);
    frame.append(inlineEditor);

    let dirty = false;
    let cancelled = false;
    let diagramScale = 1;
    const labelLeft = section.left + 10;
    const ruleGap = 4;
    const sizeLabel = () => {
      const longestLine = Math.max(
        1,
        ...labelControl.value
          .split("\n")
          .map((line) => Array.from(line).length),
      );
      const availableWidth = Math.max(
        20,
        section.right - section.left - 44,
      );
      const labelWidth = Math.min(
        availableWidth,
        Math.max(52, longestLine * 5.6 + 16),
      );
      labelControl.style.width = `${labelWidth * diagramScale}px`;
      rightRule?.setAttribute(
        "x1",
        String(labelLeft + labelWidth + ruleGap),
      );
    };
    labelControl.addEventListener("input", () => {
      dirty = true;
      sizeLabel();
    });

    const commit = (deferDraw = false) => {
      if (!dirty) {
        return "unchanged";
      }
      const previousDocument = editor.document;
      try {
        editor.updateSection(model.id, { label: labelControl.value });
        if (editor.document === previousDocument) {
          const current = findSectionLocation(
            editor.document,
            model.id,
          )?.section;
          labelControl.value = current?.label ?? labelControl.value;
          dirty = false;
          return "unchanged";
        }
        dirty = false;
        selectedIds = [model.id];
        transient = null;
        notifyChange();
        if (deferDraw) {
          scheduleInlineDraw(frame);
        } else {
          draw();
        }
        return "changed";
      } catch (error) {
        notifyError(error, inlineEditor);
        return "error";
      }
    };

    const cancelInlineEdit = (event) => {
      event.preventDefault();
      event.stopPropagation();
      cancelled = true;
      pendingFocus = null;
      selectedIds = [];
      removeInlineSectionEditor(frame);
      applySelectedVisuals(baseController.svg, selectedIds);
      contextualEditor(frame, layout);
      frame.focus();
    };
    labelControl.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        cancelInlineEdit(event);
        return;
      }
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        event.stopPropagation();
        commit();
        return;
      }
      event.stopPropagation();
    });

    deleteControl.addEventListener("pointerdown", (event) => {
      cancelled = true;
      event.stopPropagation();
    });
    deleteControl.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      run(() => editor.removeSection(model.id), []);
    });

    const positionEditor = () => {
      if (!inlineEditor.isConnected) {
        return;
      }
      const svgRect = svg.getBoundingClientRect();
      diagramScale = svgRect.width / layout.width;
      const editorHeight = section.headerHeight - 7;
      sizeLabel();
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
        "--la-inline-section-gap",
        `${4 * diagramScale}px`,
      );
      inlineEditor.style.setProperty(
        "--la-inline-section-padding-y",
        `${4 * diagramScale}px`,
      );
      inlineEditor.style.setProperty(
        "--la-inline-section-padding-x",
        `${8 * diagramScale}px`,
      );
      inlineEditor.style.setProperty(
        "--la-inline-section-radius",
        `${10 * diagramScale}px`,
      );
      inlineEditor.style.setProperty(
        "--la-inline-section-font-size",
        `${10 * diagramScale}px`,
      );
      inlineEditor.style.setProperty(
        "--la-inline-section-line-height",
        `${12 * diagramScale}px`,
      );
      inlineEditor.style.setProperty(
        "--la-inline-delete-size",
        `${20 * diagramScale}px`,
      );
      inlineEditor.style.setProperty(
        "--la-inline-delete-cross-thickness",
        `${1.5 * diagramScale}px`,
      );
    };

    const positioning = observePosition(svg, positionEditor);

    inlineEditor.addEventListener("pointerdown", (event) => {
      event.stopPropagation();
    });
    inlineEditor.addEventListener("click", (event) => {
      event.stopPropagation();
    });
    inlineEditor.addEventListener("focusout", (event) => {
      if (cancelled || inlineEditor.contains(event.relatedTarget)) {
        return;
      }
      commit(true);
    });

    inlineEditor.cleanup = () => {
      positioning.disconnect();
      label.style.visibility = previousVisibility;
      if (rightRule && previousRightRuleStart !== null) {
        rightRule.setAttribute("x1", previousRightRuleStart);
      }
    };
    positionEditor();
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

    const hiddenElements = [
      ...messageElement.querySelectorAll(
        ".la-message-label, .la-tag, .la-tooltip-trigger",
      ),
    ];
    const previousVisibility = hiddenElements.map(
      (element) => element.style.visibility,
    );
    for (const element of hiddenElements) {
      element.style.visibility = "hidden";
    }

    const inlineEditor = document.createElement("div");
    inlineEditor.className = "la-inline-message-editor";
    inlineEditor.setAttribute("role", "group");
    inlineEditor.setAttribute(
      "aria-label",
      `Edit arrow from ${model.source} to ${model.target}`,
    );

    const labelControl = document.createElement("textarea");
    labelControl.className = "la-inline-message-label";
    labelControl.dataset.field = "message-label";
    labelControl.rows = 1;
    labelControl.placeholder = "Label";
    labelControl.setAttribute("aria-label", "Arrow label");
    labelControl.value = model.label ?? "";

    const deleteControl = document.createElement("button");
    deleteControl.type = "button";
    deleteControl.className =
      "la-inline-delete-control la-inline-message-delete";
    deleteControl.setAttribute("aria-label", "Delete arrow");

    const metadata = document.createElement("div");
    metadata.className = "la-inline-message-metadata";

    const tagControl = document.createElement("input");
    tagControl.type = "text";
    tagControl.className = "la-inline-actor-pill";
    tagControl.dataset.field = "message-tag";
    tagControl.placeholder = "Tag";
    tagControl.setAttribute("aria-label", "Arrow tag");
    tagControl.value = model.tag ?? "";

    const tooltip = createInlineTooltipEditor(
      frame,
      model,
      "arrow",
      "message-tooltip-text",
    );
    const {
      wrapper: tooltipWrapper,
      control: tooltipControl,
    } = tooltip;

    const dirtyFields = new Set();
    let diagramScale = 1;
    const sizeTagPill = () => {
      const width = tagControl.value
        ? metadataMetrics(tagControl.value, false).tagWidth
        : 50;
      tagControl.style.width = `${width * diagramScale}px`;
    };
    sizeTagPill();

    labelControl.addEventListener("input", () => {
      dirtyFields.add("label");
    });
    tagControl.addEventListener("input", () => {
      dirtyFields.add("tag");
      sizeTagPill();
    });

    metadata.append(tagControl, tooltipWrapper);
    inlineEditor.append(
      labelControl,
      deleteControl,
      metadata,
    );
    frame.append(inlineEditor);

    let cancelled = false;
    const commit = (
      extraPatch = {},
      focusField = null,
      deferDraw = false,
    ) => {
      const previousDocument = editor.document;
      const patch = { ...extraPatch };
      if (dirtyFields.has("label")) {
        patch.label = labelControl.value;
      }
      if (dirtyFields.has("tag")) {
        patch.tag = tagControl.value;
      }
      if (dirtyFields.has("tooltip")) {
        patch.tooltip = tooltipControl.value;
      }
      if (Object.keys(patch).length === 0) {
        return "unchanged";
      }
      try {
        editor.updateItem(model.id, patch);
        if (editor.document === previousDocument) {
          const current = findItemLocation(
            editor.document,
            model.id,
          )?.item;
          labelControl.value = current?.label ?? "";
          tagControl.value = current?.tag ?? "";
          tooltipControl.value = current?.tooltip ?? "";
          dirtyFields.clear();
          sizeTagPill();
          return "unchanged";
        }
        dirtyFields.clear();
        selectedIds = [model.id];
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
        notifyError(error, inlineEditor);
        return "error";
      }
    };

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
    inlineEditor.append(arrowStyles);

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
      dirtyFields,
      commit,
      selectedFocus: pendingFocus === "message-tooltip-text",
    });

    const positionEditor = () => {
      if (!inlineEditor.isConnected) {
        return;
      }
      const svgRect = svg.getBoundingClientRect();
      diagramScale = svgRect.width / layout.width;
      sizeTagPill();
      inlineEditor.style.left = `${svgRect.left}px`;
      inlineEditor.style.top = `${svgRect.top}px`;
      inlineEditor.style.width = `${svgRect.width}px`;
      inlineEditor.style.height = `${svgRect.height}px`;

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
      const labelY = selfMessage ? row.y - 22 : row.y - 9;
      const labelMetrics = messageLabelMetrics(
        model.label,
        layout.options.messageLabelMaxWidth,
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
      labelControl.style.setProperty(
        "--la-inline-message-label-font-size",
        `${11 * diagramScale}px`,
      );
      labelControl.style.setProperty(
        "--la-inline-message-label-line-height",
        `${13 * diagramScale}px`,
      );

      inlineEditor.style.setProperty(
        "--la-inline-delete-size",
        `${16 * diagramScale}px`,
      );
      inlineEditor.style.setProperty(
        "--la-inline-delete-cross-thickness",
        `${1.25 * diagramScale}px`,
      );
      const deleteSize = 16;
      const deleteGap = 12;
      const arrowRight = selfMessage
        ? source.centerX + loopWidth
        : Math.max(source.centerX, target.centerX);
      deleteControl.style.left = `${
        (arrowRight + deleteGap + deleteSize / 2) * diagramScale
      }px`;
      deleteControl.style.top = `${row.y * diagramScale}px`;

      inlineEditor.style.setProperty(
        "--la-inline-message-pill-gap",
        `${4 * diagramScale}px`,
      );
      inlineEditor.style.setProperty(
        "--la-inline-actor-pill-height",
        `${20 * diagramScale}px`,
      );
      inlineEditor.style.setProperty(
        "--la-inline-actor-pill-padding",
        `${10 * diagramScale}px`,
      );
      inlineEditor.style.setProperty(
        "--la-inline-actor-pill-radius",
        `${10 * diagramScale}px`,
      );
      inlineEditor.style.setProperty(
        "--la-inline-actor-pill-font-size",
        `${10 * diagramScale}px`,
      );
      inlineEditor.style.setProperty(
        "--la-inline-actor-tooltip-size",
        `${20 * diagramScale}px`,
      );
      inlineEditor.style.setProperty(
        "--la-inline-actor-tooltip-icon-size",
        `${14 * diagramScale}px`,
      );
      inlineEditor.style.setProperty(
        "--la-inline-actor-tooltip-font-size",
        `${11 * diagramScale}px`,
      );
      metadata.style.left = `${labelX * diagramScale}px`;
      metadata.style.top = `${
        (row.y + (selfMessage ? 20 : 7)) * diagramScale
      }px`;
      metadata.style.setProperty(
        "--la-inline-message-metadata-shift",
        "0px",
      );

      inlineEditor.style.setProperty(
        "--la-inline-message-arrow-size",
        `${18 * diagramScale}px`,
      );
      inlineEditor.style.setProperty(
        "--la-inline-message-arrow-gap",
        `${3 * diagramScale}px`,
      );
      inlineEditor.style.setProperty(
        "--la-inline-message-arrow-icon-width",
        `${14 * diagramScale}px`,
      );
      inlineEditor.style.setProperty(
        "--la-inline-message-arrow-icon-height",
        `${12 * diagramScale}px`,
      );
      const arrowControlsWidth = 60 * diagramScale;
      const arrowControlsLeft =
        labelX * diagramScale - arrowControlsWidth / 2;
      arrowStyles.style.left = `${arrowControlsLeft}px`;
      arrowStyles.style.top = `${
        (labelTop - 12) * diagramScale
      }px`;

      const metadataRect = metadata.getBoundingClientRect();
      const frameRect = frame.getBoundingClientRect();
      const viewportWidth = innerWidth;
      const leftBoundary = Math.max(8, frameRect.left + 8);
      const rightBoundary = Math.min(
        viewportWidth - 8,
        frameRect.right - 8,
      );
      let metadataShift = 0;
      if (metadataRect.left < leftBoundary) {
        metadataShift = leftBoundary - metadataRect.left;
      } else if (metadataRect.right > rightBoundary) {
        metadataShift = rightBoundary - metadataRect.right;
      }
      metadata.style.setProperty(
        "--la-inline-message-metadata-shift",
        `${metadataShift}px`,
      );
      tooltipEditor.position();
    };

    const positioning = observePosition(svg, positionEditor);

    inlineEditor.addEventListener("pointerdown", (event) => {
      if (
        tooltipEditor.open &&
        !tooltipWrapper.contains(event.target)
      ) {
        tooltipEditor.close(false);
      }
      event.stopPropagation();
    });
    inlineEditor.addEventListener("click", (event) => {
      event.stopPropagation();
    });
    inlineEditor.addEventListener("focusout", (event) => {
      if (
        cancelled ||
        inlineEditor.contains(event.relatedTarget)
      ) {
        return;
      }
      tooltipEditor.close(false);
      commit({}, null, true);
    });

    const cancelInlineEdit = (event) => {
      event.preventDefault();
      event.stopPropagation();
      cancelled = true;
      pendingFocus = null;
      selectedIds = [];
      removeInlineMessageEditor(frame);
      applySelectedVisuals(baseController.svg, selectedIds);
      contextualEditor(frame, layout);
      frame.focus();
    };
    labelControl.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        cancelInlineEdit(event);
        return;
      }
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        event.stopPropagation();
        commit();
        return;
      }
      event.stopPropagation();
    });
    tagControl.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        cancelInlineEdit(event);
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        event.stopPropagation();
        commit();
        return;
      }
      event.stopPropagation();
    });

    deleteControl.addEventListener("pointerdown", (event) => {
      cancelled = true;
      event.stopPropagation();
    });
    deleteControl.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      run(() => editor.removeItem(model.id), []);
    });

    inlineEditor.cleanup = () => {
      positioning.disconnect();
      tooltipEditor.cleanup();
      for (let index = 0; index < hiddenElements.length; index += 1) {
        hiddenElements[index].style.visibility =
          previousVisibility[index];
      }
    };
    positionEditor();
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
    const previousVisibility = label.style.visibility;
    label.style.visibility = "hidden";

    const lines = String(model.label).split("\n");
    const availableWidth = Math.max(
      56,
      layout.contentRight - layout.contentLeft - 20,
    );
    let measuredWidth =
      Math.max(...lines.map((line) => Math.min(46, line.length))) *
        5.5 +
      22;
    measuredWidth = Math.max(measuredWidth, label.getBBox().width + 22);
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
    inlineEditor.cleanup = () => {
      label.style.visibility = previousVisibility;
    };

    const body = document.createElement("div");
    body.className = "la-inline-gap-editor-body";
    body.setAttribute("role", "group");
    body.setAttribute("aria-label", "Edit gap");

    const control = document.createElement("textarea");
    control.className = "la-inline-gap-label";
    control.dataset.field = "gap-label";
    control.setAttribute("aria-label", "Gap label");
    control.rows = lines.length;
    control.wrap = "off";
    control.value = model.label;
    control.style.height = `${labelHeight}px`;

    const deleteSize = 20;
    const deleteControl = document.createElement("button");
    deleteControl.type = "button";
    deleteControl.className =
      "la-inline-delete-control la-inline-gap-delete";
    deleteControl.setAttribute("aria-label", "Delete gap");

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
        "--la-inline-delete-size",
        `${deleteSize * scale}px`,
      );
      deleteControl.style.setProperty(
        "--la-inline-delete-cross-thickness",
        `${1.5 * scale}px`,
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

    let cancelled = false;
    let committedValue = model.label;
    const commit = (focusAfter = false, deferDraw = false) => {
      if (control.value === committedValue) {
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

    body.addEventListener("pointerdown", (event) => {
      event.stopPropagation();
    });
    body.addEventListener("click", (event) => {
      event.stopPropagation();
    });
    body.addEventListener("focusout", (event) => {
      if (
        cancelled ||
        body.contains(event.relatedTarget) ||
        deleteControl.contains(event.relatedTarget)
      ) {
        return;
      }
      commit(false, true);
    });
    control.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        cancelled = true;
        pendingFocus = null;
        selectedIds = [];
        removeInlineGapEditor(frame);
        applySelectedVisuals(baseController.svg, selectedIds);
        contextualEditor(frame, layout);
        frame.focus();
        return;
      }
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        event.stopPropagation();
        commit(true);
        return;
      }
      event.stopPropagation();
    });
    const deleteGap = (event) => {
      event.preventDefault();
      event.stopPropagation();
      cancelled = true;
      run(() => editor.removeItem(model.id), [], body);
    };
    deleteControl.addEventListener("pointerdown", (event) => {
      cancelled = true;
      event.stopPropagation();
    });
    deleteControl.addEventListener("click", deleteGap);

    body.append(control);
    labelEditor.append(body);
    inlineEditor.append(labelEditor);
    gap.append(inlineEditor);
    frame.append(deleteControl);
    queueMicrotask(repositionDeleteControl);
  }

  function contextualEditor(frame, layout) {
    removeContextualEditor(frame);

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
      addInsertionPicker(popover, [
        {
          label: "Add group",
          visibleLabel: "Group",
          icon: "rectangle-dashed",
          fallback: "□",
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

    const closeInsertionPickerAfterHover = (
      trigger,
      hoverTarget,
    ) => {
      const close = () => {
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

    svg.addEventListener(
      "pointerdown",
      (event) => {
        if (event.button !== 0 || selectedIds.length === 0) {
          return;
        }
        const owner = event.target.closest(
          "[data-la-id], [data-owner-id]",
        );
        const ownerId = owner?.dataset.laId ?? owner?.dataset.ownerId;
        if (ownerId && selectedIds.includes(ownerId)) {
          return;
        }

        suppressClick = true;
        event.preventDefault();
        event.stopImmediatePropagation();
        activeCancel?.();

        const focusedControl = frame.querySelector(
          ".la-inline-gap-editor :focus, " +
            ".la-inline-actor-editor :focus, " +
            ".la-inline-group-editor :focus, " +
            ".la-inline-section-editor :focus, " +
            ".la-inline-message-editor :focus",
        );
        focusedControl?.blur();
        if (frame.querySelector(".la-edit-error")) {
          return;
        }

        transient = null;
        baseController.clearSelection();
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
      };

      activeCancel = cancel;
      globalThis.addEventListener("pointermove", onMove);
      globalThis.addEventListener("pointerup", onUp);
      globalThis.addEventListener("pointercancel", cancel);
    });

    frame.addEventListener("keydown", (event) => {
      const editing = event.target.matches("input, textarea, select");
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
    if (pendingInlineDraw !== null) {
      clearTimeout(pendingInlineDraw);
      pendingInlineDraw = null;
    }

    const previousFrame = baseController?.svg?.closest(".la-frame");
    removeContextualEditor(previousFrame);
    baseController?.destroy();
    baseController = renderDiagramForEditor(
      target,
      editor.document,
      options.copySource === false ? "" : editor.source,
      {
        ...options,
        headerActions: [
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
        actorPartActivatesSelection(actorId, field) {
          pendingFocus = field;
          baseController.select(actorId);
        },
        groupPartActivatesSelection(groupId, field) {
          pendingFocus = field;
          baseController.select(groupId);
        },
        messagePartActivatesSelection(messageId, field) {
          pendingFocus = field;
          baseController.select(messageId);
        },
        onSelect(detail) {
          transient = null;
          selectedIds = detail.id ? [detail.id] : [];
          pendingFocus ??=
            detail.kind === "gap"
              ? "gap-label"
              : detail.kind === "actor"
                ? "actor-name"
                : detail.kind === "group"
                  ? "group-label"
                  : detail.kind === "section"
                    ? "section-label"
                    : detail.kind === "message"
                      ? "message-label"
                      : null;
          applySelectedVisuals(baseController.svg, selectedIds);
          const frame = baseController.svg.closest(".la-frame");
          contextualEditor(frame, baseController.layout);
          focusPendingField(frame, true);
        },
      },
    );

    const frame = baseController.svg.closest(".la-frame");
    decorate(frame, baseController.svg, baseController.layout);
    applySelectedVisuals(baseController.svg, selectedIds);
    contextualEditor(frame, baseController.layout);
    focusPendingField(frame);
  }

  draw();

  return {
    destroy() {
      destroyed = true;
      activeCancel?.();
      if (pendingInlineDraw !== null) {
        clearTimeout(pendingInlineDraw);
        pendingInlineDraw = null;
      }
      const frame = baseController?.svg?.closest(".la-frame");
      removeContextualEditor(frame);
      baseController?.destroy();
    },
  };
}
