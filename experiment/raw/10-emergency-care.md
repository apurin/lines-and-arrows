# Emergency Care

## 1. Pre-arrival notification and team readiness

Shows how an ambulance alert lets the emergency department prepare the right people and resources before a high-acuity patient arrives.

```plantuml
@startuml
participant "EMS Crew" as EMS
participant "ED Coordinator" as Coordinator
participant "Emergency Clinician" as Clinician
participant "Response Team" as Team
participant "Treatment Bay" as Bay

EMS -> Coordinator: Report condition, vital signs, interventions, and ETA
Coordinator -> Clinician: Relay structured pre-arrival alert
Clinician -> Clinician: Assess likely time-critical pathway
alt Specialty activation indicated
  Clinician -> Team: Activate pathway with expected arrival time
  Team --> Coordinator: Confirm roles and readiness
else Standard emergency reception
  Clinician --> Coordinator: Assign ED assessment team
end
Coordinator -> Bay: Reserve space and request equipment
Bay --> Coordinator: Bay ready
EMS -> Coordinator: Announce arrival
Coordinator --> EMS: Direct patient to prepared bay
@enduml
```

## 2. Triage, prioritization, and waiting-room reassessment

Illustrates how initial risk determines placement while repeated observations detect patients who worsen before a clinician is available.

```plantuml
@startuml
actor Patient
participant "Triage Nurse" as Triage
participant "Triage Protocol" as Protocol
participant "ED Queue" as Queue
participant "Emergency Clinician" as Clinician

Patient -> Triage: Present complaint and relevant history
Triage -> Patient: Obtain vital signs and focused risk screen
Triage -> Protocol: Submit findings and red flags
Protocol --> Triage: Acuity category and required precautions
alt Immediate threat identified
  Triage -> Clinician: Request immediate bedside assessment
  Clinician --> Triage: Move patient to resuscitation area
else Stable for prioritized queue
  Triage -> Queue: Enqueue with acuity and arrival time
  loop Until care space is assigned
    Triage -> Patient: Reassess symptoms and vital signs
    alt New red flag or deterioration
      Triage -> Protocol: Update findings
      Protocol --> Queue: Raise priority
    else Condition unchanged
      Triage -> Queue: Record reassessment
    end
  end
  Queue -> Clinician: Assign next patient by clinical priority
end
@enduml
```

## 3. Primary survey and coordinated resuscitation

Depicts a team leader coordinating parallel airway, breathing, circulation, and bedside assessment work through repeated stabilization cycles.

```plantuml
@startuml
participant "Team Leader" as Lead
participant "Airway Clinician" as Airway
participant "Bedside Nurse" as Nurse
participant "Procedure Clinician" as Procedure
participant "Point-of-Care Testing" as POC

Lead -> Lead: Perform rapid primary survey
par Airway and breathing
  Lead -> Airway: Assess airway and ventilation
  Airway --> Lead: Findings and response to support
else Circulation
  Lead -> Nurse: Establish access and begin indicated support
  Nurse --> Lead: Hemodynamics and treatment response
else Immediate causes
  Lead -> Procedure: Perform focused examination
  Procedure -> POC: Request bedside tests or imaging
  POC --> Procedure: Immediate findings
  Procedure --> Lead: Reversible cause assessment
end
Lead -> Lead: Integrate findings and set priorities
loop Until stabilized or transferred
  Lead -> Airway: Reassess airway and breathing
  Lead -> Nurse: Repeat vital signs and response checks
  Nurse --> Lead: Updated status
  alt Instability persists
    Lead -> Procedure: Escalate intervention
  else Physiologic goals reached
    Lead -> Lead: Proceed to secondary survey
  end
end
@enduml
```

## 4. Hypothesis-driven diagnostic workup

Shows tests being selected from a working differential, results arriving asynchronously, and critical findings changing the diagnostic plan immediately.

```plantuml
@startuml
participant "Emergency Clinician" as Clinician
participant EHR
participant Laboratory as Lab
participant Radiology
participant "Consulting Service" as Consultant

Clinician -> EHR: Record history, examination, and differential
par Laboratory evaluation
  Clinician -> Lab: Order targeted specimens
  Lab --> EHR: Routine results
else Imaging evaluation
  Clinician -> Radiology: Order study with clinical question
  Radiology --> EHR: Preliminary interpretation
end
alt Critical result identified
  Lab -> Clinician: Direct critical-value notification
  Clinician --> Lab: Read back result
else Time-critical imaging finding
  Radiology -> Clinician: Direct verbal report
  Clinician --> Radiology: Confirm finding received
end
Clinician -> EHR: Reconcile results with differential
alt Diagnosis or pathway is clear
  Clinician -> Consultant: Request targeted input or definitive care
  Consultant --> Clinician: Recommendations and urgency
else Important uncertainty remains
  Clinician -> EHR: Order next discriminating test
end
@enduml
```

## 5. Closed-loop medication treatment

Tracks an emergency medication from order through safety checks, administration, effect assessment, and response to an adverse reaction.

```plantuml
@startuml
participant "Emergency Clinician" as Clinician
participant "Order System" as Orders
participant Pharmacist
participant "Bedside Nurse" as Nurse
actor Patient

Clinician -> Orders: Enter medication, indication, dose, and route
Orders -> Orders: Check allergies, interactions, and dose limits
alt Safety alert requires resolution
  Orders --> Clinician: Block or warn with reason
  Clinician -> Orders: Modify order or document justified override
end
Orders -> Pharmacist: Queue order for verification
alt Immediate emergency administration
  Clinician -> Nurse: Give verbal emergency order
  Nurse --> Clinician: Read back drug, dose, and route
  Clinician -> Orders: Enter and reconcile order promptly
else Standard verification
  Pharmacist -> Orders: Verify or clarify order
  Orders --> Nurse: Release verified medication
end
Nurse -> Patient: Confirm identity and administer medication
Nurse -> Patient: Monitor effect and adverse signs
alt Expected response
  Nurse -> Orders: Document administration and response
else Adverse reaction or inadequate response
  Nurse -> Clinician: Escalate findings immediately
  Clinician -> Orders: Stop, reverse, or adjust treatment
end
@enduml
```

## 6. Time-critical stroke pathway

Highlights the compressed coordination required to establish timing, exclude hemorrhage, judge reperfusion eligibility, and avoid delay in definitive care.

```plantuml
@startuml
participant "ED Clinician" as ED
participant "Stroke Team" as Stroke
participant Radiology
participant Laboratory as Lab
participant "Treatment Nurse" as Nurse
participant "Transfer Center" as Transfer

ED -> Stroke: Activate stroke pathway with last-known-well time
par Neurologic assessment
  Stroke -> Stroke: Quantify deficit and baseline function
else Immediate imaging
  ED -> Radiology: Request emergency brain and vessel imaging
  Radiology --> Stroke: Hemorrhage and vessel findings
else Essential tests
  ED -> Lab: Request tests that affect treatment eligibility
  Lab --> Stroke: Available eligibility-relevant results
end
Stroke -> Stroke: Balance diagnosis, timing, contraindications, and goals
alt Hemorrhage identified
  Stroke -> Nurse: Start hemorrhage-specific pathway
else Eligible for immediate reperfusion
  Stroke -> Nurse: Authorize protocol-directed treatment
  Nurse --> Stroke: Treatment started and monitoring active
else Large-vessel therapy requires another center
  Stroke -> Transfer: Request accepting specialist and transport
  Transfer --> ED: Destination and departure plan
else Reperfusion not appropriate
  Stroke -> ED: Recommend supportive care and further evaluation
end
@enduml
```

## 7. Continuous monitoring and deterioration escalation

Explains how bedside observations become a validated alert, rapid intervention, and escalation to critical care when a patient deteriorates.

```plantuml
@startuml
participant Monitor
participant "Bedside Nurse" as Nurse
participant "Emergency Clinician" as Clinician
participant "Resuscitation Team" as Response
participant "Critical Care" as ICU

loop While patient remains under emergency observation
  Monitor -> Nurse: Stream vital signs and alarms
  Nurse -> Nurse: Validate signal and assess patient
  alt Artifact or transient change
    Nurse -> Monitor: Correct sensor and record reassessment
  else Clinically significant deterioration
    Nurse -> Clinician: Escalate trend, symptoms, and current support
    Clinician -> Clinician: Reassess cause and severity
    alt Immediate life threat
      Clinician -> Response: Activate emergency response
      Response -> Response: Stabilize airway, breathing, and circulation
      Response --> Clinician: Intervention response
    else Urgent but currently compensated
      Clinician -> Nurse: Increase monitoring and start treatment
    end
    alt Needs ongoing organ support
      Clinician -> ICU: Request critical-care review
      ICU --> Clinician: Accept transfer and specify readiness needs
    else Stabilized in ED
      Clinician -> Nurse: Continue observation plan
    end
  end
end
@enduml
```

## 8. Consultation and disposition coordination

Shows how the emergency team obtains specialist input, resolves disagreement, and coordinates the level and location of ongoing care.

```plantuml
@startuml
participant "ED Clinician" as ED
participant "Consulting Clinician" as Consultant
participant "Bed Management" as Beds
participant "Senior Decision Maker" as Senior
participant EHR

ED -> Consultant: Send focused question, findings, and urgency
Consultant -> EHR: Review record, tests, and treatment response
Consultant -> ED: Assess patient and recommend disposition
alt Safe for outpatient management
  ED -> EHR: Document discharge criteria and follow-up needs
else Observation is appropriate
  Consultant -> Beds: Request observation placement
  Beds --> ED: Placement and responsible service
else Inpatient care is required
  Consultant -> Beds: Request specialty bed and care level
  Beds --> ED: Bed status and expected delay
end
opt Team disagreement about risk or ownership
  ED -> Senior: Escalate unresolved disposition concern
  Senior -> Consultant: Conduct joint review
  Consultant --> ED: Confirm accountable service and plan
end
ED -> EHR: Record final disposition, rationale, and contingencies
@enduml
```

## 9. Safe discharge and follow-up

Details the checks, reconciliation, teach-back, safety net, and pending-result ownership needed before a patient leaves emergency care.

```plantuml
@startuml
participant "Emergency Clinician" as Clinician
participant "Discharge Nurse" as Nurse
actor Patient
participant Pharmacy
participant "Follow-up Service" as FollowUp
participant "Results Queue" as Results

Clinician -> Clinician: Confirm stability and discharge criteria
Clinician -> Pharmacy: Reconcile medicines and send prescriptions
Pharmacy --> Clinician: Confirm or clarify medication plan
Clinician -> FollowUp: Request required review or referral
FollowUp --> Clinician: Appointment or access instructions
Clinician -> Results: Assign owner for outstanding results
Clinician -> Nurse: Provide diagnosis, plan, and return precautions
Nurse -> Patient: Explain care, medicines, follow-up, and warning signs
Patient --> Nurse: Teach back key actions in own words
alt Understanding or access gap found
  Nurse -> Clinician: Request revised plan or added support
  Clinician --> Patient: Resolve barrier and restate plan
else Plan understood and feasible
  Nurse -> Patient: Provide written instructions and contact route
end
Nurse -> Clinician: Confirm discharge completed
@enduml
```

## 10. Admission transfer and clinical handoff

Models a structured handoff that establishes shared understanding, explicit task ownership, and continuity during transfer from the ED to an inpatient unit.

```plantuml
@startuml
participant "ED Clinician" as ED
participant "Receiving Clinician" as Receiver
participant "ED Nurse" as EDNurse
participant "Unit Nurse" as UnitNurse
participant "Transport Team" as Transport
participant EHR

ED -> Receiver: Handoff situation, background, assessment, recommendation
Receiver -> ED: Ask questions and read back critical risks
ED -> EHR: Reconcile diagnosis, medicines, orders, and code status
critical Transfer responsibility explicitly
  ED -> Receiver: Identify pending results and unfinished actions
  Receiver --> ED: Accept care and name each task owner
end
EDNurse -> UnitNurse: Handoff observations, access, treatments, and precautions
UnitNurse --> EDNurse: Confirm monitoring and immediate priorities
alt Patient stable for routine transport
  EDNurse -> Transport: Release patient with records and belongings
else Patient needs monitored transfer
  ED -> Transport: Specify escort, equipment, and contingency plan
end
Transport -> UnitNurse: Deliver patient and transfer equipment
UnitNurse -> Receiver: Confirm arrival and perform joint safety check
Receiver -> EHR: Acknowledge admission and pending work
@enduml
```
