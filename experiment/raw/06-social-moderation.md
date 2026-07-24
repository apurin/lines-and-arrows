# Community Moderation and Social Coordination

## 1. Safe report intake

Intent: Capture a report, preserve the relevant evidence, and protect the reporter's chosen level of visibility.

```plantuml
@startuml
actor Reporter
participant "Community UI" as UI
participant "Report Service" as Reports
database "Evidence Store" as Evidence

Reporter -> UI: Select rule and describe concern
UI -> Reporter: Choose confidential or named report
Reporter -> UI: Confirm submission
UI -> Reports: Submit report and visibility choice
Reports -> Evidence: Snapshot content and context
Evidence --> Reports: evidence_id
Reports -> Reports: Create case and tracking token
Reports --> UI: Receipt without sensitive metadata
UI --> Reporter: Confirm safe submission
@enduml
```

## 2. Risk-based triage

Intent: Combine severity, context, and reach signals to route each case to an appropriate response queue.

```plantuml
@startuml
participant "Report Queue" as Queue
participant "Triage Service" as Triage
participant "Risk Signals" as Risk
participant "Context Service" as Context
participant "Routine Review" as Routine
participant "Priority Moderation" as Priority
participant "Safety On-call" as Safety

Queue -> Triage: Dequeue untriaged case
par Assess potential harm
  Triage -> Risk: Score severity and velocity
  Risk --> Triage: risk signals
else Load conversational context
  Triage -> Context: Fetch thread and account history
  Context --> Triage: relevant context
end
alt Credible imminent harm
  Triage -> Safety: Page with evidence summary
  Safety --> Triage: Acknowledge ownership
else High impact or rapid spread
  Triage -> Priority: Assign expedited review
else Routine policy question
  Triage -> Routine: Assign standard review
end
Triage -> Queue: Record route and rationale
@enduml
```

## 3. Moderator adjudication

Intent: Help a moderator test evidence against policy and apply a proportional, auditable outcome.

```plantuml
@startuml
actor Moderator
participant "Case Queue" as Queue
participant "Case File" as Case
participant "Policy Guide" as Policy
participant "Enforcement Service" as Enforcement
participant "Decision Log" as Log

Moderator -> Queue: Claim case
Queue --> Moderator: Case reference
Moderator -> Case: Review evidence and context
Case --> Moderator: Preserved record
Moderator -> Policy: Check applicable rule and precedent
Policy --> Moderator: Decision criteria
alt Evidence is insufficient
  Moderator -> Case: Request more context
  Case -> Queue: Return case as pending
else No violation
  Moderator -> Case: Close with explanation
  Case -> Log: Record no-action decision
else Violation confirmed
  Moderator -> Enforcement: Apply proportional remedy
  Enforcement --> Moderator: Action result
  Moderator -> Log: Record evidence, rule, and rationale
end
@enduml
```

## 4. Coordinated-reporting abuse defense

Intent: Detect report brigading without discarding legitimate safety signals or allowing report volume to decide guilt.

```plantuml
@startuml
actor "Reporting Accounts" as Reporters
participant "Report Service" as Reports
participant "Coordination Detector" as Detector
participant "Triage Queue" as Triage
actor "Abuse Specialist" as Specialist

loop Incoming reports about the same target
  Reporters -> Reports: Submit report
  Reports -> Detector: Add timing, linkage, and reason signals
end
Detector -> Detector: Compare burst and account graph
alt Suspected coordinated campaign
  Detector -> Reports: Mark correlated reports
  Reports -> Triage: Send one case with all unique evidence
  Triage -> Specialist: Request human abuse review
  Specialist -> Reports: Preserve valid reports; discount volume
else Independent reporting pattern
  Detector -> Reports: Keep normal confidence weights
  Reports -> Triage: Route by harm severity
end
@enduml
```

## 5. Consensus for an ambiguous case

Intent: Use independent judgments and a clear quorum rule when one moderator's decision would be too fragile.

```plantuml
@startuml
participant "Case Manager" as Case
actor "Reviewer A" as A
actor "Reviewer B" as B
actor "Reviewer C" as C
participant "Consensus Service" as Consensus
actor "Policy Panel" as Panel

Case -> Case: Remove prior-reviewer identity
par Independent review A
  Case -> A: Send evidence and policy question
  A -> Consensus: Submit sealed judgment
else Independent review B
  Case -> B: Send evidence and policy question
  B -> Consensus: Submit sealed judgment
else Independent review C
  Case -> C: Send evidence and policy question
  C -> Consensus: Submit sealed judgment
end
Consensus -> Consensus: Compare outcomes and rationales
alt Outcome reaches quorum
  Consensus -> Case: Adopt majority outcome
else Tie or incompatible policy readings
  Consensus -> Panel: Escalate disagreement packet
  Panel -> Case: Return binding interpretation
end
Case -> Case: Publish decision and audit trail
@enduml
```

## 6. Community-mediated conflict resolution

Intent: Let participants negotiate a shared remedy for interpersonal conflict while retaining a path to formal moderation.

```plantuml
@startuml
actor "Member A" as A
participant "Community Mediator" as Mediator
participant "Shared Proposal" as Proposal
actor "Member B" as B
participant "Formal Moderation" as Moderation

A -> Mediator: Request facilitated resolution
Mediator -> B: Invite voluntary participation
alt Member B declines or safety risk exists
  Mediator -> Moderation: Refer with consent-safe summary
else Both members participate
  par Hear Member A privately
    Mediator -> A: Ask impact and desired repair
    A --> Mediator: Needs and boundaries
  else Hear Member B privately
    Mediator -> B: Ask perspective and constraints
    B --> Mediator: Perspective and boundaries
  end
  Mediator -> Proposal: Draft commitments and review date
  loop Until both accept or mediation ends
    Proposal -> A: Request revision or approval
    Proposal -> B: Request revision or approval
  end
  A -> Proposal: Approve
  B -> Proposal: Approve
  Proposal -> Mediator: Record shared agreement
  opt Agreement is breached
    Mediator -> Moderation: Escalate agreement and evidence
  end
end
@enduml
```

## 7. Emergency safety escalation

Intent: Contain credible imminent harm quickly while minimizing unnecessary disclosure and preserving later accountability.

```plantuml
@startuml
actor Moderator
participant "Safety On-call" as Safety
participant "Platform Controls" as Controls
database "Evidence Vault" as Evidence
participant "Legal / Safety Lead" as Lead
participant "Emergency Contact" as Emergency

Moderator -> Safety: Escalate credible imminent threat
Safety -> Safety: Verify source, immediacy, and location
critical Contain immediate harm
  Safety -> Controls: Limit exposure and risky account actions
  Controls --> Safety: Containment active
end
par Preserve accountability
  Safety -> Evidence: Seal relevant records and access log
else Check disclosure threshold
  Safety -> Lead: Request urgent legal and safety review
  Lead --> Safety: Authorized response and data scope
end
alt External intervention is authorized
  Safety -> Emergency: Send minimum necessary facts
  Emergency --> Safety: Receipt and case reference
else Threshold is not met
  Safety -> Controls: Continue internal safeguards
end
Safety -> Evidence: Record decisions and disclosures
@enduml
```

## 8. Cross-community incident coordination

Intent: Coordinate a threat spanning several communities while leaving each community responsible for its own rules and actions.

```plantuml
@startuml
actor "Local Moderator" as Local
participant "Coordination Hub" as Hub
participant "Community B" as B
participant "Community C" as C
participant "Shared Incident" as Incident

Local -> Hub: Share sanitized pattern indicators
par Ask peer community B
  Hub -> B: Check for matching behavior
  B --> Hub: Local findings
else Ask peer community C
  Hub -> C: Check for matching behavior
  C --> Hub: Local findings
end
alt Pattern is isolated
  Hub --> Local: Handle under local policy
else Cross-community pattern is confirmed
  Hub -> Incident: Open shared incident and timeline
  Incident -> Local: Recommend coordinated window
  Incident -> B: Recommend coordinated window
  Incident -> C: Recommend coordinated window
  par Autonomous local decisions
    Local -> Incident: Report local action
  else
    B -> Incident: Report local action
  else
    C -> Incident: Report local action
  end
  Incident -> Hub: Consolidate impact and unresolved risks
end
@enduml
```

## 9. Independent appeal review

Intent: Reconsider a moderation outcome using a reviewer separated from the original decision and restore effects when warranted.

```plantuml
@startuml
actor "Sanctioned User" as User
participant "Appeals Service" as Appeals
actor "Independent Reviewer" as Reviewer
participant "Enforcement Service" as Enforcement
participant "Decision Log" as Log

User -> Appeals: Submit grounds and new context
Appeals -> Appeals: Check deadline, standing, and completeness
alt Appeal is incomplete but curable
  Appeals --> User: Request missing information
else Appeal is eligible
  Appeals -> Reviewer: Send evidence without moderator identity
  Reviewer -> Log: Read original rationale and policy version
  Log --> Reviewer: Decision record
  Reviewer -> Appeals: Return fresh finding
  alt Original decision upheld
    Appeals -> Log: Record upheld appeal
  else Remedy modified
    Appeals -> Enforcement: Replace sanction
    Enforcement --> Appeals: Updated remedy
  else Decision reversed
    Appeals -> Enforcement: Restore content and account state
    Enforcement --> Appeals: Restoration result
  end
  Appeals --> User: Explain outcome and effective changes
end
@enduml
```

## 10. Role-specific outcome notification

Intent: Inform affected people consistently while tailoring detail for privacy, safety, and each recipient's legitimate needs.

```plantuml
@startuml
participant "Decision Service" as Decision
participant "Notification Service" as Notify
actor "Content Author" as Author
actor Reporter
participant "Transparency Log" as Transparency
participant "Delivery Queue" as Delivery

Decision -> Notify: Publish outcome, rationale, and sensitivity
par Prepare author notice
  Notify -> Notify: Include rule, action, duration, and appeal path
  Notify -> Delivery: Queue detailed author notice
else Prepare reporter notice
  Notify -> Notify: Include status without private sanctions
  Notify -> Delivery: Queue privacy-limited reporter notice
else Prepare community record
  Notify -> Transparency: Publish anonymized aggregate outcome
end
alt Immediate notice creates a safety risk
  Notify -> Delivery: Delay or redact sensitive details
else Normal delivery
  Delivery -> Author: Send decision notice
  Delivery -> Reporter: Send report outcome
end
loop Until delivered or retry limit reached
  Delivery -> Delivery: Retry failed channel
end
@enduml
```
