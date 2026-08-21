export type ThemeName = "auto" | "light" | "dark";
export type CanvasBackground = "transparent" | "solid";

export interface ThemePalette {
  background?: string;
  foreground?: string;
  accent?: string;
  accentForeground?: string;
  danger?: string;
  dangerForeground?: string;
}

export interface ActorDetails {
  readonly name: string;
  readonly icon: string | null;
  readonly tag: string | null;
  readonly tooltip: string | null;
  readonly tooltipIcon: string | null;
}

export interface RenderOptions {
  theme?: ThemeName;
  palette?: ThemePalette | null;
  canvasBackground?: CanvasBackground;
  label?: string;
  branding?: boolean;
  copySource?: boolean;
  /** Enables actor interaction, selection callbacks, and controller selection. */
  selectableActors?: boolean;
  /** Receives immutable actor details after enabled selection changes. */
  onActorSelect?: (actor: ActorDetails | null) => void;
}

export interface DiagramController {
  readonly svg: SVGSVGElement;
  /** Selects an existing actor or clears selection in an actor-selectable view. */
  selectActor(name: string | null): void;
  destroy(): void;
}

export function renderDiagram(
  target: Element | ShadowRoot,
  source: string,
  options?: RenderOptions,
): DiagramController;
