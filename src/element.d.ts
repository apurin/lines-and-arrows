import type {
  ActorDetails,
  CanvasBackground,
  ThemeName,
  ThemePalette,
} from "./index.js";

export type {
  ActorDetails,
  CanvasBackground,
  ThemeName,
  ThemePalette,
} from "./index.js";

interface ChangeDetail {
  readonly source: string;
}

interface ErrorDetail {
  readonly error: Error;
}

interface LinesAndArrowsEventMap {
  "la-actor-select": CustomEvent<ActorDetails | null>;
  "la-change": CustomEvent<ChangeDetail>;
  "la-error": CustomEvent<ErrorDetail>;
}

export interface LinesAndArrowsElement extends HTMLElement {
  source: string;
  mode: "view" | "edit";
  theme: ThemeName;
  label: string;
  selectableActors: boolean;
  branding: boolean;
  copySource: boolean;
  canvasBackground: CanvasBackground;
  palette: ThemePalette | null;
  selectActor(name: string | null): void;
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

export function defineLinesAndArrows(): void;

declare global {
  interface HTMLElementTagNameMap {
    "lines-and-arrows": LinesAndArrowsElement;
  }
}
