import test from "node:test";
import assert from "node:assert/strict";

import {
  PHOSPHOR_ICON_VERSION,
  phosphorIconCatalog,
  phosphorIconResolver,
  recommendedActorIconNames,
  withDefaultIconOptions,
} from "../src/icons.js";

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

test("ships six complete rows of available recommended actor icons", () => {
  assert.equal(recommendedActorIconNames.length, 48);
  assert.equal(new Set(recommendedActorIconNames).size, 48);
  assert.deepEqual(
    recommendedActorIconNames.slice(0, 8),
    [
      "user",
      "users",
      "browser",
      "device-mobile",
      "desktop",
      "terminal",
      "cloud",
      "robot",
    ],
  );

  const available = new Set(phosphorIconCatalog);
  for (const name of recommendedActorIconNames) {
    assert.ok(available.has(name), `${name} must be available`);
  }
});
