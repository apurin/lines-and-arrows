import { DiagramEditor } from "./editor.js";
import { renderEditor } from "./edit-render.js";
import { parse } from "./parser.js";
import { renderDiagramForElement } from "./render.js";
import { dedentInlineSource } from "./text.js";

class LinesAndArrowsElement extends HTMLElement {
  static get observedAttributes() {
    return [
      "theme",
      "label",
      "mode",
      "selectable-actors",
      "branding",
      "copy-source",
      "canvas-background",
    ];
  }

  #source = "";
  #palette = null;
  #controller = null;
  #editor = null;
  #selectedActorName = null;
  #mediaQuery = null;
  #handleThemeChange = () => this.#render();

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }

  connectedCallback() {
    const inlineSource = dedentInlineSource(this.textContent);
    if (!this.#source && inlineSource) {
      this.#source = inlineSource;
      this.textContent = "";
    }
    this.#syncThemeListener();
    this.#render();
  }

  disconnectedCallback() {
    this.#mediaQuery?.removeEventListener(
      "change",
      this.#handleThemeChange,
    );
    this.#destroyController();
  }

  attributeChangedCallback(name) {
    if (
      (name === "selectable-actors" && !this.selectableActors) ||
      (name === "mode" && this.mode === "edit")
    ) {
      this.#clearActorSelection();
    }
    if (!this.isConnected) {
      return;
    }
    if (name === "theme") {
      this.#syncThemeListener();
    }
    this.#render();
  }

  get source() {
    return this.#editor?.source ?? this.#source;
  }

  set source(value) {
    const source = String(value ?? "");
    if (source.trim()) {
      parse(source);
    }
    if (source === this.source) {
      return;
    }
    this.#source = source;
    this.#editor = null;
    this.#clearActorSelection();
    if (this.isConnected) {
      this.#render();
    }
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
    if (this.isConnected) {
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
    this.#selectedActorName = name;
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

  #render() {
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
        return;
      }

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
    } catch (problem) {
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
      message.part = "error";
      message.setAttribute("role", "alert");
      message.textContent = error.message;
      this.shadowRoot.replaceChildren(style, message);
    }
  }
}

export function defineLinesAndArrows() {
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
