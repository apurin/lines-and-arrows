import assert from "node:assert/strict";
import { createReadStream, statSync } from "node:fs";
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

async function openPage(testContext) {
  const context = await browser.newContext();
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin });
  const page = await context.newPage();
  const requests = [];
  iconRequests.set(page, requests);
  await page.route("https://cdn.jsdelivr.net/**", (route) => {
    requests.push(route.request().url());
    return route.fulfill({
      status: 200,
      contentType: "image/svg+xml",
      body: ICON,
    });
  });
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
      const snapshot = {
        tag: controller.svg.tagName,
        theme: controller.svg.closest(".la-frame").dataset.theme,
        selected: selected?.getAttribute("aria-label"),
        selections: window.selections,
        selectableKinds: [
          ...controller.svg.querySelectorAll(".la-selectable"),
        ].map((element) => element.dataset.laKind),
        attributionCount: copied
          .split("\n")
          .filter((line) => line === attribution).length,
        attributionFirst: copied.startsWith(`${attribution}\n`),
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
      selected: "Actor API",
      selections: ["Client", "API"],
      selectableKinds: ["actor", "actor"],
      attributionCount: 1,
      attributionFirst: true,
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
    const result = await page.evaluate(() => {
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
      return {
        inlineSource,
        initialCanvas,
        preserved,
        invalidMessage,
        selections,
        hasCanvas: Boolean(element.shadowRoot.querySelector("svg")),
      };
    });

    assert.equal(result.inlineSource, "Client -> API: Start");
    assert.equal(result.initialCanvas, true);
    assert.equal(result.preserved, result.inlineSource);
    assert.match(result.invalidMessage, /label cannot be empty/i);
    assert.deepEqual(result.selections, ["Client", null]);
    assert.equal(result.hasCanvas, true);
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
