import {
  defineLinesAndArrows,
  parse,
} from "./runtime.js?v=20260803-2";
import { initializeSiteTheme } from "./site.js?v=20260803-2";

defineLinesAndArrows();

const featureLayout = {
  actorHeight: 48,
  actorGap: 60,
  marginX: 36,
  marginTop: 24,
  timelineTopGap: 26,
  messageHeight: 52,
  gapHeight: 56,
  groupHeaderHeight: 28,
  sectionHeaderHeight: 25,
  groupPaddingBottom: 10,
  groupGap: 8,
  bottomPadding: 24,
};

const themePreviewLayout = {
  actorHeight: 40,
  actorGap: 36,
  marginX: 18,
  marginTop: 12,
  timelineTopGap: 22,
  messageHeight: 42,
  bottomPadding: 12,
};

const themePreviewSource = `@Browser
@API

Browser -> API: Ask
API --> Browser: Answer`;

const theme = initializeSiteTheme();

for (const feature of document.querySelectorAll("[data-feature]")) {
  const sourceCode = feature.querySelector(".feature-source code");
  const source = sourceCode.textContent.trim();
  const diagram = feature.querySelector("[data-feature-diagram]");
  const frame = feature.querySelector(".feature-diagram");
  const figure = feature.querySelector(".feature-figure");
  const error = feature.querySelector(".feature-error");
  const title = feature.querySelector("h2").textContent.trim();
  const toolbar = document.createElement("div");
  const switcher = document.createElement("div");
  const viewButton = document.createElement("button");
  const editButton = document.createElement("button");
  const status = document.createElement("p");

  toolbar.className = "feature-toolbar";
  switcher.className = "surface-switcher feature-mode-switcher";
  switcher.setAttribute("role", "group");
  switcher.setAttribute("aria-label", `${title} diagram mode`);

  viewButton.type = "button";
  viewButton.textContent = "View";
  viewButton.dataset.featureMode = "view";
  viewButton.setAttribute("aria-pressed", "true");

  editButton.type = "button";
  editButton.textContent = "Edit";
  editButton.dataset.featureMode = "edit";
  editButton.setAttribute("aria-pressed", "false");

  status.className = "visually-hidden";
  status.setAttribute("aria-live", "polite");
  status.textContent = "View mode. Read-only diagram.";

  switcher.append(viewButton, editButton);
  toolbar.append(switcher);
  figure.prepend(toolbar);
  figure.append(status);

  diagram.layout = featureLayout;
  diagram.theme = theme.theme;

  const setMode = (mode) => {
    const editing = mode === "edit";
    viewButton.setAttribute("aria-pressed", String(!editing));
    editButton.setAttribute("aria-pressed", String(editing));
    diagram.selectable = editing;
    diagram.mode = editing ? "edit" : "view";
    status.textContent = editing
      ? "Edit mode. Select an object to change it, then drag to reorder."
      : "View mode. Read-only diagram.";
  };

  viewButton.addEventListener("click", () => setMode("view"));
  editButton.addEventListener("click", () => setMode("edit"));

  try {
    parse(source);
    diagram.source = source;
    setMode("view");
    frame.classList.add("is-ready");
  } catch (problem) {
    error.textContent =
      problem instanceof Error ? problem.message : "Unable to render example.";
  }

  diagram.addEventListener("la-change", (event) => {
    sourceCode.textContent = event.detail.source;
    error.textContent = "";
  });

  diagram.addEventListener("la-error", (event) => {
    error.textContent =
      event.detail.error?.message ?? "Unable to render example.";
  });
}

const themePreviewError = document.querySelector(".theme-preview-error");

try {
  parse(themePreviewSource);

  for (const diagram of document.querySelectorAll("[data-theme-preview]")) {
    diagram.layout = themePreviewLayout;
    diagram.source = themePreviewSource;
  }
} catch (problem) {
  themePreviewError.textContent =
    problem instanceof Error
      ? problem.message
      : "Unable to render the theme previews.";
}
