export function cloneDocument(document) {
  if (typeof structuredClone === "function") {
    return structuredClone(document);
  }
  return JSON.parse(JSON.stringify(document));
}

export function freezeDocument(document) {
  const visited = new Set();

  function freeze(value) {
    if (
      value === null ||
      typeof value !== "object" ||
      visited.has(value)
    ) {
      return value;
    }

    visited.add(value);
    for (const child of Object.values(value)) {
      freeze(child);
    }
    return Object.freeze(value);
  }

  return freeze(document);
}

export function documentSnapshot(document) {
  return freezeDocument(cloneDocument(document));
}
