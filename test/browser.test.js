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
  try {
    browser = await chromium.launch({ channel: "chrome", headless: true });
  } catch (error) {
    throw new Error(
      "The browser suite requires Google Chrome (stable channel) installed " +
        "locally. playwright-core does not download browsers; install Google " +
        "Chrome and rerun. See CONTRIBUTING.md.\n" +
        `Launch error: ${error.message}`,
      { cause: error },
    );
  }
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
  const { version } = JSON.parse(
    readFileSync(join(ROOT, "package.json"), "utf8"),
  );
  const expected =
    `https://cdn.jsdelivr.net/npm/lines-and-arrows@${version}/dist/lines-and-arrows.auto.min.js`;

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
    await page.waitForFunction(
      () => !document.body.classList.contains("is-loading"),
    );
    assert.equal(
      requests.filter((url) => url.includes("/lines-and-arrows@")).at(-1),
      expected,
      path,
    );
    assert.deepEqual(
      (await page
        .locator(".constructor-error, .showcase-error, .feature-error")
        .allTextContents())
        .filter((text) => text.trim()),
      [],
      path,
    );
  }
});

test("homepage CDN example disables email address rewriting", () => {
  const source = readFileSync(join(ROOT, "website", "index.html"), "utf8");
  assert.doesNotMatch(
    source,
    /cdn\.jsdelivr\.net\/npm\/lines-and-arrows@/,
  );
});

test("showcase uses static view-mode diagrams with source copy available", async (
  testContext,
) => {
  const htmlSource = readFileSync(
    join(ROOT, "website", "showcase.html"),
    "utf8",
  );
  const scriptSource = readFileSync(
    join(ROOT, "website", "showcase.js"),
    "utf8",
  );
  assert.equal(
    htmlSource.match(/<lines-and-arrows\b[^>]*>\s*@/g)?.length,
    12,
  );
  assert.doesNotMatch(
    scriptSource,
    /technicalShowcases|IntersectionObserver|insertAdjacentHTML|data-showcase/,
  );

  const context = await browser.newContext();
  testContext.after(() => context.close());
  const page = await context.newPage();
  await stubCdn(page);
  await page.goto(`${origin}/website/showcase.html`);
  await page.waitForFunction(
    () => document.querySelectorAll("lines-and-arrows").length === 12,
  );

  assert.equal(
    await page
      .locator("[data-showcase-surface], [data-braided-surface]")
      .count(),
    0,
  );

  for (const diagram of await page.locator("lines-and-arrows").all()) {
    await diagram.scrollIntoViewIfNeeded();
    await diagram.getByRole("button", { name: "Copy source" }).waitFor();
    assert.equal(await diagram.getAttribute("mode"), "view");
  }

  const lead = page.locator("#braided-ancestry");
  const detailImage = lead.locator(".braided-media img");
  const storyParagraphs = lead.locator("[data-braided-story] p");
  await page.getByRole("button", { name: "Light theme" }).click();
  await detailImage.evaluate((image) => {
    image.dataset.testIdentity = "persistent";
  });
  await storyParagraphs.evaluateAll((paragraphs) => {
    paragraphs.forEach((paragraph, index) => {
      paragraph.dataset.testIdentity = `paragraph-${index}`;
    });
  });
  await lead
    .getByRole("button", { name: /^Actor Neanderthals/ })
    .click();
  await page.waitForFunction(() =>
    document
      .querySelector(".braided-media img")
      ?.getAttribute("src")
      ?.endsWith("/neanderthal-light.jpg"),
  );
  assert.equal(
    await detailImage.getAttribute("data-test-identity"),
    "persistent",
  );
  assert.deepEqual(
    await storyParagraphs.evaluateAll((paragraphs) =>
      paragraphs.map((paragraph) => paragraph.dataset.testIdentity),
    ),
    ["paragraph-0", "paragraph-1", "paragraph-2"],
  );

  await page.getByRole("button", { name: "Dark theme" }).click();
  await page.waitForFunction(() =>
    document
      .querySelector(".braided-media img")
      ?.getAttribute("src")
      ?.endsWith("/neanderthal-dark.jpg"),
  );
  assert.equal(
    await detailImage.getAttribute("data-test-identity"),
    "persistent",
  );
});

async function openPage(testContext, beforeLoad = async () => {}) {
  const context = await browser.newContext();
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin });
  const page = await context.newPage();
  const requests = [];
  iconRequests.set(page, requests);
  await stubCdn(page, requests);
  await beforeLoad(page);
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
          lowercaseWide: measureLongGeometry("m"),
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
        lowercaseWide: {
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

test("copy source offers selectable text when clipboard access fails", async (
  testContext,
) => {
  const page = await openPage(testContext);
  await page.evaluate(() => {
    Object.defineProperty(navigator.clipboard, "writeText", {
      configurable: true,
      value: async () => {
        throw new DOMException("Clipboard unavailable", "NotAllowedError");
      },
    });
  });

  const diagram = page.locator("#view");
  await diagram.getByRole("button", { name: "Copy source" }).click();

  const dialog = diagram.getByRole("dialog", { name: "Copy source" });
  const source = dialog.getByRole("textbox", { name: "Diagram source" });
  await dialog.waitFor();
  const fallback = await source.evaluate((control) => ({
    value: control.value,
    selected:
      control.selectionStart === 0 &&
      control.selectionEnd === control.value.length,
    focused: control.getRootNode().activeElement === control,
  }));
  assert.equal(
    fallback.value,
    "// Powered by https://lines-and-arrows.dev/\n" +
      "Client -> API: Start\n",
  );
  assert.equal(fallback.selected, true);
  assert.equal(fallback.focused, true);

  await dialog.getByRole("button", { name: "Close" }).click();
  assert.equal(await dialog.isVisible(), false);
  await diagram.getByRole("button", { name: "Copy source" }).waitFor();
});

function iconFallbackSnapshot(svg) {
  const visible = (element) =>
    Boolean(element) &&
    getComputedStyle(element).opacity !== "0" &&
    getComputedStyle(element).display !== "none";
  const actorFallback = svg.querySelector(".la-actor-icon-fallback");
  const tooltipFallback = svg.querySelector(".la-tooltip-trigger-fallback");
  return {
    images: [...svg.querySelectorAll("image")].map((image) =>
      image.getAttribute("class"),
    ),
    actorFallback: actorFallback?.textContent,
    actorFallbackVisible: visible(actorFallback),
    tooltipFallback: tooltipFallback?.textContent,
    tooltipFallbackVisible: visible(tooltipFallback),
  };
}

test("unknown icon names keep the generic fallback", async (testContext) => {
  const page = await openPage(testContext);
  const source =
    "@Server\n  icon server\n  tooltip Runs jobs\n  tooltip-icon nope\n\n" +
    "Server -> Server: Check";
  const view = await page.evaluate(
    ({ source, snapshot }) => {
      const target = document.createElement("div");
      document.body.append(target);
      const rendered = window.linesAndArrows.renderDiagram(target, source, {
        branding: false,
        copySource: false,
        downloadSvg: false,
      });
      return new Function(`return (${snapshot})`)()(rendered.svg);
    },
    { source, snapshot: iconFallbackSnapshot.toString() },
  );
  assert.deepEqual(view, {
    images: [],
    actorFallback: "S",
    actorFallbackVisible: true,
    tooltipFallback: "i",
    tooltipFallbackVisible: true,
  });
  assert.equal(
    iconRequests
      .get(page)
      .filter((url) => /\/(server|nope)-bold\.svg$/.test(url)).length,
    0,
  );

  const edit = await page.evaluate((source) => {
    const element = document.createElement("lines-and-arrows");
    element.mode = "edit";
    element.source = source;
    document.body.append(element);
    element.shadowRoot
      .querySelector('.la-actor[aria-label^="Actor Server"]')
      .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    const trigger = element.shadowRoot.querySelector(
      ".la-inline-actor-icon-picker .la-icon-picker-trigger",
    );
    const currentText = (selector) =>
      element.shadowRoot.querySelector(`${selector} .la-icon-picker-current`)
        ?.textContent;
    return {
      images: element.shadowRoot.querySelectorAll(
        ".la-actor-icon, .la-tooltip-trigger-icon",
      ).length,
      pickerName: trigger?.getAttribute("aria-label"),
      pickerTitle: trigger?.title,
      pickerCurrent: currentText(".la-inline-actor-icon-picker"),
      tooltipIconCurrent: currentText(".la-inline-tooltip-icon-selector"),
      pickerImages: trigger?.querySelectorAll("img").length,
      source: element.source,
    };
  }, source);
  assert.deepEqual(edit, {
    images: 0,
    pickerName: "Choose actor icon, currently server",
    pickerTitle: "server",
    pickerCurrent: "Current: server",
    tooltipIconCurrent: "Current: nope",
    pickerImages: 0,
    source: `${source}\n`,
  });
});

test("icons that fail to load keep the generic fallback", async (
  testContext,
) => {
  const page = await openPage(testContext, (page) =>
    page.route("https://cdn.jsdelivr.net/npm/@phosphor-icons/**", (route) =>
      route.abort(),
    ),
  );
  await page.evaluate(() => {
    const target = document.createElement("div");
    target.id = "offline-icons";
    document.body.append(target);
    window.offlineIcons = window.linesAndArrows.renderDiagram(
      target,
      "@Server\n  icon cloud\n  tooltip Runs jobs\n  tooltip-icon key\n\n" +
        "Server -> Server: Check",
    );
  });
  await page.waitForFunction(
    () => window.offlineIcons.svg.querySelectorAll("image").length === 0,
  );
  const result = await page.evaluate(
    (snapshot) =>
      new Function(`return (${snapshot})`)()(window.offlineIcons.svg),
    iconFallbackSnapshot.toString(),
  );
  assert.deepEqual(result, {
    images: [],
    actorFallback: "S",
    actorFallbackVisible: true,
    tooltipFallback: "i",
    tooltipFallbackVisible: true,
  });
  assert.equal(
    await page
      .locator("#offline-icons .la-copy-source .la-header-control-fallback")
      .evaluate((node) => getComputedStyle(node).display !== "none"),
    true,
  );
});

test("group and gap labels use measured width", async (testContext) => {
  const page = await openPage(testContext);
  const label = "Retry the payment authorization until the provider confirms";
  const longType = "a-really-long-group-type-for-narrow-frames";
  const wide = `@A\n@B\n@C\n@D\n\nrepeat ${label}\\nsecond line\n  A -> D: Go\n  gap ${label}`;
  const oversizedType = "x".repeat(80);
  const narrow = `A -> B: Go\ncritical Outer\n  parallel Middle\n    ${longType} ${label}\n      A -> B: Go\n  ${oversizedType} Label\n    A -> B: Go`;
  const result = await page.evaluate(
    ({ wide, narrow }) => {
      const headerGeometry = (root) =>
        [...root.querySelectorAll(".la-group-header")].map((header, index) => {
          const frame = root
            .querySelectorAll(".la-group-shape")
            [index].getBBox();
          const [type, text] = header.querySelectorAll("text");
          const inside = (element) => {
            const box = element.getBBox();
            return (
              box.x >= frame.x && box.x + box.width <= frame.x + frame.width
            );
          };
          return {
            type: type.textContent,
            lines: [...text.querySelectorAll("tspan")].map(
              (line) => line.textContent,
            ),
            typeInside: inside(type),
            labelInside: inside(text),
            gapBetween: text.getBBox().x - (type.getBBox().x + type.getBBox().width),
          };
        });
      const gapGeometry = (root) =>
        [...root.querySelectorAll(".la-gap")].map((gap) => {
          const frame = gap.querySelector("rect").getBBox();
          const text = gap.querySelector(".la-gap-label");
          const box = text.getBBox();
          return {
            text: text.textContent,
            inside: box.x >= frame.x && box.x + box.width <= frame.x + frame.width,
          };
        });
      const snapshot = (root) => ({
        groups: headerGeometry(root),
        gaps: gapGeometry(root),
      });
      const view = (source) => {
        const target = document.createElement("div");
        target.style.width = "1200px";
        document.body.append(target);
        const rendered = window.linesAndArrows.renderDiagram(target, source, {
          branding: false,
          copySource: false,
        });
        const result = snapshot(rendered.svg);
        rendered.destroy();
        target.remove();
        return result;
      };
      const edit = (source) => {
        const element = document.createElement("lines-and-arrows");
        element.mode = "edit";
        element.source = source;
        element.style.width = "1200px";
        document.body.append(element);
        const result = snapshot(element.shadowRoot);
        element.remove();
        return result;
      };
      return {
        wideView: view(wide),
        wideEdit: edit(wide),
        narrowView: view(narrow),
        narrowEdit: edit(narrow),
      };
    },
    { wide, narrow },
  );

  for (const mode of ["wideView", "wideEdit"]) {
    const [group] = result[mode].groups;
    assert.deepEqual(group.lines, [label, "second line"], mode);
    assert.equal(group.typeInside && group.labelInside, true, mode);
    assert.ok(group.gapBetween < 16, `${mode}: ${group.gapBetween}`);
    assert.deepEqual(result[mode].gaps, [{ text: label, inside: true }], mode);
  }
  for (const mode of ["narrowView", "narrowEdit"]) {
    const inner = result[mode].groups[2];
    assert.equal(inner.type, longType, mode);
    assert.match(inner.lines[0], /…$/, mode);
    assert.ok(label.startsWith(inner.lines[0].slice(0, -1)), mode);
    assert.equal(inner.typeInside, true, mode);
    assert.equal(inner.labelInside, true, mode);
    assert.match(result[mode].groups[3].type, /^x+…$/, mode);
    for (const group of result[mode].groups) {
      assert.equal(group.typeInside && group.labelInside, true, mode);
    }
  }
});

test("message labels use the arrow span and expose truncated text", async (
  testContext,
) => {
  const page = await openPage(testContext);
  const label =
    "Publish the reconciled settlement batch to every downstream ledger and notify each subscriber";
  const source =
    "@A\n@B\n@C\n@D\n@E\n@F\n@G\n@H\n\n" +
    `A -> H: ${label}\nA -> B: ${label}\nC -> C: ${label}\n` +
    "D -> E: Short label";
  const snapshot = (root) =>
    [...root.querySelectorAll(".la-message")].map((message) => {
      const text = message.querySelector(".la-message-label");
      const lifelines = [...root.querySelectorAll(".la-lifeline")].map(
        (line) => Number(line.getAttribute("x1")),
      );
      const box = text.getBBox();
      const line = message.querySelector(".la-message-line").getBBox();
      return {
        text: text.textContent,
        title: message.querySelector("title")?.textContent ?? null,
        name: message.getAttribute("aria-label"),
        between:
          box.x >= line.x - 0.5 &&
          box.x + box.width <= line.x + line.width + 0.5 &&
          lifelines.length === 8,
        hoverTarget:
          message.querySelector("title")
            ? getComputedStyle(text).pointerEvents
            : null,
      };
    });
  const result = await page.evaluate(
    ({ source, snapshot }) => {
      const read = new Function(`return (${snapshot})`)();
      const target = document.createElement("div");
      document.body.append(target);
      const rendered = window.linesAndArrows.renderDiagram(target, source, {
        branding: false,
        copySource: false,
      });
      target.id = "span-labels";
      const view = read(rendered.svg);
      const element = document.createElement("lines-and-arrows");
      element.mode = "edit";
      element.source = source;
      document.body.append(element);
      const edit = read(element.shadowRoot);
      element.remove();
      return { view, edit };
    },
    { source, snapshot: snapshot.toString() },
  );

  for (const mode of ["view", "edit"]) {
    const [long, adjacent, self, short] = result[mode];
    assert.equal(long.text, label, mode);
    assert.equal(long.title, null, mode);
    assert.equal(long.between, true, mode);
    assert.match(adjacent.text, /…$/, mode);
    assert.equal(adjacent.title, label, mode);
    assert.equal(adjacent.between, true, mode);
    assert.equal(adjacent.hoverTarget, "bounding-box", mode);
    assert.match(adjacent.name, new RegExp(`^A to B: ${label}`), mode);
    assert.match(self.text, /…$/, mode);
    assert.equal(self.title, label, mode);
    assert.match(self.name, new RegExp(`^C to C: ${label}`), mode);
    assert.deepEqual(
      { text: short.text, title: short.title },
      { text: "Short label", title: null },
      mode,
    );
  }
  assert.equal(result.view[0].name, null);
  assert.equal(result.view[3].name, null);
  const labels = page.locator("#span-labels");
  assert.equal(
    await labels.getByRole("group", { name: `A to B: ${label}` }).count(),
    1,
  );
  assert.equal(
    await labels.getByRole("group", { name: `C to C: ${label}` }).count(),
    1,
  );
});

test("view canvases stay at natural size, shrink, then scroll", async (
  testContext,
) => {
  const page = await openPage(testContext);
  const small = "A -> B: Start\nB --> A: Done";
  const large = Array.from(
    { length: 5 },
    (_, index) => `A${index} -> A${index + 1}: Step ${index}`,
  ).join("\n");
  const result = await page.evaluate(
    async ({ small, large }) => {
      // Samples the rendered width each frame until the viewBox and width
      // stay unchanged across two animation frames.
      const settle = async (element) => {
        const widths = [];
        let previous = null;
        let stable = 0;
        for (let frame = 0; frame < 300; frame += 1) {
          await new Promise((resolve) => requestAnimationFrame(resolve));
          const canvas = element.shadowRoot.querySelector(".la-canvas");
          const width = canvas.getBoundingClientRect().width;
          const current = `${canvas.getAttribute("viewBox")} ${width}`;
          widths.push(width);
          stable = current === previous ? stable + 1 : 0;
          if (stable >= 2) {
            return widths;
          }
          previous = current;
        }
        throw new Error("The mode transition did not settle.");
      };
      const inlineSizing = (element) => {
        const { width, minWidth, maxWidth } = element.shadowRoot.querySelector(
          ".la-canvas",
        ).style;
        return { width, minWidth, maxWidth };
      };
      const transition = async (source, containerWidth) => {
        const container = document.createElement("div");
        container.style.width = `${containerWidth}px`;
        document.body.append(container);
        const element = document.createElement("lines-and-arrows");
        element.source = source;
        container.append(element);
        const width = () =>
          element.shadowRoot.querySelector(".la-canvas").getBoundingClientRect()
            .width;
        const view = { width: width(), sizing: inlineSizing(element) };
        element.mode = "edit";
        const toEdit = await settle(element);
        const edit = { width: width(), sizing: inlineSizing(element) };
        element.mode = "view";
        const toView = await settle(element);
        const restored = { width: width(), sizing: inlineSizing(element) };
        container.remove();
        return { view, toEdit, edit, toView, restored };
      };
      const measure = async (source, containerWidth, mode = "view") => {
        const container = document.createElement("div");
        container.style.width = `${containerWidth}px`;
        document.body.append(container);
        const element = document.createElement("lines-and-arrows");
        element.mode = mode;
        element.source = source;
        container.append(element);
        const frame = element.shadowRoot.querySelector(".la-frame");
        const canvas = element.shadowRoot.querySelector(".la-canvas");
        const natural = canvas.viewBox.baseVal.width;
        const bounds = canvas.getBoundingClientRect();
        const snapshot = {
          natural,
          width: bounds.width,
          left: bounds.left - container.getBoundingClientRect().left,
          scrolls: frame.scrollWidth > frame.clientWidth,
          frameWidth: frame.clientWidth,
        };
        if (mode === "edit") {
          element.mode = "view";
          await settle(element);
          snapshot.afterTransition = canvas.isConnected
            ? null
            : element.shadowRoot
                .querySelector(".la-canvas")
                .getBoundingClientRect().width;
          snapshot.viewNatural = element.shadowRoot
            .querySelector(".la-canvas")
            .viewBox.baseVal.width;
        }
        container.remove();
        return snapshot;
      };
      return {
        wide: await measure(small, 1200),
        medium: await measure(large, 800),
        narrow: await measure(large, 320),
        edit: await measure(small, 1200, "edit"),
        narrowTransition: await transition(large, 375),
      };
    },
    { small, large },
  );

  assert.equal(result.wide.width, result.wide.natural);
  assert.equal(result.wide.left, 0);
  assert.equal(result.wide.scrolls, false);

  assert.ok(
    result.medium.natural > 800 && result.medium.natural * 0.75 < 800,
    JSON.stringify(result.medium),
  );
  assert.equal(result.medium.width, 800);
  assert.equal(result.medium.scrolls, false);

  assert.ok(
    Math.abs(result.narrow.width - result.narrow.natural * 0.75) < 0.5,
    JSON.stringify(result.narrow),
  );
  assert.equal(result.narrow.scrolls, true);

  assert.equal(result.edit.width, 1200);
  assert.equal(result.edit.afterTransition, result.edit.viewNatural);

  const narrow = result.narrowTransition;
  assert.ok(narrow.view.width > 375, JSON.stringify(narrow.view));
  assert.equal(narrow.edit.width, 375);
  assert.deepEqual(narrow.restored, narrow.view);
  assert.deepEqual(narrow.edit.sizing, {
    width: "",
    minWidth: "",
    maxWidth: "",
  });
  for (const [from, to, widths] of [
    [narrow.view.width, narrow.edit.width, narrow.toEdit],
    [narrow.edit.width, narrow.view.width, narrow.toView],
  ]) {
    const span = Math.abs(to - from);
    const direction = Math.sign(to - from);
    assert.ok(widths.length > 3, JSON.stringify(widths));
    assert.ok(
      Math.abs(widths[0] - from) < span / 2,
      `first frame jumps: ${JSON.stringify({ from, to, widths })}`,
    );
    assert.ok(
      widths.every(
        (width, index) =>
          index === 0 || (width - widths[index - 1]) * direction >= -0.5,
      ),
      JSON.stringify(widths),
    );
    assert.ok(Math.abs(widths.at(-1) - to) < 0.5, JSON.stringify(widths));
  }
});

test("view mode downloads the visible diagram as standalone SVG", async (
  testContext,
) => {
  const page = await openPage(testContext);
  await page.evaluate(() => {
    const target = document.createElement("div");
    target.id = "download-target";
    document.body.append(target);
    window.downloadController = window.linesAndArrows.renderDiagram(
      target,
      "@Client\n  icon user\n  tag human\n  tooltip Starts work\n\n" +
        "Client -> API: Start job\n  tooltip Carries the request\n" +
        "critical Retry\n  API --> Client: Accepted\ngap Later",
      {
        theme: "dark",
        palette: { accent: "var(--test-accent)" },
        label: "Payment flow: retries & IDs",
        selectableActors: true,
      },
    );
    document.body.style.setProperty("--test-accent", "rgb(200, 30, 60)");
    window.downloadController.selectActor("Client");
  });
  const target = page.locator("#download-target");
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    target.getByRole("button", { name: "Download SVG" }).click(),
  ]);
  assert.equal(download.suggestedFilename(), "payment-flow-retries-ids.svg");
  const markup = readFileSync(await download.path(), "utf8");
  assert.doesNotMatch(markup, /var\(--/);

  const parsed = await page.evaluate((markup) => {
    const document = new DOMParser().parseFromString(markup, "image/svg+xml");
    const svg = document.documentElement;
    return {
      parserErrors: document.querySelectorAll("parsererror").length,
      root: svg.localName,
      namespace: svg.namespaceURI,
      xmlns: svg.getAttribute("xmlns"),
      xlink: svg.getAttribute("xmlns:xlink"),
      width: svg.getAttribute("width"),
      height: svg.getAttribute("height"),
      viewBox: svg.getAttribute("viewBox"),
      texts: [...svg.querySelectorAll("text")].map((text) => text.textContent),
      popovers: svg.querySelectorAll(".la-tooltip-popover").length,
      controls: svg.querySelectorAll(
        ".la-header-control, .la-diagram-header, [role='button'], [tabindex]",
      ).length,
      selected: svg.querySelectorAll("[data-selected], .la-selectable").length,
      fontFamily: svg.querySelector("style")?.textContent.includes("font-family"),
      tooltipTriggers: svg.querySelectorAll(".la-tooltip-trigger").length,
    };
  }, markup);
  const [, , viewWidth, viewHeight] = parsed.viewBox.split(" ");
  assert.deepEqual(
    {
      ...parsed,
      texts: undefined,
      viewBox: undefined,
    },
    {
      parserErrors: 0,
      root: "svg",
      namespace: "http://www.w3.org/2000/svg",
      xmlns: "http://www.w3.org/2000/svg",
      xlink: "http://www.w3.org/1999/xlink",
      width: viewWidth,
      height: viewHeight,
      texts: undefined,
      viewBox: undefined,
      popovers: 0,
      controls: 0,
      selected: 0,
      fontFamily: true,
      tooltipTriggers: 2,
    },
  );
  assert.ok(parsed.texts.includes("Start job"), parsed.texts.join(", "));
  assert.ok(!parsed.texts.includes("Powered by Lines & Arrows"));

  const standalone = await page.context().newPage();
  await standalone.goto(
    `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`,
  );
  const rendered = await standalone.evaluate(() => {
    const label = [...document.querySelectorAll("text")].find(
      (text) => text.textContent === "Start job",
    );
    const actor = document.querySelector(".la-actor-shape");
    return {
      labelWidth: label.getBBox().width,
      background: getComputedStyle(document.documentElement).backgroundColor,
      actorFill: getComputedStyle(actor).fill,
      canvasBounds: document.documentElement.getBoundingClientRect().width,
    };
  });
  assert.ok(rendered.labelWidth > 20, JSON.stringify(rendered));
  assert.equal(rendered.canvasBounds, Number(viewWidth));
  assert.equal(rendered.actorFill, "rgb(200, 30, 60)");
  assert.equal(rendered.background, "rgb(17, 19, 25)");

  const downloadControl = target.locator(".la-download-svg");
  await page.evaluate(() => {
    window.originalCreateObjectURL = URL.createObjectURL;
    URL.createObjectURL = () => {
      throw new Error("Blocked");
    };
  });
  await downloadControl.click();
  assert.equal(
    await downloadControl.getAttribute("aria-label"),
    "Download failed",
  );
  await page.evaluate(() => {
    URL.createObjectURL = window.originalCreateObjectURL;
  });
  await page.waitForFunction(
    () =>
      document
        .querySelector("#download-target .la-download-svg")
        .getAttribute("aria-label") === "Download SVG",
  );
  assert.equal(
    await downloadControl.locator("title").textContent(),
    "Download SVG",
  );

  const hidden = await page.evaluate(() => {
    const target = document.createElement("div");
    document.body.append(target);
    const withoutActions = window.linesAndArrows.renderDiagram(
      target,
      "A -> B: Start",
      { branding: false, copySource: false, downloadSvg: false },
    );
    const snapshot = {
      header: withoutActions.svg.querySelectorAll(".la-diagram-header").length,
      actorY: withoutActions.svg
        .querySelector(".la-actor")
        .getAttribute("transform"),
    };
    const element = document.createElement("lines-and-arrows");
    element.source = "A -> B: Start";
    element.downloadSvg = false;
    document.body.append(element);
    snapshot.elementActions = [
      ...element.shadowRoot.querySelectorAll(".la-header-control"),
    ].map((control) => control.getAttribute("aria-label"));
    snapshot.attribute = element.getAttribute("download-svg");
    element.mode = "edit";
    snapshot.editActions = [
      ...element.shadowRoot.querySelectorAll(".la-header-control"),
    ].map((control) => control.getAttribute("aria-label"));
    element.downloadSvg = true;
    element.mode = "view";
    snapshot.viewActions = [
      ...element.shadowRoot.querySelectorAll(".la-header-control"),
    ].map((control) => control.getAttribute("aria-label"));
    return snapshot;
  });
  assert.deepEqual(hidden, {
    header: 0,
    actorY: "translate(2 0)",
    elementActions: ["Copy source"],
    attribute: "false",
    editActions: ["Undo", "Redo", "Copy source"],
    viewActions: ["Download SVG", "Copy source"],
  });
});

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
      const settleViewBox = async (canvas) => {
        let previous = null;
        for (let frame = 0; frame < 300; frame += 1) {
          await new Promise((resolve) => requestAnimationFrame(resolve));
          const current = canvas.getAttribute("viewBox");
          if (current === previous) {
            return;
          }
          previous = current;
        }
        throw new Error("The mode transition did not settle.");
      };
      const transition = document.createElement("lines-and-arrows");
      transition.branding = false;
      transition.copySource = false;
      transition.downloadSvg = false;
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
      await settleViewBox(editCanvas);
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
      await settleViewBox(viewStart);
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
    const tagGeometry = await element.evaluate((node) =>
      [...node.shadowRoot.querySelectorAll(".la-message .la-tag")].map(
        (tag) => {
          const text = tag.querySelector("text");
          const pill = tag.querySelector("rect");
          return {
            text: text.textContent,
            textWidth: text.getBBox().width,
            pillWidth: pill.getBBox().width,
          };
        },
      ),
    );
    assert.deepEqual(
      tagGeometry.map(({ text }) => text),
      ["local + one replica", "mmmmmmmmmmmmmmmmmmmm"],
    );
    assert.ok(tagGeometry[0].pillWidth < 140);
    for (const geometry of tagGeometry) {
      assert.ok(
        geometry.textWidth + 16 <= geometry.pillWidth,
        JSON.stringify(geometry),
      );
    }
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
    await name.fill("gap service");
    await name.press("Enter");
    assert.equal(
      await element.locator(".la-edit-error").textContent(),
      'Actor name "gap service" cannot start with the reserved word "gap".',
    );
    assert.match(await element.evaluate((node) => node.source), /@Client/);
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
    const initialMessageLabelWidth = await messageLabel.evaluate(
      (node) => node.getBoundingClientRect().width,
    );
    await messageLabel.fill("mmmmmmmmmmmmmmmmmmmm");
    const expandedMessageLabel = await messageLabel.evaluate((node) => ({
      width: node.getBoundingClientRect().width,
      clientHeight: node.clientHeight,
      scrollHeight: node.scrollHeight,
    }));
    assert.ok(expandedMessageLabel.width > initialMessageLabelWidth * 2);
    assert.ok(
      expandedMessageLabel.scrollHeight <=
        expandedMessageLabel.clientHeight + 1,
      JSON.stringify(expandedMessageLabel),
    );
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

test(
  "source replacement drops an uncommitted inline edit without la-change",
  async (testContext) => {
    const page = await openPage(testContext);
    const openInlineLabel = async (source) => {
      await page.evaluate((initialSource) => {
        document.querySelector("#pending")?.remove();
        const diagram = document.createElement("lines-and-arrows");
        diagram.id = "pending";
        diagram.mode = "edit";
        diagram.source = initialSource;
        window.pendingChanges = [];
        diagram.addEventListener("la-change", (event) =>
          window.pendingChanges.push(event.detail.source),
        );
        document.body.append(diagram);
      }, source);
      const diagram = page.locator("#pending");
      await diagram.getByRole("button", { name: "A to B: Start" }).click();
      await diagram.getByLabel("Arrow label").fill("Uncommitted");
    };

    await openInlineLabel("A -> B: Start\n");
    const replaced = await page.evaluate(async () => {
      const diagram = document.querySelector("#pending");
      const assigned = "C -> D: Replacement\n";
      diagram.source = assigned;
      const duringAssignment = [...window.pendingChanges];
      await new Promise((resolve) => setTimeout(resolve, 20));
      return {
        duringAssignment,
        afterAssignment: window.pendingChanges,
        source: diagram.source,
        assigned,
        labels: [
          ...diagram.shadowRoot.querySelectorAll(".la-message-label"),
        ].map((label) => label.textContent),
        inlineEditors: diagram.shadowRoot.querySelectorAll(
          ".la-inline-message-editor",
        ).length,
        undoDisabled: diagram.shadowRoot
          .querySelector('[aria-label="Undo"]')
          .getAttribute("aria-disabled"),
      };
    });
    assert.deepEqual(replaced.duringAssignment, []);
    assert.deepEqual(replaced.afterAssignment, []);
    assert.equal(replaced.source, replaced.assigned);
    assert.deepEqual(replaced.labels, ["Replacement"]);
    assert.equal(replaced.inlineEditors, 0);
    assert.equal(replaced.undoDisabled, "true");

    await openInlineLabel("A -> B: Start\n");
    const switched = await page.evaluate(async () => {
      const diagram = document.querySelector("#pending");
      diagram.mode = "view";
      await new Promise((resolve) => setTimeout(resolve, 20));
      return {
        changes: window.pendingChanges,
        source: diagram.source,
        labels: [
          ...diagram.shadowRoot.querySelectorAll(".la-message-label"),
        ].map((label) => label.textContent),
      };
    });
    assert.deepEqual(switched, {
      changes: ["A -> B: Uncommitted\n"],
      source: "A -> B: Uncommitted\n",
      labels: ["Uncommitted"],
    });
  },
);

async function openFixture(testContext, body) {
  const context = await browser.newContext();
  testContext.after(() => context.close());
  const page = await context.newPage();
  await stubCdn(page);
  const url = `${origin}/test/fixture.html`;
  await page.route(url, (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/html; charset=utf-8",
      body: `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><title>Fixture</title></head>
  <body>
${body}
    <script type="module">
      await import("../dist/lines-and-arrows.auto.min.js");
      window.afterDefinition?.();
      window.fixtureReady = true;
    </script>
  </body>
</html>`,
    }),
  );
  await page.goto(url);
  await page.waitForFunction(() => window.fixtureReady);
  return page;
}

test(
  "properties assigned before definition apply on upgrade",
  async (testContext) => {
    const page = await openFixture(
      testContext,
      `
    <lines-and-arrows id="upgraded">
      Inline -> Text: Stale
    </lines-and-arrows>
    <lines-and-arrows id="invalid">
      Inline -> Text: Kept
    </lines-and-arrows>
    <script type="module">
      const upgraded = document.querySelector("#upgraded");
      upgraded.mode = "edit";
      upgraded.theme = "dark";
      upgraded.label = "Upgraded diagram";
      upgraded.branding = false;
      upgraded.copySource = false;
      upgraded.canvasBackground = "solid";
      upgraded.palette = { accent: "rgb(1 2 3)" };
      upgraded.source = "A -> B: From property";
      const invalid = document.querySelector("#invalid");
      window.upgradeErrors = [];
      invalid.addEventListener("la-error", (event) =>
        window.upgradeErrors.push(event.detail.error.message),
      );
      invalid.theme = "sepia";
      invalid.source = "A -> B:";
      const detached = document.createElement("lines-and-arrows");
      detached.id = "detached";
      detached.selectableActors = true;
      detached.source = "C -> D: Detached";
      window.afterDefinition = () => document.body.append(detached);
    </script>`,
    );
    const result = await page.evaluate(() => {
      const labels = (element) =>
        [...element.shadowRoot.querySelectorAll(".la-message-label")].map(
          (label) => label.textContent,
        );
      const upgraded = document.querySelector("#upgraded");
      const invalid = document.querySelector("#invalid");
      const detached = document.querySelector("#detached");
      const names = [
        "source",
        "mode",
        "theme",
        "label",
        "branding",
        "copySource",
        "canvasBackground",
        "palette",
        "selectableActors",
      ];
      const snapshot = {
        ownProperties: [upgraded, invalid, detached].flatMap((element) =>
          names.filter((name) => Object.hasOwn(element, name)),
        ),
        upgraded: {
          source: upgraded.source,
          labels: labels(upgraded),
          inlineText: upgraded.textContent,
          mode: upgraded.mode,
          theme: upgraded.shadowRoot.querySelector(".la-frame").dataset
            .theme,
          label: upgraded.getAttribute("label"),
          branding: upgraded.getAttribute("branding"),
          copySource: upgraded.getAttribute("copy-source"),
          canvasBackground: upgraded.getAttribute("canvas-background"),
          palette: upgraded.palette,
          undo: Boolean(
            upgraded.shadowRoot.querySelector('[aria-label="Undo"]'),
          ),
        },
        invalid: {
          errors: [...window.upgradeErrors],
          alert: invalid.shadowRoot.querySelector('[role="alert"]')
            ?.textContent,
          source: invalid.source,
        },
        detached: {
          source: detached.source,
          labels: labels(detached),
          selectableActors: detached.hasAttribute("selectable-actors"),
        },
      };
      const errorAlert = () =>
        invalid.shadowRoot.querySelector('[role="alert"]')?.textContent ??
        null;
      invalid.theme = "dark";
      const afterTheme = errorAlert();
      invalid.remove();
      document.body.append(invalid);
      const persisted = {
        afterTheme,
        afterReconnect: errorAlert(),
        errors: window.upgradeErrors.length,
      };
      upgraded.source = "E -> F: Reassigned";
      invalid.source = "G -> H: Recovered";
      return {
        ...snapshot,
        persisted,
        reassigned: labels(upgraded),
        recovered: {
          labels: labels(invalid),
          alert: Boolean(invalid.shadowRoot.querySelector('[role="alert"]')),
        },
      };
    });

    assert.deepEqual(result.ownProperties, []);
    assert.deepEqual(result.upgraded, {
      source: "A -> B: From property\n",
      labels: ["From property"],
      inlineText: "",
      mode: "edit",
      theme: "dark",
      label: "Upgraded diagram",
      branding: "false",
      copySource: "false",
      canvasBackground: "solid",
      palette: { accent: "rgb(1 2 3)" },
      undo: true,
    });
    assert.equal(result.invalid.errors.length, 2);
    assert.match(result.invalid.errors[0], /theme must be/);
    assert.match(result.invalid.errors[1], /label cannot be empty/i);
    assert.equal(result.invalid.alert, result.invalid.errors[1]);
    assert.equal(result.invalid.source, "Inline -> Text: Kept");
    assert.deepEqual(result.persisted, {
      afterTheme: result.invalid.errors[1],
      afterReconnect: result.invalid.errors[1],
      errors: 4,
    });
    assert.deepEqual(result.detached, {
      source: "C -> D: Detached",
      labels: ["Detached"],
      selectableActors: true,
    });
    assert.deepEqual(result.reassigned, ["Reassigned"]);
    assert.deepEqual(result.recovered, {
      labels: ["Recovered"],
      alert: false,
    });
  },
);

test("source attribute supplies, replaces, and reports diagram text", async (
  testContext,
) => {
  const page = await openFixture(
    testContext,
    `
    <lines-and-arrows
      id="markup"
      source="
        @Client
        Client -> API: Say &quot;hello&quot;
        API --> Client: First\\nSecond
      "
    >
      Inline -> Text: Ignored
    </lines-and-arrows>
    <lines-and-arrows id="broken" source="A -> B:"></lines-and-arrows>
    <lines-and-arrows id="owned" source="A -> B: Attribute">
    </lines-and-arrows>
    <lines-and-arrows id="editing" mode="edit" source="A -> B: Before">
    </lines-and-arrows>
    <script type="module">
      window.attributeErrors = { markup: [], broken: [] };
      for (const id of ["markup", "broken"]) {
        document.querySelector("#" + id).addEventListener(
          "la-error",
          (event) =>
            window.attributeErrors[id].push(event.detail.error.message),
        );
      }
      document.querySelector("#owned").source = "A -> B: Property";
    </script>`,
  );
  const result = await page.evaluate(() => {
    const labels = (element) =>
      [...element.shadowRoot.querySelectorAll(".la-message-label")].map(
        (label) => label.textContent,
      );
    const alert = (element) =>
      element.shadowRoot.querySelector('[role="alert"]')?.textContent ?? null;
    const markup = document.querySelector("#markup");
    const broken = document.querySelector("#broken");
    const owned = document.querySelector("#owned");
    const editing = document.querySelector("#editing");

    const initial = {
      source: markup.source,
      labels: labels(markup),
      lines: [
        ...markup.shadowRoot.querySelectorAll(".la-message-label"),
      ].map((label) => label.querySelectorAll("tspan").length),
      inlineText: markup.textContent,
    };
    const brokenInitial = {
      errors: [...window.attributeErrors.broken],
      alert: alert(broken),
      source: broken.source,
    };
    broken.theme = "dark";
    const brokenAfterTheme = alert(broken);
    broken.remove();
    document.body.append(broken);
    const brokenPersisted = {
      afterTheme: brokenAfterTheme,
      afterReconnect: alert(broken),
      errors: window.attributeErrors.broken.length,
    };

    markup.setAttribute("source", "X -> Y: Changed");
    const changed = { source: markup.source, labels: labels(markup) };
    markup.setAttribute("source", "X -> Y:");
    const invalidChange = {
      errors: [...window.attributeErrors.markup],
      alert: alert(markup),
      source: markup.source,
    };
    markup.setAttribute("source", "X -> Y: Changed");
    const recovered = { alert: alert(markup), labels: labels(markup) };
    markup.removeAttribute("source");
    const removed = {
      source: markup.source,
      canvas: Boolean(markup.shadowRoot.querySelector("svg")),
    };

    const ownedInitial = { source: owned.source, labels: labels(owned) };
    owned.setAttribute("source", "A -> B: Later attribute");
    const laterAttribute = { source: owned.source, labels: labels(owned) };
    owned.source = "A -> B: Later property";
    const laterProperty = {
      source: owned.source,
      labels: labels(owned),
      attribute: owned.getAttribute("source"),
    };

    const changes = [];
    editing.addEventListener("la-change", (event) =>
      changes.push(event.detail.source),
    );
    editing.shadowRoot
      .querySelector('.la-message[aria-label="A to B: Before"]')
      .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    const field = editing.shadowRoot.querySelector(
      ".la-inline-message-label",
    );
    field.focus();
    field.value = "Uncommitted";
    field.dispatchEvent(new Event("input", { bubbles: true }));
    editing.setAttribute("source", "C -> D: After");
    const edited = {
      changes,
      source: editing.source,
      labels: labels(editing),
      undoDisabled: editing.shadowRoot
        .querySelector('[aria-label="Undo"]')
        .getAttribute("aria-disabled"),
    };

    return {
      initial,
      brokenInitial,
      brokenPersisted,
      changed,
      invalidChange,
      recovered,
      removed,
      ownedInitial,
      laterAttribute,
      laterProperty,
      edited,
    };
  });

  assert.deepEqual(result.initial, {
    source:
      '@Client\nClient -> API: Say "hello"\nAPI --> Client: First\\nSecond',
    labels: ['Say "hello"', "FirstSecond"],
    lines: [1, 2],
    inlineText: "",
  });
  assert.equal(result.brokenInitial.errors.length, 1);
  assert.match(result.brokenInitial.errors[0], /label cannot be empty/i);
  assert.equal(result.brokenInitial.alert, result.brokenInitial.errors[0]);
  assert.equal(result.brokenInitial.source, "");
  assert.deepEqual(result.brokenPersisted, {
    afterTheme: result.brokenInitial.errors[0],
    afterReconnect: result.brokenInitial.errors[0],
    errors: 3,
  });
  assert.deepEqual(result.changed, {
    source: "X -> Y: Changed",
    labels: ["Changed"],
  });
  assert.equal(result.invalidChange.errors.length, 1);
  assert.match(result.invalidChange.errors[0], /label cannot be empty/i);
  assert.equal(result.invalidChange.alert, result.invalidChange.errors[0]);
  assert.equal(result.invalidChange.source, "X -> Y: Changed");
  assert.deepEqual(result.recovered, { alert: null, labels: ["Changed"] });
  assert.deepEqual(result.removed, { source: "", canvas: false });
  assert.deepEqual(result.ownedInitial, {
    source: "A -> B: Property",
    labels: ["Property"],
  });
  assert.deepEqual(result.laterAttribute, {
    source: "A -> B: Later attribute",
    labels: ["Later attribute"],
  });
  assert.deepEqual(result.laterProperty, {
    source: "A -> B: Later property",
    labels: ["Later property"],
    attribute: "A -> B: Later attribute",
  });
  assert.deepEqual(result.edited, {
    changes: [],
    source: "C -> D: After\n",
    labels: ["After"],
    undoDisabled: "true",
  });
});

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
      ["[data-option-download-svg]", false],
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
        downloadSvg: diagram?.getAttribute("download-svg"),
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
      downloadSvg: "false",
      canvasBackground: "solid",
    },
  });
});

test("partial actor declarations set the visible actor prefix", async (
  testContext,
) => {
  const page = await openPage(testContext);
  const result = await page.evaluate(() => {
    const source = `@Database

@Audit

Client -> API: Start
choice Processing
  | store
    API -> Database: Save
  | inspect
    Worker -> Worker: Check
API --> Client: Done`;
    const namesAndPositions = (root) =>
      [...root.querySelectorAll(".la-actor")].map((actor) => ({
        name: actor.querySelector(".la-actor-label").textContent,
        left: actor.getBoundingClientRect().left,
      }));

    const viewTarget = document.createElement("div");
    document.body.append(viewTarget);
    const view = window.linesAndArrows.renderDiagram(viewTarget, source, {
      branding: false,
      copySource: false,
    });

    const editor = document.createElement("lines-and-arrows");
    editor.mode = "edit";
    editor.branding = false;
    editor.source = source;
    document.body.append(editor);

    const snapshot = {
      view: namesAndPositions(view.svg),
      edit: namesAndPositions(editor.shadowRoot),
      canonicalSource: editor.source,
    };
    view.destroy();
    viewTarget.remove();
    editor.remove();
    return snapshot;
  });

  const expectedNames = ["Database", "Audit", "Client", "API", "Worker"];
  for (const mode of ["view", "edit"]) {
    assert.deepEqual(
      result[mode].map(({ name }) => name),
      expectedNames,
    );
    assert.ok(
      result[mode].every(
        ({ left }, index, actors) =>
          index === 0 || left > actors[index - 1].left,
      ),
      JSON.stringify(result[mode]),
    );
  }
  assert.equal(
    result.canonicalSource,
    "@Database\n\n@Audit\n\nClient -> API: Start\n" +
      "choice Processing\n  | store\n    API -> Database: Save\n" +
      "  | inspect\n    Worker -> Worker: Check\nAPI --> Client: Done\n",
  );
});

async function openEditor(testContext, source) {
  const page = await openPage(testContext);
  await page.evaluate((diagramSource) => {
    const diagram = document.createElement("lines-and-arrows");
    diagram.id = "focus-editor";
    diagram.mode = "edit";
    diagram.branding = false;
    diagram.source = diagramSource;
    document.body.append(diagram);
  }, source);
  return { page, element: page.locator("#focus-editor") };
}

test("group type field uses a pattern valid under the v flag", async (
  testContext,
) => {
  const { page, element } = await openEditor(
    testContext,
    "A -> B: Start\nchoice Result\n  A -> B: Done",
  );
  const messages = [];
  page.on("console", (message) => messages.push(message.text()));
  await element.getByRole("button", { name: "Edit group label" }).click();
  const typeControl = element.getByRole("textbox", { name: "Group type" });
  assert.equal(await typeControl.inputValue(), "choice");
  const validity = await typeControl.evaluate((node) =>
    Object.fromEntries(
      ["choice", "my-type", "a1", "Gap", "-x", "a b"].map((value) => {
        node.value = value;
        return [value, node.validity.patternMismatch];
      }),
    ),
  );
  assert.deepEqual(validity, {
    choice: false,
    "my-type": false,
    a1: false,
    Gap: true,
    "-x": true,
    "a b": true,
  });
  assert.deepEqual(
    messages.filter((text) => /regular expression/i.test(text)),
    [],
  );
});

test("undo shortcuts inside text fields stay with the field", async (
  testContext,
) => {
  const { page, element } = await openEditor(
    testContext,
    "@Client\n  icon user\n\nClient -> API: Start",
  );
  const source = () => element.evaluate((node) => node.source);
  await element.getByRole("button", { name: /Actor Client/ }).click();
  const name = element.getByLabel("Actor name");
  await name.fill("Customer");
  await name.press("Enter");
  const renamed = await source();
  assert.match(renamed, /@Customer/);

  await element.getByRole("button", { name: /Actor Customer/ }).click();
  await element.getByRole("button", { name: "Choose actor icon" }).click();
  const search = element.getByRole("searchbox", { name: "Search icons" });
  await search.pressSequentially("data");
  await search.press("ControlOrMeta+z");
  assert.equal(await source(), renamed);
  assert.notEqual(await search.inputValue(), "data");
  // Close the picker so its panel no longer covers the tooltip control.
  await search.press("Escape");

  const tooltipText = element.getByLabel("actor tooltip text");
  await element
    .getByRole("button", { name: "Edit actor tooltip" })
    .click();
  await tooltipText.pressSequentially("Hi");
  await tooltipText.press("ControlOrMeta+z");
  assert.equal(await source(), renamed);

  await element.evaluate((node) =>
    node.shadowRoot.querySelector(".la-frame").focus(),
  );
  await page.keyboard.press("ControlOrMeta+z");
  assert.match(await source(), /@Client/);
});

test("deletion keys apply only to the frame or the selected element", async (
  testContext,
) => {
  const { page, element } = await openEditor(
    testContext,
    "A -> B: Start\nA -> B: Next\nA -> B: Done",
  );
  const source = () => element.evaluate((node) => node.source);
  const dashed = "A --> B: Start\nA -> B: Next\nA -> B: Done\n";
  const focusInFrame = (selector) =>
    element.evaluate(
      (node, target) => node.shadowRoot.querySelector(target).focus(),
      selector,
    );

  await element.getByRole("button", { name: "A to B: Start" }).click();
  await element.getByRole("button", { name: "Dashed arrow" }).click();
  assert.equal(await source(), dashed);
  assert.equal(
    await element.evaluate((node) =>
      node.shadowRoot.activeElement?.getAttribute("aria-label"),
    ),
    "Dashed arrow",
  );
  await page.keyboard.press("Backspace");
  await page.keyboard.press("Delete");
  assert.equal(await source(), dashed);
  await focusInFrame(".la-inline-actor-tooltip-trigger");
  assert.equal(
    await element.evaluate((node) =>
      node.shadowRoot.activeElement?.getAttribute("aria-label"),
    ),
    "Edit arrow tooltip",
  );
  await page.keyboard.press("Backspace");
  await page.keyboard.press("Delete");
  await page.keyboard.press("Alt+ArrowDown");
  assert.equal(await source(), dashed);

  await focusInFrame('.la-message[data-selected="true"]');
  await page.keyboard.press("Alt+ArrowDown");
  assert.equal(
    await source(),
    "A -> B: Next\nA --> B: Start\nA -> B: Done\n",
  );
  await focusInFrame('.la-message[data-selected="true"]');
  await page.keyboard.press("Delete");
  assert.equal(await source(), "A -> B: Next\nA -> B: Done\n");

  await element.getByRole("button", { name: "A to B: Next" }).click();
  await focusInFrame(".la-frame");
  await page.keyboard.press("Delete");
  assert.equal(await source(), "A -> B: Done\n");
});

test("editor redraws keep keyboard focus inside the frame", async (
  testContext,
) => {
  const { page, element } = await openEditor(
    testContext,
    "A -> B: Start\nA -> B: Next",
  );
  await page.evaluate(() => {
    const outside = document.createElement("button");
    outside.id = "outside";
    outside.textContent = "Outside";
    document.body.prepend(outside);
  });
  const source = () => element.evaluate((node) => node.source);
  const focused = () =>
    element.evaluate((node) => {
      const active = node.shadowRoot.activeElement;
      const frame = node.shadowRoot.querySelector(".la-frame");
      return {
        inFrame: Boolean(active && frame.contains(active)),
        label:
          active === frame
            ? "frame"
            : active?.getAttribute("aria-label") ?? null,
      };
    });
  const selected = () =>
    element.evaluate((node) =>
      [...node.shadowRoot.querySelectorAll('[data-selected="true"]')].map(
        (item) => item.getAttribute("aria-label"),
      ),
    );

  const label = element.getByLabel("Arrow label");
  await element.getByRole("button", { name: "A to B: Start" }).click();
  await label.fill("Begin");
  await label.press("Enter");
  assert.equal(await source(), "A -> B: Begin\nA -> B: Next\n");
  assert.deepEqual(await focused(), { inFrame: true, label: "Arrow label" });
  await page.keyboard.press("Escape");
  assert.deepEqual(await selected(), []);
  assert.deepEqual(await focused(), { inFrame: true, label: "frame" });

  await element.getByRole("button", { name: "A to B: Next" }).click();
  await element.evaluate((node) =>
    node.shadowRoot.querySelector(".la-frame").focus(),
  );
  await page.keyboard.press("Delete");
  assert.equal(await source(), "A -> B: Begin\n");
  assert.deepEqual(await focused(), { inFrame: true, label: "frame" });
  await page.keyboard.press("ControlOrMeta+z");
  assert.equal(await source(), "A -> B: Begin\nA -> B: Next\n");
  assert.equal((await focused()).inFrame, true);
  await page.keyboard.press("ControlOrMeta+z");
  assert.equal(await source(), "A -> B: Start\nA -> B: Next\n");
  assert.equal((await focused()).inFrame, true);
  await page.keyboard.press("ControlOrMeta+Shift+z");
  assert.equal(await source(), "A -> B: Begin\nA -> B: Next\n");

  await element.getByRole("button", { name: "A to B: Next" }).click();
  await element.evaluate((node) =>
    node.shadowRoot.querySelector('.la-message[data-selected="true"]').focus(),
  );
  await page.keyboard.press("Alt+ArrowUp");
  assert.equal(await source(), "A -> B: Next\nA -> B: Begin\n");
  assert.deepEqual(await focused(), { inFrame: true, label: "A to B: Next" });
  await page.keyboard.press("Escape");
  assert.deepEqual(await selected(), []);

  await element.getByRole("button", { name: "Undo" }).click();
  assert.equal(await source(), "A -> B: Begin\nA -> B: Next\n");
  assert.deepEqual(await focused(), { inFrame: true, label: "Undo" });
  await page.keyboard.press("Enter");
  assert.equal(await source(), "A -> B: Start\nA -> B: Next\n");
  assert.deepEqual(await focused(), { inFrame: true, label: "Redo" });
  await page.keyboard.press("Enter");
  assert.equal(await source(), "A -> B: Begin\nA -> B: Next\n");
  await page.keyboard.press("Enter");
  assert.equal(await source(), "A -> B: Next\nA -> B: Begin\n");
  assert.deepEqual(await focused(), { inFrame: true, label: "Undo" });

  await element.getByRole("button", { name: "A to B: Begin" }).click();
  await label.fill("Later");
  await page.locator("#outside").focus();
  await page.waitForFunction(() =>
    document.querySelector("#focus-editor").source.includes("Later"),
  );
  // The focusout commit redraws on a timer; let that redraw run.
  await page.evaluate(
    () => new Promise((resolve) => setTimeout(resolve, 20)),
  );
  assert.equal(
    await page.evaluate(() => document.activeElement?.id),
    "outside",
  );
  await element.evaluate((node) => {
    node.theme = "dark";
  });
  assert.equal(
    await page.evaluate(() => document.activeElement?.id),
    "outside",
  );
  assert.deepEqual(await focused(), { inFrame: false, label: null });
});

test("focus returns to the frame when Escape removes the focused control", async (
  testContext,
) => {
  const { page, element } = await openEditor(testContext, "A -> B: Start");
  const source = () => element.evaluate((node) => node.source);
  await element.getByRole("button", { name: "A to B: Start" }).click();
  await element.getByRole("button", { name: "Dashed arrow" }).click();
  assert.equal(await source(), "A --> B: Start\n");
  await page.keyboard.press("Escape");
  assert.equal(
    await element.evaluate(
      (node) =>
        node.shadowRoot.activeElement ===
        node.shadowRoot.querySelector(".la-frame"),
    ),
    true,
  );
  await page.keyboard.press("ControlOrMeta+z");
  assert.equal(await source(), "A -> B: Start\n");
});

test("picking an actor icon returns focus to the picker trigger", async (
  testContext,
) => {
  const { page, element } = await openEditor(
    testContext,
    "@Client\n@Lonely\n\nClient -> API: Start",
  );
  const source = () => element.evaluate((node) => node.source);
  await element.getByRole("button", { name: /Actor Lonely/ }).click();
  await element.getByRole("button", { name: "Choose actor icon" }).click();
  await element.locator(".la-icon-option").first().click();
  assert.match(await source(), /@Lonely\n  icon /);
  assert.match(
    await element.evaluate((node) =>
      node.shadowRoot.activeElement?.getAttribute("aria-label"),
    ),
    /^Choose actor icon/,
  );
  await page.keyboard.press("Backspace");
  await page.keyboard.press("Delete");
  assert.match(await source(), /@Lonely\n  icon /);
});

test("restored focus stays with the control's own diagram item", async (
  testContext,
) => {
  const { page, element } = await openEditor(
    testContext,
    "@X\n  tooltip x\n\n@A\n  tooltip a\n\n@B\n  tooltip b\n\nA -> B: Go",
  );
  const source = () => element.evaluate((node) => node.source);
  await element.getByRole("button", { name: /Actor X/ }).click();
  await element.evaluate((node) =>
    node.shadowRoot.querySelector(".la-frame").focus(),
  );
  await page.keyboard.press("Delete");
  assert.doesNotMatch(await source(), /@X/);
  await element.evaluate((node) =>
    node.shadowRoot
      .querySelector('.la-actor[aria-label^="Actor B"] .la-tooltip-trigger')
      .focus(),
  );
  await page.keyboard.press("ControlOrMeta+z");
  assert.match(await source(), /@X/);
  assert.equal(
    await element.evaluate((node) => {
      const active = node.shadowRoot.activeElement;
      return active?.classList.contains("la-tooltip-trigger")
        ? active.closest(".la-actor").getAttribute("aria-label")
        : null;
    }),
    await element.evaluate((node) =>
      node.shadowRoot
        .querySelector('.la-actor[aria-label^="Actor B"]')
        .getAttribute("aria-label"),
    ),
  );
});

test("label measurement follows the host font family", async (
  testContext,
) => {
  const page = await openPage(testContext);
  const label = "Reconcile every settlement batch with the downstream ledgers";
  const result = await page.evaluate((label) => {
    const target = document.createElement("div");
    target.style.setProperty("--la-font-family", '"Courier New", monospace');
    document.body.append(target);
    const rendered = window.linesAndArrows.renderDiagram(
      target,
      `A -> B: ${label}\ncritical ${label}\n  | ${label} ${label}\n    A -> B: Go\n` +
        `gap ${label} and then some more words to fill the row`,
      { branding: false, copySource: false, downloadSvg: false },
    );
    const inside = (text, frame) => {
      const box = text.getBBox();
      return (
        box.x >= frame.x - 0.5 &&
        box.x + box.width <= frame.x + frame.width + 0.5
      );
    };
    const svg = rendered.svg;
    const group = svg.querySelector(".la-group-shape").getBBox();
    const sectionFrame = { x: group.x + 14, width: group.width - 28 };
    const message = svg.querySelector(".la-message");
    const snapshot = {
      font: getComputedStyle(svg.querySelector(".la-message-label"))
        .fontFamily,
      message: inside(
        message.querySelector(".la-message-label"),
        message.querySelector(".la-message-line").getBBox(),
      ),
      group: inside(
        svg.querySelector(".la-group-header text:last-of-type"),
        group,
      ),
      section: inside(svg.querySelector(".la-section-label"), sectionFrame),
      gap: inside(
        svg.querySelector(".la-gap-label"),
        svg.querySelector(".la-gap rect").getBBox(),
      ),
      truncated: [
        ".la-message-label",
        ".la-group-header text:last-of-type",
        ".la-section-label",
        ".la-gap-label",
      ].map((selector) => svg.querySelector(selector).textContent.endsWith("…")),
    };
    rendered.destroy();
    target.remove();
    return snapshot;
  }, label);
  assert.match(result.font, /Courier New/);
  assert.deepEqual(
    { ...result, font: undefined },
    {
      font: undefined,
      message: true,
      group: true,
      section: true,
      gap: true,
      truncated: [true, true, true, true],
    },
  );
});

function selectedLabels(element) {
  return element.evaluate((node) =>
    [...node.shadowRoot.querySelectorAll('[data-selected="true"]')].map(
      (item) => item.getAttribute("aria-label"),
    ),
  );
}

test("one click moves the selection and history stays reachable", async (
  testContext,
) => {
  const { element } = await openEditor(
    testContext,
    "@A\n@B\n\nA -> B: Start\nA -> B: Next\nopt Batch\n  B -> A: Done",
  );
  const source = () => element.evaluate((node) => node.source);
  const label = element.getByLabel("Arrow label");
  const undo = element.getByRole("button", { name: "Undo" });

  await element.getByRole("button", { name: "A to B: Start" }).click();
  assert.equal(await undo.isVisible(), true);
  await element.getByRole("button", { name: "A to B: Next" }).click();
  assert.deepEqual(await selectedLabels(element), ["A to B: Next"]);
  assert.equal(await label.inputValue(), "Next");

  await element.getByRole("button", { name: /^Actor A/ }).click();
  await element.getByRole("button", { name: /^Actor B/ }).click();
  assert.deepEqual(await selectedLabels(element), [
    await element
      .getByRole("button", { name: /^Actor B/ })
      .getAttribute("aria-label"),
  ]);
  assert.equal(await element.getByLabel("Actor name").inputValue(), "B");

  await element.getByRole("button", { name: "Edit group label" }).click();
  assert.equal(
    await element.getByRole("textbox", { name: "Group label" }).inputValue(),
    "Batch",
  );

  // An uncommitted edit is committed by the same press that moves the
  // selection, even when the button is held while the commit redraws.
  await element.getByRole("button", { name: "A to B: Start" }).click();
  await label.fill("Begin");
  await element
    .getByRole("button", { name: "A to B: Next" })
    .click({ delay: 80 });
  assert.match(await source(), /A -> B: Begin\n/);
  assert.deepEqual(await selectedLabels(element), ["A to B: Next"]);
  assert.equal(await label.inputValue(), "Next");

  await label.fill("Later");
  await label.press("Enter");
  assert.match(await source(), /A -> B: Later\n/);
  assert.deepEqual(await selectedLabels(element), ["A to B: Later"]);
  assert.equal(await undo.isVisible(), true);
  await undo.click();
  assert.match(await source(), /A -> B: Next\n/);
  assert.deepEqual(await selectedLabels(element), []);
  assert.equal(
    await element.evaluate((node) =>
      node.shadowRoot.activeElement?.getAttribute("aria-label"),
    ),
    "Undo",
  );
});

async function openTouchEditor(testContext, source) {
  const context = await browser.newContext({
    hasTouch: true,
    isMobile: true,
    viewport: { width: 390, height: 844 },
  });
  testContext.after(() => context.close());
  const page = await context.newPage();
  await stubCdn(page);
  await page.goto(`${origin}/test/browser.html`);
  await page.waitForFunction(() => window.linesAndArrows);
  await page.evaluate((diagramSource) => {
    const viewport = document.createElement("meta");
    viewport.name = "viewport";
    viewport.content = "width=device-width, initial-scale=1";
    document.head.append(viewport);
    document.querySelector("main").remove();
    window.pointerCancels = 0;
    window.changes = [];
    globalThis.addEventListener(
      "pointercancel",
      () => {
        window.pointerCancels += 1;
      },
      true,
    );
    const diagram = document.createElement("lines-and-arrows");
    diagram.id = "touch-editor";
    diagram.mode = "edit";
    diagram.branding = false;
    diagram.source = diagramSource;
    diagram.addEventListener("la-change", (event) =>
      window.changes.push(event.detail.source),
    );
    const spacer = document.createElement("div");
    spacer.style.height = "2000px";
    document.body.append(diagram, spacer);
  }, source);
  await page.waitForFunction(() => innerWidth === 390);
  return { page, element: page.locator("#touch-editor") };
}

async function touchDrag(page, from, to, steps = 8) {
  const session = await page.context().newCDPSession(page);
  const point = (step) => ({
    x: from.x + ((to.x - from.x) * step) / steps,
    y: from.y + ((to.y - from.y) * step) / steps,
  });
  await session.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [point(0)],
  });
  for (let step = 1; step <= steps; step += 1) {
    await session.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [point(step)],
    });
  }
  await session.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await session.detach();
}

async function recordChanges(page, selector) {
  await page.evaluate((target) => {
    window.changes = [];
    document
      .querySelector(target)
      .addEventListener("la-change", (event) =>
        window.changes.push(event.detail.source),
      );
  }, selector);
  return () => page.evaluate(() => window.changes);
}

test("a press that ends without a click does not swallow the next click", async (
  testContext,
) => {
  const { page, element } = await openEditor(
    testContext,
    "A -> B: One\nA -> B: Two",
  );
  await element.getByRole("button", { name: "A to B: One" }).click();
  const frame = await element.evaluate((node) => {
    const rect = node.shadowRoot
      .querySelector(".la-frame")
      .getBoundingClientRect();
    return { x: rect.x, top: rect.top, bottom: rect.bottom };
  });
  const one = await partCenter(element, "A to B: One", ".la-message-line");
  await page.mouse.move(frame.x + 4, one.y - 8);
  await page.mouse.down();
  await page.mouse.move(frame.x + 4, frame.bottom + 40, { steps: 4 });
  await page.mouse.up();
  await element.getByRole("button", { name: "A to B: Two" }).click();
  assert.deepEqual(await selectedLabels(element), ["A to B: Two"]);

  const touch = await openTouchEditor(
    testContext,
    "A -> B: One\nA -> B: Two",
  );
  await touch.element.getByRole("button", { name: "A to B: One" }).tap();
  const empty = await touch.element.evaluate((node) => {
    const rect = node.shadowRoot
      .querySelector(".la-frame")
      .getBoundingClientRect();
    return { x: rect.x + 4, y: rect.bottom - 12 };
  });
  await touchDrag(touch.page, empty, { x: empty.x, y: empty.y - 150 });
  await touch.page.waitForFunction(() => scrollY > 0);
  await touch.element.getByRole("button", { name: "A to B: Two" }).tap();
  assert.deepEqual(await selectedLabels(touch.element), ["A to B: Two"]);
});

test("only a primary press holds back an inline commit redraw", async (
  testContext,
) => {
  const { page, element } = await openEditor(
    testContext,
    "A -> B: One\nA -> B: Two",
  );
  await element.getByRole("button", { name: "A to B: One" }).click();
  await element.getByLabel("Arrow label").fill("First");
  await element.evaluate((node) => {
    node.shadowRoot
      .querySelector(".la-canvas")
      .dispatchEvent(
        new PointerEvent("pointerdown", {
          button: 2,
          bubbles: true,
          composed: true,
        }),
      );
    node.shadowRoot.querySelector(".la-frame").focus();
  });
  await page.waitForFunction(
    () =>
      [
        ...document
          .querySelector("#focus-editor")
          .shadowRoot.querySelectorAll(".la-message-label"),
      ].some((label) => label.textContent === "First"),
    null,
    { timeout: 2000 },
  );
});

test("undo commits a pending field edit before reverting it", async (
  testContext,
) => {
  const { page, element } = await openEditor(
    testContext,
    "A -> B: Start\nA -> B: Next",
  );
  const changes = await recordChanges(page, "#focus-editor");
  const label = element.getByLabel("Arrow label");
  await element.getByRole("button", { name: "A to B: Start" }).click();
  await label.fill("First");
  await label.press("Enter");
  await element.getByRole("button", { name: "A to B: Next" }).click();
  await label.fill("Later");
  await element.getByRole("button", { name: "Undo" }).click();
  assert.deepEqual(await changes(), [
    "A -> B: First\nA -> B: Next\n",
    "A -> B: First\nA -> B: Later\n",
    "A -> B: First\nA -> B: Next\n",
  ]);
  await element.getByRole("button", { name: "Redo" }).click();
  assert.equal(
    (await changes()).at(-1),
    "A -> B: First\nA -> B: Later\n",
  );
});

// Client coordinates of the center of an editor part, located through the
// accessible label of the item that owns it. A selector containing `$id`
// matches anywhere in the editor with the owner's ID substituted; any other
// selector matches inside the owner.
function partCenter(element, ownerLabel, partSelector = null) {
  return element.evaluate(
    (node, [label, selector]) => {
      const owner = node.shadowRoot.querySelector(
        `[aria-label="${CSS.escape(label)}"]`,
      );
      let part = owner;
      if (selector?.includes("$id")) {
        part = node.shadowRoot.querySelector(
          selector.replaceAll("$id", CSS.escape(owner.dataset.laId)),
        );
      } else if (selector) {
        part = owner.querySelector(selector);
      }
      const rect = part.getBoundingClientRect();
      return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
    },
    [ownerLabel, partSelector],
  );
}

async function mouseDrag(page, from, to) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, (from.y + to.y) / 2, { steps: 4 });
  await page.mouse.move(to.x, to.y, { steps: 4 });
  await page.mouse.up();
}

test("mouse drags select a range, reconnect, and reorder", async (
  testContext,
) => {
  const { page, element } = await openEditor(
    testContext,
    "@A\n@B\n@C\n\nA -> B: One\nA -> B: Two\nA -> B: Three",
  );
  const source = () => element.evaluate((node) => node.source);
  await element.scrollIntoViewIfNeeded();
  const one = await partCenter(element, "A to B: One", ".la-message-line");
  const two = await partCenter(element, "A to B: Two", ".la-message-line");
  const three = await partCenter(
    element,
    "A to B: Three",
    ".la-message-line",
  );
  const frameLeft = await element.evaluate(
    (node) =>
      node.shadowRoot.querySelector(".la-frame").getBoundingClientRect().x,
  );
  const empty = { x: frameLeft + 4, y: one.y - 8 };
  assert.equal(
    await element.evaluate(
      (node, point) =>
        node.shadowRoot
          .elementFromPoint(point.x, point.y)
          ?.closest("[data-la-id], .la-insertion, .la-header-control") ??
        null,
      empty,
    ),
    null,
  );

  await mouseDrag(page, empty, { x: frameLeft + 40, y: two.y + 8 });
  assert.deepEqual(await selectedLabels(element), [
    "A to B: One",
    "A to B: Two",
  ]);
  await page.keyboard.press("Escape");
  assert.deepEqual(await selectedLabels(element), []);

  await element.getByRole("button", { name: "A to B: One" }).click();
  const endpoint = await partCenter(
    element,
    "A to B: One",
    '.la-message-endpoint[data-owner-id="$id"][data-endpoint="target"] circle',
  );
  const actorC = await partCenter(
    element,
    await element
      .getByRole("button", { name: /^Actor C/ })
      .getAttribute("aria-label"),
    ".la-actor-shape",
  );
  await mouseDrag(page, endpoint, { x: actorC.x, y: endpoint.y });
  assert.equal(
    await source(),
    "@A\n\n@B\n\nA -> C: One\nA -> B: Two\nA -> B: Three\n",
  );
  assert.deepEqual(await selectedLabels(element), ["A to C: One"]);

  const handle = await partCenter(
    element,
    "A to C: One",
    '.la-reorder-handle[data-owner-id="$id"] circle',
  );
  await mouseDrag(page, handle, {
    x: handle.x,
    y: (two.y + three.y) / 2,
  });
  assert.equal(
    await source(),
    "A -> B: Two\nA -> C: One\nA -> B: Three\n",
  );
});
