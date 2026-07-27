import test from "node:test";
import assert from "node:assert/strict";

import { parse } from "../src/parser.js";
import { dedentInlineSource } from "../src/text.js";

test("dedents naturally formatted inline element source", () => {
  const inlineSource = `
    @Client
    @API

    Client -> API: Start
  `;

  assert.equal(
    dedentInlineSource(inlineSource),
    "@Client\n@API\n\nClient -> API: Start",
  );
});

test("preserves relative indentation, comments, blank lines, and Unicode", () => {
  const inlineSource =
    "\r\n\t\t@Client\r\n\t\t  tooltip Première ligne\\n次の行\r\n" +
    "\t\t\r\n\t\tchoice Résultat\r\n\t\t  // 保持する comment\r\n" +
    "\t\t  Client -> Client: Terminé\r\n\t\t\r\n\t\t\r\n";

  assert.equal(
    dedentInlineSource(inlineSource),
    "@Client\n  tooltip Première ligne\\n次の行\n\n" +
      "choice Résultat\n  // 保持する comment\n" +
      "  Client -> Client: Terminé",
  );
});

test("removes common tab indentation without hiding syntax tabs", () => {
  const validInlineSource = `
\t@Client
\t  icon user

\tClient -> Client
  `;
  const invalidInlineSource = `
\t@Client
\t\ticon user

\tClient -> Client
  `;

  const valid = dedentInlineSource(validInlineSource);
  const invalid = dedentInlineSource(invalidInlineSource);

  assert.equal(
    valid,
    "@Client\n  icon user\n\nClient -> Client",
  );
  assert.doesNotThrow(() => parse(valid));
  assert.equal(
    invalid,
    "@Client\n\ticon user\n\nClient -> Client",
  );
  assert.throws(() => parse(invalid), /Tabs are not allowed/);
});
