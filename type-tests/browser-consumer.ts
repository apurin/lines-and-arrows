import "lines-and-arrows/auto";

import {
  renderDiagram,
  type ActorDetails,
  type ThemePalette,
} from "lines-and-arrows";
import { defineLinesAndArrows } from "lines-and-arrows/element";

const palette: ThemePalette = {
  background: "#ffffff",
  foreground: "#111111",
  accent: "#3459c8",
  danger: "#b4384a",
};

const controller = renderDiagram(
  document.body,
  "Client -> API: Request",
  {
    palette,
    selectableActors: true,
    onActorSelect(actor: ActorDetails | null) {
      void actor?.tooltip;
    },
  },
);
const svg: SVGSVGElement = controller.svg;
void svg;
controller.selectActor("Client");
controller.selectActor(null);
controller.destroy();

defineLinesAndArrows();
const element = document.createElement("lines-and-arrows");
element.source = "Client -> API: Request";
element.mode = "edit";
element.theme = "auto";
element.palette = palette;
element.selectActor(null);
element.addEventListener("la-change", (event) => {
  const source: string = event.detail.source;
  void source;
});
element.addEventListener("la-actor-select", (event) => {
  const actor: ActorDetails | null = event.detail;
  void actor?.tag;
});
element.addEventListener("la-error", (event) => {
  const error: Error = event.detail.error;
  void error;
});
