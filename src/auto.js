import { defineLinesAndArrows } from "./element.js";

if (
  typeof customElements !== "undefined" &&
  typeof HTMLElement !== "undefined"
) {
  defineLinesAndArrows();
}
