import { DiagramEditor } from "./editor.js";
import { renderEditor } from "./edit-render.js";
import { renderDiagram } from "./render.js";

const HTMLElementBase = globalThis.HTMLElement ?? class {};

export class LinesAndArrowsElement extends HTMLElementBase {
  static get observedAttributes() {
    return ["theme", "label", "mode"];
  }

  #source = "";
  #iconResolver = null;
  #iconCatalog = [];
  #controller = null;
  #editor = null;
  #mediaQuery = null;
  #handleThemeChange = () => this.#render();

  constructor() {
    super();
    this.attachShadow?.({ mode: "open" });
  }

  connectedCallback() {
    if (!this.#source && this.textContent.trim()) {
      this.#source = this.textContent.trim();
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
    this.#controller?.destroy();
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

  get iconResolver() {
    return this.#iconResolver;
  }

  set iconResolver(value) {
    if (value !== null && typeof value !== "function") {
      throw new TypeError("iconResolver must be a function or null.");
    }
    this.#iconResolver = value;
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

  #render() {
    if (!this.shadowRoot) {
      return;
    }
    if (!this.#source.trim()) {
      this.shadowRoot.replaceChildren();
      return;
    }

    try {
      this.#controller?.destroy?.();
      const renderOptions = {
        theme: this.theme,
        label: this.getAttribute("label") || "Sequence diagram",
        iconResolver: this.#iconResolver,
        iconCatalog: this.#iconCatalog,
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
  if (!registry.get(name)) {
    registry.define(name, LinesAndArrowsElement);
  }
  return registry.get(name);
}
