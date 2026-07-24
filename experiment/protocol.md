# Blind sequence-diagram usage study

## Question

Which semantic capabilities recur when independent authors use sequence diagrams to explain real systems, and which PlantUML capabilities are dispensable for a lightweight human-editable language?

## Blind generation protocol

Ten isolated agents receive no project context and no information about the language-design question. Each is assigned one domain and asked for exactly ten distinct, self-contained PlantUML sequence diagrams. The common generation instructions are:

- Explain different important aspects of the assigned topic.
- Prefer concise diagrams optimized for human comprehension.
- Preserve complexity where it materially improves the explanation.
- Avoid optional visual clutter: colors, `skinparam`, theming, custom fonts, and decorative styling.
- Use any semantic PlantUML sequence capability judged useful.
- Include `@startuml` and `@enduml` in every diagram.

## Domains

1. Internal class/object interactions in a collaborative document editor.
2. Multithreaded task scheduling and worker-pool concurrency.
3. Streaming file I/O, buffering, backpressure, and cancellation.
4. Service-oriented order fulfilment and distributed sagas.
5. A scientific sequencing experiment and analysis pipeline.
6. Community moderation, appeals, and social coordination.
7. An AI coding agent using repository and external tools.
8. Passkey authentication, authorization, and session security.
9. Embedded autonomous-drone sensing, control, and failsafes.
10. Emergency-care triage, diagnostics, treatment, and handoff.

## Planned analysis

The analysis has two layers:

1. **Syntactic frequency:** messages, participant declarations and types, fragments, notes, activations, lifecycle operations, timing/spacing, references, numbering, and other commands.
2. **Semantic coverage:** what the author needed to communicate, including alternatives, optional paths, repetition, concurrency, time gaps, participant state, off-diagram systems, creation/destruction, and explanatory annotation.

Frequency alone will not decide the language. A rare construct can still be essential in a domain, while a frequently typed PlantUML spelling can be representational ceremony rather than a distinct need.

## Revised unit of analysis

The first analysis incorrectly treated values inside the same editor control as separate scope decisions. The corrected report groups the evidence by interaction topology:

1. **Actor control:** identity, label, order, icon, and attached pills.
2. **Connection control:** endpoints, label, arrow style, and attached pills.
3. **Group control:** type, label, one or more sections, children, and nesting.
4. **Pill attachment:** a visible tag plus tooltip detail attached to an actor or connection.

PlantUML keywords such as `alt`, `loop`, `par`, `critical`, and `opt` are therefore group-type values rather than independent controls. Participant shapes become icon choices, and arrow spellings become connection-style choices. Their corpus frequencies may inform selector defaults and ordering, but not architectural inclusion or exclusion.

The revised audit also identifies genuinely different potential controls: lifeline spans/state and timeline markers/gaps. These remain meaningful MVP boundary questions because they require different selection and editing behavior.
