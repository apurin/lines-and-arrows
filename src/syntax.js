import {
  LinesAndArrowsSyntaxError,
  parse,
} from "./parser.js";

export {
  LinesAndArrowsSyntaxError,
  parse,
} from "./parser.js";
export { serialize } from "./serialize.js";

export function validate(source) {
  try {
    return {
      valid: true,
      document: parse(source),
    };
  } catch (error) {
    if (!(error instanceof LinesAndArrowsSyntaxError)) {
      throw error;
    }

    return {
      valid: false,
      error: {
        name: error.name,
        message: error.message.replace(/^Line \d+: /, ""),
        line: error.line,
      },
    };
  }
}
