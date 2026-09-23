# Contributing

## Prerequisites

- Node.js 22 or newer.
- Google Chrome, installed where Playwright finds its stable channel. The
  browser suite drives it through `playwright-core`, which downloads no
  browser of its own.

## Set up and verify

```sh
npm ci
npm run check
```

`npm run check` builds the CDN bundle, verifies the package boundary, and runs
the Node suite, the browser suite, and the type checks.

Run one suite or one test while iterating:

```sh
npm run test:node
npm run build && npm run test:browser
node --test --test-name-pattern "<name>" test/syntax.test.js
```

The browser suite serves `dist/`, so build before running it on its own.

## Other browser engines

Chrome is the default and CI engine. `LA_TEST_BROWSER` runs the browser suite
in Playwright's Firefox or WebKit build instead:

```sh
npx playwright-core install firefox webkit
npm run build
LA_TEST_BROWSER=firefox npm run test:browser
LA_TEST_BROWSER=webkit npm run test:browser
```

Both engines pass the suite with these differences:

- Playwright grants clipboard permissions only in Chromium, so the suite
  reads back the text the page last wrote with `writeText` instead of the
  system clipboard.
- Tests that dispatch touch input through a CDP session are skipped, because
  only Chromium has CDP.
- Known renderer differences have engine-specific expectations, each with a
  comment in the test: in WebKit, actor names with more than about 20 emoji
  overflow their box, and a typed actor name is dropped after a refused delete
  from the inspector; in Firefox, the hover area of a shortened message label
  covers only its glyphs.

Validate a diagram file with the local CLI:

```sh
npm run validate -- FILE
```

## Visual work

Serve the repository and open the demo at `http://localhost:4173/demo/`:

```sh
python3 -m http.server 4173
```

## Conventions

[AGENTS.md](./AGENTS.md) describes where responsibilities live, the contracts
to keep, and the release procedure. The [agent guide](./website/agents.md)
describes how to author diagrams, and [syntax.md](./syntax.md) is the formal
language contract.
