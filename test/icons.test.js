import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  PHOSPHOR_ICON_VERSION,
  phosphorIconCatalog,
  phosphorIconResolver,
  recommendedActorIconNames,
  withDefaultIconOptions,
} from "../src/icons.js";

const shippedExampleFiles = [
  new URL("../README.md", import.meta.url),
  new URL("../syntax.md", import.meta.url),
  new URL("../agents.md", import.meta.url),
  new URL("../demo/index.html", import.meta.url),
];

test("ships the pinned Phosphor provider as the default icon source", () => {
  assert.equal(PHOSPHOR_ICON_VERSION, "2.1.1");
  assert.equal(phosphorIconCatalog.length, 1512);
  assert.equal(
    phosphorIconResolver("database"),
    "https://cdn.jsdelivr.net/npm/@phosphor-icons/core@2.1.1/assets/bold/database-bold.svg",
  );
  assert.equal(phosphorIconResolver(""), null);
});

test("does not assume custom providers support Phosphor names", () => {
  const customResolver = (name) => `/custom/${name}.svg`;
  const withoutCatalog = withDefaultIconOptions({
    iconResolver: customResolver,
  });
  assert.equal(withoutCatalog.iconResolver, customResolver);
  assert.deepEqual(withoutCatalog.iconCatalog, []);

  const withCatalog = withDefaultIconOptions({
    iconResolver: customResolver,
    iconCatalog: ["database"],
  });
  assert.deepEqual(withCatalog.iconCatalog, ["database"]);
});

test("recommended and shipped example icons exist in the default catalog", () => {
  const available = new Set(phosphorIconCatalog);
  const documented = shippedExampleFiles.flatMap((file) =>
    [...readFileSync(file, "utf8").matchAll(
      /^\s*(?:icon|tooltip-icon) ([a-z0-9-]+)\s*$/gm,
    )]
      .map((match) => match[1])
      .filter((name) => name !== "catalog-identifier"),
  );

  for (const name of new Set([
    ...recommendedActorIconNames,
    ...documented,
  ])) {
    assert.ok(available.has(name), `${name} must exist in Phosphor 2.1.1`);
  }
});
