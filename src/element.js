import { DiagramEditor } from "./editor.js";
import { renderEditor } from "./edit-render.js";
import {
  phosphorIconCatalog,
  phosphorIconResolver,
} from "./icons.js";
import { renderDiagram } from "./render.js";
import { dedentInlineSource } from "./text.js";

const HTMLElementBase = globalThis.HTMLElement ?? class {};

export class LinesAndArrowsElement extends HTMLElementBase {
  static get observedAttributes() {
    return [
      "theme",
      "label",
      "mode",
      "selectable",
      "branding",
      "canvas-background",
    ];
  }

  #source = "";
  #iconResolver = phosphorIconResolver;
  #iconCatalog = phosphorIconCatalog;
  #layout = null;
  #palette = null;
  #controller = null;
  #editor = null;
  #mediaQuery = null;
  #handleThemeChange = () => this.#render();

  constructor() {
    super();
    this.attachShadow?.({ mode: "open" });
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
    this.#mediaQuery?.removeEventListener?.(
      "change",
      this.#handleThemeChange,
    );
    this.#destroyController();
  }

  attributeChangedCallback() {
    if (this.isConnected) {
      this.#syncThemeListener();
      this.#render();
    }
  }

  get source() {
    return this.#source;
  }

  set source(value) {
    this.#source = String(value ?? "");
    this.#editor = null;
    if (this.isConnected) {
      this.#render();
    }
  }

  get theme() {
    return this.getAttribute("theme") || "auto";
  }

  set theme(value) {
    this.setAttribute("theme", value || "auto");
  }

  get mode() {
    return this.getAttribute("mode") === "edit" ? "edit" : "view";
  }

  set mode(value) {
    this.setAttribute("mode", value === "edit" ? "edit" : "view");
  }

  get selectable() {
    return this.getAttribute("selectable") !== "false";
  }

  set selectable(value) {
    if (value === false) {
      this.setAttribute("selectable", "false");
    } else {
      this.removeAttribute("selectable");
    }
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

  get canvasBackground() {
    return this.getAttribute("canvas-background") === "transparent"
      ? "transparent"
      : "solid";
  }

  set canvasBackground(value) {
    if (value !== "solid" && value !== "transparent") {
      throw new TypeError(
        'canvasBackground must be either "solid" or "transparent".',
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

  get iconResolver() {
    return this.#iconResolver;
  }

  set iconResolver(value) {
    if (value !== null && typeof value !== "function") {
      throw new TypeError("iconResolver must be a function or null.");
    }
    const replacesUntouchedDefaults =
      this.#iconResolver === phosphorIconResolver &&
      this.#iconCatalog === phosphorIconCatalog &&
      value !== phosphorIconResolver;
    this.#iconResolver = value;
    if (replacesUntouchedDefaults) {
      this.#iconCatalog = [];
    }
    if (this.isConnected) {
      this.#render();
    }
  }

  get iconCatalog() {
    return [...this.#iconCatalog];
  }

  set iconCatalog(value) {
    if (value !== null && !Array.isArray(value)) {
      throw new TypeError("iconCatalog must be an array or null.");
    }
    this.#iconCatalog = value ? [...value] : [];
    if (this.isConnected) {
      this.#render();
    }
  }

  get layout() {
    return this.#layout ? { ...this.#layout } : null;
  }

  set layout(value) {
    if (
      value !== null &&
      (typeof value !== "object" || Array.isArray(value))
    ) {
      throw new TypeError("layout must be an object or null.");
    }
    this.#layout = value ? { ...value } : null;
    if (this.isConnected) {
      this.#render();
    }
  }

  get selectedId() {
    return this.#controller?.selectedId ?? null;
  }

  get selectedIds() {
    return this.#controller?.selectedIds ?? (
      this.selectedId ? [this.selectedId] : []
    );
  }

  get canUndo() {
    return this.#controller?.canUndo ?? false;
  }

  get canRedo() {
    return this.#controller?.canRedo ?? false;
  }

  select(id) {
    this.#controller?.select(id);
  }

  clearSelection() {
    this.#controller?.clearSelection();
  }

  undo() {
    return this.#controller?.undo?.() ?? false;
  }

  redo() {
    return this.#controller?.redo?.() ?? false;
  }

  replaceSource(source) {
    if (this.mode === "edit" && this.#controller?.replaceSource) {
      return this.#controller.replaceSource(String(source ?? ""));
    }
    this.source = source;
    return true;
  }

  #syncThemeListener() {
    this.#mediaQuery?.removeEventListener?.(
      "change",
      this.#handleThemeChange,
    );
    this.#mediaQuery = null;

    if (this.theme === "auto") {
      this.#mediaQuery = globalThis.matchMedia?.(
        "(prefers-color-scheme: dark)",
      );
      this.#mediaQuery?.addEventListener?.(
        "change",
        this.#handleThemeChange,
      );
    }
  }

  #destroyController() {
    const controller = this.#controller;
    this.#controller = null;
    controller?.destroy?.();
  }

  #render() {
    if (!this.shadowRoot) {
      return;
    }
    if (!this.#source.trim()) {
      this.#destroyController();
      this.shadowRoot.replaceChildren();
      return;
    }

    try {
      this.#destroyController();
      const renderOptions = {
        theme: this.theme,
        label: this.getAttribute("label") || "Sequence diagram",
        selectable: this.mode === "edit" ? true : this.selectable,
        branding: this.branding,
        canvasBackground: this.canvasBackground,
        palette: this.#palette,
        iconResolver: this.#iconResolver,
        iconCatalog: this.#iconCatalog,
        layout: this.#layout,
      };

      if (this.mode === "edit") {
        this.#editor ||= new DiagramEditor(this.#source);
        this.#controller = renderEditor(
          this.shadowRoot,
          this.#editor.document,
          {
            ...renderOptions,
            editor: this.#editor,
            onChange: (detail) => {
              this.#source = detail.source;
            },
          },
        );
      } else {
        const input = this.#editor?.document ?? this.#source;
        this.#controller = renderDiagram(
          this.shadowRoot,
          input,
          renderOptions,
        );
      }
    } catch (error) {
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
          .error {
            color: #ffb4b4;
            background: #2d1719;
          }
        }
      `;
      const message = document.createElement("div");
      message.className = "error";
      message.part = "error";
      message.setAttribute("role", "alert");
      message.textContent =
        error instanceof Error ? error.message : "Unable to render diagram.";
      this.shadowRoot.replaceChildren(style, message);
      this.dispatchEvent(
        new CustomEvent("la-error", {
          detail: { error },
          bubbles: true,
          composed: true,
        }),
      );
    }
  }
}

export function defineLinesAndArrows(
  name = "lines-and-arrows",
  registry = globalThis.customElements,
) {
  if (!registry) {
    throw new Error("Custom elements are not available in this environment.");
  }
  const existing = registry.get(name);
  if (existing && existing !== LinesAndArrowsElement) {
    throw new Error(
      `Custom element "${name}" is already registered with a different constructor.`,
    );
  }
  if (!existing) {
    registry.define(name, LinesAndArrowsElement);
  }
  return LinesAndArrowsElement;
}
