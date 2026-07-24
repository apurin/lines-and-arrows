# Multithreaded Task Scheduler

## 1. Normal task lifecycle

Intent: Show the happy path from submission through queueing, worker execution, and result delivery.

```plantuml
@startuml
actor Client
participant Scheduler
queue "Ready Queue" as Ready
participant Worker
participant Future

Client -> Scheduler: submit(task)
Scheduler -> Future: create pending result
Scheduler -> Ready: enqueue(task, Future)
Scheduler --> Client: Future
Worker -> Ready: take()
Ready --> Worker: task, Future
activate Worker
Worker -> Worker: execute task
Worker -> Future: complete(result)
deactivate Worker
Client -> Future: get()
Future --> Client: result
@enduml
```

## 2. Bounded queue backpressure

Intent: Show how a full queue blocks a producer until a worker creates capacity.

```plantuml
@startuml
actor Producer
participant Scheduler
queue "Bounded Queue" as Queue
participant Worker

Producer -> Scheduler: submit(task C)
Scheduler -> Queue: put(task C)
activate Scheduler
Queue --> Scheduler: wait: capacity is zero
Worker -> Queue: take(task A)
Queue --> Worker: task A
Queue --> Scheduler: capacity available
Scheduler -> Queue: enqueue(task C)
Queue --> Scheduler: accepted
deactivate Scheduler
Scheduler --> Producer: submission accepted
@enduml
```

## 3. Contention on a shared queue

Intent: Show two workers racing for the same task while the queue lock serializes access.

```plantuml
@startuml
queue "Shared Queue" as Queue
participant "Worker 1" as W1
participant "Worker 2" as W2

par Worker 1 requests work
  W1 -> Queue: take()
else Worker 2 requests work
  W2 -> Queue: take()
end
critical Queue lock held by Worker 1
  Queue --> W1: task A
  Queue --> W2: wait for lock
end
W1 -> W1: execute task A
W2 -> Queue: retry take()
Queue --> W2: wait: queue empty
@enduml
```

## 4. Cancelling a queued task

Intent: Show cancellation winning before dispatch so the task never starts.

```plantuml
@startuml
actor Client
participant Scheduler
queue "Ready Queue" as Ready
participant Worker
participant Future

Client -> Scheduler: submit(task)
Scheduler -> Ready: enqueue(task)
Scheduler --> Client: Future
Client -> Future: cancel()
Future -> Scheduler: request cancellation
Scheduler -> Ready: remove(task)
Ready --> Scheduler: removed
Scheduler -> Future: mark cancelled
Future --> Client: cancellation accepted
Worker -> Ready: take()
Ready --> Worker: no cancelled task available
@enduml
```

## 5. Cooperative cancellation during execution

Intent: Show a running task observing a cancellation token and terminating cleanly.

```plantuml
@startuml
actor Client
participant Worker
participant "Cancellation Token" as Token
participant Future

activate Worker
Worker -> Worker: begin task
Client -> Future: cancel()
Future -> Token: set cancelled
Future --> Client: cancellation requested
loop At task checkpoints
  Worker -> Token: isCancelled()
  Token --> Worker: true
end
Worker -> Worker: release task resources
Worker -> Future: complete as cancelled
deactivate Worker
@enduml
```

## 6. Transient failure and successful retry

Intent: Show retry scheduling with backoff followed by success on a later attempt.

```plantuml
@startuml
participant Worker
participant Task
participant "Retry Policy" as Policy
participant Timer
queue "Ready Queue" as Ready
participant Future

Worker -> Task: execute(attempt 1)
Task --> Worker: transient failure
Worker -> Policy: nextDelay(attempt 1, failure)
Policy --> Worker: retry after 100 ms
Worker -> Timer: schedule(task, 100 ms)
Timer -> Ready: enqueue(task, attempt 2)
Worker -> Ready: take()
Ready --> Worker: task, attempt 2
Worker -> Task: execute(attempt 2)
Task --> Worker: result
Worker -> Future: complete(result)
@enduml
```

## 7. Retry budget exhausted

Intent: Show repeated failure crossing the retry limit and becoming a terminal result.

```plantuml
@startuml
participant Worker
participant Task
participant "Retry Policy" as Policy
queue "Dead-letter Queue" as Dead
participant Future

loop Attempts 1 through 3
  Worker -> Task: execute(attempt)
  Task --> Worker: retryable failure
  Worker -> Policy: mayRetry(attempt)
  Policy --> Worker: yes, until final attempt
end
Worker -> Policy: mayRetry(attempt 3)
Policy --> Worker: no: budget exhausted
Worker -> Dead: enqueue(task, last failure)
Worker -> Future: fail(last failure)
@enduml
```

## 8. Graceful shutdown with draining

Intent: Show shutdown rejecting new work while allowing queued and running tasks to finish.

```plantuml
@startuml
actor Operator
actor Client
participant Scheduler
queue "Ready Queue" as Ready
participant Worker

Operator -> Scheduler: shutdownGracefully()
Scheduler -> Scheduler: state = DRAINING
Client -> Scheduler: submit(new task)
Scheduler --> Client: rejected: shutting down
loop Until queue is empty
  Worker -> Ready: take()
  Ready --> Worker: queued task
  Worker -> Worker: execute task
end
Worker -> Scheduler: worker idle
Scheduler -> Worker: stop
Scheduler -> Scheduler: state = TERMINATED
Scheduler --> Operator: shutdown complete
@enduml
```

## 9. Immediate shutdown

Intent: Show an urgent stop cancelling queued work and interrupting running workers.

```plantuml
@startuml
actor Operator
participant Scheduler
queue "Ready Queue" as Ready
participant "Worker 1" as W1
participant "Worker 2" as W2
collections "Queued Futures" as Futures

Operator -> Scheduler: shutdownNow()
Scheduler -> Scheduler: state = STOPPING
Scheduler -> Ready: drain all queued tasks
Ready --> Scheduler: tasks B, C
Scheduler -> Futures: cancel(B, C)
par Interrupt active workers
  Scheduler -> W1: interrupt()
else
  Scheduler -> W2: interrupt()
end
W1 --> Scheduler: stopped
W2 --> Scheduler: stopped
Scheduler -> Scheduler: state = TERMINATED
Scheduler --> Operator: unstarted tasks B, C
@enduml
```

## 10. Work stealing under uneven load

Intent: Show an idle worker stealing from a busy worker's local queue to balance load without a central hot spot.

```plantuml
@startuml
participant "Worker 1" as W1
queue "Worker 1 Deque" as Q1
participant "Worker 2" as W2
queue "Worker 2 Deque" as Q2

W1 -> Q1: popFront()
Q1 --> W1: task A
W2 -> Q2: popFront()
Q2 --> W2: empty
W2 -> Q1: stealBack()
critical Worker 1 deque lock
  Q1 --> W2: task C
end
par Independent execution
  W1 -> W1: execute task A
else
  W2 -> W2: execute task C
end
@enduml
```
