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
