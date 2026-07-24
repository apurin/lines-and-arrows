# Collaborative editor class and object interactions

## 1. Command dispatch and local change publication

Intent: Trace a keystroke from command lookup through a durable model mutation and incremental view update.

```plantuml
@startuml
actor User
boundary EditorView
control CommandRegistry
control InsertTextCommand
entity DocumentModel
database ChangeJournal
control ModelEventBus

User -> EditorView: type(text)
EditorView -> CommandRegistry: resolve("insertText", context)
CommandRegistry --> EditorView: InsertTextCommand
EditorView -> InsertTextCommand: execute(selection, text)
activate InsertTextCommand
InsertTextCommand -> DocumentModel: apply(InsertText)
DocumentModel --> InsertTextCommand: ChangeSet(newVersion, affectedRange)
InsertTextCommand -> ChangeJournal: append(ChangeSet)
ChangeJournal --> InsertTextCommand: durable
InsertTextCommand -> ModelEventBus: publish(ModelChanged)
ModelEventBus -> EditorView: update(affectedRange)
InsertTextCommand --> EditorView: CommandResult
deactivate InsertTextCommand
@enduml
```

## 2. Atomic multi-range formatting command

Intent: Show how one command validates and applies several mutations as a single transaction or rolls them all back.

```plantuml
@startuml
actor User
boundary Toolbar
control FormatCommand
control TransactionManager
participant "ModelTransaction" as Tx
entity DocumentModel
control SchemaValidator
database ChangeJournal

User -> Toolbar: choose Bold
Toolbar -> FormatCommand: execute(selectedRanges)
FormatCommand -> TransactionManager: begin(DocumentModel)
TransactionManager --> FormatCommand: Tx
loop each selected range
  FormatCommand -> Tx: setMark(range, bold)
end
Tx -> SchemaValidator: validate(candidateDocument)
alt candidate is valid
  SchemaValidator --> Tx: valid
  Tx -> DocumentModel: commit()
  DocumentModel --> Tx: ChangeSet
  Tx -> ChangeJournal: append(ChangeSet)
  Tx --> FormatCommand: committed
else candidate violates schema
  SchemaValidator --> Tx: violations
  Tx -> Tx: rollback()
  Tx --> FormatCommand: rejected(violations)
end
FormatCommand --> Toolbar: result
@enduml
```

## 3. Selective undo in the presence of remote edits

Intent: Undo the current user's latest command by transforming its inverse over intervening remote operations instead of rewinding the whole document.

```plantuml
@startuml
actor User
boundary EditorView
control UndoCommand
control HistoryManager
control OperationTransformer
entity DocumentModel
control SyncClient

User -> EditorView: Undo
EditorView -> UndoCommand: execute()
UndoCommand -> HistoryManager: latestUndoable(localAuthor)
HistoryManager --> UndoCommand: entry(inverse, baseVersion)
UndoCommand -> DocumentModel: operationsSince(baseVersion)
DocumentModel --> UndoCommand: interveningOps
UndoCommand -> OperationTransformer: transform(inverse, interveningOps)
OperationTransformer --> UndoCommand: transformedInverse
alt inverse still has an effect
  UndoCommand -> DocumentModel: apply(transformedInverse)
  DocumentModel --> UndoCommand: undoChange
  UndoCommand -> HistoryManager: moveToRedo(entry, undoChange)
  UndoCommand -> SyncClient: enqueue(undoChange)
  UndoCommand --> EditorView: undone
else target content no longer exists
  UndoCommand -> HistoryManager: markObsolete(entry)
  UndoCommand --> EditorView: nothingToUndo
end
@enduml
```

## 4. Version-aware autosave

Intent: Persist a stable snapshot without clearing the dirty flag when newer edits arrive during the save.

```plantuml
@startuml
participant ModelEventBus
control AutosaveScheduler
entity DocumentModel
control SnapshotSerializer
database DocumentStore

ModelEventBus -> AutosaveScheduler: ModelChanged(version 41)
AutosaveScheduler -> AutosaveScheduler: debounce()
AutosaveScheduler -> DocumentModel: captureSnapshot()
DocumentModel --> AutosaveScheduler: snapshot(version 41)
AutosaveScheduler -> SnapshotSerializer: serialize(snapshot)
SnapshotSerializer --> AutosaveScheduler: bytes
AutosaveScheduler -> DocumentStore: writeTemporary(bytes, version 41)
DocumentStore -> DocumentStore: fsync and atomicReplace
DocumentStore --> AutosaveScheduler: saved(version 41)
AutosaveScheduler -> DocumentModel: currentVersion()
alt current version is 41
  DocumentModel --> AutosaveScheduler: 41
  AutosaveScheduler -> DocumentModel: markClean(throughVersion 41)
else edits arrived while saving
  DocumentModel --> AutosaveScheduler: version 42+
  AutosaveScheduler -> AutosaveScheduler: scheduleNextSave()
end
@enduml
```

## 5. Document opening and crash recovery

Intent: Reconstruct a valid current model from a stored snapshot plus journal entries, migrating old data before exposure to the editor.

```plantuml
@startuml
actor User
boundary WorkspaceController
control DocumentRepository
database DocumentStore
control SchemaMigrator
control JournalReplayer
entity DocumentModel
control SyncClient

User -> WorkspaceController: open(documentId)
WorkspaceController -> DocumentRepository: load(documentId)
DocumentRepository -> DocumentStore: readLatestSnapshot(documentId)
DocumentStore --> DocumentRepository: snapshot(schemaVersion, version)
opt snapshot uses an older schema
  DocumentRepository -> SchemaMigrator: migrate(snapshot)
  SchemaMigrator --> DocumentRepository: currentSnapshot
end
DocumentRepository -> DocumentStore: readJournal(after version)
DocumentStore --> DocumentRepository: orderedEntries
DocumentRepository -> JournalReplayer: replay(currentSnapshot, orderedEntries)
alt every entry is valid
  JournalReplayer --> DocumentRepository: recoveredState(headVersion)
  DocumentRepository -> DocumentModel: create(recoveredState)
  DocumentRepository --> WorkspaceController: DocumentModel
  WorkspaceController -> SyncClient: attach(documentId, headVersion)
else corrupt or incomplete tail
  JournalReplayer --> DocumentRepository: recoveredState(lastGoodVersion, warning)
  DocumentRepository --> WorkspaceController: DocumentModel in recovery mode
end
@enduml
```

## 6. Optimistic local synchronization

Intent: Apply a local operation immediately, then either confirm it at the server version or reconcile an authoritative rejection.

```plantuml
@startuml
actor User
boundary EditorView
control EditCommand
entity DocumentModel
queue PendingOutbox
control SyncClient
participant CollaborationServer
control Reconciler

User -> EditorView: edit
EditorView -> EditCommand: execute()
EditCommand -> DocumentModel: applyOptimistically(op, clientOpId)
DocumentModel --> EditCommand: localChange(baseVersion)
EditCommand -> PendingOutbox: enqueue(localChange)
EditCommand --> EditorView: rendered immediately
SyncClient -> PendingOutbox: nextUnsent()
PendingOutbox --> SyncClient: localChange
SyncClient -> CollaborationServer: submit(op, clientOpId, baseVersion)
alt server accepts
  CollaborationServer --> SyncClient: ack(clientOpId, serverVersion)
  SyncClient -> PendingOutbox: confirm(clientOpId, serverVersion)
  SyncClient -> DocumentModel: confirm(clientOpId, serverVersion)
else server rejects with authoritative delta
  CollaborationServer --> SyncClient: reject(clientOpId, delta, reason)
  SyncClient -> Reconciler: reconcile(pendingOps, delta)
  Reconciler -> DocumentModel: rollbackPending()
  Reconciler -> DocumentModel: apply(delta)
  Reconciler -> DocumentModel: reapply(validPendingOps)
  Reconciler -> PendingOutbox: replace(validPendingOps)
  Reconciler -> EditorView: reportRejectedEdit(reason)
end
@enduml
```

## 7. Causally ordered remote operation delivery

Intent: Buffer an out-of-order remote operation, then transform and apply it once its causal dependencies are available.

```plantuml
@startuml
participant CollaborationServer
control SyncClient
control CausalBuffer
queue PendingOutbox
control OperationTransformer
entity DocumentModel
control HistoryManager
boundary EditorView

CollaborationServer -> SyncClient: remoteOp(op, dependencies)
SyncClient -> CausalBuffer: offer(op, dependencies)
alt dependencies are missing
  CausalBuffer --> SyncClient: buffered(missingVersions)
  SyncClient -> CollaborationServer: requestMissing(missingVersions)
else operation is causally ready
  CausalBuffer --> SyncClient: ready(op)
  SyncClient -> PendingOutbox: unacknowledgedOps()
  PendingOutbox --> SyncClient: localPending
  SyncClient -> OperationTransformer: rebase(op, localPending)
  OperationTransformer --> SyncClient: remoteForModel, rebasedPending
  SyncClient -> DocumentModel: applyRemote(remoteForModel)
  SyncClient -> PendingOutbox: replace(rebasedPending)
  SyncClient -> HistoryManager: remapAnchors(remoteForModel)
  DocumentModel -> EditorView: ModelChanged(affectedRanges)
  SyncClient -> CollaborationServer: acknowledge(op.id)
end
@enduml
```

## 8. Offline editing and reconnection

Intent: Merge server changes first on reconnect, rebase durable offline operations, and surface only conflicts that cannot be represented automatically.

```plantuml
@startuml
actor User
control NetworkMonitor
control SyncClient
queue DurableOutbox
entity DocumentModel
participant CollaborationServer
control RebaseEngine
control ConflictRegistry

NetworkMonitor -> SyncClient: disconnected
User -> DocumentModel: edit offline
DocumentModel -> DurableOutbox: append(op, baseClock)
... connection restored ...
NetworkMonitor -> SyncClient: connected
SyncClient -> CollaborationServer: synchronize(documentId, localClock)
CollaborationServer --> SyncClient: missingServerOps, serverClock
SyncClient -> DurableOutbox: allPending()
DurableOutbox --> SyncClient: offlineOps
SyncClient -> RebaseEngine: merge(missingServerOps, offlineOps)
alt merge succeeds
  RebaseEngine --> SyncClient: mergedState, rebasedOps
  SyncClient -> DocumentModel: replaceWith(mergedState)
  SyncClient -> DurableOutbox: replace(rebasedOps)
  SyncClient -> CollaborationServer: submitBatch(rebasedOps, serverClock)
else semantic conflict remains
  RebaseEngine --> SyncClient: partialMerge, conflicts
  SyncClient -> DocumentModel: replaceWith(partialMerge)
  SyncClient -> ConflictRegistry: register(conflicts)
  SyncClient --> User: requestResolution(conflicts)
end
@enduml
```

## 9. Durable server commit before broadcast

Intent: Ensure collaborators observe an operation only after authorization, validation, and an atomic durable commit establish its server version.

```plantuml
@startuml
participant SendingClient
control SyncGateway
control AccessPolicy
control OperationValidator
control DocumentTransaction
database OperationLog
database VersionStore
queue DocumentChannel
participant OtherClients

SendingClient -> SyncGateway: submit(op, baseVersion)
SyncGateway -> AccessPolicy: mayEdit(user, documentId)
AccessPolicy --> SyncGateway: decision
alt user is authorized
  SyncGateway -> OperationValidator: validate(op, baseVersion)
  alt operation is valid
    OperationValidator --> SyncGateway: normalizedOp
    SyncGateway -> DocumentTransaction: begin(documentId)
    DocumentTransaction -> OperationLog: append(normalizedOp)
    DocumentTransaction -> VersionStore: advanceHead()
    VersionStore --> DocumentTransaction: serverVersion
    DocumentTransaction -> DocumentTransaction: commit()
    DocumentTransaction --> SyncGateway: committed(serverVersion)
    SyncGateway -> DocumentChannel: publish(op, serverVersion)
    DocumentChannel -> OtherClients: remoteOp(op, serverVersion)
    SyncGateway --> SendingClient: ack(op.id, serverVersion)
  else operation is invalid or stale
    OperationValidator --> SyncGateway: rejection
    SyncGateway --> SendingClient: reject(reason, currentVersion)
  end
else user is not authorized
  SyncGateway --> SendingClient: reject(forbidden)
end
@enduml
```

## 10. Concurrent-safe snapshot compaction

Intent: Compact an operation log at a captured version without deleting newer operations committed while the snapshot is being built.

```plantuml
@startuml
control CompactionScheduler
database VersionStore
database OperationLog
control SnapshotBuilder
database SnapshotStore
control RetentionManager

CompactionScheduler -> VersionStore: readHead(documentId)
VersionStore --> CompactionScheduler: compactThroughVersion
CompactionScheduler -> SnapshotStore: latestSnapshot(documentId)
SnapshotStore --> CompactionScheduler: baseSnapshot(baseVersion)
CompactionScheduler -> OperationLog: read(baseVersion + 1 .. compactThroughVersion)
OperationLog --> CompactionScheduler: operations
CompactionScheduler -> SnapshotBuilder: build(baseSnapshot, operations)
SnapshotBuilder --> CompactionScheduler: snapshot(compactThroughVersion)
CompactionScheduler -> SnapshotStore: putIfNewer(snapshot)
SnapshotStore --> CompactionScheduler: stored
CompactionScheduler -> VersionStore: readHead(documentId)
VersionStore --> CompactionScheduler: currentHead
alt newer edits were committed during compaction
  CompactionScheduler -> RetentionManager: deleteLog(through compactThroughVersion)
  note right of RetentionManager
    Operations after compactThroughVersion remain.
  end note
else head is unchanged
  CompactionScheduler -> RetentionManager: deleteLog(through currentHead)
end
RetentionManager --> CompactionScheduler: compacted
@enduml
```
