import { DiagramEditor } from "./editor.js";
import { renderEditor } from "./edit-render.js";
import { parse } from "./parser.js";
import { renderDiagramForElement } from "./render.js";
import { dedentInlineSource } from "./text.js";

// Properties a page may assign before the element is defined. Configuration
// comes first so the first render sees it; source comes last.
const UPGRADED_PROPERTIES = [
  "mode",
  "theme",
  "label",
  "selectableActors",
  "branding",
  "copySource",
  "canvasBackground",
  "palette",
  "source",
];

// The class extends HTMLElement, so it is created on first registration
// rather than at module evaluation. This keeps the module importable where
// DOM globals do not exist, such as during server rendering.
function createElementClass() {
  return class LinesAndArrowsElement extends HTMLElement {
    static get observedAttributes() {
      return [
        "theme",
        "label",
        "mode",
        "selectable-actors",
        "branding",
        "copy-source",
        "canvas-background",
        "source",
      ];
    }

    #source = "";
    #palette = null;
    #controller = null;
    #editor = null;
    #selectedActorName = null;
    #mediaQuery = null;
    #modeAnimationFrame = null;
    #live = false;
    #sourceError = null;
    #showingError = false;
    #handleThemeChange = () => this.#render();

    constructor() {
      super();
      this.attachShadow({ mode: "open" });
    }

    connectedCallback() {
      const inlineSource = dedentInlineSource(this.textContent);
      if (inlineSource) {
        if (!this.#source && !this.hasAttribute("source")) {
          this.#source = inlineSource;
        }
        this.textContent = "";
      }
      this.#upgradeProperties();
      this.#syncThemeListener();
      this.#live = true;
      this.#render();
    }

    disconnectedCallback() {
      this.#live = false;
      this.#mediaQuery?.removeEventListener(
        "change",
        this.#handleThemeChange,
      );
      this.#cancelModeTransition();
      this.#destroyController();
    }

    attributeChangedCallback(name) {
      if (name === "source") {
        this.#applySourceAttribute();
        return;
      }
      const previousFrame =
        name === "mode" && this.#live
          ? this.#currentCanvasFrame()
          : null;
      if (
        (name === "selectable-actors" && !this.selectableActors) ||
        (name === "mode" && this.mode === "edit")
      ) {
        this.#clearActorSelection();
      }
      if (!this.#live) {
        return;
      }
      if (name === "theme") {
        this.#syncThemeListener();
      }
      this.#render(previousFrame);
    }

    get source() {
      return this.#editor?.source ?? this.#source;
    }

    set source(value) {
      const source = String(value ?? "");
      if (source.trim()) {
        parse(source);
      }
      this.textContent = "";
      this.#replaceSource(source);
    }

    get theme() {
      return this.getAttribute("theme") || "auto";
    }

    set theme(value) {
      if (!["auto", "light", "dark"].includes(value)) {
        throw new TypeError('theme must be "auto", "light", or "dark".');
      }
      this.setAttribute("theme", value);
    }

    get mode() {
      return this.getAttribute("mode") === "edit" ? "edit" : "view";
    }

    set mode(value) {
      if (value !== "view" && value !== "edit") {
        throw new TypeError('mode must be "view" or "edit".');
      }
      this.setAttribute("mode", value);
    }

    get label() {
      return this.getAttribute("label") || "Sequence diagram";
    }

    set label(value) {
      this.setAttribute("label", String(value));
    }

    get selectableActors() {
      return this.hasAttribute("selectable-actors");
    }

    set selectableActors(value) {
      this.toggleAttribute("selectable-actors", Boolean(value));
    }

    get branding() {
      return this.getAttribute("branding") !== "false";
    }

    set branding(value) {
      if (value === false) {
        this.setAttribute("branding", "false");
      } else {
        this.removeAttribute("branding");
      }
    }

    get copySource() {
      return this.getAttribute("copy-source") !== "false";
    }

    set copySource(value) {
      if (value === false) {
        this.setAttribute("copy-source", "false");
      } else {
        this.removeAttribute("copy-source");
      }
    }

    get canvasBackground() {
      return this.getAttribute("canvas-background") === "solid"
        ? "solid"
        : "transparent";
    }

    set canvasBackground(value) {
      if (value !== "solid" && value !== "transparent") {
        throw new TypeError(
          'canvasBackground must be "solid" or "transparent".',
        );
      }
      this.setAttribute("canvas-background", value);
    }

    get palette() {
      return this.#palette ? { ...this.#palette } : null;
    }

    set palette(value) {
      if (
        value !== null &&
        (typeof value !== "object" || Array.isArray(value))
      ) {
        throw new TypeError("palette must be an object or null.");
      }
      this.#palette = value ? { ...value } : null;
      if (this.#live) {
        this.#render();
      }
    }

    selectActor(name) {
      if (name !== null && (typeof name !== "string" || !name.trim())) {
        throw new TypeError("selectActor requires an actor name or null.");
      }
      if (name === null) {
        if (
          this.#controller &&
          this.mode === "view" &&
          this.selectableActors
        ) {
          this.#controller.selectActor(null);
        } else {
          this.#clearActorSelection();
        }
        return;
      }
      if (this.mode !== "view" || !this.selectableActors) {
        throw new Error("Actor selection is not enabled.");
      }
      if (this.#controller) {
        this.#controller.selectActor(name);
        return;
      }
      const source = this.source || dedentInlineSource(this.textContent);
      const exists =
        source.trim() &&
        parse(source).actors.some((actor) => actor.name === name);
      if (!exists) {
        throw new RangeError(`No actor named "${name}" exists.`);
      }
      this.#selectedActorName = name;
    }

    // Replaces the document without validating it. Callers validate first.
    #replaceSource(source) {
      this.#sourceError = null;
      if (source === this.source && !this.#showingError) {
        return;
      }
      this.#destroyController();
      if (source !== this.source) {
        this.#source = source;
        this.#editor = null;
        this.#clearActorSelection();
      }
      if (this.#live) {
        this.#render();
      }
    }

    // Attribute values have no caller to throw to, so an invalid value is
    // shown and reported as la-error while the previous valid source stays.
    #applySourceAttribute() {
      const source = dedentInlineSource(this.getAttribute("source") ?? "");
      try {
        if (source.trim()) {
          parse(source);
        }
      } catch (error) {
        this.#reportSourceError(error);
        return;
      }
      this.textContent = "";
      this.#replaceSource(source);
    }

    // The error stays visible, including across re-renders and reconnection,
    // until a valid source replaces it.
    #reportSourceError(error) {
      this.#sourceError = error;
      if (this.#live) {
        this.#render();
      }
    }

    // A property assigned before the element was defined is an own data
    // property that shadows the accessor. Move each one onto the accessor.
    // There is no caller to throw to, so failures are reported as la-error.
    #upgradeProperties() {
      for (const name of UPGRADED_PROPERTIES) {
        if (!Object.hasOwn(this, name)) {
          continue;
        }
        const value = this[name];
        delete this[name];
        try {
          this[name] = value;
        } catch (error) {
          if (name === "source") {
            this.#reportSourceError(error);
          } else {
            this.#dispatchError(error);
          }
        }
      }
    }

    #clearActorSelection() {
      if (this.#selectedActorName === null) {
        return;
      }
      this.#selectedActorName = null;
      if (this.isConnected) {
        this.#dispatch("la-actor-select", null);
      }
    }

    #syncThemeListener() {
      this.#mediaQuery?.removeEventListener(
        "change",
        this.#handleThemeChange,
      );
      this.#mediaQuery = null;

      if (this.theme === "auto") {
        this.#mediaQuery = matchMedia("(prefers-color-scheme: dark)");
        this.#mediaQuery.addEventListener(
          "change",
          this.#handleThemeChange,
        );
      }
    }

    #destroyController() {
      this.#controller?.destroy();
      this.#controller = null;
    }

    #cancelModeTransition() {
      if (this.#modeAnimationFrame !== null) {
        cancelAnimationFrame(this.#modeAnimationFrame);
        this.#modeAnimationFrame = null;
      }
    }

    #currentCanvasFrame() {
      const canvas = this.shadowRoot.querySelector(".la-canvas");
      if (!canvas) {
        return null;
      }
      const { width, height } = canvas.viewBox.baseVal;
      return {
        width,
        height,
        pixelWidth: canvas.getBoundingClientRect().width,
      };
    }

    #animateModeTransition(previousFrame) {
      const canvas = this.shadowRoot.querySelector(".la-canvas");
      if (
        !canvas ||
        !previousFrame ||
        matchMedia("(prefers-reduced-motion: reduce)").matches
      ) {
        return;
      }

      const finalFrame = {
        x: canvas.viewBox.baseVal.x,
        y: canvas.viewBox.baseVal.y,
        width: canvas.viewBox.baseVal.width,
        height: canvas.viewBox.baseVal.height,
      };
      const initialFrame = {
        x: finalFrame.x + (finalFrame.width - previousFrame.width) / 2,
        y: finalFrame.y + finalFrame.height - previousFrame.height,
        width: previousFrame.width,
        height: previousFrame.height,
      };
      if (
        initialFrame.x === finalFrame.x &&
        initialFrame.y === finalFrame.y &&
        initialFrame.width === finalFrame.width &&
        initialFrame.height === finalFrame.height
      ) {
        return;
      }

      // View canvases are capped between a readability floor and their
      // natural width while the editor fills its container, so the rendered
      // width animates with the frame. The effective widths already include
      // the container and floor clamps; the fixed width is only temporary.
      const finalStyle = {
        width: canvas.style.width,
        minWidth: canvas.style.minWidth,
        maxWidth: canvas.style.maxWidth,
      };
      initialFrame.pixelWidth = previousFrame.pixelWidth;
      finalFrame.pixelWidth = canvas.getBoundingClientRect().width;
      const animateWidth =
        initialFrame.pixelWidth > 0 && finalFrame.pixelWidth > 0;
      const setFrame = ({ x, y, width, height, pixelWidth }, final = false) => {
        canvas.setAttribute("viewBox", `${x} ${y} ${width} ${height}`);
        canvas.style.aspectRatio = `${width} / ${height}`;
        if (animateWidth && !final) {
          canvas.style.width = `${pixelWidth}px`;
          canvas.style.minWidth = "0";
          canvas.style.maxWidth = "none";
        } else {
          canvas.style.width = finalStyle.width;
          canvas.style.minWidth = finalStyle.minWidth;
          canvas.style.maxWidth = finalStyle.maxWidth;
        }
      };
      setFrame(initialFrame);
      const startedAt = performance.now();
      const duration = 180;
      const step = (time) => {
        const progress = Math.min((time - startedAt) / duration, 1);
        const eased = 1 - (1 - progress) ** 3;
        setFrame({
          x: initialFrame.x + (finalFrame.x - initialFrame.x) * eased,
          y: initialFrame.y + (finalFrame.y - initialFrame.y) * eased,
          width:
            initialFrame.width +
            (finalFrame.width - initialFrame.width) * eased,
          height:
            initialFrame.height +
            (finalFrame.height - initialFrame.height) * eased,
          pixelWidth:
            initialFrame.pixelWidth +
            (finalFrame.pixelWidth - initialFrame.pixelWidth) * eased,
        });
        if (progress < 1) {
          this.#modeAnimationFrame = requestAnimationFrame(step);
        } else {
          this.#modeAnimationFrame = null;
          setFrame(finalFrame, true);
        }
      };
      this.#modeAnimationFrame = requestAnimationFrame(step);
    }


    #dispatch(type, detail) {
      this.dispatchEvent(
        new CustomEvent(type, {
          detail,
          bubbles: true,
          composed: true,
        }),
      );
    }

    #dispatchError(problem) {
      const error =
        problem instanceof Error
          ? problem
          : new Error("Unable to render diagram.");
      this.#dispatch("la-error", { error });
      return error;
    }

    #render(previousFrame = null) {
      if (this.#sourceError) {
        this.#renderError(this.#sourceError);
        return;
      }
      this.#showingError = false;
      this.#cancelModeTransition();
      this.#controller?.commitPending?.();
      if (!this.source.trim()) {
        this.#destroyController();
        this.shadowRoot.replaceChildren();
        return;
      }

      try {
        this.#destroyController();
        const options = {
          theme: this.theme,
          label: this.label,
          branding: this.branding,
          copySource: this.copySource,
          canvasBackground: this.canvasBackground,
          palette: this.#palette,
        };

        if (this.mode === "edit") {
          this.#editor ||= new DiagramEditor(this.#source);
          this.#controller = renderEditor(
            this.shadowRoot,
            this.#editor,
            {
              ...options,
              onChange: (detail) => {
                this.#dispatch("la-change", detail);
              },
              onError: (error) => this.#dispatchError(error),
            },
          );
        } else {
          this.#controller = renderDiagramForElement(
            this.shadowRoot,
            this.source,
            {
              ...options,
              selectableActors: this.selectableActors,
              onActorSelect: (actor) => {
                this.#selectedActorName = actor?.name ?? null;
                this.#dispatch("la-actor-select", actor);
              },
            },
            this.#selectedActorName,
          );
        }
        this.#animateModeTransition(previousFrame);
      } catch (problem) {
        this.#renderError(problem);
      }
    }

    #renderError(problem) {
      this.#cancelModeTransition();
      this.#controller?.commitPending?.();
      this.#destroyController();
      this.#showingError = true;
      const error = this.#dispatchError(problem);
      const style = document.createElement("style");
      style.textContent = `
        :host { display: block; }
        .error {
          padding: 16px;
          border-radius: 12px;
          color: #9b2c2c;
          background: #fff0f0;
          font: 500 13px/1.5 ui-sans-serif, system-ui, sans-serif;
        }
        @media (prefers-color-scheme: dark) {
          .error { color: #ffb4b4; background: #2d1719; }
        }
      `;
      const message = document.createElement("div");
      message.className = "error";
      message.setAttribute("role", "alert");
      message.textContent = error.message;
      this.shadowRoot.replaceChildren(style, message);
    }
  };
}

let LinesAndArrowsElement = null;

export function defineLinesAndArrows() {
  if (
    typeof customElements === "undefined" ||
    typeof HTMLElement === "undefined"
  ) {
    throw new Error(
      "Custom elements are unavailable in this environment.",
    );
  }
  LinesAndArrowsElement ??= createElementClass();
  const name = "lines-and-arrows";
  const existing = customElements.get(name);
  if (existing && existing !== LinesAndArrowsElement) {
    throw new Error(
      `Custom element "${name}" is already registered with a different constructor.`,
    );
  }
  if (!existing) {
    customElements.define(name, LinesAndArrowsElement);
  }
}
