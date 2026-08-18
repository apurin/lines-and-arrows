export const CDN_VERSION = "0.9.0";

const CDN_URL =
  `https://cdn.jsdelivr.net/npm/lines-and-arrows@${CDN_VERSION}` +
  "/dist/lines-and-arrows.min.js";
const localDevelopment =
  location.hostname === "127.0.0.1" || location.hostname === "localhost";
const runtimeUrl = localDevelopment ? "../src/index.js" : CDN_URL;

let runtime;
try {
  runtime = await import(runtimeUrl);
} catch (error) {
  for (const loading of document.querySelectorAll(".diagram-loading")) {
    loading.textContent =
      "Unable to load the diagram runtime. Check the connection and reload.";
  }
  for (const link of document.querySelectorAll(
    '.showcase-contents-list a[href^="#"]',
  )) {
    const targetId = link.getAttribute("href")?.slice(1);
    if (targetId && !document.getElementById(targetId)) {
      link.closest("li")?.remove();
    }
  }
  document.body?.classList.remove("is-loading");
  throw error;
}

export const {
  defineLinesAndArrows,
  parse,
  phosphorIconCatalog,
  phosphorIconResolver,
} = runtime;
