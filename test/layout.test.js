import test from "node:test";
import assert from "node:assert/strict";

import { layoutDiagram } from "../src/layout.js";
import { messageLabelMetrics } from "../src/metadata.js";
import { parse } from "../src/parser.js";

test("keeps compact first messages clear of actor metadata", () => {
  const layout = layoutDiagram(
    parse(`@Human
  tag tiny request
  tooltip A request whose size has not yet been verified

@Agent

Human -> Agent: Make one tiny change`),
    {
      actorHeight: 42,
      actorMetadataGap: 6,
      actorMetadataHeight: 20,
      timelineTopGap: 20,
      messageHeight: 36,
    },
  );
  const human = layout.actorByName.get("Human");
  const firstMessage = layout.rows[0];
  const metadataBottom =
    human.y +
    human.height +
    layout.options.actorMetadataGap +
    layout.options.actorMetadataHeight;
  const messageLabelTop = firstMessage.y - 21;

  assert.equal(layout.options.timelineTopGap, 33);
  assert.ok(messageLabelTop >= metadataBottom + 4);

  const selfLayout = layoutDiagram(
    parse(`@Agent
  tag working

Agent -> Agent: Check the plan`),
    {
      actorHeight: 42,
      actorMetadataGap: 6,
      actorMetadataHeight: 20,
      timelineTopGap: 20,
      messageHeight: 36,
    },
  );
  const agent = selfLayout.actorByName.get("Agent");
  const selfMessage = selfLayout.rows[0];
  const selfMetadataBottom =
    agent.y +
    agent.height +
    selfLayout.options.actorMetadataGap +
    selfLayout.options.actorMetadataHeight;
  const selfLabelTop = selfMessage.y - 34;

  assert.equal(selfLayout.options.timelineTopGap, 33);
  assert.ok(selfLabelTop >= selfMetadataBottom + 4);
});

test("keeps compact group and section spacing visually safe", () => {
  const layout = layoutDiagram(
    parse(`@Agent
@Worker

parallel First pass
  | code
    Agent -> Worker: Update
  | verification
    Agent -> Worker: Test
choice Test result
  | passed
    Worker --> Agent: Continue
  | failed
    Worker --> Agent: Fix`),
    {
      groupHeaderHeight: 16,
      sectionHeaderHeight: 12,
      groupPaddingBottom: 2,
      groupGap: 2,
    },
  );

  assert.equal(layout.options.groupHeaderHeight, 24);
  assert.equal(layout.options.sectionHeaderHeight, 24);
  assert.equal(layout.options.groupPaddingBottom, 6);
  assert.equal(layout.options.groupGap, 8);

  for (const section of layout.sections) {
    assert.equal(section.y - section.top, 12);
  }

  for (let index = 1; index < layout.groups.length; index += 1) {
    assert.ok(
      layout.groups[index].top - layout.groups[index - 1].bottom >= 8,
    );
  }
});

test("reserves visible rows for intentional line breaks", () => {
  const single = layoutDiagram(
    parse(`A -> B: One line
choice One line
  | one line
    gap One line
    A --> B: Done`),
  );
  const multiline = layoutDiagram(
    parse(String.raw`A -> B: First\nsecond
choice First\nsecond
  | first\nsecond
    gap First\nsecond
    A --> B: Done`),
  );

  assert.deepEqual(
    messageLabelMetrics("First\nsecond").visibleLines,
    ["First", "second"],
  );
  assert.equal(
    multiline.rows[0].height - single.rows[0].height,
    13,
  );
  assert.equal(
    multiline.groups[0].headerHeight -
      single.groups[0].headerHeight,
    13,
  );
  assert.equal(
    multiline.sections[0].headerHeight -
      single.sections[0].headerHeight,
    12,
  );
  assert.equal(
    multiline.rows[1].height - single.rows[1].height,
    12,
  );
});
