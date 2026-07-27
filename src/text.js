export function decodeText(value) {
  const source = String(value ?? "");
  let result = "";

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (character !== "\\" || index + 1 >= source.length) {
      result += character;
      continue;
    }

    const next = source[index + 1];
    if (next === "n") {
      result += "\n";
      index += 1;
    } else if (next === "\\") {
      result += "\\";
      index += 1;
    } else {
      result += character;
    }
  }

  return result;
}

export function encodeText(value) {
  return String(value ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n");
}

export function textLines(value) {
  return String(value ?? "").replace(/\r\n?/g, "\n").split("\n");
}

export function dedentInlineSource(value) {
  const lines = textLines(value);

  while (lines.length > 0 && /^[ \t]*$/.test(lines[0])) {
    lines.shift();
  }
  while (
    lines.length > 0 &&
    /^[ \t]*$/.test(lines[lines.length - 1])
  ) {
    lines.pop();
  }

  if (lines.length === 0) {
    return "";
  }

  const contentIndents = lines
    .filter((line) => !/^[ \t]*$/.test(line))
    .map((line) => line.match(/^[ \t]*/)[0]);
  let commonIndent = contentIndents[0] ?? "";

  for (const indent of contentIndents.slice(1)) {
    let sharedLength = 0;
    while (
      sharedLength < commonIndent.length &&
      sharedLength < indent.length &&
      commonIndent[sharedLength] === indent[sharedLength]
    ) {
      sharedLength += 1;
    }
    commonIndent = commonIndent.slice(0, sharedLength);
    if (!commonIndent) {
      break;
    }
  }

  return lines
    .map((line) =>
      /^[ \t]*$/.test(line) ? "" : line.slice(commonIndent.length),
    )
    .join("\n");
}
