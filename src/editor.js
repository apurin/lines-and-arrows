import {
  assignStructuralIds,
  cloneDocument,
  descendantContainerIds,
  findContainerItems,
  findGroup,
  findItemLocation,
  findSectionLocation,
  freezeDocument,
  groupSections,
  visitMessages,
} from "./document.js";
import { parse } from "./parser.js";
import { serialize } from "./serialize.js";
import { isGroupType } from "./grammar.js";

class EditorIdAllocator {
  #nextByKind = new Map();

  next(kind) {
    const next = this.#nextByKind.get(kind) ?? 1;
    this.#nextByKind.set(kind, next + 1);
    return `${kind}:edit-${next}`;
  }
}

function optionalText(value) {
  const text = String(value ?? "").replace(/\r\n?/g, "\n").trim();
  return text || null;
}

function optionalSingleLineText(value, label) {
  const text = optionalText(value);
  if (text?.includes("\n")) {
    throw new Error(`${label} must stay on one line.`);
  }
  return text;
}

function requiredText(value, label, options = {}) {
  const text = String(value ?? "").replace(/\r\n?/g, "\n").trim();
  if (!text) {
    throw new Error(`${label} cannot be empty.`);
  }
  if (options.multiline === false && text.includes("\n")) {
    throw new Error(`${label} must stay on one line.`);
  }
  return text;
}

function requiredGroupType(value) {
  const text = requiredText(value, "Group type", {
    multiline: false,
  });
  if (!isGroupType(text)) {
    throw new Error(
      'Group type must start with a lowercase letter and contain only lowercase letters, numbers, or hyphens; "gap" is reserved.',
    );
  }
  return text;
}

function uniqueActorName(document, preferred = "New actor") {
  const names = new Set(document.actors.map((actor) => actor.name));
  if (!names.has(preferred)) {
    return preferred;
  }

  let suffix = 2;
  while (names.has(`${preferred} ${suffix}`)) {
    suffix += 1;
  }
  return `${preferred} ${suffix}`;
}

function createMessage(document, allocator, properties = {}) {
  if (document.actors.length === 0) {
    throw new Error("Add an actor before adding a message.");
  }
  const source = requiredText(
    properties.source ?? document.actors[0]?.name,
    "Message source",
    { multiline: false },
  );
  const target = requiredText(
    properties.target ?? document.actors[1]?.name ?? source,
    "Message target",
    { multiline: false },
  );
  for (const name of [source, target]) {
    if (!document.actors.some((actor) => actor.name === name)) {
      throw new Error(`Unknown actor "${name}".`);
    }
  }
  const arrow = properties.arrow ?? "->";
  if (!["->", "-->", "->x"].includes(arrow)) {
    throw new Error(`Unsupported arrow "${arrow}".`);
  }

  return {
    type: "message",
    id: allocator.next("item"),
    source,
    target,
    arrow,
    label: optionalText(properties.label),
    tag: optionalSingleLineText(properties.tag, "tag"),
    tooltip: optionalText(properties.tooltip),
    tooltipIcon: optionalSingleLineText(
      properties.tooltipIcon,
      "tooltipIcon",
    ),
  };
}

function createTimelineItem(document, allocator, type) {
  if (type === "message") {
    return createMessage(document, allocator);
  }
  if (type === "gap") {
    return {
      type: "gap",
      id: allocator.next("item"),
      label: "Time passes",
    };
  }
  if (type === "group") {
    return {
      type: "group",
      id: allocator.next("item"),
      groupType: "group",
      label: "New group",
      body: [createMessage(document, allocator)],
    };
  }
  throw new Error(`Unsupported timeline item type "${type}".`);
}

function pruneTimeline(items, removal = {}) {
  const kept = [];

  for (const item of items) {
    if (item.type === "group") {
      const sections = groupSections(item);
      if (sections) {
        for (const section of sections) {
          section.items = pruneTimeline(section.items, removal);
        }
        item.body = sections.filter(
          (section) => section.items.length > 0,
        );
      } else {
        item.body = pruneTimeline(item.body, removal);
      }
    }

    const isRemoved =
      removal.itemIds?.has(item.id) ||
      (item.type === "message" &&
        (item.source === removal.actorName ||
          item.target === removal.actorName));
    const isEmptyGroup =
      item.type === "group" && item.body.length === 0;
    if (!isRemoved && !isEmptyGroup) {
      kept.push(item);
    }
  }

  return kept;
}

export class DiagramEditor {
  #snapshot;
  #ids = new EditorIdAllocator();
  #undo = [];
  #redo = [];

  constructor(source) {
    const document = freezeDocument(assignStructuralIds(parse(source)));
    this.#snapshot = Object.freeze({ document, source: serialize(document) });
  }

  get document() {
    return this.#snapshot.document;
  }

  get source() {
    return this.#snapshot.source;
  }

  get canUndo() {
    return this.#undo.length > 0;
  }

  get canRedo() {
    return this.#redo.length > 0;
  }

  #commit(mutate) {
    const before = this.#snapshot;
    const draft = cloneDocument(before.document);
    const result = mutate(draft);
    const afterSource = serialize(draft);

    if (afterSource === before.source) {
      return result;
    }

    this.#undo.push(before);
    this.#redo = [];
    this.#snapshot = Object.freeze({
      document: freezeDocument(draft),
      source: afterSource,
    });
    return result;
  }

  undo() {
    if (!this.canUndo) {
      return false;
    }
    this.#redo.push(this.#snapshot);
    this.#snapshot = this.#undo.pop();
    return true;
  }

  redo() {
    if (!this.canRedo) {
      return false;
    }
    this.#undo.push(this.#snapshot);
    this.#snapshot = this.#redo.pop();
    return true;
  }

  addActor(index = this.document.actors.length) {
    return this.#commit((document) => {
      const actor = {
        type: "actor",
        id: this.#ids.next("actor"),
        name: uniqueActorName(document),
        icon: null,
        tag: null,
        tooltip: null,
        tooltipIcon: null,
      };
      const target = Math.max(0, Math.min(index, document.actors.length));
      document.actors.splice(target, 0, actor);
      return actor.id;
    });
  }

  updateActor(id, patch) {
    return this.#commit((document) => {
      const actor = document.actors.find((candidate) => candidate.id === id);
      if (!actor) {
        throw new Error("Actor not found.");
      }

      const previousName = actor.name;
      if (Object.hasOwn(patch, "name")) {
        const name = requiredText(patch.name, "Actor name", {
          multiline: false,
        });
        if (
          document.actors.some(
            (candidate) => candidate !== actor && candidate.name === name,
          )
        ) {
          throw new Error(`Actor "${name}" already exists.`);
        }
        actor.name = name;
        visitMessages(document.items, (message) => {
          if (message.source === previousName) {
            message.source = name;
          }
          if (message.target === previousName) {
            message.target = name;
          }
        });
      }

      for (const property of ["icon", "tag", "tooltip", "tooltipIcon"]) {
        if (Object.hasOwn(patch, property)) {
          actor[property] =
            property === "tooltip"
              ? optionalText(patch[property])
              : optionalSingleLineText(patch[property], property);
        }
      }
      return actor.id;
    });
  }

  moveActor(id, index) {
    return this.#commit((document) => {
      const sourceIndex = document.actors.findIndex(
        (actor) => actor.id === id,
      );
      if (sourceIndex === -1) {
        throw new Error("Actor not found.");
      }
      const [actor] = document.actors.splice(sourceIndex, 1);
      let target = index;
      if (sourceIndex < index) {
        target -= 1;
      }
      target = Math.max(0, Math.min(target, document.actors.length));
      document.actors.splice(target, 0, actor);
      return actor.id;
    });
  }

  removeActor(id) {
    return this.#commit((document) => {
      const index = document.actors.findIndex((actor) => actor.id === id);
      if (index === -1) {
        throw new Error("Actor not found.");
      }
      if (document.actors.length === 1) {
        throw new Error("A diagram must keep at least one actor.");
      }

      const [actor] = document.actors.splice(index, 1);
      document.items = pruneTimeline(document.items, {
        actorName: actor.name,
      });
      return null;
    });
  }

  addItem(parentId, index, type = "message") {
    return this.#commit((document) => {
      const items = findContainerItems(document, parentId);
      if (!items) {
        throw new Error("Timeline insertion point no longer exists.");
      }
      const item = createTimelineItem(document, this.#ids, type);
      const target = Math.max(0, Math.min(index, items.length));
      items.splice(target, 0, item);
      return item.id;
    });
  }

  addMessage(parentId, index, properties = {}) {
    return this.#commit((document) => {
      const items = findContainerItems(document, parentId);
      if (!items) {
        throw new Error("Timeline insertion point no longer exists.");
      }
      const item = createMessage(document, this.#ids, properties);
      const target = Math.max(0, Math.min(index, items.length));
      items.splice(target, 0, item);
      return item.id;
    });
  }

  updateItem(id, patch) {
    return this.#commit((document) => {
      const location = findItemLocation(document, id);
      if (!location) {
        throw new Error("Timeline item not found.");
      }
      const { item } = location;

      if (item.type === "message") {
        for (const property of ["source", "target"]) {
          if (Object.hasOwn(patch, property)) {
            const name = requiredText(patch[property], property, {
              multiline: false,
            });
            if (!document.actors.some((actor) => actor.name === name)) {
              throw new Error(`Unknown actor "${name}".`);
            }
            item[property] = name;
          }
        }
        if (Object.hasOwn(patch, "arrow")) {
          if (!["->", "-->", "->x"].includes(patch.arrow)) {
            throw new Error(`Unsupported arrow "${patch.arrow}".`);
          }
          item.arrow = patch.arrow;
        }
        if (Object.hasOwn(patch, "label")) {
          item.label = optionalText(patch.label);
        }
        for (const property of ["tag", "tooltip", "tooltipIcon"]) {
          if (Object.hasOwn(patch, property)) {
            item[property] =
              property === "tooltip"
                ? optionalText(patch[property])
                : optionalSingleLineText(patch[property], property);
          }
        }
      } else if (item.type === "gap") {
        if (Object.hasOwn(patch, "label")) {
          item.label = requiredText(patch.label, "Gap label");
        }
      } else {
        if (Object.hasOwn(patch, "groupType")) {
          item.groupType = requiredGroupType(patch.groupType);
        }
        if (Object.hasOwn(patch, "label")) {
          item.label = optionalText(patch.label);
        }
      }
      return item.id;
    });
  }

  removeItem(id) {
    return this.#commit((document) => {
      if (!findItemLocation(document, id)) {
        throw new Error("Timeline item not found.");
      }
      document.items = pruneTimeline(document.items, {
        itemIds: new Set([id]),
      });
      return null;
    });
  }

  removeItems(ids) {
    return this.#commit((document) => {
      const selected = new Set(ids);
      if (selected.size === 0) {
        return null;
      }

      document.items = pruneTimeline(document.items, {
        itemIds: selected,
      });
      return null;
    });
  }

  moveItem(id, targetParentId, targetIndex) {
    return this.#commit((document) => {
      const source = findItemLocation(document, id);
      if (!source) {
        throw new Error("Timeline item not found.");
      }
      if (descendantContainerIds(source.item).has(targetParentId)) {
        throw new Error("A group cannot be moved into itself.");
      }

      const sameParent = source.parentId === targetParentId;
      const [item] = source.items.splice(source.index, 1);
      let target = targetIndex;
      if (sameParent && source.index < target) {
        target -= 1;
      }

      if (sameParent) {
        target = Math.max(0, Math.min(target, source.items.length));
        source.items.splice(target, 0, item);
        return item.id;
      }

      const destination = findContainerItems(document, targetParentId);
      if (!destination) {
        throw new Error("Timeline destination no longer exists.");
      }
      target = Math.max(0, Math.min(target, destination.length));
      destination.splice(target, 0, item);
      document.items = pruneTimeline(document.items);
      return item.id;
    });
  }

  wrapItems(parentId, ids, groupType = "group", label = "New group") {
    return this.#commit((document) => {
      const items = findContainerItems(document, parentId);
      if (!items) {
        throw new Error("Selected items do not share a parent.");
      }
      const indices = ids
        .map((id) => items.findIndex((item) => item.id === id))
        .sort((a, b) => a - b);
      if (
        indices.length === 0 ||
        indices.some((index) => index < 0) ||
        indices.some(
          (index, position) =>
            position > 0 && index !== indices[position - 1] + 1,
        )
      ) {
        throw new Error("Only a contiguous range of sibling items can group.");
      }

      const first = indices[0];
      const grouped = items.splice(first, indices.length);
      const group = {
        type: "group",
        id: this.#ids.next("item"),
        groupType: requiredGroupType(groupType),
        label: optionalText(label),
        body: grouped,
      };
      items.splice(first, 0, group);
      return group.id;
    });
  }

  ungroup(id) {
    return this.#commit((document) => {
      const location = findItemLocation(document, id);
      if (!location || location.item.type !== "group") {
        throw new Error("Group not found.");
      }
      const sections = groupSections(location.item);
      const contents = sections
        ? sections.flatMap((section) => section.items)
        : location.item.body;
      location.items.splice(location.index, 1, ...contents);
      return contents[0]?.id ?? null;
    });
  }

  convertGroupToSections(id) {
    return this.#commit((document) => {
      const group = findGroup(document, id);
      if (!group) {
        throw new Error("Group not found.");
      }
      const sections = groupSections(group);
      if (sections) {
        return sections[0].id;
      }
      group.body = [
        {
          type: "section",
          id: this.#ids.next("section"),
          label: "first",
          items: group.body,
        },
        {
          type: "section",
          id: this.#ids.next("section"),
          label: "second",
          items: [createMessage(document, this.#ids)],
        },
      ];
      return group.body[1].id;
    });
  }

  addSection(groupId, index) {
    return this.#commit((document) => {
      const group = findGroup(document, groupId);
      if (!group) {
        throw new Error("Group not found.");
      }
      const sections = groupSections(group);
      if (!sections) {
        throw new Error("Convert the group to sections first.");
      }
      const section = {
        type: "section",
        id: this.#ids.next("section"),
        label: `section ${sections.length + 1}`,
        items: [createMessage(document, this.#ids)],
      };
      const target = Math.max(
        0,
        Math.min(index ?? sections.length, sections.length),
      );
      sections.splice(target, 0, section);
      return section.id;
    });
  }

  updateSection(id, patch) {
    return this.#commit((document) => {
      const location = findSectionLocation(document, id);
      if (!location) {
        throw new Error("Section not found.");
      }
      if (Object.hasOwn(patch, "label")) {
        location.section.label = requiredText(
          patch.label,
          "Section label",
        );
      }
      return location.section.id;
    });
  }

  moveSection(id, index) {
    return this.#commit((document) => {
      const location = findSectionLocation(document, id);
      if (!location) {
        throw new Error("Section not found.");
      }
      const [section] = location.sections.splice(location.index, 1);
      let target = index;
      if (location.index < index) {
        target -= 1;
      }
      target = Math.max(0, Math.min(target, location.sections.length));
      location.sections.splice(target, 0, section);
      return section.id;
    });
  }

  removeSection(id) {
    return this.#commit((document) => {
      const location = findSectionLocation(document, id);
      if (!location) {
        throw new Error("Section not found.");
      }
      const group = findGroup(document, location.groupId);
      const [section] = location.sections.splice(location.index, 1);

      if (location.sections.length === 0) {
        group.body = section.items;
        return group.id;
      }

      const followingSection = location.sections[location.index];
      if (followingSection) {
        followingSection.items.unshift(...section.items);
        return followingSection.id;
      }

      const destination = location.sections[location.index - 1];
      destination.items.push(...section.items);
      return destination.id;
    });
  }
}
