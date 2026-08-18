export const CDN_VERSION = "0.12.0";

const localDevelopment =
  location.hostname === "127.0.0.1" || location.hostname === "localhost";
const packageBase = localDevelopment
  ? ".."
  : `https://cdn.jsdelivr.net/npm/lines-and-arrows@${CDN_VERSION}`;
const cacheKey = localDevelopment ? new URL(import.meta.url).search : "";
const autoUrl =
  `${packageBase}/dist/lines-and-arrows.auto.min.js${cacheKey}`;

try {
  await import(autoUrl);
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
