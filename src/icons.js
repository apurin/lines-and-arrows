import { phosphorIconNames } from "./phosphor-icon-names.js";

const PHOSPHOR_ICON_VERSION = "2.1.1";
const PHOSPHOR_ICON_WEIGHT = "bold";

const PHOSPHOR_ICON_BASE =
  `https://cdn.jsdelivr.net/npm/@phosphor-icons/core@${PHOSPHOR_ICON_VERSION}` +
  `/assets/${PHOSPHOR_ICON_WEIGHT}`;

export const phosphorIconCatalog = phosphorIconNames;
const phosphorIconNameSet = new Set(phosphorIconNames);

export const recommendedActorIconNames = Object.freeze([
  // People, clients, and runtimes.
  "user",
  "users",
  "browser",
  "device-mobile",
  "desktop",
  "terminal",
  "cloud",
  "robot",

  // Data and service infrastructure.
  "database",
  "queue",
  "hard-drives",
  "desktop-tower",
  "gear-six",
  "globe",
  "envelope",
  "package",

  // Infrastructure and integration.
  "network",
  "tree-structure",
  "stack",
  "cube",
  "plug",
  "webhooks-logo",
  "broadcast",
  "cpu",

  // Content and communication.
  "folder",
  "file-text",
  "tray",
  "calendar",
  "chat-circle",
  "phone",
  "bell",
  "paper-plane-tilt",

  // Platform services and operations.
  "key",
  "identification-card",
  "vault",
  "heartbeat",
  "magnifying-glass",
  "chart-line",
  "test-tube",
  "bug",

  // Organizations and business systems.
  "bank",
  "credit-card",
  "shopping-cart",
  "storefront",
  "buildings",
  "factory",
  "truck",
  "map-pin",
]);

// Only catalog names resolve to a URL. Unknown identifiers stay in the
// document, and renderers show their generic fallback for them.
export function phosphorIconResolver(name) {
  const normalizedName = String(name ?? "").trim();
  if (!phosphorIconNameSet.has(normalizedName)) {
    return null;
  }
  return `${PHOSPHOR_ICON_BASE}/${encodeURIComponent(normalizedName)}-${PHOSPHOR_ICON_WEIGHT}.svg`;
}
