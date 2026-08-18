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
    parse(source);
    return { valid: true };
  } catch (error) {
    if (!(error instanceof LinesAndArrowsSyntaxError)) {
      throw error;
    }

    return {
      valid: false,
      error: {
        message: error.message.replace(/^Line \d+: /, ""),
        line: error.line,
      },
    };
  }
}
