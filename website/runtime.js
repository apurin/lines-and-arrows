export const CDN_VERSION = "0.12.0";

const autoUrl = `https://cdn.jsdelivr.net/npm/lines-and-arrows@${CDN_VERSION}/dist/lines-and-arrows.auto.min.js`;

try {
  await import(autoUrl);
} catch (error) {
  for (const loading of document.querySelectorAll(".diagram-loading")) {
    loading.textContent =
      "Unable to load the diagram runtime. Check the connection and reload.";
  }
  document.body?.classList.remove("is-loading");
  throw error;
}
