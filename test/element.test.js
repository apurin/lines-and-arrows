import test from "node:test";
import assert from "node:assert/strict";

import { LinesAndArrowsElement } from "../src/element.js";
import {
  phosphorIconCatalog,
  phosphorIconResolver,
} from "../src/icons.js";

test("uses Phosphor icons by default and clears assumptions on override", () => {
  const element = new LinesAndArrowsElement();

  assert.equal(element.iconResolver, phosphorIconResolver);
  assert.equal(element.iconCatalog.length, phosphorIconCatalog.length);

  element.iconResolver = (name) => `/custom/${name}.svg`;
  assert.deepEqual(element.iconCatalog, []);
});

test("stores an isolated icon catalog for the visual editor", () => {
  const element = new LinesAndArrowsElement();
  const catalog = [
    "user",
    {
      name: "warning",
      label: "Warning",
      keywords: ["alert"],
    },
  ];

  element.iconCatalog = catalog;
  catalog.push("cloud");

  assert.equal(element.iconCatalog.length, 2);
  assert.equal(element.iconCatalog[1].name, "warning");
  element.iconCatalog.push("cloud");
  assert.equal(element.iconCatalog.length, 2);
  assert.throws(
    () => {
      element.iconCatalog = "user";
    },
    /iconCatalog must be an array or null/,
  );

  element.iconCatalog = null;
  assert.deepEqual(element.iconCatalog, []);
});

test("stores isolated layout overrides for compact embeds", () => {
  const element = new LinesAndArrowsElement();
  const layout = { marginX: 36, marginTop: 20 };

  element.layout = layout;
  layout.marginX = 80;

  assert.deepEqual(element.layout, { marginX: 36, marginTop: 20 });
  element.layout.marginX = 90;
  assert.equal(element.layout.marginX, 36);
  assert.throws(
    () => {
      element.layout = "compact";
    },
    /layout must be an object or null/,
  );

  element.layout = null;
  assert.equal(element.layout, null);
});

test("reflects the selectable view-mode setting", () => {
  const element = new LinesAndArrowsElement();
  const attributes = new Map();
  element.getAttribute = (name) => attributes.get(name) ?? null;
  element.setAttribute = (name, value) => {
    attributes.set(name, String(value));
  };
  element.removeAttribute = (name) => {
    attributes.delete(name);
  };

  assert.equal(element.selectable, true);
  element.selectable = false;
  assert.equal(element.selectable, false);
  assert.equal(attributes.get("selectable"), "false");

  element.selectable = true;
  assert.equal(element.selectable, true);
  assert.equal(attributes.has("selectable"), false);
  assert.ok(
    LinesAndArrowsElement.observedAttributes.includes("selectable"),
  );
});
