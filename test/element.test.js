import test from "node:test";
import assert from "node:assert/strict";

import { LinesAndArrowsElement } from "../src/element.js";

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
