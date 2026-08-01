import type {
  Actor,
  Arrow,
  DiagramDocument,
  DiagramDocumentSnapshot,
  Gap,
  Group,
  Immutable,
  Message,
  Section,
  TimelineItem,
  TimelineItemKind,
} from "./model.js";

export type {
  Actor,
  Arrow,
  Comment,
  DiagramDocument,
  DiagramDocumentSnapshot,
  Gap,
  Group,
  Immutable,
  Message,
  PropertyComment,
  PropertyCommentAnchor,
  Section,
  TimelineItem,
  TimelineItemKind,
  ValidationError,
  ValidationResult,
} from "./model.js";
export {
  LinesAndArrowsSyntaxError,
  parse,
  serialize,
  validate,
} from "./syntax.js";

export type ThemeName = "light" | "dark" | "auto";
export type EditorMode = "view" | "edit";

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
  readonly id?: string | null;
  readonly ids?: readonly string[];
  readonly kind:
    | TimelineItem["type"]
    | "actor"
    | "section"
    | "range"
    | null;
  readonly item?: Immutable<Actor | TimelineItem | Section> | null;
  readonly items?: readonly Immutable<TimelineItem>[];
}

export interface ChangeDetail {
  readonly source: string;
  readonly ast: DiagramDocumentSnapshot;
  readonly command: string | null;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
}

export interface ErrorDetail {
  readonly error: unknown;
}

export interface LinesAndArrowsEventMap {
  "la-select": CustomEvent<SelectionDetail>;
  "la-change": CustomEvent<ChangeDetail>;
  "la-error": CustomEvent<ErrorDetail>;
}

export interface IconCatalogItem {
  name: string;
  label?: string;
  keywords?: string[];
}

export type IconCatalogEntry = string | IconCatalogItem;
export type IconResolver = (
  iconName: string,
  resolvedTheme: "light" | "dark",
) => string | null | undefined;

export const PHOSPHOR_ICON_VERSION: "2.1.1";
export const PHOSPHOR_ICON_WEIGHT: "bold";
export const phosphorIconCatalog: readonly string[];
export const recommendedActorIconNames: readonly string[];
export function phosphorIconResolver(
  iconName: string,
  resolvedTheme?: "light" | "dark",
): string | null;

export interface RenderOptions {
  theme?: ThemeName;
  label?: string;
  selectable?: boolean;
  branding?: boolean;
  initialSelectedId?: string | null;
  iconResolver?: IconResolver | null;
  iconCatalog?: readonly IconCatalogEntry[];
  onSelect?: (detail: SelectionDetail) => void;
  layout?: Record<string, number>;
}

export interface DiagramLayout {
  width: number;
  height: number;
  contentLeft: number;
  contentRight: number;
  lifelineTop: number;
  lifelineBottom: number;
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
      height: number;
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
      headerHeight: number;
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
      headerHeight: number;
      depth: number;
      parentId: string;
      index: number;
    }
  >;
}

export interface RenderController {
  readonly ast: DiagramDocumentSnapshot;
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

export class DiagramEditor {
  constructor(
    input: string | DiagramDocument | DiagramDocumentSnapshot,
  );
  readonly document: DiagramDocumentSnapshot;
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
  document: DiagramDocument | DiagramDocumentSnapshot,
): DiagramDocumentSnapshot;
export function findItemLocation(
  document: DiagramDocument | DiagramDocumentSnapshot,
  id: string,
): Immutable<ItemLocation> | null;
export function findSectionLocation(
  document: DiagramDocument | DiagramDocumentSnapshot,
  id: string,
): Immutable<SectionLocation> | null;
export function getContainer(
  document: DiagramDocument | DiagramDocumentSnapshot,
  id: string,
): Immutable<TimelineContainer> | null;

export function layoutDiagram(
  document: DiagramDocument | DiagramDocumentSnapshot,
  overrides?: Record<string, number>,
): DiagramLayout;
export function renderDiagram(
  target: Element | ShadowRoot,
  input: string | DiagramDocument | DiagramDocumentSnapshot,
  options?: RenderOptions,
): RenderController;
export function renderEditor(
  target: Element | ShadowRoot,
  input: string | DiagramDocument | DiagramDocumentSnapshot,
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
  selectable: boolean;
  branding: boolean;
  get iconResolver(): IconResolver | null;
  set iconResolver(value: IconResolver | null);
  get iconCatalog(): IconCatalogEntry[];
  set iconCatalog(value: readonly IconCatalogEntry[] | null);
  layout: RenderOptions["layout"] | null;
  readonly selectedId: string | null;
  readonly selectedIds: string[];
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  select(id: string): void;
  clearSelection(): void;
  undo(): boolean;
  redo(): boolean;
  replaceSource(source: string): boolean;
  addEventListener<Type extends keyof LinesAndArrowsEventMap>(
    type: Type,
    listener:
      | ((
          this: LinesAndArrowsElement,
          event: LinesAndArrowsEventMap[Type],
        ) => unknown)
      | null,
    options?: boolean | AddEventListenerOptions,
  ): void;
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | AddEventListenerOptions,
  ): void;
  removeEventListener<Type extends keyof LinesAndArrowsEventMap>(
    type: Type,
    listener:
      | ((
          this: LinesAndArrowsElement,
          event: LinesAndArrowsEventMap[Type],
        ) => unknown)
      | null,
    options?: boolean | EventListenerOptions,
  ): void;
  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | EventListenerOptions,
  ): void;
}

export function defineLinesAndArrows(
  name?: string,
  registry?: CustomElementRegistry,
): typeof LinesAndArrowsElement;

declare global {
  interface HTMLElementTagNameMap {
    "lines-and-arrows": LinesAndArrowsElement;
  }
}
