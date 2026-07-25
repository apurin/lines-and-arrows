export type ThemeName = "light" | "dark" | "auto";
export type EditorMode = "view" | "edit";
export type Arrow = "->" | "-->" | "->x";
export type TimelineItemKind = "message" | "gap" | "group";

export interface Actor {
  type: "actor";
  id?: string;
  name: string;
  icon: string | null;
  tag: string | null;
  tooltip: string | null;
  tooltipIcon: string | null;
  line: number;
  inferred?: boolean;
}

export interface Message {
  type: "message";
  id: string;
  source: string;
  target: string;
  arrow: Arrow;
  label: string | null;
  tag: string | null;
  tooltip: string | null;
  tooltipIcon: string | null;
  line: number;
}

export interface Gap {
  type: "gap";
  id: string;
  label: string;
  line: number;
}

export interface Section {
  type: "section";
  id: string;
  label: string;
  items: TimelineItem[];
  line: number;
}

export interface Group {
  type: "group";
  id: string;
  groupType: string;
  label: string;
  items: TimelineItem[];
  sections: Section[];
  line: number;
}

export type TimelineItem = Message | Gap | Group;

export interface DiagramDocument {
  type: "diagram";
  actors: Actor[];
  items: TimelineItem[];
  comments: Array<{
    type: "comment";
    text: string;
    line: number;
    indent: number;
  }>;
  explicitActors: boolean;
}

export interface Theme {
  name: "light" | "dark";
  canvas: string;
  text: string;
  mutedText: string;
  faintText: string;
  line: string;
  lifeline: string;
  groupFill: string;
  groupNestedFill: string;
  sectionLine: string;
  actor: string;
  actorHover: string;
  actorSelected: string;
  actorText: string;
  accent: string;
  accentSoft: string;
  tagFill: string;
  tagText: string;
  selection: string;
  tooltip: string;
}

export interface SelectionDetail {
  id?: string | null;
  ids?: string[];
  kind:
    | TimelineItem["type"]
    | "actor"
    | "section"
    | "range"
    | null;
  item?: Actor | TimelineItem | Section | null;
  items?: TimelineItem[];
}

export interface ChangeDetail {
  source: string;
  ast: DiagramDocument;
  command: string | null;
  canUndo: boolean;
  canRedo: boolean;
}

export interface IconCatalogItem {
  name: string;
  label?: string;
  keywords?: string[];
}

export type IconCatalogEntry = string | IconCatalogItem;

export interface RenderOptions {
  theme?: ThemeName;
  label?: string;
  initialSelectedId?: string | null;
  iconResolver?: (
    iconName: string,
    resolvedTheme: "light" | "dark",
  ) => string | null | undefined;
  iconCatalog?: IconCatalogEntry[];
  onSelect?: (detail: SelectionDetail) => void;
  layout?: Record<string, number>;
}

export interface DiagramLayout {
  width: number;
  height: number;
  contentLeft: number;
  contentRight: number;
  lifelineTop: number;
  options: Record<string, number>;
  actorByName: Map<string, DiagramLayout["actors"][number]>;
  actors: Array<
    Actor & {
      id: string;
      x: number;
      y: number;
      centerX: number;
      width: number;
      height: number;
    }
  >;
  rows: Array<
    (Message | Gap) & {
      y: number;
      top: number;
      bottom: number;
      depth: number;
      parentId: string;
      index: number;
    }
  >;
  groups: Array<
    Group & {
      top: number;
      bottom: number;
      left: number;
      right: number;
      height: number;
      depth: number;
      parentId: string;
      index: number;
    }
  >;
  sections: Array<
    Section & {
      top: number;
      y: number;
      left: number;
      right: number;
      depth: number;
      parentId: string;
      index: number;
    }
  >;
}

export interface RenderController {
  readonly ast: DiagramDocument;
  readonly layout: DiagramLayout;
  readonly svg: SVGSVGElement;
  readonly selectedId: string | null;
  select(id: string): void;
  clearSelection(): void;
  destroy(): void;
}

export interface EditorController extends RenderController {
  readonly editor: DiagramEditor;
  readonly source: string;
  readonly selectedIds: string[];
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  undo(): boolean;
  redo(): boolean;
  replaceSource(source: string): boolean;
}

export interface EditorRenderOptions extends RenderOptions {
  editor?: DiagramEditor;
  dangerColor?: string;
  onChange?: (detail: ChangeDetail) => void;
  onError?: (error: unknown) => void;
}

export interface ItemLocation {
  item: TimelineItem;
  items: TimelineItem[];
  index: number;
  parentId: string;
}

export interface SectionLocation {
  section: Section;
  sections: Section[];
  index: number;
  groupId: string;
}

export interface TimelineContainer {
  id: string;
  items: TimelineItem[];
  type: "root" | "group" | "section";
  owner: DiagramDocument | Group | Section;
}

export class LinesAndArrowsSyntaxError extends SyntaxError {
  line: number;
  column: number;
}

export class DiagramEditor {
  constructor(input: string | DiagramDocument);
  readonly document: DiagramDocument;
  readonly source: string;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly lastCommand: string | null;
  replaceSource(source: string): boolean;
  undo(): boolean;
  redo(): boolean;
  addActor(index?: number): string;
  updateActor(
    id: string,
    patch: Partial<
      Pick<
        Actor,
        "name" | "icon" | "tag" | "tooltip" | "tooltipIcon"
      >
    >,
  ): string;
  moveActor(id: string, index: number): string;
  removeActor(id: string): null;
  addItem(
    parentId: string,
    index: number,
    type?: TimelineItemKind,
  ): string;
  addMessage(
    parentId: string,
    index: number,
    properties: {
      source: string;
      target: string;
      arrow?: Arrow;
      label?: string | null;
      tag?: string | null;
      tooltip?: string | null;
      tooltipIcon?: string | null;
    },
  ): string;
  updateItem(
    id: string,
    patch: Partial<
      Pick<
        Message,
        | "source"
        | "target"
        | "arrow"
        | "label"
        | "tag"
        | "tooltip"
        | "tooltipIcon"
      > & Pick<Group, "groupType"> & Pick<Gap, "label">
    >,
  ): string;
  removeItem(id: string): null;
  removeItems(ids: string[]): null;
  moveItem(id: string, parentId: string, index: number): string;
  wrapItems(
    parentId: string,
    ids: string[],
    groupType?: string,
    label?: string,
  ): string;
  ungroup(id: string): string | null;
  convertGroupToSections(id: string): string;
  addSection(groupId: string, index?: number): string;
  updateSection(id: string, patch: { label?: string }): string;
  moveSection(id: string, index: number): string;
  removeSection(id: string): string;
}

export const ROOT_CONTAINER_ID: "root";
export function ensureDocumentIds(
  document: DiagramDocument,
): DiagramDocument;
export function findItemLocation(
  document: DiagramDocument,
  id: string,
): ItemLocation | null;
export function findSectionLocation(
  document: DiagramDocument,
  id: string,
): SectionLocation | null;
export function getContainer(
  document: DiagramDocument,
  id: string,
): TimelineContainer | null;

export function parse(source: string): DiagramDocument;
export function serialize(document: DiagramDocument): string;
export function layoutDiagram(
  document: DiagramDocument,
  overrides?: Record<string, number>,
): DiagramLayout;
export function renderDiagram(
  target: Element | ShadowRoot,
  input: string | DiagramDocument,
  options?: RenderOptions,
): RenderController;
export function renderEditor(
  target: Element | ShadowRoot,
  input: string | DiagramDocument,
  options?: EditorRenderOptions,
): EditorController;
export function resolveTheme(
  theme?: ThemeName,
  host?: typeof globalThis,
): Theme;
export const themes: Record<"light" | "dark", Theme>;

export class LinesAndArrowsElement extends HTMLElement {
  source: string;
  theme: ThemeName;
  mode: EditorMode;
  iconResolver: RenderOptions["iconResolver"];
  iconCatalog: IconCatalogEntry[];
  readonly selectedId: string | null;
  readonly selectedIds: string[];
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  select(id: string): void;
  clearSelection(): void;
  undo(): boolean;
  redo(): boolean;
  replaceSource(source: string): boolean;
}

export function defineLinesAndArrows(
  name?: string,
  registry?: CustomElementRegistry,
): typeof LinesAndArrowsElement;
