export type Arrow = "->" | "-->" | "->x";

export interface Comment {
  type: "comment";
  text: string;
  /** Indentation levels relative to the comment's structural owner. */
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
  name: string;
  icon: string | null;
  tag: string | null;
  tooltip: string | null;
  tooltipIcon: string | null;
  leadingComments: Comment[];
  propertyComments: PropertyComment[];
}

export interface Message {
  type: "message";
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
  label: string;
  leadingComments: Comment[];
}

export interface Section {
  type: "section";
  label: string;
  items: TimelineItem[];
  leadingComments: Comment[];
  bodyTrailingComments: Comment[];
}

export interface Group {
  type: "group";
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

export interface ValidationError {
  message: string;
  line: number;
}

export type ValidationResult =
  | { valid: true }
  | { valid: false; error: ValidationError };
