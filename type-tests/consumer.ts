import "lines-and-arrows/auto";

import {
  DiagramEditor,
  defineLinesAndArrows,
  renderDiagram,
  type ChangeDetail,
  type SelectionDetail,
  type ThemePalette,
} from "lines-and-arrows";
import {
  LinesAndArrowsSyntaxError,
  parse,
  serialize,
  validate,
} from "lines-and-arrows/syntax";
import { LinesAndArrowsElement } from "lines-and-arrows/element";

const parsed = parse("Client -> API: Request");
const source: string = serialize(parsed);
const validation = validate(source);
if (!validation.valid) {
  throw new Error(validation.error.message);
}

const syntaxError = new LinesAndArrowsSyntaxError("Invalid source", 1);
const line: number = syntaxError.line;
void line;

const editor = new DiagramEditor(parsed);
const palette: ThemePalette = {
  background: "#ffffff",
  foreground: "#111111",
  accent: "#3459c8",
  danger: "#b4384a",
};
const controller = renderDiagram(document.body, editor.document, {
  palette,
  onSelect(detail: SelectionDetail) {
    void detail.kind;
  },
});
controller.destroy();

const element = document.body.appendChild(new LinesAndArrowsElement());
element.palette = palette;
element.addEventListener("la-change", (event) => {
  const detail: ChangeDetail = event.detail;
  void detail.source;
});

const constructor: typeof LinesAndArrowsElement = defineLinesAndArrows();
void constructor;
