export const themes = {
  light: {
    name: "light",
    canvas: "#F6F7F9",
    text: "#20242C",
    mutedText: "#6A7280",
    faintText: "#8A919D",
    line: "#A9B0BC",
    lifeline: "#D8DCE3",
    groupFill: "#ECEFF5",
    groupNestedFill: "#E5E9F1",
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
  },
  dark: {
    name: "dark",
    canvas: "#111319",
    text: "#E7EAF0",
    mutedText: "#A0A7B3",
    faintText: "#7F8794",
    line: "#7C8594",
    lifeline: "#303641",
    groupFill: "#191D25",
    groupNestedFill: "#1E232D",
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
  },
};

export function resolveTheme(theme = "auto", host = globalThis) {
  if (theme === "light" || theme === "dark") {
    return themes[theme];
  }

  const isDark = Boolean(
    host?.matchMedia?.("(prefers-color-scheme: dark)")?.matches,
  );
  return isDark ? themes.dark : themes.light;
}
