# Service-oriented e-commerce order fulfilment

## 1. Orchestrated fulfilment happy path

Intent: Trace the saga coordinator through inventory, payment, and shipping while each service commits locally and reports progress by event.

```plantuml
@startuml
actor Customer
participant "Order API" as API
participant "Saga Coordinator" as Saga
participant "Inventory Service" as Inventory
participant "Payment Service" as Payment
participant "Shipping Service" as Shipping
queue "Event Bus" as Bus

Customer -> API: PlaceOrder(order, idempotencyKey)
API -> Saga: StartFulfilment(order)
Saga -> Inventory: ReserveItems(orderId, items)
Inventory -> Bus: ItemsReserved(orderId, reservationId)
Bus -> Saga: ItemsReserved
Saga -> Payment: AuthorizePayment(orderId, total)
Payment -> Bus: PaymentAuthorized(orderId, authorizationId)
Bus -> Saga: PaymentAuthorized
Saga -> Shipping: CreateShipment(orderId, address)
Shipping -> Bus: ShipmentCreated(orderId, shipmentId)
Bus -> Saga: ShipmentCreated
Saga -> Payment: CapturePayment(orderId, authorizationId)
Payment -> Bus: PaymentCaptured(orderId)
Bus -> Saga: PaymentCaptured
Saga -> API: FulfilmentConfirmed(orderId)
API --> Customer: 202 Accepted(orderId)
@enduml
```

## 2. Choreographed fulfilment through domain events

Intent: Show services advancing a fulfilment without a central coordinator by reacting only to durable domain events.

```plantuml
@startuml
actor Customer
participant "Order Service" as Order
queue "Event Bus" as Bus
participant "Inventory Service" as Inventory
participant "Payment Service" as Payment
participant "Shipping Service" as Shipping

Customer -> Order: SubmitOrder(order)
Order -> Order: Persist PENDING
Order -> Bus: OrderPlaced(orderId, items, total)
Bus -> Inventory: OrderPlaced
Inventory -> Inventory: Reserve stock
Inventory -> Bus: InventoryReserved(orderId)
Bus -> Payment: InventoryReserved
Payment -> Payment: Authorize funds
Payment -> Bus: PaymentAuthorized(orderId)
Bus -> Shipping: PaymentAuthorized
Shipping -> Shipping: Allocate shipment
Shipping -> Bus: ShipmentAllocated(orderId)
Bus -> Order: ShipmentAllocated
Order -> Order: Mark CONFIRMED
Order --> Customer: Order confirmed
@enduml
```

## 3. Inventory rejection before payment

Intent: Make an early saga rejection explicit when stock cannot be reserved and no downstream compensation is yet required.

```plantuml
@startuml
actor Customer
participant "Order Service" as Order
participant "Saga Coordinator" as Saga
participant "Inventory Service" as Inventory
queue "Event Bus" as Bus

Customer -> Order: PlaceOrder(order)
Order -> Saga: Start(orderId)
Saga -> Inventory: ReserveItems(orderId, items)
alt all items available
  Inventory -> Bus: ItemsReserved(orderId)
  Bus -> Saga: ItemsReserved
  Saga -> Order: MarkAwaitingPayment(orderId)
else one or more items unavailable
  Inventory -> Bus: ReservationRejected(orderId, shortages)
  Bus -> Saga: ReservationRejected
  Saga -> Order: RejectOrder(orderId, OUT_OF_STOCK)
  Order --> Customer: Order rejected(shortages)
end
@enduml
```

## 4. Payment rejection compensates inventory

Intent: Trace the reverse action that releases a completed stock reservation after payment authorization fails.

```plantuml
@startuml
participant "Saga Coordinator" as Saga
participant "Inventory Service" as Inventory
participant "Payment Service" as Payment
participant "Order Service" as Order
queue "Event Bus" as Bus

Saga -> Inventory: ReserveItems(orderId, items)
Inventory -> Bus: ItemsReserved(orderId, reservationId)
Bus -> Saga: ItemsReserved
Saga -> Payment: AuthorizePayment(orderId, total)
Payment -> Bus: PaymentRejected(orderId, reason)
Bus -> Saga: PaymentRejected
Saga -> Saga: Enter COMPENSATING
Saga -> Inventory: ReleaseReservation(orderId, reservationId)
Inventory -> Bus: InventoryReleased(orderId)
Bus -> Saga: InventoryReleased
Saga -> Order: CancelOrder(orderId, PAYMENT_REJECTED)
Order -> Bus: OrderCancelled(orderId)
@enduml
```

## 5. Shipment failure triggers multi-step compensation

Intent: Show compensation proceeding in reverse order when fulfilment fails after both stock reservation and payment capture.

```plantuml
@startuml
participant "Saga Coordinator" as Saga
participant "Inventory Service" as Inventory
participant "Payment Service" as Payment
participant "Shipping Service" as Shipping
participant "Order Service" as Order

Saga -> Inventory: ReserveItems(orderId)
Inventory --> Saga: Reserved(reservationId)
Saga -> Payment: CapturePayment(orderId, total)
Payment --> Saga: Captured(paymentId)
Saga -> Shipping: CreateShipment(orderId)
Shipping --> Saga: Failed(NO_CARRIER)
Saga -> Saga: Begin reverse compensation
Saga -> Payment: RefundPayment(orderId, paymentId)
Payment --> Saga: Refunded(refundId)
Saga -> Inventory: ReleaseReservation(orderId, reservationId)
Inventory --> Saga: Released
Saga -> Order: MarkCancelled(orderId, NO_CARRIER)
Order --> Saga: Cancelled
@enduml
```

## 6. Ambiguous payment timeout with idempotent retry

Intent: Demonstrate how a stable operation key prevents a retry from charging twice when the first response is lost.

```plantuml
@startuml
participant "Saga Coordinator" as Saga
participant "Payment Service" as Payment
database "Payment Store" as Store
participant "Payment Gateway" as Gateway

Saga -> Payment: Capture(orderId, amount, key=pay-123)
Payment -> Store: Insert operation(pay-123, PENDING) if absent
Payment -> Gateway: Charge(amount, merchantRef=pay-123)
Gateway --> Payment: Charged(gatewayChargeId)
Payment -> Store: Mark SUCCEEDED(gatewayChargeId)
Payment -x Saga: Response lost
Saga -> Payment: Retry Capture(orderId, amount, key=pay-123)
Payment -> Store: Read operation(pay-123)
Store --> Payment: SUCCEEDED(gatewayChargeId)
Payment --> Saga: Captured(gatewayChargeId, replayed=true)
@enduml
```

## 7. Transactional outbox and consumer deduplication

Intent: Preserve an atomic local state change and event publication while ensuring redelivery cannot repeat the shipping side effect.

```plantuml
@startuml
participant "Order Service" as Order
database "Order DB" as DB
participant "Outbox Relay" as Relay
queue "Event Bus" as Bus
participant "Shipping Service" as Shipping
database "Shipping Inbox" as Inbox

Order -> DB: Begin transaction
Order -> DB: Update order to READY_TO_SHIP
Order -> DB: Insert outbox event(eventId=evt-7)
Order -> DB: Commit
Relay -> DB: Read unpublished evt-7
Relay -> Bus: Publish OrderReady(evt-7, orderId)
Bus -> Shipping: Deliver evt-7
Shipping -> Inbox: Insert evt-7 if absent
alt first delivery
  Inbox --> Shipping: inserted
  Shipping -> Shipping: Create shipment
else redelivery
  Inbox --> Shipping: already exists
  Shipping -> Shipping: Skip duplicate effect
end
Relay -> DB: Mark evt-7 published
@enduml
```

## 8. Out-of-order events guarded by saga version

Intent: Prevent a delayed failure event from reversing a saga that has already advanced on a newer causally valid event.

```plantuml
@startuml
queue "Event Bus" as Bus
participant "Saga Coordinator" as Saga
database "Saga Store" as Store
participant "Inventory Service" as Inventory

Bus -> Saga: PaymentAuthorized(orderId, sagaVersion=3)
Saga -> Store: Compare-and-set version 2 to 3
Store --> Saga: Updated
Saga -> Inventory: CommitReservation(orderId)
Bus -> Saga: PaymentRejected(orderId, sagaVersion=2)
Saga -> Store: Read current version
Store --> Saga: version 3, state PAYMENT_AUTHORIZED
alt event version is stale
  Saga -> Store: Record ignored event
  Saga -> Bus: EventIgnored(orderId, staleVersion=2)
else event is next expected version
  Saga -> Saga: Apply transition
end
@enduml
```

## 9. Degraded fraud dependency routes order to review

Intent: Keep the order safe and visible when a non-responsive risk service prevents an automated fulfilment decision.

```plantuml
@startuml
actor Customer
participant "Order Service" as Order
participant "Saga Coordinator" as Saga
participant "Fraud Service" as Fraud
participant "Inventory Service" as Inventory
queue "Review Queue" as Review

Customer -> Order: PlaceOrder(order)
Order -> Saga: Start(orderId)
Saga -> Fraud: Assess(orderId, customer, total)
... timeout budget expires ...
Fraud -x Saga: No response
Saga -> Saga: Open circuit for Fraud
Saga -> Inventory: ReserveItems(orderId, shortLease=true)
Inventory --> Saga: Reserved(reservationId, expiresAt)
Saga -> Order: Mark ON_HOLD(RISK_UNAVAILABLE)
Saga -> Review: Enqueue(orderId, reservationId, expiresAt)
Order --> Customer: Order received; review pending
@enduml
```

## 10. Coordinator crash and durable saga recovery

Intent: Resume an in-flight saga from its persisted step and safely repeat a command after the coordinator restarts.

```plantuml
@startuml
participant "Saga Coordinator" as Saga
database "Saga Store" as Store
participant "Inventory Service" as Inventory
participant "Payment Service" as Payment

Saga -> Inventory: ReserveItems(orderId, commandId=reserve-9)
Inventory --> Saga: Reserved(reservationId)
Saga -> Store: Save INVENTORY_RESERVED, next=AUTHORIZE_PAYMENT
Store --> Saga: Durable
... coordinator process crashes ...
destroy Saga
participant "Restarted Coordinator" as Restarted
Restarted -> Store: Load incomplete sagas
Store --> Restarted: orderId, next=AUTHORIZE_PAYMENT
Restarted -> Payment: Authorize(orderId, commandId=auth-9)
Payment --> Restarted: Authorized(authorizationId)
... coordinator crashes before checkpoint ...
destroy Restarted
participant "Coordinator after retry" as Retry
Retry -> Store: Load incomplete saga
Store --> Retry: next=AUTHORIZE_PAYMENT
Retry -> Payment: Retry Authorize(commandId=auth-9)
Payment --> Retry: Same authorizationId
Retry -> Store: Save PAYMENT_AUTHORIZED
@enduml
```
