export type ThemeName = "light" | "dark" | "auto";
export type Arrow = "->" | "-->" | "->x";

export interface Actor {
  type: "actor";
  name: string;
  icon: string | null;
  tag: string | null;
  tooltip: string | null;
  line: number;
  inferred?: boolean;
}

export interface Message {
  type: "message";
  id: string;
  source: string;
  target: string;
  arrow: Arrow;
  label: string;
  tag: string | null;
  tooltip: string | null;
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

export interface RenderOptions {
  theme?: ThemeName;
  label?: string;
  iconResolver?: (
    iconName: string,
    resolvedTheme: "light" | "dark",
  ) => string | null | undefined;
  onSelect?: (detail: {
    id: string | null;
    kind: TimelineItem["type"] | "actor" | "section" | null;
    item: Actor | TimelineItem | Section | null;
  }) => void;
  layout?: Record<string, number>;
}

export interface RenderController {
  ast: DiagramDocument;
  layout: ReturnType<typeof layoutDiagram>;
  svg: SVGSVGElement;
  readonly selectedId: string | null;
  select(id: string): void;
  clearSelection(): void;
  destroy(): void;
}

export class LinesAndArrowsSyntaxError extends SyntaxError {
  line: number;
  column: number;
}

export function parse(source: string): DiagramDocument;
export function layoutDiagram(
  document: DiagramDocument,
  overrides?: Record<string, number>,
): {
  width: number;
  height: number;
  actors: Array<Actor & {
    id: string;
    x: number;
    y: number;
    centerX: number;
    width: number;
    height: number;
  }>;
  rows: Array<TimelineItem & {
    y: number;
    depth: number;
  }>;
  groups: Array<Group & {
    top: number;
    bottom: number;
    left: number;
    right: number;
    height: number;
    depth: number;
  }>;
  sections: Array<Section & {
    top: number;
    y: number;
    left: number;
    right: number;
    depth: number;
  }>;
};
export function renderDiagram(
  target: Element | ShadowRoot,
  input: string | DiagramDocument,
  options?: RenderOptions,
): RenderController;
export function resolveTheme(
  theme?: ThemeName,
  host?: typeof globalThis,
): Theme;
export const themes: Record<"light" | "dark", Theme>;

export class LinesAndArrowsElement extends HTMLElement {
  source: string;
  theme: ThemeName;
  iconResolver: RenderOptions["iconResolver"];
  readonly selectedId: string | null;
  select(id: string): void;
  clearSelection(): void;
}

export function defineLinesAndArrows(
  name?: string,
  registry?: CustomElementRegistry,
): typeof LinesAndArrowsElement;
