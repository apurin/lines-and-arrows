import test from "node:test";
import assert from "node:assert/strict";

import {
  renderDiagram,
  renderDiagramForEditor,
} from "../src/render.js";
import { parse } from "../src/parser.js";

const SOURCE = `@A
  tag actor
  tooltip Actor details

@B

parallel Review
  | connected
    A -> B: Connect
      tag event
      tooltip Event details
  | delayed
    gap Later`;

const SECTION_GEOMETRY_SOURCE = `@A
@B

parallel Geometry
  | short
    A -> B: First
  | This section label should use all of the available width before truncating at the right rule
    B -> A: Second`;

class FakeClassList {
  constructor(element) {
    this.element = element;
    this.names = new Set();
  }

  add(...names) {
    for (const name of names) {
      this.names.add(name);
    }
    this.element.attributes.set("class", [...this.names].join(" "));
  }

  contains(name) {
    return this.names.has(name);
  }

  replace(value) {
    this.names = new Set(String(value).split(/\s+/).filter(Boolean));
  }
}

class FakeElement {
  constructor(name) {
    this.localName = name;
    this.attributes = new Map();
    this.children = [];
    this.parentNode = null;
    this.dataset = {};
    this.listeners = new Map();
    this.classList = new FakeClassList(this);
    this.style = {
      values: new Map(),
      setProperty: (property, value) => {
        this.style.values.set(property, String(value));
      },
    };
    this.textContent = "";
  }

  append(...children) {
    for (const child of children) {
      child.parentNode = this;
      this.children.push(child);
    }
  }

  replaceChildren(...children) {
    for (const child of this.children) {
      child.parentNode = null;
    }
    this.children = [];
    this.append(...children);
  }

  remove() {
    if (!this.parentNode) {
      return;
    }
    this.parentNode.children = this.parentNode.children.filter(
      (child) => child !== this,
    );
    this.parentNode = null;
  }

  setAttribute(name, value) {
    const normalized = String(value);
    this.attributes.set(name, normalized);
    if (name === "class") {
      this.classList.replace(normalized);
    }
  }

  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }

  removeAttribute(name) {
    this.attributes.delete(name);
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type, listener) {
    const listeners = this.listeners.get(type) ?? [];
    this.listeners.set(
      type,
      listeners.filter((candidate) => candidate !== listener),
    );
  }

  emit(type) {
    const event = {
      type,
      target: this,
      currentTarget: this,
      preventDefault() {},
      stopPropagation() {},
    };
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event);
    }
  }

  matches(selector) {
    if (selector.startsWith(".")) {
      return this.classList.contains(selector.slice(1));
    }
    return this.localName === selector;
  }

  closest(selector) {
    for (let element = this; element; element = element.parentNode) {
      if (element.matches(selector)) {
        return element;
      }
    }
    return null;
  }

  querySelectorAll(selector) {
    const matches = [];
    const visit = (element) => {
      for (const child of element.children) {
        if (
          (selector === "[data-la-id]" && child.dataset.laId) ||
          child.matches(selector)
        ) {
          matches.push(child);
        }
        visit(child);
      }
    };
    visit(this);
    return matches;
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] ?? null;
  }
}

class FakeDocument {
  createElement(name) {
    return new FakeElement(name);
  }

  createElementNS(_namespace, name) {
    return new FakeElement(name);
  }
}

function descendants(root, predicate) {
  const matches = [];
  const visit = (element) => {
    for (const child of element.children) {
      if (predicate(child)) {
        matches.push(child);
      }
      visit(child);
    }
  };
  visit(root);
  return matches;
}

function byClass(root, className) {
  return descendants(root, (element) =>
    element.classList.contains(className),
  );
}

function directChild(root, predicate) {
  return root.children.find(predicate);
}

function renderWithFakeDocument(render, source = SOURCE, options = {}) {
  const previousDocument = globalThis.document;
  globalThis.document = new FakeDocument();
  try {
    const target = new FakeElement("div");
    const controller = render(target, source, {
      theme: "light",
      branding: false,
      ...options,
    });
    return { target, controller };
  } finally {
    globalThis.document = previousDocument;
  }
}

test("renders a compact aligned header and copies attributed source", async () => {
  const previousNavigator = Object.getOwnPropertyDescriptor(
    globalThis,
    "navigator",
  );
  let copiedSource = null;
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      clipboard: {
        async writeText(source) {
          copiedSource = source;
        },
      },
    },
  });

  let controller = null;
  try {
    const rendered = renderWithFakeDocument(
      renderDiagram,
      SOURCE,
      { branding: true },
    );
    controller = rendered.controller;
    const branding = byClass(rendered.target, "la-branding")[0];
    const brandingText = byClass(
      branding,
      "la-branding-text",
    )[0];
    const copy = byClass(rendered.target, "la-copy-source")[0];
    const title = copy.children.find(
      (element) => element.localName === "title",
    );

    assert.equal(brandingText.textContent, "Powered by Lines & Arrows");
    assert.equal(
      Number(brandingText.getAttribute("x")),
      controller.layout.width / 2,
    );
    assert.equal(brandingText.getAttribute("text-anchor"), "middle");
    assert.equal(
      copy.getAttribute("transform"),
      `translate(${controller.layout.contentRight - 18} 5)`,
    );
    assert.equal(copy.getAttribute("aria-label"), "Copy source");
    assert.equal(title.textContent, "Copy source");

    const click = copy.listeners.get("click")[0];
    await click({
      preventDefault() {},
      stopPropagation() {},
    });

    assert.equal(
      copiedSource.startsWith(
        "// Powered by https://lines-and-arrows.dev/\n",
      ),
      true,
    );
    assert.equal(
      copiedSource.match(
        /\/\/ Powered by https:\/\/lines-and-arrows\.dev\//g,
      ).length,
      1,
    );
    assert.deepEqual(
      parse(copiedSource),
      parse(`// Powered by https://lines-and-arrows.dev/\n${SOURCE}`),
    );

    controller.destroy();
    copiedSource = null;
    const attributed = renderWithFakeDocument(
      renderDiagram,
      `// Powered by https://lines-and-arrows.dev/\n${SOURCE}`,
      { branding: true },
    );
    controller = attributed.controller;
    const attributedCopy = byClass(
      attributed.target,
      "la-copy-source",
    )[0];
    await attributedCopy.listeners.get("click")[0]({
      preventDefault() {},
      stopPropagation() {},
    });
    assert.equal(
      copiedSource.match(
        /\/\/ Powered by https:\/\/lines-and-arrows\.dev\//g,
      ).length,
      1,
    );
  } finally {
    controller?.destroy();
    if (previousNavigator) {
      Object.defineProperty(
        globalThis,
        "navigator",
        previousNavigator,
      );
    } else {
      delete globalThis.navigator;
    }
  }
});

test("keeps copy source available when attribution text is hidden", () => {
  const { target, controller } = renderWithFakeDocument(renderDiagram);
  assert.equal(byClass(target, "la-branding").length, 0);
  assert.equal(byClass(target, "la-copy-source").length, 1);
  controller.destroy();
});

test("removes the empty header row when branding and copy are hidden", () => {
  const { target, controller } = renderWithFakeDocument(
    renderDiagram,
    SOURCE,
    { copySource: false },
  );

  assert.equal(byClass(target, "la-diagram-header").length, 0);
  assert.equal(byClass(target, "la-branding").length, 0);
  assert.equal(byClass(target, "la-copy-source").length, 0);
  assert.equal(controller.layout.options.marginTop, 0);
  assert.equal(controller.layout.actors[0].y, 0);
  controller.destroy();
});

test("keeps the header row when copy is hidden but branding is visible", () => {
  const { target, controller } = renderWithFakeDocument(
    renderDiagram,
    SOURCE,
    { branding: true, copySource: false },
  );

  assert.equal(byClass(target, "la-diagram-header").length, 1);
  assert.equal(byClass(target, "la-branding").length, 1);
  assert.equal(byClass(target, "la-copy-source").length, 0);
  assert.equal(controller.layout.options.marginTop, 28);
  controller.destroy();
});

test("uses a transparent canvas by default with a solid opt-in", () => {
  const transparent = renderWithFakeDocument(renderDiagram);
  const transparentFrame = transparent.target.children.find(
    (element) => element.localName === "div",
  );
  assert.equal(
    transparentFrame.style.values.get("--la-canvas"),
    "transparent",
  );
  transparent.controller.destroy();

  const solid = renderWithFakeDocument(renderDiagram, SOURCE, {
    canvasBackground: "solid",
  });
  const solidFrame = solid.target.children.find(
    (element) => element.localName === "div",
  );
  assert.equal(solidFrame.style.values.get("--la-canvas"), "#F6F7F9");
  solid.controller.destroy();
});

test("renders actor titles after more than five timeline elements", () => {
  const fiveElements = renderWithFakeDocument(
    renderDiagram,
    `A -> B: One
B --> A: Two
A -> B: Three
B --> A: Four
A -> B: Five`,
  );
  assert.equal(
    byClass(fiveElements.target, "la-lifeline-label").length,
    0,
  );
  fiveElements.controller.destroy();

  const { target, controller } = renderWithFakeDocument(
    renderDiagram,
    `repeat Flow
  A -> B: One
  B --> A: Two
  A -> B: Three
  B --> A: Four
  A -> B: Five
  B --> A: Six`,
    { layout: { bottomPadding: 18 } },
  );
  const labels = byClass(target, "la-lifeline-label");

  assert.deepEqual(
    labels.map((label) => label.textContent),
    ["A", "B"],
  );
  labels.forEach((label, index) => {
    assert.equal(
      Number(label.getAttribute("x")),
      controller.layout.actors[index].centerX,
    );
    assert.equal(
      Number(label.getAttribute("y")),
      controller.layout.lifelineBottom + 14,
    );
    assert.ok(
      controller.layout.height - Number(label.getAttribute("y")) >= 4,
    );
    assert.equal(label.getAttribute("font-size"), "8");
    assert.equal(label.getAttribute("opacity"), "0.48");
    assert.equal(label.getAttribute("aria-hidden"), "true");
    assert.equal(label.getAttribute("pointer-events"), "none");
  });
  controller.destroy();
});

function sectionGeometry(section) {
  const lines = section.children.filter((element) =>
    element.classList.contains("la-section-line"),
  );
  const label = section.children.find(
    (element) => element.localName === "text",
  );
  const renderedLabel = label.children[0].textContent;
  const labelX = Number(label.getAttribute("x"));
  return {
    renderedLabel,
    leftGap: labelX - Number(lines[0].getAttribute("x2")),
    rightGap:
      Number(lines[1].getAttribute("x1")) -
      (labelX + renderedLabel.length * 10 * 0.56),
    rightLineWidth:
      Number(lines[1].getAttribute("x2")) -
      Number(lines[1].getAttribute("x1")),
  };
}

test("section rules use available label width with compact symmetric gaps", () => {
  const { target } = renderWithFakeDocument(
    renderDiagram,
    SECTION_GEOMETRY_SOURCE,
  );
  const sections = byClass(target, "la-section");
  const short = sectionGeometry(sections[0]);
  const long = sectionGeometry(sections[1]);

  assert.equal(short.renderedLabel, "short");
  assert.equal(short.leftGap, 4);
  assert.ok(Math.abs(short.rightGap - short.leftGap) < 0.001);

  assert.ok(long.renderedLabel.length > 28);
  assert.match(long.renderedLabel, /…$/);
  assert.equal(long.leftGap, 4);
  assert.ok(Math.abs(long.rightGap - long.leftGap) < 0.001);
  assert.ok(long.rightLineWidth >= 8);
  assert.ok(long.rightLineWidth < 14);
});

test("actor-selectable view keeps every non-actor object static", () => {
  const { target } = renderWithFakeDocument((container, source, options) =>
    renderDiagram(container, source, {
      ...options,
      selectableActors: true,
    }),
  );

  const actors = byClass(target, "la-actor");
  const messages = byClass(target, "la-message");
  const groupHits = byClass(target, "la-group-hit");
  const sections = byClass(target, "la-section");
  const gaps = byClass(target, "la-gap");

  assert.equal(actors.length, 2);
  assert.equal(messages.length, 1);
  assert.equal(groupHits.length, 1);
  assert.equal(sections.length, 2);
  assert.equal(gaps.length, 1);
  for (const section of sections) {
    assert.equal(byClass(section, "la-section-label").length, 1);
  }

  for (const actor of actors) {
    assert.equal(actor.classList.contains("la-selectable"), true);
    assert.equal(actor.getAttribute("role"), "button");
    assert.equal(actor.getAttribute("tabindex"), "0");
  }

  for (const item of [...messages, ...groupHits, ...sections, ...gaps]) {
    assert.equal(item.classList.contains("la-selectable"), false);
    assert.equal(item.getAttribute("role"), null);
    assert.equal(item.getAttribute("tabindex"), null);
    assert.equal(item.listeners.has("click"), false);
    assert.equal(item.listeners.has("keydown"), false);
    assert.equal(item.listeners.has("pointerenter"), false);
    assert.equal(item.listeners.has("focus"), false);
  }

  const message = messages[0];
  const messageLine = byClass(message, "la-message-line")[0];
  const markerBeforePointer = messageLine.getAttribute("marker-end");
  message.emit("pointerenter");
  assert.equal(messageLine.getAttribute("marker-end"), markerBeforePointer);
  assert.equal(message.listeners.has("pointerenter"), false);
  assert.equal(
    byClass(message, "la-message-selection-highlight").length,
    0,
  );
  assert.equal(messageLine.dataset.markerSelected, undefined);

  const messageHitArea = directChild(
    message,
    (element) =>
      element.localName === "rect" &&
      element.getAttribute("height") === "50",
  );
  const messageHitPath = directChild(
    message,
    (element) =>
      element.localName === "path" &&
      element.getAttribute("stroke") === "transparent",
  );
  assert.equal(messageHitArea.getAttribute("pointer-events"), "none");
  assert.equal(messageHitPath.getAttribute("pointer-events"), "none");

  const groupHitArea = groupHits[0].children[0];
  const gapHitArea = gaps[0].children[0];
  assert.equal(groupHitArea.getAttribute("pointer-events"), "none");
  assert.equal(gapHitArea.getAttribute("pointer-events"), "none");

  const messageTags = byClass(message, "la-tag");
  const messageTooltips = byClass(message, "la-tooltip-trigger");
  assert.equal(messageTags[0].getAttribute("role"), null);
  assert.equal(messageTags[0].getAttribute("tabindex"), null);
  assert.equal(messageTooltips[0].getAttribute("role"), "button");
  assert.equal(messageTooltips[0].getAttribute("tabindex"), "0");
});

test("editor rendering retains selection behavior for every object type", () => {
  const { target } = renderWithFakeDocument(renderDiagramForEditor);
  const actors = byClass(target, "la-actor");
  const messages = byClass(target, "la-message");
  const groupHits = byClass(target, "la-group-hit");
  const sections = byClass(target, "la-section");
  const gaps = byClass(target, "la-gap");

  const selectableItems = [
    ...actors,
    ...messages,
    ...groupHits,
    ...sections,
    ...gaps,
  ];
  for (const item of selectableItems) {
    assert.equal(item.classList.contains("la-selectable"), true);
    assert.equal(item.getAttribute("role"), "button");
    assert.equal(item.getAttribute("tabindex"), "0");
    assert.equal(item.listeners.has("click"), true);
    assert.equal(item.listeners.has("keydown"), true);
  }

  const message = messages[0];
  const messageLine = byClass(message, "la-message-line")[0];
  assert.equal(
    byClass(message, "la-message-selection-highlight").length,
    1,
  );
  assert.equal(message.children[0].getAttribute("pointer-events"), "all");
  assert.equal(messageLine.dataset.markerSelected !== undefined, true);
  message.emit("pointerenter");
  assert.equal(
    messageLine.getAttribute("marker-end"),
    messageLine.dataset.markerSelected,
  );

  const gapHitArea = gaps[0].children[0];
  assert.equal(gapHitArea.getAttribute("pointer-events"), "all");
});
