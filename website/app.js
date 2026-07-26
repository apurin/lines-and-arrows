import {
  defineLinesAndArrows,
  parse,
  phosphorIconCatalog,
  phosphorIconResolver,
} from "../src/index.js";
import {
  createIconPicker,
  EDIT_STYLES,
} from "../src/edit-render.js";

defineLinesAndArrows();

const root = document.documentElement;
const iconResolver = phosphorIconResolver;
const compactDiagramLayout = {
  actorHeight: 44,
  actorGap: 56,
  marginX: 36,
  marginTop: 20,
  timelineTopGap: 24,
  messageHeight: 50,
  gapHeight: 54,
  groupHeaderHeight: 28,
  sectionHeaderHeight: 25,
  groupPaddingBottom: 8,
  groupGap: 8,
  bottomPadding: 20,
};
const heroDiagramLayout = {
  ...compactDiagramLayout,
  actorHeight: 42,
  marginTop: 18,
  timelineTopGap: 20,
  messageHeight: 36,
  gapHeight: 40,
  groupHeaderHeight: 24,
  sectionHeaderHeight: 20,
  groupPaddingBottom: 6,
  groupGap: 6,
  bottomPadding: 18,
};
const themeButtons = [...document.querySelectorAll("[data-site-theme]")];

const readSavedTheme = () => {
  try {
    const saved = localStorage.getItem("lines-and-arrows-theme");
    return saved === "light" || saved === "dark" ? saved : null;
  } catch {
    return null;
  }
};

const systemTheme = matchMedia("(prefers-color-scheme: dark)").matches
  ? "dark"
  : "light";
let activeTheme = readSavedTheme() ?? systemTheme;

const applyTheme = (theme, persist = false) => {
  activeTheme = theme === "dark" ? "dark" : "light";
  root.dataset.theme = activeTheme;

  for (const diagram of document.querySelectorAll("lines-and-arrows")) {
    diagram.theme = activeTheme;
  }

  for (const frame of document.querySelectorAll("[data-icon-picker-frame]")) {
    frame.dataset.theme = activeTheme;
  }

  for (const button of themeButtons) {
    button.setAttribute(
      "aria-pressed",
      String(button.dataset.siteTheme === activeTheme),
    );
  }

  if (persist) {
    try {
      localStorage.setItem("lines-and-arrows-theme", activeTheme);
    } catch {
      // The theme still applies when storage is unavailable.
    }
  }
};

for (const button of themeButtons) {
  button.addEventListener("click", () => {
    applyTheme(button.dataset.siteTheme, true);
  });
}

applyTheme(activeTheme);

const heroSource = `@Human
  icon user
  tag tiny request
  tooltip A request whose size has not yet been independently verified
  tooltip-icon magnifying-glass

@Agent
  icon robot
  tag on it

@Workspace
  icon code
  tag repo and tests

@Lines & Arrows
  icon arrow-right
  tag narrator

Human -> Agent: Make one tiny change
parallel First pass
  | code
    Agent -> Workspace: Update the obvious file
  | verification
    Agent -> Workspace: Run everything
    Workspace --> Agent: One unrelated failure
choice The "unrelated" failure
  | genuinely unrelated
    Agent -> Lines & Arrows: Draw the evidence trail
  | related after all
    Agent -> Workspace: Fix the surprise dependency
gap One green build later
Agent -> Lines & Arrows: Explain the handoff
Lines & Arrows --> Human: Tiny change, full documentary`;

const heroDiagram = document.querySelector("#hero-diagram");
const heroStage = heroDiagram.closest(".diagram-stage");
const surfaceButtons = [
  ...document.querySelectorAll("[data-hero-surface]"),
];
const sourceEditor = document.querySelector("#hero-source-editor");
const sourceInput = document.querySelector("#hero-source");
const sourceError = document.querySelector("#hero-source-error");
const applySourceButton = document.querySelector("#apply-hero-source");
const modeStatus = document.querySelector("#hero-mode-status");

heroDiagram.iconResolver = iconResolver;
heroDiagram.iconCatalog = phosphorIconCatalog;
heroDiagram.layout = heroDiagramLayout;
heroDiagram.theme = activeTheme;
heroDiagram.source = heroSource;
sourceInput.value = heroSource;
heroStage.classList.add("is-ready");

const setHeroSurface = (surface) => {
  for (const button of surfaceButtons) {
    button.setAttribute(
      "aria-pressed",
      String(button.dataset.heroSurface === surface),
    );
  }

  if (surface === "source") {
    heroDiagram.mode = "edit";
    heroDiagram.hidden = true;
    sourceEditor.hidden = false;
    sourceInput.value = heroDiagram.source;
    modeStatus.textContent =
      "Source mode. Apply with the button or Command-Enter.";
    sourceInput.focus();
    return;
  }

  sourceEditor.hidden = true;
  heroDiagram.hidden = false;
  heroDiagram.selectable = surface !== "view";
  heroDiagram.mode = surface;
  modeStatus.textContent =
    surface === "edit"
      ? "Edit mode. Select an object to change it, then drag to reorder."
      : "View mode. Read-only diagram without selection controls.";
};

for (const button of surfaceButtons) {
  button.addEventListener("click", () => {
    setHeroSurface(button.dataset.heroSurface);
  });
}

const applyHeroSource = () => {
  sourceError.textContent = "";

  try {
    const result = heroDiagram.replaceSource(sourceInput.value);
    if (result !== null && result !== false) {
      sourceInput.value = heroDiagram.source;
    }
  } catch (problem) {
    sourceError.textContent =
      problem instanceof Error ? problem.message : "Unable to apply source.";
  }
};

applySourceButton.addEventListener("click", applyHeroSource);
sourceInput.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
    event.preventDefault();
    applyHeroSource();
  }
});

heroDiagram.addEventListener("la-change", (event) => {
  sourceInput.value = event.detail.source;
  sourceError.textContent = "";
});

heroDiagram.addEventListener("la-error", (event) => {
  sourceError.textContent =
    event.detail.error?.message ?? "Unable to apply source.";
});

for (const playground of document.querySelectorAll("[data-playground]")) {
  const source = playground.querySelector("textarea");
  const diagram = playground.querySelector("lines-and-arrows");
  const error = playground.querySelector(".source-error");
  const sourcePane = playground.querySelector(".source-pane");
  const diagramPane = playground.querySelector(".diagram-pane");
  const applySource = playground.querySelector(
    "[data-apply-playground-source]",
  );
  const status = playground.querySelector("[data-playground-status]");
  const buttons = [
    ...playground.querySelectorAll("[data-playground-surface]"),
  ];

  diagram.iconResolver = iconResolver;
  diagram.layout = compactDiagramLayout;
  diagram.theme = activeTheme;

  const setSurface = (surface) => {
    for (const button of buttons) {
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.playgroundSurface === surface),
      );
    }

    if (surface === "source") {
      diagram.mode = "edit";
      diagramPane.hidden = true;
      sourcePane.hidden = false;
      source.value = diagram.source;
      status.textContent =
        "Source mode. Apply with the button or Command-Enter.";
      source.focus();
      return;
    }

    sourcePane.hidden = true;
    diagramPane.hidden = false;
    diagram.selectable = surface !== "view";
    diagram.mode = surface;
    status.textContent =
      surface === "edit"
        ? "Edit mode. Select an object to change it, then drag to reorder."
        : "View mode. Read-only diagram without selection controls.";
  };

  for (const button of buttons) {
    button.addEventListener("click", () => {
      setSurface(button.dataset.playgroundSurface);
    });
  }

  const applySourceEdit = () => {
    error.textContent = "";

    try {
      const result = diagram.replaceSource(source.value);
      if (result !== null && result !== false) {
        source.value = diagram.source;
        playground.dataset.state = "ready";
      }
    } catch (problem) {
      playground.dataset.state = "error";
      error.textContent =
        problem instanceof Error ? problem.message : "Unable to apply source.";
    }
  };

  applySource.addEventListener("click", applySourceEdit);
  source.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      applySourceEdit();
    }
  });

  diagram.addEventListener("la-change", (event) => {
    source.value = event.detail.source;
    error.textContent = "";
    playground.dataset.state = "ready";
  });

  diagram.addEventListener("la-error", (event) => {
    playground.dataset.state = "error";
    error.textContent =
      event.detail.error?.message ?? "Unable to apply source.";
  });

  try {
    parse(source.value);
    diagram.source = source.value;
    error.textContent = "";
    playground.dataset.state = "ready";
    diagramPane.classList.add("is-ready");
  } catch (problem) {
    playground.dataset.state = "error";
    error.textContent =
      problem instanceof Error ? problem.message : "Unable to parse source.";
  }
}

const iconPickerHost = document.querySelector("[data-icon-picker-host]");

if (iconPickerHost) {
  let selectedActorIcon = "robot";

  const mountIconPicker = () => {
    iconPickerHost.replaceChildren();

    const style = document.createElement("style");
    style.textContent = EDIT_STYLES;

    const frame = document.createElement("div");
    frame.className = "la-frame icon-picker-frame";
    frame.dataset.iconPickerFrame = "";
    frame.dataset.theme = activeTheme;

    const pickerAnchor = document.createElement("div");
    const picker = createIconPicker(
      pickerAnchor,
      selectedActorIcon,
      (icon) => {
        selectedActorIcon = icon;
        mountIconPicker();
      },
      {
        catalog: phosphorIconCatalog,
        resolver: iconResolver,
        label: "Choose actor icon",
        clearLabel: "No actor icon",
        defaultText: "+",
        focusOnOpen: false,
      },
    );

    pickerAnchor.append(picker);
    frame.append(style, pickerAnchor);
    iconPickerHost.append(frame);
    picker.openPicker();
  };

  mountIconPicker();
}

const tabButtons = [...document.querySelectorAll("[data-code-tab]")];
const copyButton = document.querySelector("[data-copy-active]");

const selectCodePanel = (button) => {
  for (const candidate of tabButtons) {
    const selected = candidate === button;
    candidate.setAttribute("aria-selected", String(selected));
    candidate.tabIndex = selected ? 0 : -1;
    document.querySelector(`#${candidate.dataset.codeTab}`).hidden = !selected;
  }
};

for (const button of tabButtons) {
  button.addEventListener("click", () => selectCodePanel(button));
  button.addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
      return;
    }

    event.preventDefault();
    const current = tabButtons.indexOf(button);
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? tabButtons.length - 1
          : (current + (event.key === "ArrowRight" ? 1 : -1) +
              tabButtons.length) %
            tabButtons.length;

    selectCodePanel(tabButtons[next]);
    tabButtons[next].focus();
  });
}

if (tabButtons.length > 0 && copyButton) {
  selectCodePanel(tabButtons[0]);

  copyButton.addEventListener("click", async () => {
    const activeTab = tabButtons.find(
      (button) => button.getAttribute("aria-selected") === "true",
    );
    const code = document.querySelector(
      `#${activeTab.dataset.codeTab} code`,
    ).textContent;
    const originalLabel = copyButton.textContent;

    try {
      await navigator.clipboard.writeText(code);
      copyButton.textContent = "Copied";
    } catch {
      copyButton.textContent = "Copy failed";
    }

    window.setTimeout(() => {
      copyButton.textContent = originalLabel;
    }, 1400);
  });
}
