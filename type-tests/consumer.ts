import "lines-and-arrows/auto";

import {
  DiagramEditor,
  defineLinesAndArrows,
  renderDiagram,
  renderEditor,
  type ActorSelectionDetail,
  type ActorSelectionSnapshot,
  type ChangeDetail,
  type EditorRenderOptions,
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
  copySource: false,
  selectableActors: true,
  initialSelectedActorName: "Client",
  onActorSelect(detail: ActorSelectionDetail) {
    const actor: ActorSelectionSnapshot | null = detail.actor;
    void actor?.tooltip;
  },
});
controller.selectActor("Client");
const selectedActorName: string | null = controller.selectedActorName;
void selectedActorName;
controller.clearActorSelection();
controller.destroy();

const editorOptions: EditorRenderOptions = {
  historyControls: false,
  onSelect(detail: SelectionDetail) {
    void detail.kind;
  },
};
void editorOptions;
const editorController = renderEditor(
  document.body,
  editor.document,
  editorOptions,
);
editorController.select(editor.document.actors[0].id!);
editorController.clearSelection();
editorController.destroy();

const element = document.body.appendChild(new LinesAndArrowsElement());
element.palette = palette;
element.selectableActors = true;
element.selectActor("Client");
const elementActorName: string | null = element.selectedActorName;
void elementActorName;
element.clearActorSelection();
element.historyControls = false;
const historyControls: boolean = element.historyControls;
void historyControls;
element.copySource = false;
const copySource: boolean = element.copySource;
void copySource;
element.addEventListener("la-change", (event) => {
  const detail: ChangeDetail = event.detail;
  void detail.source;
});
element.addEventListener("la-actor-select", (event) => {
  const detail: ActorSelectionDetail = event.detail;
  void detail.actor?.tag;
});

const constructor: typeof LinesAndArrowsElement = defineLinesAndArrows();
void constructor;
