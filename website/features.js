import "./runtime.js?v=20260821-1";
import { initializeSiteTheme } from "./site.js?v=20260806-2";

const themePreviewSource = `@Client
@API
@Store

Client -> API: Request
critical Verify
  API -> Store: Read
  Store --> API: Result
API --> Client: Response`;

const themePreviewPalettes = {
  "midnight-cobalt": {
    scheme: "dark",
    palette: {
      background: "#0B1020",
      foreground: "#EAF0FF",
      accent: "#7AA2FF",
      danger: "#FF6B7A",
    },
  },
  "phosphor-terminal": {
    scheme: "dark",
    palette: {
      background: "#07110B",
      foreground: "#B9FFC9",
      accent: "#33E277",
      danger: "#FF6577",
    },
  },
  "newsprint-monochrome": {
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

const theme = initializeSiteTheme();

for (const feature of document.querySelectorAll("[data-feature]")) {
  const sourceCode = feature.querySelector(".feature-source code");
  const source = sourceCode.textContent.trim();
  const diagram = feature.querySelector("[data-feature-diagram]");
  const frame = feature.querySelector(".feature-diagram");
  const error = feature.querySelector(".feature-error");

  diagram.branding = false;
  diagram.theme = theme.theme;

  try {
    diagram.source = source;
    frame.classList.add("is-ready");
  } catch (problem) {
    frame.classList.add("is-failed");
    error.textContent =
      problem instanceof Error ? problem.message : "Unable to render example.";
  }

  diagram.addEventListener("la-error", (event) => {
    error.textContent =
      event.detail.error?.message ?? "Unable to render example.";
  });
}

const themePreviewError = document.querySelector(".theme-preview-error");

try {
  for (const diagram of document.querySelectorAll("[data-theme-preview]")) {
    const preview = themePreviewPalettes[diagram.dataset.themePreview];
    if (!preview) {
      throw new Error("Unknown theme preview.");
    }
    diagram.branding = false;
    diagram.theme = preview.scheme;
    diagram.palette = preview.palette;
    diagram.canvasBackground = "transparent";
    diagram.source = themePreviewSource;
  }
} catch (problem) {
  themePreviewError.textContent =
    problem instanceof Error
      ? problem.message
      : "Unable to render the theme previews.";
}
