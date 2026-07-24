# AI Coding Agent Repository Task

## 1. Task intake and repository orientation

Intent: Establish the requested outcome, repository rules, and current working state before choosing an implementation path.

```plantuml
@startuml
actor User
participant "Coding Agent" as Agent
database "Local Repository" as Repo
participant Shell

User -> Agent: Request repository change
Agent -> Repo: Read project instructions
Repo --> Agent: Scope and conventions
Agent -> Shell: Inspect status, tree, and manifests
Shell -> Repo: Read working state
Repo --> Shell: Files and uncommitted changes
Shell --> Agent: Repository summary
Agent -> Agent: Form implementation plan
alt Goal is sufficiently defined
  Agent --> User: Begin scoped work
else Material decision is missing
  Agent -> User: Ask focused clarification
  User --> Agent: Resolve ambiguity
end
@enduml
```

## 2. Tracing a behavior through local code

Intent: Follow symbols from entry point to tests so the agent changes the responsible code rather than a nearby symptom.

```plantuml
@startuml
participant "Coding Agent" as Agent
participant Shell
database "Source Files" as Source
database "Tests" as Tests

Agent -> Shell: Search for error, symbol, and caller
Shell -> Source: Scan matching definitions and uses
Source --> Shell: Candidate paths
Shell --> Agent: Ranked matches
loop Until the execution path is explained
  Agent -> Source: Read focused code region
  Source --> Agent: Implementation and dependencies
  Agent -> Tests: Read related expectations
  Tests --> Agent: Existing contract and edge cases
  Agent -> Shell: Trace next symbol or configuration key
  Shell --> Agent: Next relevant location
end
Agent -> Agent: Identify root cause and change boundary
@enduml
```

## 3. Preserving unrelated work

Intent: Isolate the requested edit when the worktree already contains user-owned changes.

```plantuml
@startuml
actor User
participant "Coding Agent" as Agent
participant Git
database "Working Tree" as Tree

Agent -> Git: Inspect status and diffs
Git -> Tree: Read tracked and untracked state
Tree --> Git: Current user changes
Git --> Agent: Changed paths and hunks
Agent -> Agent: Compare requested scope to existing edits
alt Target does not overlap
  Agent -> Tree: Edit only in-scope files
else Target overlaps but intent is clear
  Agent -> Tree: Apply minimal compatible hunk
  Agent -> Git: Review combined diff
else Safe separation is uncertain
  Agent -> User: Explain overlap and request direction
  User --> Agent: Choose how to proceed
end
Agent -> Git: Confirm unrelated changes remain intact
@enduml
```

## 4. Patch and targeted-test cycle

Intent: Make a small local change and use the narrowest relevant test to obtain fast feedback.

```plantuml
@startuml
participant "Coding Agent" as Agent
database "Source Files" as Source
database "Test Files" as Tests
participant Shell
participant "Test Runner" as Runner

Agent -> Source: Apply focused implementation patch
opt Contract needs explicit coverage
  Agent -> Tests: Add or refine regression test
end
Agent -> Shell: Run targeted test command
Shell -> Runner: Execute selected test scope
Runner --> Shell: Exit status and diagnostics
Shell --> Agent: Test result
alt Targeted tests pass
  Agent -> Agent: Expand verification scope
else Targeted tests fail
  Agent -> Source: Reconcile patch with failure
end
@enduml
```

## 5. Researching an unstable external dependency

Intent: Verify time-sensitive behavior against authoritative web or API sources before encoding an assumption in the repository.

```plantuml
@startuml
participant "Coding Agent" as Agent
participant "Web / API Client" as Client
participant "Primary Documentation" as Docs
participant "External API" as API
database "Local Repository" as Repo

Agent -> Client: Search exact feature and version
par Read authoritative documentation
  Client -> Docs: Fetch specification or release notes
  Docs --> Client: Supported behavior and constraints
else Probe machine-readable behavior
  Client -> API: Send safe read-only request
  API --> Client: Response schema or error
end
Client --> Agent: Sources and observed result
Agent -> Agent: Reconcile docs with live behavior
alt Evidence agrees
  Agent -> Repo: Implement supported integration
else Evidence conflicts or is incomplete
  Agent -> Repo: Avoid unsupported assumption
  Agent -> Agent: Record uncertainty for handoff
end
@enduml
```

## 6. Approval-gated privileged action

Intent: Keep a consequential command behind an explicit user decision while retaining a safe path forward.

```plantuml
@startuml
actor User
participant "Coding Agent" as Agent
participant "Approval Gate" as Gate
participant Shell
database "Protected Resource" as Resource

Agent -> Agent: Detect privilege or destructive risk
Agent -> Gate: Request exact command and rationale
Gate -> User: Show target, impact, and scope
alt User approves
  User --> Gate: Approve this action
  Gate --> Agent: Authorization granted
  Agent -> Shell: Execute approved command
  Shell -> Resource: Perform bounded operation
  Resource --> Shell: Result
  Shell --> Agent: Exit status and output
else User declines
  User --> Gate: Deny action
  Gate --> Agent: Authorization denied
  Agent -> Agent: Select non-privileged alternative
end
@enduml
```

## 7. Recovering from a transient tool failure

Intent: Retry only recoverable failures, vary the approach when useful, and stop once further attempts would be unsafe or redundant.

```plantuml
@startuml
participant "Coding Agent" as Agent
participant Tool
participant "Fallback Tool" as Fallback
database "Attempt Log" as Log

Agent -> Tool: Perform operation
Tool --> Agent: Failure with diagnostics
Agent -> Log: Record command, error, and attempt
loop While failure is transient and retry budget remains
  Agent -> Agent: Adjust timeout, scope, or parameters
  Agent -> Tool: Retry operation
  Tool --> Agent: New result
  alt Operation succeeds
    Agent -> Log: Record recovery
    break Continue repository work
      Agent -> Agent: Consume successful result
    end
  end
end
alt Equivalent safe method exists
  Agent -> Fallback: Attempt alternate method
  Fallback --> Agent: Result
else No safe progress remains
  Agent -> Agent: Preserve diagnostics for handoff
end
@enduml
```

## 8. Diagnosing and repairing a failing test suite

Intent: Turn broad suite failures into a minimal causal fix, distinguishing regressions from unrelated environmental failures.

```plantuml
@startuml
participant "Coding Agent" as Agent
participant "Test Runner" as Runner
database "Failure Output" as Output
database "Source and Tests" as Files

Agent -> Runner: Run broader verification suite
Runner -> Output: Write failures and traces
Output --> Agent: Failed cases and diagnostics
loop For each causally relevant failure
  Agent -> Files: Inspect failing assertion and code path
  Files --> Agent: Local evidence
  alt Regression caused by current patch
    Agent -> Files: Correct implementation or expectation
    Agent -> Runner: Re-run smallest failing case
    Runner --> Agent: Focused result
  else Pre-existing or environmental failure
    Agent -> Agent: Capture evidence without unrelated edit
  end
end
Agent -> Runner: Re-run affected suite
Runner --> Agent: Final verification status
@enduml
```

## 9. Handling a user scope change mid-task

Intent: Incorporate an additive request or replace obsolete work without silently carrying the old scope forward.

```plantuml
@startuml
actor User
participant "Coding Agent" as Agent
database "Current Plan" as Plan
database "Working Tree" as Tree

Agent -> Plan: Mark implementation in progress
Agent -> Tree: Begin scoped edits
User -> Agent: Send new instruction
Agent -> Agent: Compare new intent with active task
alt New instruction extends the task
  Agent -> Plan: Add required work and validation
  Agent -> Tree: Continue with combined scope
else New instruction replaces the task
  Agent -> Plan: Retire obsolete steps
  Agent -> Tree: Preserve useful compatible edits
  Agent -> Tree: Remove only superseded agent changes
else Relationship is ambiguous
  Agent -> User: State conflict and ask which scope wins
  User --> Agent: Confirm intended scope
end
Agent -> Plan: Continue from revised objective
@enduml
```

## 10. Final verification and handoff

Intent: Deliver a concise result backed by diff review, relevant checks, and explicit disclosure of anything unresolved.

```plantuml
@startuml
actor User
participant "Coding Agent" as Agent
participant Git
participant "Test Runner" as Runner
database "Local Repository" as Repo

Agent -> Git: Review final diff and status
Git -> Repo: Read changed files
Repo --> Git: Patch and remaining worktree state
Git --> Agent: Scoped final diff
Agent -> Runner: Run agreed validation
Runner --> Agent: Checks passed or residual failures
alt Change is complete and verified
  Agent -> User: Summarize outcome, files, and checks
else Required work is blocked
  Agent -> User: Report blocker, evidence, and next decision
else Change works with known limitation
  Agent -> User: Summarize result and disclose limitation
end
User --> Agent: Accept or request follow-up
@enduml
```
