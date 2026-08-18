const themes = {
  light: {
    name: "light",
    canvas: "#F6F7F9",
    surface: "#F6F7F9",
    text: "#20242C",
    mutedText: "#6A7280",
    faintText: "#8A919D",
    line: "#A9B0BC",
    lifeline: "rgb(52 89 200 / 0.17)",
    groupFill: overlay("#20242C", 5),
    groupNestedFill: overlay("#20242C", 9),
    sectionLine: "#CDD2DC",
    actor: "#3459C8",
    actorHover: "#2F50B5",
    actorSelected: "#5274D6",
    actorText: "#F9FAFF",
    accent: "#3459C8",
    accentSoft: "#DFE6FF",
    tagFill: "#D4E0FF",
    tagText: "#29468F",
    selection: "#3459C8",
    tooltip: "#20242C",
    tooltipText: "#F6F7F9",
    danger: "#B4384A",
    dangerText: "#F9FAFF",
  },
  dark: {
    name: "dark",
    canvas: "#111319",
    surface: "#111319",
    text: "#E7EAF0",
    mutedText: "#A0A7B3",
    faintText: "#7F8794",
    line: "#7C8594",
    lifeline: "rgb(157 181 255 / 0.17)",
    groupFill: overlay("#E7EAF0", 5),
    groupNestedFill: overlay("#E7EAF0", 9),
    sectionLine: "#373E4A",
    actor: "#9DB5FF",
    actorHover: "#ACC0FF",
    actorSelected: "#667FCB",
    actorText: "#111319",
    accent: "#9DB5FF",
    accentSoft: "#26345C",
    tagFill: "#2C3C69",
    tagText: "#DCE5FF",
    selection: "#AFC3FF",
    tooltip: "#E7EAF0",
    tooltipText: "#111319",
    danger: "#FF8FA0",
    dangerText: "#111319",
  },
};

const PALETTE_COLOR_KEYS = [
  "background",
  "foreground",
  "accent",
  "accentForeground",
  "danger",
  "dangerForeground",
];

function normalizePalette(palette) {
  if (palette === null || palette === undefined) {
    return null;
  }
  if (typeof palette !== "object" || Array.isArray(palette)) {
    throw new TypeError("palette must be an object or null.");
  }

  const normalized = {};
  for (const key of PALETTE_COLOR_KEYS) {
    if (palette[key] === undefined) {
      continue;
    }
    if (typeof palette[key] !== "string" || !palette[key].trim()) {
      throw new TypeError(`palette.${key} must be a non-empty CSS color.`);
    }
    const value = palette[key].trim();
    if (!CSS.supports("color", value)) {
      throw new TypeError(`palette.${key} must be a valid CSS color.`);
    }
    normalized[key] = value;
  }
  return normalized;
}

function parseHexColor(value) {
  const match = /^#([\da-f]{3}|[\da-f]{6})$/i.exec(value);
  if (!match) {
    return null;
  }
  const hex =
    match[1].length === 3
      ? [...match[1]].map((digit) => `${digit}${digit}`).join("")
      : match[1];
  return [0, 2, 4].map((offset) =>
    Number.parseInt(hex.slice(offset, offset + 2), 16),
  );
}

function relativeLuminance(color) {
  const rgb = parseHexColor(color);
  if (!rgb) {
    return null;
  }
  const channels = rgb.map((channel) => {
    const value = channel / 255;
    return value <= 0.04045
      ? value / 12.92
      : ((value + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function contrastRatio(first, second) {
  const firstLuminance = relativeLuminance(first);
  const secondLuminance = relativeLuminance(second);
  if (firstLuminance === null || secondLuminance === null) {
    return null;
  }
  const lighter = Math.max(firstLuminance, secondLuminance);
  const darker = Math.min(firstLuminance, secondLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

function contrastingColor(fill, first, second, fallback) {
  const firstRatio = contrastRatio(fill, first);
  const secondRatio = contrastRatio(fill, second);
  if (firstRatio === null || secondRatio === null) {
    return fallback;
  }
  return firstRatio >= secondRatio ? first : second;
}

function overlay(color, percentage) {
  return `color-mix(in oklab, ${color} ${percentage}%, transparent)`;
}

function mix(first, percentage, second) {
  return `color-mix(in oklab, ${first} ${percentage}%, ${second})`;
}

export function resolvePaletteTheme(
  baseTheme,
  palette,
  canvasBackground = "solid",
) {
  const normalized = normalizePalette(palette);
  if (!normalized) {
    return baseTheme;
  }
  if (canvasBackground !== "solid" && canvasBackground !== "transparent") {
    throw new TypeError(
      'canvasBackground must be either "solid" or "transparent".',
    );
  }

  const background = normalized.background ?? baseTheme.surface;
  const foreground = normalized.foreground ?? baseTheme.text;
  const accent = normalized.accent ?? baseTheme.accent;
  const danger = normalized.danger ?? baseTheme.danger;
  const accentForeground =
    normalized.accentForeground ??
    contrastingColor(
      accent,
      foreground,
      background,
      baseTheme.actorText,
    );
  const dangerForeground =
    normalized.dangerForeground ??
    contrastingColor(
      danger,
      foreground,
      background,
      baseTheme.dangerText,
    );

  return {
    name: baseTheme.name,
    canvas: canvasBackground === "transparent" ? "transparent" : background,
    surface: background,
    text: foreground,
    mutedText: overlay(foreground, 68),
    faintText: overlay(foreground, 48),
    line: mix(foreground, 56, background),
    lifeline: overlay(accent, 17),
    groupFill: overlay(foreground, 5),
    groupNestedFill: overlay(foreground, 9),
    sectionLine: overlay(foreground, 28),
    actor: accent,
    actorHover: mix(accent, 88, foreground),
    actorSelected: mix(accent, 78, background),
    actorText: accentForeground,
    accent,
    accentSoft: mix(accent, 18, background),
    tagFill: mix(accent, 20, background),
    tagText: foreground,
    selection: accent,
    tooltip: foreground,
    tooltipText: background,
    danger,
    dangerText: dangerForeground,
  };
}

export function resolveTheme(theme = "auto") {
  if (theme === "light" || theme === "dark") {
    return themes[theme];
  }

  return matchMedia("(prefers-color-scheme: dark)").matches
    ? themes.dark
    : themes.light;
}
