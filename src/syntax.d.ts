import type {
  DiagramDocument,
  DiagramDocumentSnapshot,
  ValidationResult,
} from "./model.js";

export type {
  Actor,
  Arrow,
  Comment,
  DiagramDocument,
  DiagramDocumentSnapshot,
  Gap,
  Group,
  Message,
  PropertyComment,
  PropertyCommentAnchor,
  Section,
  TimelineItem,
  ValidationError,
  ValidationResult,
} from "./model.js";

export class LinesAndArrowsSyntaxError extends SyntaxError {
  constructor(message: string, line: number);
  line: number;
}

export function parse(source: string): DiagramDocument;
export function serialize(
  document: DiagramDocument | DiagramDocumentSnapshot,
): string;
export function validate(source: string): ValidationResult;
