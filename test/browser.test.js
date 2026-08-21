import assert from "node:assert/strict";
import { createReadStream, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright-core";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const MIME = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".svg", "image/svg+xml"],
]);
const ICON = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"/>');
let server;
let browser;
let origin;
const iconRequests = new WeakMap();

test.before(async () => {
  server = createServer((request, response) => {
    const pathname = new URL(request.url, "http://localhost").pathname;
    const path = join(ROOT, pathname);
    try {
      const stats = statSync(path);
      if (!stats.isFile()) throw new Error("not a file");
      response.writeHead(200, { "content-type": MIME.get(extname(path)) ?? "application/octet-stream" });
      createReadStream(path).pipe(response);
    } catch {
      response.writeHead(404).end();
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ channel: "chrome", headless: true });
});

test.after(async () => {
  await browser?.close();
  await new Promise((resolve) => server?.close(resolve));
});

async function stubCdn(page, requests = []) {
  await page.route("https://cdn.jsdelivr.net/**", (route) => {
    const url = route.request().url();
    requests.push(url);
    if (url.includes("/lines-and-arrows@")) {
      return route.fulfill({
        status: 200,
        contentType: "text/javascript",
        body: readFileSync(
          join(ROOT, "dist/lines-and-arrows.auto.min.js"),
          "utf8",
        ),
      });
    }
    if (url.includes("/prismjs@")) {
      return route.fulfill({
        status: 200,
        contentType: "text/javascript",
        body: "globalThis.Prism ??= { highlightElement() {} };",
      });
    }
    return route.fulfill({
      status: 200,
      contentType: "image/svg+xml",
      body: ICON,
    });
  });
}

test("website pages load the exact public CDN runtime", async (testContext) => {
  const expected =
    "https://cdn.jsdelivr.net/npm/lines-and-arrows@0.12.0/dist/lines-and-arrows.auto.min.js";

  for (const path of [
    "index.html",
    "showcase.html",
    "features.html",
    "constructor.html",
  ]) {
    const context = await browser.newContext();
    testContext.after(() => context.close());
    const page = await context.newPage();
    const requests = [];
    await stubCdn(page, requests);
    await page.goto(`${origin}/website/${path}`);
    await page.waitForFunction(() =>
      Boolean(customElements.get("lines-and-arrows")),
    );
    assert.equal(
      requests.filter((url) => url.includes("/lines-and-arrows@")).at(-1),
      expected,
      path,
    );
  }
});

async function openPage(testContext) {
  const context = await browser.newContext();
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin });
  const page = await context.newPage();
  const requests = [];
  iconRequests.set(page, requests);
  await stubCdn(page, requests);
  await page.goto(`${origin}/test/browser.html`);
  await page.waitForFunction(() => window.linesAndArrows);
  testContext.after(() => context.close());
  return page;
}

test(
  "public renderer owns SVG, actor selection, copy, and teardown",
  async (testContext) => {
    const page = await openPage(testContext);
    await page.evaluate(() => window.rendererController.selectActor("Client"));
    const target = page.locator("#target");
    await target.getByRole("button", { name: "Actor API" }).click();
    await target.getByRole("button", { name: "Copy source" }).click();
    const result = await page.evaluate(async () => {
      const controller = window.rendererController;
      const selected = controller.svg.querySelector(
        '.la-actor[data-selected="true"]',
      );
      const copied = await navigator.clipboard.readText();
      const attribution = "// Powered by https://lines-and-arrows.dev/";
      const actorLabel = controller.svg.querySelector(".la-actor text");
      const flagActor = [...controller.svg.querySelectorAll(".la-actor")].find(
        (actor) => actor.getAttribute("aria-label")?.startsWith("Actor 🇪🇸"),
      );
      const flagLabel = [...flagActor.querySelectorAll("text")].find(
        (text) => text.textContent.startsWith("🇪🇸🇪🇸"),
      );
      const emojiTag = flagActor.querySelector(".la-tag");
      const emojiGroup = controller.svg.querySelector(".la-group-header");
      const emojiGroupLabel = [...emojiGroup.querySelectorAll("text")].find(
        (text) => text.textContent.startsWith("😀"),
      );
      const fits = (text, shape) =>
        text.getBBox().width <= shape.getBBox().width;
      const measureLongGeometry = (character) => {
        const renderTarget = document.createElement("div");
        document.body.append(renderTarget);
        const actorName = character.repeat(30);
        const actorTag = character.repeat(20);
        const messageLabel = character.repeat(50);
        const blockLabel = character.repeat(70);
        const rendered = window.linesAndArrows.renderDiagram(
          renderTarget,
          `@${actorName}\n  tag ${actorTag}\n\n@B\n\nchoice ${blockLabel}\n  ${actorName} -> B: ${messageLabel}\n  gap ${blockLabel}\n\n${actorName} -> ${actorName}: ${messageLabel}`,
          { branding: false, copySource: false },
        );
        const actor = rendered.svg.querySelector(".la-actor");
        const group = rendered.svg.querySelector(".la-group-header");
        const gap = rendered.svg.querySelector(".la-gap");
        const gapBounds = gap.querySelector("rect").getBBox();
        const gapLabelBounds = gap.querySelector(".la-gap-label").getBBox();
        const geometry = {
          actor: fits(
            actor.querySelector(".la-actor-label"),
            actor.querySelector(".la-actor-shape"),
          ),
          tag: fits(
            actor.querySelector(".la-tag text"),
            actor.querySelector(".la-tag rect"),
          ),
          group: fits(
            group.querySelector("text:last-of-type"),
            group.querySelector(".la-group-label-shape"),
          ),
          gap:
            gapLabelBounds.x >= gapBounds.x &&
            gapLabelBounds.x + gapLabelBounds.width <=
              gapBounds.x + gapBounds.width,
          messages: [...rendered.svg.querySelectorAll(".la-message")].map(
            (message) =>
              fits(
                message.querySelector(".la-message-label"),
                message.querySelector(".la-message-line"),
              ),
          ),
        };
        rendered.destroy();
        renderTarget.remove();
        return geometry;
      };
      const snapshot = {
        tag: controller.svg.tagName,
        theme: controller.svg.closest(".la-frame").dataset.theme,
        actorTextColor: getComputedStyle(actorLabel).fill,
        selected: selected?.getAttribute("aria-label"),
        selections: window.selections,
        selectableKinds: [
          ...controller.svg.querySelectorAll(".la-selectable"),
        ].map((element) => element.dataset.laKind),
        attributionCount: copied
          .split("\n")
          .filter((line) => line === attribution).length,
        attributionFirst: copied.startsWith(`${attribution}\n`),
        headerComment: copied.includes("// first\n"),
        injectedControls: controller.svg.querySelectorAll(
          '[aria-label="Injected"]',
        ).length,
        injectedCallbacks: window.injectedHeaderActions,
        flagActor: {
          fallback: flagActor.querySelector(".la-actor-icon-fallback")
            ?.textContent,
          labelFits:
            flagLabel.getComputedTextLength() <=
            Number(
              flagActor
                .querySelector(".la-actor-shape")
                .getAttribute("width"),
            ),
        },
        emojiGeometry: {
          tag:
            emojiTag.querySelector("text").getComputedTextLength() <=
            Number(emojiTag.querySelector("rect").getAttribute("width")),
          group:
            emojiGroupLabel.getComputedTextLength() <=
            Number(
              emojiGroup
                .querySelector(".la-group-label-shape")
                .getAttribute("width"),
            ),
        },
        longTextGeometry: {
          emoji: measureLongGeometry("😀"),
          latin: measureLongGeometry("W"),
          nonAscii: measureLongGeometry("Ж"),
        },
      };
      controller.destroy();
      return {
        ...snapshot,
        childrenAfterDestroy:
          document.querySelector("#target").childElementCount,
      };
    });

    assert.deepEqual(result, {
      tag: "svg",
      theme: "dark",
      actorTextColor: "rgb(0, 0, 0)",
      selected: "Actor API",
      selections: ["Client", "API"],
      selectableKinds: ["actor", "actor", "actor"],
      attributionCount: 1,
      attributionFirst: true,
      headerComment: true,
      injectedControls: 0,
      injectedCallbacks: 0,
      flagActor: { fallback: "🇪🇸", labelFits: true },
      emojiGeometry: { tag: true, group: true },
      longTextGeometry: {
        emoji: {
          actor: true,
          tag: true,
          group: true,
          gap: true,
          messages: [true, true],
        },
        latin: {
          actor: true,
          tag: true,
          group: true,
          gap: true,
          messages: [true, true],
        },
        nonAscii: {
          actor: true,
          tag: true,
          group: true,
          gap: true,
          messages: [true, true],
        },
      },
      childrenAfterDestroy: 0,
    });
    assert.ok(
      iconRequests.get(page).some((url) =>
        url.endsWith(
          "/@phosphor-icons/core@2.1.1/assets/bold/user-bold.svg",
        ),
      ),
    );
  },
);

test(
  "inline element owns valid source and clears stale actor selection",
  async (testContext) => {
    const page = await openPage(testContext);
    const result = await page.evaluate(async () => {
      const element = document.querySelector("#view");
      const selections = [];
      element.addEventListener("la-actor-select", (event) =>
        selections.push(event.detail?.name ?? null),
      );
      const inlineSource = element.source;
      const initialCanvas = Boolean(element.shadowRoot.querySelector("svg"));
      element.selectActor("Client");
      let invalidMessage = null;
      try {
        element.source = "Client -> API:";
      } catch (error) {
        invalidMessage = error.message;
      }
      const preserved = element.source;
      element.source = "Worker -> Queue: Continue";
      const queued = document.createElement("lines-and-arrows");
      queued.source = "A -> B: Queued";
      queued.selectableActors = true;
      let queuedError = null;
      try {
        queued.selectActor("Missing");
      } catch (problem) {
        queuedError = problem.message;
      }
      queued.selectActor("A");
      document.body.append(queued);
      const queuedSelection = queued.shadowRoot
        .querySelector('.la-actor[data-selected="true"]')
        ?.getAttribute("aria-label");
      queued.remove();
      const staleInline = document.createElement("lines-and-arrows");
      staleInline.textContent = "Stale -> Source: Old";
      staleInline.source = "Fresh -> Target: Current";
      document.body.append(staleInline);
      const assignedSource = staleInline.source;
      const inlineCleared = staleInline.textContent === "";
      staleInline.source = "";
      staleInline.remove();
      document.body.append(staleInline);
      const staleSourceReturned = staleInline.source !== "";
      const staleCanvasReturned = Boolean(
        staleInline.shadowRoot.querySelector("svg"),
      );
      staleInline.remove();
      const emptyAssigned = document.createElement("lines-and-arrows");
      emptyAssigned.textContent = "Stale -> Source: Old";
      emptyAssigned.source = "";
      document.body.append(emptyAssigned);
      const emptyAssignment = {
        source: emptyAssigned.source,
        hasCanvas: Boolean(emptyAssigned.shadowRoot.querySelector("svg")),
      };
      emptyAssigned.remove();
      const teardown = document.createElement("lines-and-arrows");
      teardown.mode = "edit";
      teardown.source = "A -> B: Start";
      document.body.append(teardown);
      const teardownFrame = teardown.shadowRoot.querySelector(".la-frame");
      teardown.shadowRoot
        .querySelector('.la-actor[aria-label="Actor A"]')
        .dispatchEvent(new MouseEvent("click", { bubbles: true }));
      const insertion = teardown.shadowRoot.querySelector(
        '.la-insertion[data-control-only="true"] .la-insertion-circle',
      );
      insertion.dispatchEvent(new PointerEvent("pointerenter"));
      insertion.dispatchEvent(new PointerEvent("pointerleave"));
      teardown.remove();
      await new Promise((resolve) => setTimeout(resolve, 20));
      const detachedEditors = teardownFrame.querySelectorAll(
        ".la-inline-actor-editor",
      ).length;
      const transition = document.createElement("lines-and-arrows");
      transition.branding = false;
      transition.copySource = false;
      transition.source = "A -> B: Start";
      document.body.append(transition);
      const viewCanvas = transition.shadowRoot.querySelector(".la-canvas");
      const viewFrame = {
        width: viewCanvas.viewBox.baseVal.width,
        height: viewCanvas.viewBox.baseVal.height,
      };
      transition.mode = "edit";
      const editCanvas = transition.shadowRoot.querySelector(".la-canvas");
      const editStart = {
        x: editCanvas.viewBox.baseVal.x,
        y: editCanvas.viewBox.baseVal.y,
        width: editCanvas.viewBox.baseVal.width,
        height: editCanvas.viewBox.baseVal.height,
        canvases: transition.shadowRoot.querySelectorAll(".la-canvas").length,
      };
      await new Promise((resolve) => setTimeout(resolve, 220));
      const editFrame = {
        x: editCanvas.viewBox.baseVal.x,
        y: editCanvas.viewBox.baseVal.y,
        width: editCanvas.viewBox.baseVal.width,
        height: editCanvas.viewBox.baseVal.height,
      };
      const actorControl = editCanvas.querySelector(
        '.la-insertion[aria-label="Add actor here"] .la-insertion-circle',
      );
      const timelineControl = editCanvas.querySelector(
        '.la-insertion[data-control-only="true"] .la-insertion-circle',
      );
      timelineControl.dispatchEvent(new PointerEvent("pointerenter"));
      await new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      );
      const popover = transition.shadowRoot.querySelector(
        '.la-edit-popover[aria-label="Add timeline item"]',
      );
      const controlBounds = timelineControl.getBoundingClientRect();
      const insertionGeometry = {
        actorX: Number(actorControl.getAttribute("cx")),
        timelineX: Number(timelineControl.getAttribute("cx")),
        popoverOffset:
          popover.getBoundingClientRect().left -
          (controlBounds.left + controlBounds.width / 2),
      };
      transition.mode = "view";
      const viewStart = transition.shadowRoot.querySelector(".la-canvas");
      const reverseStart = {
        x: viewStart.viewBox.baseVal.x,
        y: viewStart.viewBox.baseVal.y,
        width: viewStart.viewBox.baseVal.width,
        height: viewStart.viewBox.baseVal.height,
        canvases: transition.shadowRoot.querySelectorAll(".la-canvas").length,
      };
      await new Promise((resolve) => setTimeout(resolve, 220));
      const restoredView = {
        x: viewStart.viewBox.baseVal.x,
        y: viewStart.viewBox.baseVal.y,
        width: viewStart.viewBox.baseVal.width,
        height: viewStart.viewBox.baseVal.height,
      };
      transition.remove();
      return {
        inlineSource,
        initialCanvas,
        preserved,
        invalidMessage,
        selections,
        hasCanvas: Boolean(element.shadowRoot.querySelector("svg")),
        queuedError,
        queuedSelection,
        assignedSource,
        inlineCleared,
        staleSourceReturned,
        staleCanvasReturned,
        emptyAssignment,
        detachedEditors,
        modeTransition: {
          viewFrame,
          editStart,
          editFrame,
          insertionGeometry,
          reverseStart,
          restoredView,
        },
      };
    });

    assert.equal(result.inlineSource, "Client -> API: Start");
    assert.equal(result.initialCanvas, true);
    assert.equal(result.preserved, result.inlineSource);
    assert.match(result.invalidMessage, /label cannot be empty/i);
    assert.deepEqual(result.selections, ["Client", null]);
    assert.equal(result.hasCanvas, true);
    assert.match(result.queuedError, /No actor named "Missing" exists/);
    assert.equal(result.queuedSelection, "Actor A");
    assert.equal(result.assignedSource, "Fresh -> Target: Current");
    assert.equal(result.inlineCleared, true);
    assert.equal(result.staleSourceReturned, false);
    assert.equal(result.staleCanvasReturned, false);
    assert.deepEqual(result.emptyAssignment, { source: "", hasCanvas: false });
    assert.equal(result.detachedEditors, 0);
    assert.deepEqual(result.modeTransition.editStart, {
      x: 30,
      y: 28,
      ...result.modeTransition.viewFrame,
      canvases: 1,
    });
    assert.equal(
      result.modeTransition.editFrame.width,
      result.modeTransition.viewFrame.width + 60,
    );
    assert.equal(
      result.modeTransition.editFrame.height,
      result.modeTransition.viewFrame.height + 28,
    );
    assert.deepEqual(
      {
        x: result.modeTransition.editFrame.x,
        y: result.modeTransition.editFrame.y,
      },
      { x: 0, y: 0 },
    );
    assert.equal(result.modeTransition.insertionGeometry.actorX, 13);
    assert.equal(result.modeTransition.insertionGeometry.timelineX, 13);
    assert.ok(
      Math.abs(result.modeTransition.insertionGeometry.popoverOffset) < 2,
    );
    assert.deepEqual(result.modeTransition.reverseStart, {
      ...result.modeTransition.editFrame,
      x: -30,
      y: -28,
      canvases: 1,
    });
    assert.deepEqual(result.modeTransition.restoredView, {
      x: 0,
      y: 0,
      ...result.modeTransition.viewFrame,
    });
  },
);

test(
  "visual edits emit canonical source and replacement resets history",
  async (testContext) => {
    const page = await openPage(testContext);
    const element = page.locator("#editor");
    await page.evaluate(() => {
      const diagram = document.querySelector("#editor");
      window.changes = [];
      diagram.addEventListener("la-change", (event) =>
        window.changes.push(event.detail.source),
      );
    });
    const nested = await element.evaluate((node) => ({
      groups: node.shadowRoot.querySelectorAll(".la-group-shape").length,
      sections: node.shadowRoot.querySelectorAll(".la-section").length,
      gaps: node.shadowRoot.querySelectorAll(".la-gap").length,
      selfMessage: Boolean(
        [...node.shadowRoot.querySelectorAll(".la-message")].find(
          (message) => message.getAttribute("aria-label") === "API to API: Retry",
        ),
      ),
    }));
    assert.deepEqual(nested, {
      groups: 1,
      sections: 2,
      gaps: 1,
      selfMessage: true,
    });
    await element
      .getByRole("button", { name: "Edit group label" })
      .click();
    assert.equal(
      await element.getByRole("textbox", { name: "Group type" }).inputValue(),
      "choice",
    );
    await page.keyboard.press("Escape");
    await element.getByRole("button", { name: /Actor Client/ }).click();
    const name = element.getByLabel("Actor name");
    await name.fill("Customer");
    await name.press("Enter");

    await element
      .getByRole("button", { name: "Choose actor icon" })
      .evaluate((node) => node.click());
    const iconPicker = await element.evaluate((node) => ({
      open: !node.shadowRoot.querySelector(".la-icon-picker-popover").hidden,
      focused: node.shadowRoot.activeElement?.getAttribute("aria-label"),
    }));
    assert.deepEqual(iconPicker, { open: true, focused: "Search icons" });
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");

    const sameSource = await element.evaluate((node) => {
      node.source = node.source;
      return node.shadowRoot
        .querySelector('[aria-label="Undo"]')
        .getAttribute("aria-disabled");
    });
    assert.equal(sameSource, "false");

    await element.getByRole("button", { name: "Undo" }).click();
    assert.match(await element.evaluate((node) => node.source), /@Client/);
    assert.equal(await page.evaluate(() => window.changes.length), 2);

    await element
      .getByRole("button", { name: "Client to API: Start" })
      .click();
    const messageLabel = element.getByLabel("Arrow label");
    await messageLabel.fill("Continue");
    await messageLabel.press("Enter");
    assert.match(
      await element.evaluate((node) => node.source),
      /Client -> API: Continue/,
    );
    assert.equal(await page.evaluate(() => window.changes.length), 3);

    const reset = await element.evaluate((node) => {
      node.source = "Worker -> Queue: Continue";
      return {
        source: node.source,
        undoDisabled: node.shadowRoot
          .querySelector('[aria-label="Undo"]')
          .getAttribute("aria-disabled"),
      };
    });
    assert.equal(reset.source, "Worker -> Queue: Continue\n");
    assert.equal(reset.undoDisabled, "true");
    assert.equal(await page.evaluate(() => window.changes.length), 3);
  },
);

test("constructor preserves diagram source in generated HTML", async (testContext) => {
  const context = await browser.newContext();
  testContext.after(() => context.close());
  const page = await context.newPage();
  const source =
    "Client -> API: &copy; </lines-and-arrows><script>globalThis.injected = true</script>";
  await page.addInitScript(
    ({ savedSource }) => {
      if (location.protocol === "http:") {
        localStorage.setItem(
          "lines-and-arrows-constructor-v1",
          JSON.stringify({ source: savedSource }),
        );
      }
    },
    { savedSource: source },
  );
  await stubCdn(page);
  await page.goto(`${origin}/website/constructor.html`);
  await page.waitForFunction(
    () => !document.body.classList.contains("is-loading"),
  );

  const previewSnapshot = () =>
    page.locator("#constructor-diagram").evaluate((node) => ({
      mode: node.mode,
      selectableActors: node.selectableActors,
      branding: node.branding,
      copySource: node.copySource,
      canvasBackground: node.canvasBackground,
      theme: node.theme,
      actions: [...node.shadowRoot.querySelectorAll(".la-header-control")].map(
        (control) => control.getAttribute("aria-label"),
      ),
      brandingCount: node.shadowRoot.querySelectorAll(".la-branding").length,
    }));
  const initialPreview = await previewSnapshot();
  const workbenchBeforeControls = await page.evaluate(() => {
    const workbench = document.querySelector(".constructor-workbench");
    const controls = document.querySelector(".constructor-controls");
    return Boolean(
      workbench.compareDocumentPosition(controls) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  await page.evaluate(() => {
    for (const [selector, checked] of [
      ["[data-option-selectable-actors]", true],
      ["[data-option-branding]", false],
      ["[data-option-copy-source]", false],
      ["[data-option-transparent]", false],
    ]) {
      const input = document.querySelector(selector);
      input.checked = checked;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }
    const theme = document.querySelector(
      '[data-diagram-theme][value="default-dark"]',
    );
    theme.checked = true;
    theme.dispatchEvent(new Event("change", { bubbles: true }));
  });

  const adjustedPreview = await previewSnapshot();
  const generated = await page.locator("#constructor-embed-code").textContent();
  const parsed = await page.evaluate((html) => {
    const document = new DOMParser().parseFromString(html, "text/html");
    const diagram = document.querySelector("lines-and-arrows");
    return {
      source: diagram?.textContent.trim(),
      injectedScripts: [...document.querySelectorAll("script")].filter(
        (script) => script.textContent.includes("globalThis.injected"),
      ).length,
      settings: {
        mode: diagram?.getAttribute("mode"),
        theme: diagram?.getAttribute("theme"),
        selectableActors: diagram?.hasAttribute("selectable-actors"),
        branding: diagram?.getAttribute("branding"),
        copySource: diagram?.getAttribute("copy-source"),
        canvasBackground: diagram?.getAttribute("canvas-background"),
      },
    };
  }, generated);

  assert.equal(workbenchBeforeControls, true);
  assert.deepEqual(initialPreview, {
    mode: "edit",
    selectableActors: false,
    branding: false,
    copySource: true,
    canvasBackground: "transparent",
    theme: "auto",
    actions: ["Undo", "Redo", "Copy source"],
    brandingCount: 0,
  });
  assert.deepEqual(adjustedPreview, {
    ...initialPreview,
    theme: "dark",
  });
  assert.deepEqual(parsed, {
    source,
    injectedScripts: 0,
    settings: {
      mode: "view",
      theme: "dark",
      selectableActors: true,
      branding: "false",
      copySource: "false",
      canvasBackground: "solid",
    },
  });
});
