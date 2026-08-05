import test from "node:test";
import assert from "node:assert/strict";

import {
  resolvePaletteTheme,
  resolveTheme,
  themes,
} from "../src/theme.js";

test("keeps the built-in themes unchanged when no palette is supplied", () => {
  assert.equal(resolveTheme("light"), themes.light);
  assert.equal(resolveTheme("dark"), themes.dark);
  assert.equal(resolvePaletteTheme(themes.light, null), themes.light);
  assert.equal(themes.light.canvas, "#F6F7F9");
  assert.equal(themes.dark.canvas, "#111319");
  assert.equal(
    themes.light.groupFill,
    "color-mix(in oklab, #20242C 5%, transparent)",
  );
  assert.equal(
    themes.light.groupNestedFill,
    "color-mix(in oklab, #20242C 9%, transparent)",
  );
  assert.equal(
    themes.dark.groupFill,
    "color-mix(in oklab, #E7EAF0 5%, transparent)",
  );
  assert.equal(
    themes.dark.groupNestedFill,
    "color-mix(in oklab, #E7EAF0 9%, transparent)",
  );
});

test("derives a transparent semantic theme from four palette colors", () => {
  const theme = resolvePaletteTheme(
    themes.light,
    {
      background: "#FFF4B8",
      foreground: "#2A2318",
      accent: "#FFD166",
      danger: "#B00020",
    },
    "transparent",
  );

  assert.equal(theme.canvas, "transparent");
  assert.equal(theme.surface, "#FFF4B8");
  assert.equal(theme.text, "#2A2318");
  assert.equal(theme.actor, "#FFD166");
  assert.equal(theme.actorText, "#2A2318");
  assert.equal(theme.danger, "#B00020");
  assert.match(theme.groupFill, /color-mix\(in oklab/);
  assert.equal(
    theme.line,
    "color-mix(in oklab, #2A2318 56%, #FFF4B8)",
  );
  assert.equal(
    theme.lifeline,
    "color-mix(in oklab, #FFD166 17%, transparent)",
  );
  assert.equal(
    theme.tagFill,
    "color-mix(in oklab, #FFD166 20%, #FFF4B8)",
  );
  assert.equal(
    theme.accentSoft,
    "color-mix(in oklab, #FFD166 18%, #FFF4B8)",
  );
});

test("allows explicit contrast colors and partial palettes", () => {
  const theme = resolvePaletteTheme(themes.dark, {
    accent: "var(--brand-accent)",
    accentForeground: "var(--brand-accent-text)",
  });

  assert.equal(theme.surface, themes.dark.surface);
  assert.equal(theme.actor, "var(--brand-accent)");
  assert.equal(theme.actorText, "var(--brand-accent-text)");
  assert.equal(theme.danger, themes.dark.danger);
});

test("rejects invalid palette and canvas values", () => {
  assert.throws(
    () => resolvePaletteTheme(themes.light, "blue"),
    /palette must be an object/,
  );
  assert.throws(
    () => resolvePaletteTheme(themes.light, { accent: "" }),
    /palette\.accent must be a non-empty CSS color/,
  );
  assert.throws(
    () =>
      resolvePaletteTheme(themes.light, {
        accent: "url(https://example.com/paint.svg#color)",
      }),
    /palette\.accent must be a safe CSS color/,
  );
  assert.throws(
    () => resolvePaletteTheme(themes.light, {}, "glass"),
    /canvasBackground must be either/,
  );
});
