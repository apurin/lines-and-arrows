# Scientific DNA Sequencing Experiment

## 1. Sample accession and chain of custody

Shows how a collected specimen becomes a traceable study sample or is rejected before laboratory work begins.

```plantuml
@startuml
actor "Study Investigator" as Investigator
participant "Collection Site" as Site
participant LIMS
database Biobank

Investigator -> LIMS: Register subject and collection plan
LIMS --> Investigator: Subject ID and sample labels
Investigator -> Site: Collect specimen with labeled tube
Site -> LIMS: Scan label and record collection metadata
LIMS -> LIMS: Check consent, identity, and timing
alt Accession criteria met
  Site -> Biobank: Transfer specimen under required conditions
  Biobank -> LIMS: Record receipt, location, and temperature log
  LIMS --> Investigator: Sample accessioned
else Identity or handling discrepancy
  LIMS --> Site: Quarantine specimen and request resolution
  Site --> Investigator: Report recollection requirement
end
@enduml
```

## 2. DNA extraction with process controls

Tracks study specimens and controls through extraction, quantification, and the decision to proceed or repeat.

```plantuml
@startuml
participant "Lab Technician" as Tech
participant "Extraction Workstation" as Extractor
participant "QC Station" as QC
participant LIMS

Tech -> LIMS: Select extraction batch
LIMS --> Tech: Specimens and control requirements
par Study specimens
  Tech -> Extractor: Load specimens
else Negative extraction control
  Tech -> Extractor: Load blank control
else Positive process control
  Tech -> Extractor: Load reference material
end
Extractor -> Extractor: Lyse, bind, wash, and elute DNA
Extractor --> Tech: Extracted DNA and controls
Tech -> QC: Measure concentration, purity, and integrity
QC --> LIMS: Per-sample metrics and control results
alt Controls pass and DNA meets thresholds
  LIMS --> Tech: Release extracts for library preparation
else Recoverable yield or purity failure
  LIMS --> Tech: Repeat extraction or cleanup
else Control failure
  LIMS --> Tech: Invalidate and investigate entire batch
end
@enduml
```

## 3. Library construction and index assignment

Explains how DNA is converted into sequenceable libraries while preventing index collisions and retaining per-sample provenance.

```plantuml
@startuml
participant "Library Technician" as Tech
participant "Index Registry" as Indexes
participant "Library Workstation" as Prep
participant "Fragment Analyzer" as Analyzer
participant LIMS

loop Each released DNA extract
  Tech -> Indexes: Request unique dual index
  critical Reserve index pair
    Indexes -> Indexes: Check planned pools for collisions
    Indexes --> Tech: Reserved i7 and i5 indexes
  end
  Tech -> Prep: Fragment DNA and repair ends
  Prep -> Prep: Ligate indexed adapters and amplify
  Prep --> Tech: Indexed library
  Tech -> Analyzer: Measure size distribution and concentration
  Analyzer --> LIMS: Library QC metrics
  alt Library passes specification
    LIMS -> Indexes: Confirm index-to-sample mapping
  else Library fails specification
    LIMS --> Tech: Rebuild library from retained DNA
    LIMS -> Indexes: Release unused index reservation
  end
end
@enduml
```

## 4. Normalization, pooling, and flow-cell loading

Shows how accepted libraries are balanced into a pool, checked against the run manifest, and loaded at the intended concentration.

```plantuml
@startuml
participant LIMS
participant "Pooling Technician" as Tech
participant "Molarity Calculator" as Calculator
participant "QC Station" as QC
participant "Sequencer" as Instrument

LIMS -> Calculator: Send library concentrations, sizes, and targets
Calculator -> Calculator: Compute equimolar contributions
Calculator --> Tech: Pooling volumes and index-balance warning
alt Index diversity is sufficient
  Tech -> Tech: Combine and mix libraries
else Index diversity is insufficient
  Tech -> Tech: Rebalance libraries or add control library
end
Tech -> QC: Quantify completed pool
QC --> Tech: Pool molarity
Tech -> LIMS: Confirm actual composition and molarity
LIMS --> Tech: Signed run manifest
Tech -> Instrument: Load denatured pool and run consumables
Instrument -> LIMS: Scan flow cell, reagents, and manifest
alt Scans and loading checks agree
  Instrument --> Tech: Run ready
else Mismatch detected
  Instrument --> Tech: Block run setup for correction
end
@enduml
```

## 5. Sequencing cycle and live run monitoring

Details the repeated chemistry, imaging, base-calling, and live-quality decision inside an instrument run.

```plantuml
@startuml
participant "Run Operator" as Operator
participant "Instrument Controller" as Controller
participant Fluidics
participant Optics
participant "Real-time Base Caller" as BaseCaller
database "Run Store" as Store

Operator -> Controller: Start approved run
loop Each sequencing cycle
  Controller -> Fluidics: Incorporate labeled nucleotides
  Fluidics --> Controller: Cycle chemistry complete
  Controller -> Optics: Image all tiles
  Optics --> BaseCaller: Fluorescence intensities
  BaseCaller -> BaseCaller: Call bases and assign quality scores
  BaseCaller -> Store: Append calls, qualities, and cycle metrics
  BaseCaller --> Controller: Yield and quality summary
  break Sustained metrics breach stop limits
    Controller --> Operator: Request abort decision with diagnostics
    Operator -> Controller: Abort run
  end
end
Controller -> Store: Finalize run metadata and checksums
Controller --> Operator: Run complete or aborted
@enduml
```

## 6. Demultiplexing and read-file delivery

Illustrates how instrument output is assigned to samples, quarantined when indexes are ambiguous, and delivered as verified read files.

```plantuml
@startuml
database "Run Store" as RunStore
participant "Demultiplexer" as Demux
database "Sample Sheet Registry" as Registry
database "Read Repository" as Reads
participant LIMS

Demux -> RunStore: Read base calls and run metadata
Demux -> Registry: Fetch signed sample sheet
Registry --> Demux: Expected dual indexes and sample IDs
loop Each read cluster
  Demux -> Demux: Match observed index pair
  alt Unique valid sample match
    Demux -> Reads: Append read to sample FASTQ
  else Index quality too low or no match
    Demux -> Reads: Append read to Undetermined FASTQ
  else Conflicting or forbidden index pair
    Demux -> Reads: Quarantine read for index-hopping review
  end
end
Demux -> Reads: Close files and write checksums
Demux -> LIMS: Report per-sample yield and index counts
LIMS --> Demux: Delivery accepted
@enduml
```

## 7. Quality-control and contamination triage

Combines independent read, alignment, and control checks into a clear pass, review, or batch-failure decision.

```plantuml
@startuml
participant "QC Orchestrator" as QC
participant "Read Metrics" as ReadQC
participant "Reference Aligner" as Aligner
participant "Contamination Estimator" as Contam
database LIMS
actor "QC Reviewer" as Reviewer

QC -> LIMS: Fetch reads, sample metadata, and control identities
par Raw-read assessment
  QC -> ReadQC: Compute yield, quality, adapters, and duplication
  ReadQC --> QC: Read metrics
else Mapping assessment
  QC -> Aligner: Align representative reads
  Aligner --> QC: Mapping, coverage, and insert metrics
else Contamination assessment
  QC -> Contam: Compare genotypes and control profiles
  Contam --> QC: Mixture and sample-swap estimates
end
QC -> Reviewer: Present metrics with predefined thresholds
alt All release criteria pass
  Reviewer -> LIMS: Mark samples analysis-ready
else Isolated sample anomaly
  Reviewer -> LIMS: Quarantine sample and request repeat
else Negative control or batch-wide anomaly
  Reviewer -> LIMS: Hold batch and open contamination investigation
end
@enduml
```

## 8. Reproducible sequence analysis

Shows a workflow engine pinning inputs and references, executing sample-level analysis, and preserving an auditable result bundle.

```plantuml
@startuml
actor "Bioinformatician" as Analyst
participant "Workflow Engine" as Workflow
database "Reference Registry" as References
participant Aligner
participant "Variant Caller" as Caller
participant Annotator
database "Artifact Store" as Artifacts

Analyst -> Workflow: Launch approved workflow(version, sample set)
Workflow -> References: Resolve pinned genome, indexes, and annotations
References --> Workflow: Immutable references and checksums
loop Each analysis-ready sample
  Workflow -> Aligner: Align reads to pinned genome
  Aligner --> Workflow: Sorted alignments and metrics
  Workflow -> Caller: Call variants from alignments
  Caller --> Workflow: Variants and confidence values
  Workflow -> Annotator: Annotate accepted variants
  Annotator --> Workflow: Annotated result table
end
Workflow -> Artifacts: Store outputs, logs, parameters, and checksums
Artifacts --> Workflow: Versioned result bundle ID
Workflow --> Analyst: Completion summary and bundle ID
@enduml
```

## 9. Replication and discordance resolution

Captures independent biological replicates, selective technical repeats, and the investigation required before combining evidence.

```plantuml
@startuml
actor "Study Designer" as Designer
participant LIMS
participant "Wet Lab" as Lab
participant Sequencer
participant "Analysis Workflow" as Analysis
actor Statistician

Designer -> LIMS: Register biological replicates and blocking factors
LIMS -> Lab: Randomized, blinded batch assignments
par Independent replicate A
  Lab -> Sequencer: Extract, prepare, and sequence replicate A
  Sequencer --> Analysis: Reads and run metadata A
else Independent replicate B
  Lab -> Sequencer: Extract, prepare, and sequence replicate B
  Sequencer --> Analysis: Reads and run metadata B
end
Analysis -> Statistician: Replicate-level estimates and QC
Statistician -> Statistician: Test concordance and batch effects
alt Replicates are concordant
  Statistician -> LIMS: Approve combined model
else Technical failure explains discordance
  Statistician -> LIMS: Request repeat from retained material
  LIMS -> Lab: Create technical replicate in a new batch
  Lab -> Sequencer: Repeat library and sequencing
  Sequencer --> Analysis: Replacement reads and metadata
else Biological heterogeneity remains
  Statistician -> LIMS: Preserve separate estimates and flag limitation
end
@enduml
```

## 10. Scientific result review and release

Shows independent review of analytical evidence, revision loops, and controlled release of a traceable result package.

```plantuml
@startuml
actor "Primary Analyst" as Analyst
database "Artifact Store" as Artifacts
actor "Independent Reviewer" as Reviewer
actor "Scientific Lead" as Lead
participant LIMS
database Archive

Analyst -> Artifacts: Submit result bundle and interpretation draft
Artifacts --> Reviewer: Provide inputs, provenance, QC, and outputs
Reviewer -> Reviewer: Reproduce key summaries and inspect exclusions
alt Methods and evidence support conclusions
  Reviewer -> Lead: Recommend approval with review record
else Correctable analysis or interpretation issue
  Reviewer --> Analyst: Request revision with specific findings
  Analyst -> Artifacts: Submit revised version
  Artifacts --> Reviewer: Provide version diff and rerun evidence
  Reviewer -> Lead: Recommend approval or rejection
else Invalid experiment or unresolved bias
  Reviewer -> Lead: Recommend rejection and documented limitations
end
Lead -> LIMS: Record final scientific decision
alt Approved for release
  LIMS -> Archive: Freeze signed report, data links, and audit trail
  Archive --> Analyst: Persistent release identifier
else Not approved
  LIMS --> Analyst: Return decision and required next action
end
@enduml
```
