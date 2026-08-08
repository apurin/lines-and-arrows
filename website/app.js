import {
  defineLinesAndArrows,
  parse,
  phosphorIconCatalog,
  phosphorIconResolver,
} from "./runtime.js?v=20260808-1";
import { initializeSiteTheme } from "./site.js?v=20260806-2";

defineLinesAndArrows();

const heroSource = `@Client
  icon browser

@API Gateway
  icon network

@Primary DB
  icon database

@Replica DB
  icon hard-drives

@Failover Controller
  icon heartbeat
  tooltip Promotes a replica only after quorum confirms the outage
  tooltip-icon shield-check

Client -> API Gateway: Submit transaction
API Gateway -> Primary DB: Write transaction
  tag idempotent
  tooltip The retry keeps the transaction key\\nThe database recognizes the write\\ninstead of applying it twice
  tooltip-icon key
Primary DB -> Primary DB: Append WAL record
gap Primary region stops acknowledging traffic
Failover Controller ->x Primary DB: Health probe expires
  tag timeout
choice Recovery path
  | quorum confirms the outage
    Failover Controller -> Replica DB: Promote replica
    Replica DB -> Replica DB: Replay replicated WAL
    Replica DB --> Failover Controller: Ready for writes
    API Gateway -> Replica DB: Retry transaction
  | primary reconnects
    Failover Controller -> Primary DB: Verify commit status
    Primary DB --> Failover Controller: WAL entry found
    API Gateway -> Primary DB: Retry transaction safely
API Gateway --> Client: Transaction confirmed`;

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

const theme = initializeSiteTheme();
diagram.theme = theme.theme;
diagram.palette = {
  background: "var(--paper-raised)",
  foreground: "var(--ink)",
  accent: "var(--accent)",
  danger: "var(--error)",
};
diagram.canvasBackground = "transparent";

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
