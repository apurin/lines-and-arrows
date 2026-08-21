export type Arrow = "->" | "-->" | "->x";

export interface Actor {
  type: "actor";
  name: string;
  icon: string | null;
  tag: string | null;
  tooltip: string | null;
  tooltipIcon: string | null;
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
}

export interface Gap {
  type: "gap";
  label: string;
}

export interface Section {
  type: "section";
  label: string;
  items: TimelineItem[];
}

export interface Group {
  type: "group";
  groupType: string;
  label: string | null;
  body: TimelineItem[] | Section[];
}

export type TimelineItem = Message | Gap | Group;

export interface DiagramDocument {
  type: "diagram";
  actors: Actor[];
  items: TimelineItem[];
  comments: string[];
}

export interface ValidationError {
  message: string;
  line: number;
}

export type ValidationResult =
  | { valid: true }
  | { valid: false; error: ValidationError };
