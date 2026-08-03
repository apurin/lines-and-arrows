const root = document.documentElement;
const storageKey = "lines-and-arrows-theme";

const readSavedTheme = () => {
  try {
    const saved = localStorage.getItem(storageKey);
    return saved === "light" || saved === "dark" ? saved : null;
  } catch {
    return null;
  }
};

const readSystemTheme = () =>
  matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";

export const initializeSiteTheme = () => {
  let activeTheme = readSavedTheme() ?? readSystemTheme();
  const buttons = [...document.querySelectorAll("[data-site-theme]")];

  const apply = (theme, persist = false) => {
    activeTheme = theme === "dark" ? "dark" : "light";
    root.dataset.theme = activeTheme;

    for (const diagram of document.querySelectorAll("lines-and-arrows")) {
      const fixedTheme = diagram.dataset.fixedTheme;
      diagram.theme =
        fixedTheme === "light" ||
        fixedTheme === "dark" ||
        fixedTheme === "auto"
          ? fixedTheme
          : activeTheme;
    }

    for (const button of buttons) {
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.siteTheme === activeTheme),
      );
    }

    if (persist) {
      try {
        localStorage.setItem(storageKey, activeTheme);
      } catch {
        // The selected theme still applies when storage is unavailable.
      }
    }
  };

  for (const button of buttons) {
    button.addEventListener("click", () => {
      apply(button.dataset.siteTheme, true);
    });
  }

  apply(activeTheme);

  return {
    apply,
    get theme() {
      return activeTheme;
    },
  };
};
