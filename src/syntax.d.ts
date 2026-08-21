import type {
  DiagramDocument,
  ValidationResult,
} from "./model.js";

export type {
  Actor,
  Arrow,
  DiagramDocument,
  Gap,
  Group,
  Message,
  Section,
  TimelineItem,
  ValidationError,
  ValidationResult,
} from "./model.js";

export class LinesAndArrowsSyntaxError extends SyntaxError {
  constructor(message: string, line: number);
  readonly line: number;
}

export function parse(source: string): DiagramDocument;
export function serialize(document: DiagramDocument): string;
export function validate(source: string): ValidationResult;
