import { CDN_VERSION } from "./runtime.js?v=20260821-1";
import { initializeSiteTheme } from "./site.js?v=20260806-2";

initializeSiteTheme();

const diagram = document.querySelector("#constructor-diagram");
const stage = document.querySelector("[data-constructor-stage]");
const error = document.querySelector("#constructor-error");
const embedCode = document.querySelector("#constructor-embed-code");
const codeSummary = document.querySelector("#constructor-code-summary");
const selectableActorsInput = document.querySelector(
  "[data-option-selectable-actors]",
);
const modeToggleInput = document.querySelector("[data-option-mode-toggle]");
const actorSelectionExampleInput = document.querySelector(
  "[data-option-actor-selection-example]",
);
const brandingInput = document.querySelector("[data-option-branding]");
const copySourceInput = document.querySelector(
  "[data-option-copy-source]",
);
const transparentInput = document.querySelector("[data-option-transparent]");
const resetButton = document.querySelector("[data-reset-constructor]");
const copyButton = document.querySelector("[data-copy-embed]");
const copyStatus = document.querySelector("#constructor-copy-status");

const storageKey = "lines-and-arrows-constructor-v1";

const initialSource = `// Powered by https://lines-and-arrows.dev/
@Customer
@API

Customer -> API: Request`;

const themeOptions = {
  auto: {
    label: "Auto",
    scheme: "auto",
    palette: null,
  },
  "default-light": {
    label: "Light",
    scheme: "light",
    palette: null,
  },
  "default-dark": {
    label: "Dark",
    scheme: "dark",
    palette: null,
  },
  "midnight-cobalt": {
    label: "Midnight Cobalt",
    scheme: "dark",
    palette: {
      background: "#0B1020",
      foreground: "#EAF0FF",
      accent: "#7AA2FF",
      danger: "#FF6B7A",
    },
  },
  "phosphor-terminal": {
    label: "Phosphor Terminal",
    scheme: "dark",
    palette: {
      background: "#07110B",
      foreground: "#B9FFC9",
      accent: "#33E277",
      danger: "#FF6577",
    },
  },
  "newsprint-monochrome": {
    label: "Newsprint Monochrome",
    scheme: "light",
    palette: {
      background: "#F4F0E8",
      foreground: "#191919",
      accent: "#191919",
      accentForeground: "#F4F0E8",
      danger: "#C43737",
    },
  },
};

const defaultState = Object.freeze({
  initialMode: "view",
  modeToggleExample: false,
  selectableActors: false,
  actorSelectionExample: false,
  branding: true,
  copySource: true,
  transparent: true,
  theme: "auto",
  source: initialSource,
});

const readSavedState = () => {
  try {
    const savedState = JSON.parse(globalThis.localStorage.getItem(storageKey));
    if (!savedState || typeof savedState !== "object") {
      return { ...defaultState };
    }

    const restoredState = { ...defaultState };
    if (["view", "edit"].includes(savedState.initialMode)) {
      restoredState.initialMode = savedState.initialMode;
    }
    for (const key of [
      "modeToggleExample",
      "selectableActors",
      "actorSelectionExample",
      "branding",
      "copySource",
      "transparent",
    ]) {
      if (typeof savedState[key] === "boolean") {
        restoredState[key] = savedState[key];
      }
    }
    if (themeOptions[savedState.theme]) {
      restoredState.theme = savedState.theme;
    }
    if (typeof savedState.source === "string") {
      restoredState.source = savedState.source;
    }

    if (!restoredState.selectableActors) {
      restoredState.actorSelectionExample = false;
    }
    return restoredState;
  } catch {
    return { ...defaultState };
  }
};

const state = readSavedState();

let generatedHtml = "";
let copyResetTimer = null;

const escapeHtmlText = (value) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

const formatSource = (source) =>
  source
    .trim()
    .split("\n")
    .map((line) => `  ${escapeHtmlText(line)}`)
    .join("\n");

const buildEnhancementScript = (palette, actorSelectionExample) => {
  const lines = [
    '<script type="module">',
    '  const diagram = document.querySelector("#customer-api");',
  ];

  if (palette) {
    const entries = Object.entries(palette).map(
      ([name, value]) => `    ${name}: "${value}",`,
    );
    lines.push("  diagram.palette = {", ...entries, "  };");
  }

  if (actorSelectionExample) {
    lines.push(
      '  const selection = document.querySelector("#selection-result");',
      '  diagram.addEventListener("la-actor-select", ({ detail }) => {',
      "    selection.textContent = JSON.stringify(detail, null, 2);",
      "  });",
    );
  }

  lines.push("</script>");
  return lines.join("\n");
};

const buildHtml = () => {
  const theme = themeOptions[state.theme];
  const packageVersion = CDN_VERSION.split(".").slice(0, 2).join(".");
  const customPalette = Boolean(theme.palette);
  const editing = state.initialMode === "edit";
  const needsDiagramId = customPalette || state.actorSelectionExample;
  const attributes = [
    needsDiagramId ? 'id="customer-api"' : null,
    `mode="${editing ? "edit" : "view"}"`,
    `theme="${theme.scheme}"`,
    state.selectableActors ? "selectable-actors" : null,
    `branding="${state.branding}"`,
    !state.copySource ? 'copy-source="false"' : null,
    `canvas-background="${state.transparent ? "transparent" : "solid"}"`,
    'label="Sequence diagram"',
  ].filter(Boolean);
  const attributeLines = attributes.map((value) => `  ${value}`).join("\n");
  const selectionResult = state.actorSelectionExample
    ? '\n\n<pre id="selection-result">Select an actor</pre>'
    : "";
  const enhancementScript = needsDiagramId
    ? `\n\n${buildEnhancementScript(theme.palette, state.actorSelectionExample)}`
    : "";
  const toggleButton = state.modeToggleExample
    ? `<button type="button" onclick="const diagram=this.nextElementSibling;diagram.mode=diagram.mode==='edit'?'view':'edit';this.textContent=diagram.mode==='edit'?'Done':'Edit diagram'">${editing ? "Done" : "Edit diagram"}</button>\n\n`
    : "";

  return `<!doctype html>
<script type="module"
  src="https://cdn.jsdelivr.net/npm/lines-and-arrows@${packageVersion}/dist/lines-and-arrows.auto.min.js">
</script>

${toggleButton}<lines-and-arrows
${attributeLines}
>
${formatSource(state.source)}
</lines-and-arrows>${selectionResult}${enhancementScript}`;
};

const highlightEmbedCode = () => {
  embedCode.textContent = generatedHtml;
  globalThis.Prism?.highlightElement?.(embedCode);
};

const renderCode = () => {
  const theme = themeOptions[state.theme];
  const editing = state.initialMode === "edit";
  generatedHtml = buildHtml();
  highlightEmbedCode();

  const initialStateDescription = editing ? "Edit initially" : "View initially";
  const interactionDescriptions = [];
  if (state.modeToggleExample) {
    interactionDescriptions.push("view/edit toggle example on");
  }
  interactionDescriptions.push(
    `selectable actors ${state.selectableActors ? "on" : "off"}`,
    `copy source ${state.copySource ? "on" : "off"}`,
  );
  codeSummary.textContent = `${initialStateDescription}, ${interactionDescriptions.join(
    ", ",
  )}, branding ${
    state.branding ? "on" : "off"
  }, ${theme.label.toLowerCase()} theme${
    state.actorSelectionExample ? ", selection handler example on" : ""
  }.`;
};

const renderControlState = () => {
  for (const input of document.querySelectorAll("[data-initial-mode]")) {
    input.checked = input.value === state.initialMode;
  }
  for (const input of document.querySelectorAll("[data-diagram-theme]")) {
    input.checked = input.value === state.theme;
  }
  modeToggleInput.checked = state.modeToggleExample;
  selectableActorsInput.checked = state.selectableActors;
  actorSelectionExampleInput.checked = state.actorSelectionExample;
  brandingInput.checked = state.branding;
  copySourceInput.checked = state.copySource;
  transparentInput.checked = state.transparent;
};

const persistState = () => {
  try {
    globalThis.localStorage.setItem(storageKey, JSON.stringify(state));
  } catch {
    // The constructor remains usable when browser storage is unavailable.
  }
};

const configurePreview = () => {
  diagram.mode = "edit";
  diagram.selectableActors = false;
  diagram.canvasBackground = "transparent";
  diagram.branding = false;
  diagram.copySource = true;
};

const renderPreview = () => {
  const theme = themeOptions[state.theme];
  diagram.dataset.fixedTheme = theme.scheme;
  stage.dataset.previewTheme = state.theme;
  diagram.theme = theme.scheme;
  diagram.palette = theme.palette;
};

const render = () => {
  renderControlState();
  renderPreview();
  renderCode();
  persistState();
};

for (const input of document.querySelectorAll("[data-initial-mode]")) {
  input.addEventListener("change", () => {
    if (!input.checked) {
      return;
    }
    state.initialMode = ["view", "edit"].includes(input.value)
      ? input.value
      : "view";
    render();
  });
}

modeToggleInput.addEventListener("change", () => {
  state.modeToggleExample = modeToggleInput.checked;
  render();
});

for (const input of document.querySelectorAll("[data-diagram-theme]")) {
  input.addEventListener("change", () => {
    if (!input.checked || !themeOptions[input.value]) {
      return;
    }
    state.theme = input.value;
    render();
  });
}

selectableActorsInput.addEventListener("change", () => {
  state.selectableActors = selectableActorsInput.checked;
  if (!state.selectableActors) {
    state.actorSelectionExample = false;
  }
  render();
});

actorSelectionExampleInput.addEventListener("change", () => {
  state.actorSelectionExample = actorSelectionExampleInput.checked;
  if (state.actorSelectionExample) {
    state.selectableActors = true;
  }
  render();
});

brandingInput.addEventListener("change", () => {
  state.branding = brandingInput.checked;
  render();
});

copySourceInput.addEventListener("change", () => {
  state.copySource = copySourceInput.checked;
  render();
});

transparentInput.addEventListener("change", () => {
  state.transparent = transparentInput.checked;
  render();
});

diagram.addEventListener("la-change", (event) => {
  state.source = event.detail.source;
  error.textContent = "";
  renderCode();
  persistState();
});

diagram.addEventListener("la-error", (event) => {
  error.textContent =
    event.detail.error?.message ?? "Unable to update the diagram.";
});

copyButton.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(generatedHtml);
    copyButton.textContent = "Copied";
    copyStatus.textContent = "Embed HTML copied to the clipboard.";
    globalThis.clearTimeout(copyResetTimer);
    copyResetTimer = globalThis.setTimeout(() => {
      copyButton.textContent = "Copy HTML";
    }, 1800);
  } catch {
    copyStatus.textContent =
      "The browser could not copy automatically. Select the code and copy it manually.";
  }
});

resetButton.addEventListener("click", () => {
  Object.assign(state, defaultState);
  diagram.source = state.source;
  configurePreview();
  error.textContent = "";
  copyStatus.textContent = "Constructor reset to its defaults.";
  render();
});

try {
  configurePreview();
  try {
    diagram.source = state.source;
  } catch {
    Object.assign(state, defaultState);
    diagram.source = state.source;
  }
  render();
  stage.classList.add("is-ready");
  document.body.classList.remove("is-loading");
} catch (problem) {
  stage.classList.add("is-failed");
  document.body.classList.remove("is-loading");
  error.textContent =
    problem instanceof Error
      ? problem.message
      : "Unable to load the editable preview.";
}

globalThis.addEventListener("load", highlightEmbedCode, { once: true });
