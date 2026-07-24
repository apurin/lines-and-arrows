# Streaming File I/O

## 1. Backpressured upload pipeline

Shows how a bounded upload pipeline advances only when downstream capacity becomes available.

```plantuml
@startuml
actor Client
participant "Upload API" as API
queue "Bounded Buffer" as Buffer
database Storage

Client -> API: Begin upload(metadata)
API --> Client: uploadId
loop Each input chunk
  Client -> API: Send chunk
  API -> Buffer: Enqueue chunk
  alt Buffer below high-water mark
    Buffer -> Storage: Write chunk
    Storage --> Buffer: Write complete
    Buffer --> API: Capacity available
    API --> Client: Request next chunk
  else Buffer full
    API --> Client: Pause reads
    Buffer -> Storage: Drain queued chunk
    Storage --> Buffer: Write complete
    Buffer --> API: Low-water mark reached
    API --> Client: Resume reads
  end
end
API -> Storage: Finalize object
Storage --> API: Object reference
API --> Client: Upload complete
@enduml
```

## 2. Demand-driven download

Illustrates a download that reads from storage only in response to transport demand.

```plantuml
@startuml
actor Client
participant "Download API" as API
database Storage

Client -> API: GET file
API -> Storage: Open read handle
Storage --> API: handle, size, ETag
API --> Client: 200 OK(size, ETag)
loop Until end of file
  Client -> API: Transport window available
  API -> Storage: Read next chunk
  Storage --> API: bytes
  API --> Client: Stream bytes
end
API -> Storage: Close handle
API --> Client: End stream
@enduml
```

## 3. High- and low-water buffering

Makes buffer watermarks and producer suspension explicit during a temporary storage slowdown.

```plantuml
@startuml
participant Producer
queue "Byte Buffer" as Buffer
database "Slow Storage" as Storage

loop Producer is faster than storage
  Producer -> Buffer: Offer chunk
  Buffer -> Storage: Write available bytes
  Storage --> Buffer: Delayed completion
end
Buffer --> Producer: Suspend at high-water mark
loop Drain buffered chunks
  Buffer -> Storage: Write chunk
  Storage --> Buffer: Write complete
end
Buffer --> Producer: Resume at low-water mark
Producer -> Buffer: Offer next chunk
@enduml
```

## 4. Incremental checksum and atomic commit

Shows checksum calculation during streaming and publication only after end-to-end validation.

```plantuml
@startuml
actor Client
participant "Upload API" as API
participant "Hash State" as Hash
database "Staging Storage" as Storage

Client -> API: Begin(expected digest)
API -> Storage: Create temporary object
loop Each chunk
  Client -> API: Chunk(bytes)
  par Update digest
    API -> Hash: Add bytes
  else Persist bytes
    API -> Storage: Append bytes
    Storage --> API: Written
  end
end
Client -> API: Finish
API -> Hash: Final digest
Hash --> API: actual digest
alt Digest matches
  API -> Storage: Commit temporary object
  Storage --> API: Committed
  API --> Client: Success
else Digest differs
  API -> Storage: Delete temporary object
  API --> Client: Checksum mismatch
end
@enduml
```

## 5. Idempotent chunk retry

Demonstrates safe recovery from an ambiguous response by identifying each chunk and deduplicating retries.

```plantuml
@startuml
actor Client
participant "Upload API" as API
database Storage

Client -> API: PUT chunk(uploadId, index, digest)
API -> Storage: Store chunk if absent
Storage --> API: Stored
API -x Client: Ack lost
Client -> API: Retry same chunk(uploadId, index, digest)
API -> Storage: Look up chunk index
Storage --> API: Existing digest
alt Same digest
  API --> Client: Already stored
else Different digest
  API --> Client: 409 Chunk conflict
end
Client -> API: Complete upload(manifest)
API -> Storage: Assemble unique chunks
Storage --> API: Object committed
API --> Client: Complete
@enduml
```

## 6. Cancellation propagation and cleanup

Traces client cancellation through active I/O and removal of incomplete upload state.

```plantuml
@startuml
actor Client
participant "Upload API" as API
database Storage
participant "Upload Registry" as Registry

Client -> API: Stream chunk
API -> Storage: Async write
Client -> API: Cancel upload
API -> API: Stop accepting chunks
API -> Storage: Cancel pending write
Storage --> API: Write cancelled / settled
API -> Storage: Close temporary handle
API -> Storage: Delete partial object
Storage --> API: Cleanup complete
API -> Registry: Mark cancelled
API --> Client: Cancellation acknowledged
@enduml
```

## 7. Partial writes and durable finalization

Captures the storage loop required for short writes and the durability boundary before success is reported.

```plantuml
@startuml
participant "Upload Worker" as Worker
database "File System" as FS

Worker -> FS: Open temporary file
loop Until chunk fully written
  Worker -> FS: write(remaining bytes)
  FS --> Worker: n bytes written
  Worker -> Worker: Advance offset by n
end
Worker -> FS: fsync(file)
FS --> Worker: File durable
Worker -> FS: Rename temp to final
FS --> Worker: Renamed
Worker -> FS: fsync(parent directory)
FS --> Worker: Name durable
Worker --> Worker: Report committed
@enduml
```

## 8. Resumable download after interruption

Shows how a client resumes from the last verified offset while guarding against object replacement.

```plantuml
@startuml
actor Client
participant "Download API" as API
database Storage

Client -> API: GET file
API -> Storage: Read from offset 0
Storage --> API: chunks, ETag v1
API --> Client: Bytes 0..N, ETag v1
API -x Client: Connection interrupted
Client -> Client: Verify received chunks
Client -> API: GET Range N+1-, If-Match v1
API -> Storage: Open file if ETag is v1
alt Object unchanged
  Storage --> API: Remaining chunks
  API --> Client: 206 Partial Content
else Object replaced
  Storage --> API: ETag v2
  API --> Client: 412 Precondition Failed
  Client -> Client: Discard or restart partial file
end
@enduml
```

## 9. Concurrent chunks and ordered assembly

Explains how parallel chunk arrival is validated independently before deterministic assembly.

```plantuml
@startuml
actor Client
participant "Upload API" as API
database "Chunk Store" as Chunks
participant Assembler

par Chunk 2 arrives
  Client -> API: Chunk 2(bytes, digest2)
  API -> API: Verify digest2
  API -> Chunks: Store(uploadId, 2)
else Chunk 0 arrives
  Client -> API: Chunk 0(bytes, digest0)
  API -> API: Verify digest0
  API -> Chunks: Store(uploadId, 0)
else Chunk 1 arrives
  Client -> API: Chunk 1(bytes, digest1)
  API -> API: Verify digest1
  API -> Chunks: Store(uploadId, 1)
end
Client -> API: Complete(manifest 0,1,2)
API -> Chunks: Confirm all indexes and digests
Chunks --> API: Manifest valid
API -> Assembler: Assemble in index order
Assembler --> API: Final object
API --> Client: Upload complete
@enduml
```

## 10. Slow-consumer timeout

Shows backpressure stopping storage reads and a timeout closing resources when a downloader remains stalled.

```plantuml
@startuml
actor "Slow Client" as Client
participant "Download API" as API
queue "Send Buffer" as Buffer
database Storage

API -> Storage: Read chunk
Storage --> API: bytes
API -> Buffer: Enqueue bytes
Buffer --> API: High-water mark reached
API -> Storage: Pause reads
API -> API: Start stall timer
alt Client drains before deadline
  Client -> Buffer: Consume bytes
  Buffer --> API: Low-water mark reached
  API -> API: Cancel stall timer
  API -> Storage: Resume reads
else Stall deadline expires
  API -> Buffer: Abort pending send
  API -> Storage: Close read handle
  API --> Client: Terminate stream
end
@enduml
```
