import {
  LinesAndArrowsSyntaxError,
  parse,
  serialize,
  validate,
  type DiagramDocument,
} from "lines-and-arrows/syntax";

const document: DiagramDocument = parse("Client -> API: Request");
const source: string = serialize(document);
const result = validate(source);
if (!result.valid) {
  throw new Error(result.error.message);
}

const syntaxError = new LinesAndArrowsSyntaxError("Invalid source", 1);
const line: number = syntaxError.line;
void line;
