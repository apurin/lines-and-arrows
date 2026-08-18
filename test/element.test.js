import test from "node:test";
import assert from "node:assert/strict";

import {
  defineLinesAndArrows,
  LinesAndArrowsElement,
} from "../src/element.js";

test("defines the web component idempotently", () => {
  let registered = null;
  const registry = {
    get() {
      return registered;
    },
    define(_name, constructor) {
      registered = constructor;
    },
  };

  assert.equal(
    defineLinesAndArrows("lines-and-arrows-test", registry),
    LinesAndArrowsElement,
  );
  assert.equal(
    defineLinesAndArrows("lines-and-arrows-test", registry),
    LinesAndArrowsElement,
  );
});

test("refuses a custom-element name owned by another constructor", () => {
  class ExistingElement {}
  const registry = {
    get() {
      return ExistingElement;
    },
    define() {
      throw new Error("must not redefine");
    },
  };

  assert.throws(
    () => defineLinesAndArrows("existing-element", registry),
    /already registered with a different constructor/,
  );
});

test("keeps history buttons on by default and reflects the opt-out attribute", () => {
  const attributes = new Map();
  const element = new LinesAndArrowsElement();
  element.getAttribute = (name) => attributes.get(name) ?? null;
  element.setAttribute = (name, value) => attributes.set(name, String(value));
  element.removeAttribute = (name) => attributes.delete(name);

  assert.equal(
    LinesAndArrowsElement.observedAttributes.includes("history-controls"),
    true,
  );
  assert.equal(element.historyControls, true);

  element.historyControls = false;
  assert.equal(attributes.get("history-controls"), "false");
  assert.equal(element.historyControls, false);

  element.historyControls = true;
  assert.equal(attributes.has("history-controls"), false);
  assert.equal(element.historyControls, true);
});

test("keeps copy source on by default and reflects the opt-out attribute", () => {
  const attributes = new Map();
  const element = new LinesAndArrowsElement();
  element.getAttribute = (name) => attributes.get(name) ?? null;
  element.setAttribute = (name, value) => attributes.set(name, String(value));
  element.removeAttribute = (name) => attributes.delete(name);

  assert.equal(
    LinesAndArrowsElement.observedAttributes.includes("copy-source"),
    true,
  );
  assert.equal(element.copySource, true);

  element.copySource = false;
  assert.equal(attributes.get("copy-source"), "false");
  assert.equal(element.copySource, false);

  element.copySource = true;
  assert.equal(attributes.has("copy-source"), false);
  assert.equal(element.copySource, true);
});

test("uses a transparent canvas by default and reflects a solid override", () => {
  const attributes = new Map();
  const element = new LinesAndArrowsElement();
  element.getAttribute = (name) => attributes.get(name) ?? null;
  element.setAttribute = (name, value) => attributes.set(name, String(value));

  assert.equal(
    LinesAndArrowsElement.observedAttributes.includes("canvas-background"),
    true,
  );
  assert.equal(element.canvasBackground, "transparent");

  element.canvasBackground = "solid";
  assert.equal(attributes.get("canvas-background"), "solid");
  assert.equal(element.canvasBackground, "solid");

  element.canvasBackground = "transparent";
  assert.equal(attributes.get("canvas-background"), "transparent");
  assert.equal(element.canvasBackground, "transparent");
  assert.throws(
    () => {
      element.canvasBackground = "glass";
    },
    /canvasBackground must be either/,
  );
});

test("opts into read-only actor selection and stores a pending actor name", () => {
  const attributes = new Map();
  const element = new LinesAndArrowsElement();
  element.getAttribute = (name) => attributes.get(name) ?? null;
  element.setAttribute = (name, value) => attributes.set(name, String(value));
  element.removeAttribute = (name) => attributes.delete(name);

  assert.equal(
    LinesAndArrowsElement.observedAttributes.includes("selectable-actors"),
    true,
  );
  assert.equal(
    LinesAndArrowsElement.observedAttributes.includes("selectable"),
    false,
  );
  assert.equal(element.selectableActors, false);

  element.selectableActors = true;
  assert.equal(attributes.get("selectable-actors"), "");
  assert.equal(element.selectableActors, true);

  element.selectActor("API");
  assert.equal(element.selectedActorName, "API");
  element.clearActorSelection();
  assert.equal(element.selectedActorName, null);

  element.selectableActors = false;
  element.attributeChangedCallback("selectable-actors");
  assert.equal(attributes.has("selectable-actors"), false);
  assert.equal(element.selectableActors, false);
  element.selectableActors = true;
  assert.equal(element.selectedActorName, null);
  assert.throws(() => element.selectActor(""), /non-empty actor name/);
});
