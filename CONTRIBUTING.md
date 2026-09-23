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
