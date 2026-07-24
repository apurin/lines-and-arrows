# Passkey Security and Account Control

## 1. Passkey enrollment

Intent: Bind a newly created public key to the correct account only after the relying party validates the complete WebAuthn registration ceremony.

```plantuml
@startuml
actor User
participant Browser
participant "Relying Party" as RP
participant Authenticator
database "Credential Store" as Store

User -> Browser: Choose Create passkey
Browser -> RP: Request registration options
RP -> RP: Generate single-use challenge
RP --> Browser: Challenge, RP ID, user ID, policy
Browser -> Authenticator: create(options)
Authenticator -> User: Verify presence and identity
alt User verification succeeds
  Authenticator -> Authenticator: Generate credential key pair
  Authenticator --> Browser: Attestation and public-key credential
  Browser -> RP: Submit registration response
  RP -> RP: Verify challenge, origin, RP ID hash,
  RP -> RP: user verification, algorithm, and attestation policy
  alt Registration is valid
    RP -> Store: Save credential ID, public key, and metadata
    RP --> Browser: Passkey enrolled
  else Any validation fails
    RP --> Browser: Reject ceremony without account change
  end
else User cancels or verification fails
  Authenticator --> Browser: Ceremony failed
  Browser --> User: Passkey was not created
end
@enduml
```

## 2. Passwordless sign-in

Intent: Authenticate a user with a discoverable credential while rejecting assertions that are validly shaped but bound to the wrong ceremony or site.

```plantuml
@startuml
actor User
participant Browser
participant "Relying Party" as RP
participant Authenticator
database "Credential Store" as Store
participant "Session Service" as Sessions

User -> Browser: Sign in with a passkey
Browser -> RP: Request authentication options
RP -> RP: Create expiring single-use challenge
RP --> Browser: Challenge, RP ID, verification policy
Browser -> Authenticator: get(options)
Authenticator -> User: Select account and verify identity
Authenticator -> Authenticator: Sign client and authenticator data
Authenticator --> Browser: Credential ID and assertion
Browser -> RP: Submit assertion
RP -> Store: Load public key and counter metadata
Store --> RP: Credential record
RP -> RP: Verify challenge, origin, RP ID hash,
RP -> RP: user verification, signature, and freshness
alt Assertion is valid
  RP -> Sessions: Create session for credential owner
  Sessions --> Browser: Secure session cookie
  Browser --> User: Signed in
else Assertion is invalid or expired
  RP --> Browser: Generic authentication failure
end
@enduml
```

## 3. Authorization with step-up authentication

Intent: Keep passkey authentication separate from authorization and require a fresh, action-bound proof before a sensitive operation.

```plantuml
@startuml
actor User
participant "Application" as App
participant "Authorization Service" as AuthZ
participant "Risk Engine" as Risk
participant "WebAuthn Service" as WebAuthn
participant Authenticator
participant "Payment Service" as Payments

User -> App: Submit high-value payment
App -> AuthZ: Authorize principal, resource, and action
AuthZ -> Risk: Evaluate amount, session age, and context
Risk --> AuthZ: Required assurance level
alt Permission denied
  AuthZ --> App: Deny
  App --> User: Action is not allowed
else Permission granted and assurance is current
  AuthZ -> Payments: Execute idempotent payment request
  Payments --> App: Result
else Permission granted but fresh proof required
  AuthZ --> App: Step-up challenge bound to payment digest
  App -> Authenticator: Request passkey assertion
  Authenticator -> User: Verify payment approval
  Authenticator --> App: Signed assertion
  App -> WebAuthn: Verify assertion and action binding
  alt Fresh proof is valid
    WebAuthn -> AuthZ: Elevate assurance for this action only
    AuthZ -> Payments: Execute idempotent payment request
    Payments --> App: Result
  else Step-up fails
    WebAuthn --> App: Deny without executing payment
  end
end
@enduml
```

## 4. Session renewal and token rotation

Intent: Renew an authenticated session atomically so that reuse of an old renewal token exposes theft and invalidates the whole token family.

```plantuml
@startuml
actor User
participant Client
participant API
participant "Session Service" as Sessions
database "Token Store" as Tokens
participant "Security Monitor" as Monitor

User -> Client: Continue using application
Client -> API: Request with expired access token
API --> Client: Authentication renewal required
Client -> Sessions: Present opaque renewal token
critical Validate and rotate atomically
  Sessions -> Tokens: Consume token if active and unexpired
  alt Token is current
    Tokens -> Tokens: Retire old token; create successor
    Tokens --> Sessions: New access and renewal pair
    Sessions --> Client: Rotated secure credentials
  else Token was already consumed
    Tokens -> Tokens: Revoke entire token family
    Tokens --> Sessions: Replay detected
    Sessions -> Monitor: Record suspected token theft
    Sessions --> Client: Session revoked; sign-in required
  else Token expired or revoked
    Tokens --> Sessions: Renewal denied
    Sessions --> Client: Sign-in required
  end
end
@enduml
```

## 5. Adaptive risk decision after valid authentication

Intent: Treat a valid passkey assertion as strong identity evidence while still evaluating contextual signs of session abuse or account takeover.

```plantuml
@startuml
participant "WebAuthn Verifier" as Verifier
participant "Risk Engine" as Risk
participant "Account History" as History
participant "Device Signals" as Device
participant "Threat Intelligence" as Threats
participant "Session Service" as Sessions
actor "Security Reviewer" as Reviewer

Verifier -> Risk: Valid assertion plus ceremony context
par Compare account behavior
  Risk -> History: Recent locations, actions, and recovery events
  History --> Risk: Behavioral signals
else Assess current client
  Risk -> Device: Integrity and continuity signals
  Device --> Risk: Device assessment
else Check active threats
  Risk -> Threats: Network and credential indicators
  Threats --> Risk: Threat matches
end
Risk -> Risk: Score evidence with explicit policy
alt Low risk
  Risk -> Sessions: Issue normal session
else Uncertain risk
  Risk -> Sessions: Issue restricted short session
  Sessions --> Verifier: Require independent step-up for sensitive actions
else High-confidence attack signal
  Risk -> Sessions: Deny session creation
  Risk -> Reviewer: Open review with reasons and evidence
end
@enduml
```

## 6. Cross-device passkey authentication

Intent: Let a nearby phone authenticate a browser on another device without exporting the private key or trusting the requesting device with it.

```plantuml
@startuml
actor User
participant "Desktop Browser" as Desktop
participant "Relying Party" as RP
participant "Hybrid Transport" as Hybrid
participant "Phone Authenticator" as Phone

User -> Desktop: Choose Use another device
Desktop -> RP: Request authentication options
RP --> Desktop: Challenge and RP ID
Desktop -> Desktop: Display hybrid sign-in QR code
User -> Phone: Scan QR code
Phone -> Hybrid: Establish proximity-bound encrypted channel
Hybrid --> Desktop: Channel confirmed
Phone -> User: Confirm site and verify identity
alt User verification succeeds
  Phone -> Phone: Sign assertion with passkey private key
  Phone -> Hybrid: Send assertion over encrypted channel
  Hybrid --> Desktop: Assertion
  Desktop -> RP: Submit assertion
  RP -> RP: Verify normal WebAuthn ceremony bindings
  RP --> Desktop: Authenticated session
else Proximity or user verification fails
  Phone --> Desktop: Authentication aborted
end
@enduml
```

## 7. Adding a passkey from a new device

Intent: Prevent an existing but stale or stolen session from silently adding an attacker-controlled passkey.

```plantuml
@startuml
actor User
participant "Account Settings" as Settings
participant "Credential Service" as Credentials
participant "Risk Engine" as Risk
participant "Existing Authenticator" as Existing
participant "New Authenticator" as New
participant "Notification Service" as Notify

User -> Settings: Add passkey on this device
Settings -> Credentials: Request enrollment authorization
Credentials -> Risk: Check session age and account changes
Risk --> Credentials: Require independent recent proof
Credentials --> Settings: Step-up challenge
Settings -> Existing: Request assertion from existing passkey
Existing -> User: Verify identity
Existing --> Settings: Signed assertion
Settings -> Credentials: Submit step-up assertion
alt Existing credential verifies
  Credentials --> Settings: Single-use registration options
  Settings -> New: Create new passkey
  New -> User: Verify identity
  New --> Settings: Registration response
  Settings -> Credentials: Register new credential
  Credentials -> Credentials: Validate and store new public key
  Credentials -> Notify: Announce new passkey out of band
  Credentials --> Settings: Enrollment complete
else Step-up fails
  Credentials --> Settings: Enrollment denied
end
@enduml
```

## 8. Account recovery without a passkey

Intent: Restore access through a narrowly scoped recovery grant, then replace compromised access paths and notify the account owner.

```plantuml
@startuml
actor User
participant "Recovery Service" as Recovery
participant "Rate Limiter" as Limits
participant "Identity Proofing" as Proofing
participant "Credential Service" as Credentials
participant "Session Service" as Sessions
participant "Notification Service" as Notify

User -> Recovery: Report all passkeys unavailable
Recovery -> Limits: Check account and network attempt budget
alt Attempt budget exhausted
  Limits --> Recovery: Deny without revealing account state
  Recovery --> User: Recovery unavailable; try later
else Attempt permitted
  Limits --> Recovery: Continue
  Recovery -> Proofing: Verify configured recovery factors
  alt Proof and risk policy pass
    Proofing --> Recovery: Time-limited recovery grant
    Recovery --> User: Permit passkey enrollment only
    User -> Credentials: Register replacement passkey with grant
    Credentials -> Credentials: Validate registration and consume grant
    Credentials -> Sessions: Revoke existing sessions
    Credentials -> Credentials: Revoke credentials marked lost
    Credentials -> Notify: Send recovery and revocation notice
    Credentials --> User: Access restored; sign in again
  else Proof fails or risk is excessive
    Proofing --> Recovery: Deny or queue manual review
    Recovery --> User: Generic recovery status
  end
end
@enduml
```

## 9. Passkey revocation and last-credential safety

Intent: Remove a lost or unwanted passkey without allowing an attacker to strand the account or preserve sessions authenticated by a compromised credential.

```plantuml
@startuml
actor User
participant "Account Settings" as Settings
participant "Credential Service" as Credentials
participant "WebAuthn Verifier" as Verifier
participant "Session Service" as Sessions
participant "Audit Log" as Audit

User -> Settings: Remove selected passkey
Settings -> Credentials: Request credential revocation
Credentials -> Credentials: Count remaining usable credentials
alt This is the last strong credential
  Credentials --> Settings: Require replacement or verified recovery path
  Settings --> User: Removal blocked until access path exists
else Another access path remains
  Credentials --> Settings: Require fresh passkey assertion
  Settings -> Verifier: Verify assertion from a different credential
  alt Reauthentication succeeds
    Verifier -> Credentials: Authorize revocation
    Credentials -> Credentials: Mark selected credential revoked
    Credentials -> Sessions: Revoke sessions tied to its authentication
    Credentials -> Audit: Record actor, credential, and reason
    Credentials --> Settings: Passkey removed
  else Reauthentication fails
    Verifier --> Settings: No account change
  end
end
@enduml
```

## 10. WebAuthn security-failure handling

Intent: Fail closed on protocol errors, distinguish possible credential cloning from ordinary cancellation, and avoid an unsafe password downgrade.

```plantuml
@startuml
participant Browser
participant "WebAuthn Verifier" as Verifier
database "Credential Store" as Store
participant "Risk Engine" as Risk
participant "Security Monitor" as Monitor

Browser -> Verifier: Submit authentication result
Verifier -> Verifier: Parse response and locate ceremony
alt Challenge, origin, or RP ID binding fails
  Verifier -> Monitor: Record cross-origin or replay indicators
  Verifier --> Browser: Generic failure; consume ceremony
else Credential is unknown or signature fails
  Verifier -> Risk: Add failed-attempt signal
  Verifier --> Browser: Generic failure; no fallback session
else Assertion is cryptographically valid
  Verifier -> Store: Compare supported signature counter
  alt Counter advances or is unsupported
    Store -> Store: Update metadata when applicable
    Store --> Verifier: Accept
    Verifier --> Browser: Continue to risk-based session decision
  else Nonzero counter regresses
    Store --> Verifier: Possible cloned authenticator
    Verifier -> Risk: Require independent credential proof
    Verifier -> Monitor: Open credential-compromise event
    Verifier --> Browser: Restricted response; no normal session
  end
else User cancels or authenticator times out
  Verifier --> Browser: End ceremony without a security incident
end
@enduml
```
