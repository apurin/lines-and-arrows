export const ROOT_CONTAINER_ID = "root";

export function groupSections(group) {
  return group.body[0]?.type === "section" ? group.body : null;
}

export function cloneDocument(document) {
  return structuredClone(document);
}

export function assignStructuralIds(document) {
  document.actors.forEach((actor, index) => {
    actor.id = `actor:${index}`;
  });

  function assign(items, parentPath = "") {
    items.forEach((item, index) => {
      const path = parentPath ? `${parentPath}.${index}` : String(index);
      item.id = `item:${path}`;
      if (item.type !== "group") {
        return;
      }
      const sections = groupSections(item);
      if (sections) {
        sections.forEach((section, sectionIndex) => {
          const sectionPath = `${path}.${sectionIndex}`;
          section.id = `section:${sectionPath}`;
          assign(section.items, sectionPath);
        });
      } else {
        assign(item.body, path);
      }
    });
  }

  assign(document.items);
  return document;
}

export function freezeDocument(document) {
  function freeze(value) {
    if (value === null || typeof value !== "object") {
      return value;
    }

    for (const child of Object.values(value)) {
      freeze(child);
    }
    return Object.freeze(value);
  }

  return freeze(document);
}

export function visitItems(
  items,
  visitor,
  parentId = ROOT_CONTAINER_ID,
) {
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    visitor(item, items, index, parentId);
    if (item.type !== "group") {
      continue;
    }
    const sections = groupSections(item);
    if (sections) {
      for (const [sectionIndex, section] of sections.entries()) {
        visitor(section, sections, sectionIndex, item.id);
        visitItems(section.items, visitor, section.id);
      }
    } else {
      visitItems(item.body, visitor, item.id);
    }
  }
}

export function visitMessages(items, visitor) {
  visitItems(items, (item) => {
    if (item.type === "message") {
      visitor(item);
    }
  });
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
  const item = findItemLocation(document, id)?.item;
  return item?.type === "group" ? item : null;
}

export function findContainerItems(document, id) {
  if (id === ROOT_CONTAINER_ID) {
    return document.items;
  }

  let items = null;
  visitItems(document.items, (item) => {
    if (items || item.id !== id) {
      return;
    }
    if (item.type === "section") {
      items = item.items;
    } else if (
      item.type === "group" &&
      !groupSections(item)
    ) {
      items = item.body;
    }
  });
  return items;
}

export function descendantContainerIds(item, ids = new Set()) {
  if (item.type !== "group") {
    return ids;
  }
  ids.add(item.id);
  const sections = groupSections(item);
  if (sections) {
    for (const section of sections) {
      ids.add(section.id);
      for (const child of section.items) {
        descendantContainerIds(child, ids);
      }
    }
  } else {
    for (const child of item.body) {
      descendantContainerIds(child, ids);
    }
  }
  return ids;
}
