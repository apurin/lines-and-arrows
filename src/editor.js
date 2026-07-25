import { parse } from "./parser.js";
import { serialize } from "./serialize.js";

export const ROOT_CONTAINER_ID = "root";

let generatedId = 0;

function nextId(kind) {
  generatedId += 1;
  return `${kind}:edit-${generatedId}`;
}

function clone(value) {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
}

function optionalText(value) {
  const text = String(value ?? "").trim();
  return text || null;
}

function requiredText(value, label) {
  const text = String(value ?? "").trim();
  if (!text) {
    throw new Error(`${label} cannot be empty.`);
  }
  return text;
}

function visitItems(items, visitor, parentId = ROOT_CONTAINER_ID) {
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    visitor(item, items, index, parentId);
    if (item.type !== "group") {
      continue;
    }
    if (item.sections.length > 0) {
      for (const section of item.sections) {
        visitor(section, item.sections, item.sections.indexOf(section), item.id);
        visitItems(section.items, visitor, section.id);
      }
    } else {
      visitItems(item.items, visitor, item.id);
    }
  }
}

export function ensureDocumentIds(document) {
  for (const actor of document.actors) {
    actor.id ||= `actor:${actor.name}`;
  }

  visitItems(document.items, (item) => {
    if (item.type === "section") {
      item.id ||= nextId("section");
    } else {
      item.id ||= nextId("item");
    }
  });
  return document;
}

export function findItemLocation(document, id) {
  let match = null;
  visitItems(document.items, (item, items, index, parentId) => {
    if (!match && item.type !== "section" && item.id === id) {
      match = { item, items, index, parentId };
    }
  });
  return match;
}

export function findSectionLocation(document, id) {
  let match = null;
  visitItems(document.items, (item, sections, index, groupId) => {
    if (!match && item.type === "section" && item.id === id) {
      match = { section: item, sections, index, groupId };
    }
  });
  return match;
}

export function findGroup(document, id) {
  return findItemLocation(document, id)?.item?.type === "group"
    ? findItemLocation(document, id).item
    : null;
}

export function getContainer(document, id) {
  if (id === ROOT_CONTAINER_ID) {
    return {
      id,
      items: document.items,
      type: "root",
      owner: document,
    };
  }

  let match = null;
  visitItems(document.items, (item) => {
    if (match) {
      return;
    }
    if (item.type === "section" && item.id === id) {
      match = {
        id,
        items: item.items,
        type: "section",
        owner: item,
      };
      return;
    }
    if (
      item.type === "group" &&
      item.id === id &&
      item.sections.length === 0
    ) {
      match = {
        id,
        items: item.items,
        type: "group",
        owner: item,
      };
    }
  });
  return match;
}

function visitMessages(items, visitor) {
  for (const item of items) {
    if (item.type === "message") {
      visitor(item);
      continue;
    }
    if (item.type !== "group") {
      continue;
    }
    if (item.sections.length > 0) {
      for (const section of item.sections) {
        visitMessages(section.items, visitor);
      }
    } else {
      visitMessages(item.items, visitor);
    }
  }
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

function createMessage(document, properties = {}) {
  if (document.actors.length === 0) {
    throw new Error("Add an actor before adding a message.");
  }
  const source = requiredText(
    properties.source ?? document.actors[0]?.name,
    "Message source",
  );
  const target = requiredText(
    properties.target ?? document.actors[1]?.name ?? source,
    "Message target",
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
    id: nextId("item"),
    source,
    target,
    arrow,
    label: optionalText(properties.label),
    tag: optionalText(properties.tag),
    tooltip: optionalText(properties.tooltip),
    line: 0,
  };
}

function createTimelineItem(document, type) {
  if (type === "message") {
    return createMessage(document);
  }
  if (type === "gap") {
    return {
      type: "gap",
      id: nextId("item"),
      label: "Time passes",
      line: 0,
    };
  }
  if (type === "group") {
    return {
      type: "group",
      id: nextId("item"),
      groupType: "group",
      label: "New group",
      items: [createMessage(document)],
      sections: [],
      line: 0,
    };
  }
  throw new Error(`Unsupported timeline item type "${type}".`);
}

function descendantContainerIds(item, ids = new Set()) {
  if (item.type !== "group") {
    return ids;
  }
  ids.add(item.id);
  if (item.sections.length > 0) {
    for (const section of item.sections) {
      ids.add(section.id);
      for (const child of section.items) {
        descendantContainerIds(child, ids);
      }
    }
  } else {
    for (const child of item.items) {
      descendantContainerIds(child, ids);
    }
  }
  return ids;
}

function cleanupEmptyGroups(items) {
  const kept = [];

  for (const item of items) {
    if (item.type !== "group") {
      kept.push(item);
      continue;
    }

    if (item.sections.length > 0) {
      for (const section of item.sections) {
        section.items = cleanupEmptyGroups(section.items);
      }
      item.sections = item.sections.filter(
        (section) => section.items.length > 0,
      );
      if (item.sections.length > 0) {
        kept.push(item);
      }
      continue;
    }

    item.items = cleanupEmptyGroups(item.items);
    if (item.items.length > 0) {
      kept.push(item);
    }
  }

  return kept;
}

function validateDocument(document) {
  const source = serialize(document);
  parse(source);
  return source;
}

export class DiagramEditor {
  #document;
  #undo = [];
  #redo = [];
  #lastCommand = null;

  constructor(input) {
    this.#document = ensureDocumentIds(
      typeof input === "string" ? parse(input) : clone(input),
    );
  }

  get document() {
    return this.#document;
  }

  get source() {
    return serialize(this.#document);
  }

  get canUndo() {
    return this.#undo.length > 0;
  }

  get canRedo() {
    return this.#redo.length > 0;
  }

  get lastCommand() {
    return this.#lastCommand;
  }

  #commit(command, mutate) {
    const before = clone(this.#document);
    const beforeSource = serialize(before);
    const draft = clone(this.#document);
    const result = mutate(draft);
    draft.explicitActors = true;
    ensureDocumentIds(draft);
    const afterSource = validateDocument(draft);

    if (afterSource === beforeSource) {
      return result;
    }

    this.#undo.push(before);
    this.#redo = [];
    this.#document = draft;
    this.#lastCommand = command;
    return result;
  }

  replaceSource(source) {
    const next = ensureDocumentIds(parse(source));
    const nextSource = serialize(next);
    if (nextSource === this.source) {
      return false;
    }
    this.#undo.push(clone(this.#document));
    this.#redo = [];
    this.#document = next;
    this.#lastCommand = "source";
    return true;
  }

  undo() {
    if (!this.canUndo) {
      return false;
    }
    this.#redo.push(clone(this.#document));
    this.#document = this.#undo.pop();
    this.#lastCommand = "undo";
    return true;
  }

  redo() {
    if (!this.canRedo) {
      return false;
    }
    this.#undo.push(clone(this.#document));
    this.#document = this.#redo.pop();
    this.#lastCommand = "redo";
    return true;
  }

  addActor(index = this.#document.actors.length) {
    return this.#commit("add-actor", (document) => {
      const actor = {
        type: "actor",
        id: nextId("actor"),
        name: uniqueActorName(document),
        icon: null,
        tag: null,
        tooltip: null,
        line: 0,
      };
      const target = Math.max(0, Math.min(index, document.actors.length));
      document.actors.splice(target, 0, actor);
      document.explicitActors = true;
      return actor.id;
    });
  }

  updateActor(id, patch) {
    return this.#commit("update-actor", (document) => {
      const actor = document.actors.find((candidate) => candidate.id === id);
      if (!actor) {
        throw new Error("Actor not found.");
      }

      const previousName = actor.name;
      if (Object.hasOwn(patch, "name")) {
        const name = requiredText(patch.name, "Actor name");
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

      for (const property of ["icon", "tag", "tooltip"]) {
        if (Object.hasOwn(patch, property)) {
          actor[property] = optionalText(patch[property]);
        }
      }
      document.explicitActors = true;
      return actor.id;
    });
  }

  moveActor(id, index) {
    return this.#commit("move-actor", (document) => {
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
      document.explicitActors = true;
      return actor.id;
    });
  }

  removeActor(id) {
    return this.#commit("remove-actor", (document) => {
      const index = document.actors.findIndex((actor) => actor.id === id);
      if (index === -1) {
        throw new Error("Actor not found.");
      }
      if (document.actors.length === 1) {
        throw new Error("A diagram must keep at least one actor.");
      }

      const [actor] = document.actors.splice(index, 1);
      const removeReferences = (items) =>
        cleanupEmptyGroups(
          items.filter((item) => {
            if (item.type === "message") {
              return (
                item.source !== actor.name && item.target !== actor.name
              );
            }
            if (item.type === "group") {
              if (item.sections.length > 0) {
                for (const section of item.sections) {
                  section.items = removeReferences(section.items);
                }
              } else {
                item.items = removeReferences(item.items);
              }
            }
            return true;
          }),
        );
      document.items = removeReferences(document.items);
      document.explicitActors = true;
      return null;
    });
  }

  addItem(parentId, index, type = "message") {
    return this.#commit(`add-${type}`, (document) => {
      const container = getContainer(document, parentId);
      if (!container) {
        throw new Error("Timeline insertion point no longer exists.");
      }
      const item = createTimelineItem(document, type);
      const target = Math.max(0, Math.min(index, container.items.length));
      container.items.splice(target, 0, item);
      return item.id;
    });
  }

  addMessage(parentId, index, properties = {}) {
    return this.#commit("add-message", (document) => {
      const container = getContainer(document, parentId);
      if (!container) {
        throw new Error("Timeline insertion point no longer exists.");
      }
      const item = createMessage(document, properties);
      const target = Math.max(0, Math.min(index, container.items.length));
      container.items.splice(target, 0, item);
      return item.id;
    });
  }

  updateItem(id, patch) {
    return this.#commit("update-item", (document) => {
      const location = findItemLocation(document, id);
      if (!location) {
        throw new Error("Timeline item not found.");
      }
      const { item } = location;

      if (item.type === "message") {
        for (const property of ["source", "target"]) {
          if (Object.hasOwn(patch, property)) {
            const name = requiredText(patch[property], property);
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
        for (const property of ["tag", "tooltip"]) {
          if (Object.hasOwn(patch, property)) {
            item[property] = optionalText(patch[property]);
          }
        }
      } else if (item.type === "gap") {
        if (Object.hasOwn(patch, "label")) {
          item.label = requiredText(patch.label, "Gap label");
        }
      } else {
        if (Object.hasOwn(patch, "groupType")) {
          item.groupType = requiredText(patch.groupType, "Group type");
        }
        if (Object.hasOwn(patch, "label")) {
          item.label = requiredText(patch.label, "Group label");
        }
      }
      return item.id;
    });
  }

  removeItem(id) {
    return this.#commit("remove-item", (document) => {
      const location = findItemLocation(document, id);
      if (!location) {
        throw new Error("Timeline item not found.");
      }
      location.items.splice(location.index, 1);
      document.items = cleanupEmptyGroups(document.items);
      return null;
    });
  }

  removeItems(ids) {
    return this.#commit("remove-items", (document) => {
      const selected = new Set(ids);
      if (selected.size === 0) {
        return null;
      }

      const removeSelected = (items) =>
        cleanupEmptyGroups(
          items
            .filter((item) => !selected.has(item.id))
            .map((item) => {
              if (item.type !== "group") {
                return item;
              }
              if (item.sections.length > 0) {
                for (const section of item.sections) {
                  section.items = removeSelected(section.items);
                }
              } else {
                item.items = removeSelected(item.items);
              }
              return item;
            }),
        );

      document.items = removeSelected(document.items);
      return null;
    });
  }

  moveItem(id, targetParentId, targetIndex) {
    return this.#commit("move-item", (document) => {
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

      document.items = cleanupEmptyGroups(document.items);
      const destination = getContainer(document, targetParentId);
      if (!destination) {
        throw new Error("Timeline destination no longer exists.");
      }
      target = Math.max(0, Math.min(target, destination.items.length));
      destination.items.splice(target, 0, item);
      return item.id;
    });
  }

  wrapItems(parentId, ids, groupType = "group", label = "New group") {
    return this.#commit("group-items", (document) => {
      const container = getContainer(document, parentId);
      if (!container) {
        throw new Error("Selected items do not share a parent.");
      }
      const indices = ids
        .map((id) => container.items.findIndex((item) => item.id === id))
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
      const grouped = container.items.splice(first, indices.length);
      const group = {
        type: "group",
        id: nextId("item"),
        groupType: requiredText(groupType, "Group type"),
        label: requiredText(label, "Group label"),
        items: grouped,
        sections: [],
        line: 0,
      };
      container.items.splice(first, 0, group);
      return group.id;
    });
  }

  ungroup(id) {
    return this.#commit("ungroup", (document) => {
      const location = findItemLocation(document, id);
      if (!location || location.item.type !== "group") {
        throw new Error("Group not found.");
      }
      const contents =
        location.item.sections.length > 0
          ? location.item.sections.flatMap((section) => section.items)
          : location.item.items;
      location.items.splice(location.index, 1, ...contents);
      return contents[0]?.id ?? null;
    });
  }

  convertGroupToSections(id) {
    return this.#commit("create-sections", (document) => {
      const group = findGroup(document, id);
      if (!group) {
        throw new Error("Group not found.");
      }
      if (group.sections.length > 0) {
        return group.sections[0].id;
      }
      group.sections = [
        {
          type: "section",
          id: nextId("section"),
          label: "first",
          items: group.items,
          line: 0,
        },
        {
          type: "section",
          id: nextId("section"),
          label: "second",
          items: [createMessage(document)],
          line: 0,
        },
      ];
      group.items = [];
      return group.sections[1].id;
    });
  }

  addSection(groupId, index) {
    return this.#commit("add-section", (document) => {
      const group = findGroup(document, groupId);
      if (!group) {
        throw new Error("Group not found.");
      }
      if (group.sections.length === 0) {
        throw new Error("Convert the group to sections first.");
      }
      const section = {
        type: "section",
        id: nextId("section"),
        label: `section ${group.sections.length + 1}`,
        items: [createMessage(document)],
        line: 0,
      };
      const target = Math.max(
        0,
        Math.min(index ?? group.sections.length, group.sections.length),
      );
      group.sections.splice(target, 0, section);
      return section.id;
    });
  }

  updateSection(id, patch) {
    return this.#commit("update-section", (document) => {
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
    return this.#commit("move-section", (document) => {
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
    return this.#commit("remove-section", (document) => {
      const location = findSectionLocation(document, id);
      if (!location) {
        throw new Error("Section not found.");
      }
      const group = findGroup(document, location.groupId);
      const [section] = location.sections.splice(location.index, 1);

      if (location.sections.length === 0) {
        group.items = section.items;
        group.sections = [];
        return group.id;
      }

      const destination =
        location.sections[
          Math.min(location.index, location.sections.length - 1)
        ];
      destination.items.push(...section.items);
      return destination.id;
    });
  }
}
