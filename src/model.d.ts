export type Arrow = "->" | "-->" | "->x";
export type TimelineItemKind = "message" | "gap" | "group";

export interface Comment {
  type: "comment";
  text: string;
  /**
   * Indentation levels relative to the comment's structural owner.
   * Document comments use the document root as their owner.
   */
  indent: number;
}

export type PropertyCommentAnchor =
  | "header"
  | "icon"
  | "tag"
  | "tooltip"
  | "tooltip-icon";

export interface PropertyComment extends Comment {
  after: PropertyCommentAnchor;
}

export interface Actor {
  type: "actor";
  id?: string;
  name: string;
  icon: string | null;
  tag: string | null;
  tooltip: string | null;
  tooltipIcon: string | null;
  inferred?: boolean;
  leadingComments: Comment[];
  propertyComments: PropertyComment[];
}

export interface Message {
  type: "message";
  id: string;
  source: string;
  target: string;
  arrow: Arrow;
  label: string | null;
  tag: string | null;
  tooltip: string | null;
  tooltipIcon: string | null;
  leadingComments: Comment[];
  propertyComments: PropertyComment[];
}

export interface Gap {
  type: "gap";
  id: string;
  label: string;
  leadingComments: Comment[];
}

export interface Section {
  type: "section";
  id: string;
  label: string;
  items: TimelineItem[];
  leadingComments: Comment[];
  bodyTrailingComments: Comment[];
}

export interface Group {
  type: "group";
  id: string;
  groupType: string;
  label: string | null;
  items: TimelineItem[];
  sections: Section[];
  leadingComments: Comment[];
  bodyTrailingComments: Comment[];
}

export type TimelineItem = Message | Gap | Group;

export interface DiagramDocument {
  type: "diagram";
  actors: Actor[];
  items: TimelineItem[];
  leadingComments: Comment[];
  trailingComments: Comment[];
  explicitActors: boolean;
}

export type Immutable<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends readonly (infer Item)[]
    ? readonly Immutable<Item>[]
    : T extends object
      ? { readonly [Key in keyof T]: Immutable<T[Key]> }
      : T;

export type DiagramDocumentSnapshot = Immutable<DiagramDocument>;

export interface ValidationError {
  name: "LinesAndArrowsSyntaxError";
  message: string;
  line: number;
}

export type ValidationResult =
  | {
      valid: true;
      document: DiagramDocument;
    }
  | {
      valid: false;
      error: ValidationError;
    };
