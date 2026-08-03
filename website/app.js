import {
  defineLinesAndArrows,
  parse,
  phosphorIconCatalog,
  phosphorIconResolver,
} from "./runtime.js?v=20260803-2";
import { initializeSiteTheme } from "./site.js?v=20260803-2";

defineLinesAndArrows();

const heroSource = `@Developer
  icon terminal
  tag human

@Review Agent
  icon robot
  tag skeptical
  tooltip Reads the diff, not the confidence\\nin the commit message
  tooltip-icon magnifying-glass

@CI
  icon check-circle
  tag gate

@Canary
  icon bird
  tag small slice
  tooltip Carries a small slice of real traffic
  tooltip-icon gauge

@Production
  icon cloud
  tag live
  tooltip The only actor allowed to wake someone up
  tooltip-icon bell

Developer -> Review Agent: Open a suspiciously small\\nFriday PR
  tag small diff
  tooltip The adjective is doing most of the risk assessment
  tooltip-icon warning
Review Agent -> CI: Prove "small" means safe
critical Earn the green button
  CI -> CI: Test, lint,\\nand scan
  CI --> Review Agent: Checks pass
Review Agent --> Developer: Approved, with supervision
Developer -> Canary: Deploy to a slice of traffic
  tag canary
  tooltip Real users, deliberately few of them
  tooltip-icon bird
gap One suspiciously quiet observation window
// The cross means this build never reaches Production.
Canary ->x Production: Stop rollout on a slow query
  tag blocked
  tooltip Production never receives this build
  tooltip-icon warning
Canary --> Developer: Add the missing index
Developer -> CI: Patch and rebuild
CI --> Canary: Signed artifact ready
Canary -> Production: Promote the healthy build
Production --> Developer: Release is healthy
  tag no page
  tooltip The nicest alert is the one that never fires
  tooltip-icon bell-slash`;

const heroLayout = {
  actorHeight: 46,
  actorGap: 96,
  marginX: 38,
  marginTop: 20,
  timelineTopGap: 28,
  messageHeight: 42,
  gapHeight: 48,
  groupHeaderHeight: 26,
  sectionHeaderHeight: 25,
  groupPaddingBottom: 8,
  groupGap: 8,
  bottomPadding: 20,
};

const diagram = document.querySelector("#hero-diagram");
const stage = diagram.closest(".diagram-stage");
const surfaceButtons = [
  ...document.querySelectorAll("[data-hero-surface]"),
];
const sourceEditor = document.querySelector("#hero-source-editor");
const sourceInput = document.querySelector("#hero-source");
const sourceError = document.querySelector("#hero-source-error");
const applySourceButton = document.querySelector("#apply-hero-source");
const modeStatus = document.querySelector("#hero-mode-status");

diagram.iconResolver = phosphorIconResolver;
diagram.iconCatalog = phosphorIconCatalog;
diagram.layout = heroLayout;

const theme = initializeSiteTheme();
diagram.theme = theme.theme;

try {
  parse(heroSource);
  diagram.source = heroSource;
  sourceInput.value = heroSource;
  stage.classList.add("is-ready");
} catch (problem) {
  stage.querySelector(".diagram-loading").textContent =
    problem instanceof Error ? problem.message : "Unable to render the diagram.";
}

const setHeroSurface = (surface) => {
  for (const button of surfaceButtons) {
    button.setAttribute(
      "aria-pressed",
      String(button.dataset.heroSurface === surface),
    );
  }

  if (surface === "source") {
    diagram.hidden = true;
    sourceEditor.hidden = false;
    sourceInput.value = diagram.source;
    modeStatus.textContent =
      "Source mode. Apply with the button or Command-Enter.";
    sourceInput.focus();
    return;
  }

  sourceEditor.hidden = true;
  diagram.hidden = false;
  diagram.selectable = surface === "edit";
  diagram.mode = surface;
  modeStatus.textContent =
    surface === "edit"
      ? "Edit mode. Select an object to change it, then drag to reorder."
      : "View mode. Read-only diagram.";
};

for (const button of surfaceButtons) {
  button.addEventListener("click", () => {
    setHeroSurface(button.dataset.heroSurface);
  });
}

const applyHeroSource = () => {
  sourceError.textContent = "";

  try {
    const result = diagram.replaceSource(sourceInput.value);
    if (result !== null && result !== false) {
      sourceInput.value = diagram.source;
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

diagram.addEventListener("la-change", (event) => {
  sourceInput.value = event.detail.source;
  sourceError.textContent = "";
});

diagram.addEventListener("la-error", (event) => {
  sourceError.textContent =
    event.detail.error?.message ?? "Unable to apply source.";
});
