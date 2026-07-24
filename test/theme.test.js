import test from "node:test";
import assert from "node:assert/strict";

import { themes } from "../src/theme.js";

function luminance(hex) {
  const channels = hex
    .match(/[0-9a-f]{2}/gi)
    .map((channel) => Number.parseInt(channel, 16) / 255)
    .map((channel) =>
      channel <= 0.04045
        ? channel / 12.92
        : ((channel + 0.055) / 1.055) ** 2.4,
    );

  return (
    0.2126 * channels[0] +
    0.7152 * channels[1] +
    0.0722 * channels[2]
  );
}

function contrast(first, second) {
  const firstLuminance = luminance(first);
  const secondLuminance = luminance(second);
  return (
    (Math.max(firstLuminance, secondLuminance) + 0.05) /
    (Math.min(firstLuminance, secondLuminance) + 0.05)
  );
}

for (const [name, theme] of Object.entries(themes)) {
  test(`${name} theme keeps actor labels readable`, () => {
    assert.ok(
      contrast(theme.actor, theme.actorText) >= 4.5,
      `${name} actor text must meet WCAG AA contrast`,
    );
  });

  test(`${name} theme keeps primary and muted text readable`, () => {
    assert.ok(contrast(theme.canvas, theme.text) >= 7);
    assert.ok(contrast(theme.canvas, theme.mutedText) >= 4.5);
  });
}
