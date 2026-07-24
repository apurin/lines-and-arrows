# Autonomous Drone Embedded Systems

## 1. Preflight Initialization and Arming

Intent: Show how the flight computer admits or rejects arming based on synchronized sensor, actuator, navigation, and battery checks.

```plantuml
@startuml
actor Operator
participant "Flight Manager" as FM
participant "Sensor Hub" as Sensors
participant "Navigation Estimator" as Nav
participant "Motor Controller" as Motors
participant "Battery Manager" as Battery

Operator -> FM: Request arm
par Verify sensing
  FM -> Sensors: Run self-test and calibration check
  Sensors --> FM: Sensor health and timestamps
and Verify navigation
  FM -> Nav: Request estimate quality
  Nav --> FM: Position confidence and attitude validity
and Verify propulsion
  FM -> Motors: Run actuator readiness check
  Motors --> FM: ESC and motor status
and Verify energy
  FM -> Battery: Request launch margin
  Battery --> FM: State of charge, voltage, temperature
end
alt Every mandatory check passes
  FM -> Motors: Enable outputs at idle
  FM --> Operator: Armed
else Any mandatory check fails
  FM -> Motors: Keep outputs inhibited
  FM --> Operator: Arming denied with causes
end
@enduml
```

## 2. Time-Aligned Sensor Acquisition

Intent: Show how asynchronous physical sensors become a coherent, timestamped measurement stream for estimation.

```plantuml
@startuml
participant "Hardware Clock" as Clock
participant IMU
participant "Barometer / Magnetometer" as SlowSensors
participant GNSS
participant "Sensor Hub" as Hub
queue "Measurement Queue" as Queue

loop At IMU sample rate
  Clock -> IMU: Sample trigger
  IMU -> Hub: Acceleration and angular rate
  Hub -> Clock: Read monotonic time
  Clock --> Hub: Capture timestamp
  Hub -> Hub: Calibrate, validate, tag sequence
  Hub -> Queue: Enqueue IMU measurement
end
par Periodic environmental samples
  SlowSensors -> Hub: Pressure and magnetic field
  Hub -> Queue: Enqueue timestamped samples
and GNSS receiver updates
  GNSS -> Hub: Fix, velocity, receiver time
  Hub -> Hub: Convert to monotonic timeline
  Hub -> Queue: Enqueue aligned GNSS update
end
@enduml
```

## 3. Multi-Rate State Estimation

Intent: Show the estimator predicting motion at IMU rate and correcting drift when lower-rate observations arrive.

```plantuml
@startuml
queue "Measurement Queue" as Queue
participant "Fusion Estimator" as Estimator
participant "Innovation Gate" as Gate
participant "Flight State Store" as State
participant "Health Monitor" as Health

loop For each IMU measurement
  Queue -> Estimator: Timed acceleration and angular rate
  Estimator -> Estimator: Predict pose, velocity, and covariance
  alt Aiding observation is available
    Queue -> Estimator: GNSS, barometer, magnetometer, or range
    Estimator -> Gate: Residual and expected uncertainty
    alt Observation is statistically consistent
      Gate --> Estimator: Accept
      Estimator -> Estimator: Correct state and covariance
    else Observation is an outlier
      Gate --> Estimator: Reject with reason
      Estimator -> Health: Report rejected observation
    end
  end
  Estimator -> State: Publish state estimate and confidence
end
@enduml
```

## 4. Cascaded Flight-Control Loop

Intent: Show how a mission target is progressively converted into motor commands while fast feedback stabilizes the aircraft.

```plantuml
@startuml
participant "Mission Guidance" as Guidance
participant "Position Controller" as Position
participant "Attitude Controller" as Attitude
participant "Rate Controller" as Rate
participant "Motor Mixer" as Mixer
participant ESC
participant "State Estimator" as Estimator

Guidance -> Position: Desired position and velocity
loop At position-loop rate
  Estimator --> Position: Position and velocity
  Position -> Attitude: Desired thrust vector and yaw
  loop At attitude-loop rate
    Estimator --> Attitude: Estimated orientation
    Attitude -> Rate: Desired angular rates and thrust
    loop At rate-loop rate
      Estimator --> Rate: Measured angular rates
      Rate -> Mixer: Requested torques and thrust
      Mixer -> ESC: Per-motor commands with limits
      ESC --> Mixer: Applied output and saturation
      Mixer --> Rate: Saturation feedback for anti-windup
    end
  end
end
@enduml
```

## 5. Obstacle-Aware Trajectory Revision

Intent: Show onboard perception interrupting normal path following only when an obstacle materially changes flight safety.

```plantuml
@startuml
participant "Depth Sensor" as Depth
participant "Perception" as Perception
participant "Local Map" as Map
participant "Trajectory Planner" as Planner
participant "Flight Manager" as FM
participant "Position Controller" as Controller

loop During autonomous flight
  Depth -> Perception: Depth frame with timestamp
  Perception -> Perception: Detect obstacles and free space
  Perception -> Map: Update local occupancy
  Map --> Planner: Collision horizon on active path
  alt Active path remains clear
    Planner -> Controller: Continue current trajectory
  else Safe local detour exists
    Planner -> Planner: Generate bounded detour
    Planner -> FM: Propose revised trajectory
    FM -> Controller: Track approved detour
  else No safe detour exists
    Planner -> FM: Path blocked
    FM -> Controller: Brake and hold position
  end
end
@enduml
```

## 6. Command and Telemetry Exchange

Intent: Show reliable command handling alongside rate-limited status delivery over an imperfect radio link.

```plantuml
@startuml
actor "Ground Station" as Ground
participant "Radio Link" as Radio
participant "Command Gateway" as Gateway
participant "Flight Manager" as FM
participant "Telemetry Publisher" as Telemetry

par Incoming commands
  Ground -> Radio: Signed command with sequence number
  Radio -> Gateway: Deliver packet
  Gateway -> Gateway: Authenticate and reject replay
  alt Command is valid for current flight mode
    Gateway -> FM: Execute command
    FM --> Gateway: Result and resulting mode
    Gateway -> Radio: Acknowledgement
    Radio --> Ground: Command result
  else Invalid, stale, or unsafe command
    Gateway -> Radio: Negative acknowledgement with reason
    Radio --> Ground: Command rejected
  end
and Outgoing telemetry
  loop At link-adaptive rate
    FM -> Telemetry: Mode, target, and failsafe state
    Telemetry -> Radio: Prioritized compact status
    Radio --> Ground: Telemetry frame
    Radio --> Telemetry: Link quality and queue pressure
    Telemetry -> Telemetry: Adjust rate and drop low-priority fields
  end
end
@enduml
```

## 7. Sensor Fault Detection and Isolation

Intent: Show how redundancy and residual checks isolate a suspect sensor without immediately destabilizing the estimator.

```plantuml
@startuml
participant "Primary IMU" as IMU1
participant "Backup IMU" as IMU2
participant "Fusion Estimator" as Estimator
participant "Fault Monitor" as Monitor
participant "Flight Manager" as FM

par Redundant samples
  IMU1 -> Estimator: Motion sample A
and
  IMU2 -> Estimator: Motion sample B
end
Estimator -> Monitor: Cross-sensor residuals and innovations
alt Brief disagreement within recovery window
  Monitor -> Estimator: Reduce suspect sensor weight
  Estimator -> Estimator: Continue with inflated uncertainty
else Persistent fault isolated to one IMU
  Monitor -> Estimator: Exclude failed sensor
  Monitor -> FM: Redundancy degraded
  FM -> FM: Restrict aggressive maneuvers
else Fault cannot be isolated
  Monitor -> FM: Navigation integrity lost
  FM -> FM: Enter attitude-only emergency mode
end
@enduml
```

## 8. Battery Protection and Energy-Aware Recovery

Intent: Show escalating battery responses that account for voltage sag, remaining energy, and the cost of returning home.

```plantuml
@startuml
participant "Battery Manager" as Battery
participant "Energy Estimator" as Energy
participant "Flight Manager" as FM
participant "Trajectory Planner" as Planner
participant "Control Allocator" as Control
participant "Telemetry" as Telemetry

loop During powered flight
  Battery -> Energy: Voltage, current, temperature, cell minimum
  Energy -> Energy: Estimate usable energy and sag recovery
  Planner -> Energy: Energy required to home and land
  Energy -> FM: Reserve margin and protection level
  alt Margin is healthy
    FM -> Control: Allow normal performance envelope
  else Return reserve reached
    FM -> Planner: Plan immediate return-to-home
    FM -> Telemetry: Announce low-energy recovery
  else Critical voltage or temperature
    FM -> Planner: Select nearest safe landing area
    FM -> Control: Limit peak thrust where survivable
    FM -> Telemetry: Announce forced landing
  else Cell collapse is imminent
    FM -> Control: Prioritize controlled descent over mission
    FM -> Telemetry: Announce emergency shutdown risk
  end
end
@enduml
```

## 9. Lost-Link Failsafe State Machine

Intent: Show the timed progression from radio degradation to autonomous recovery, with guarded reconnection handling.

```plantuml
@startuml
participant "Radio Link" as Radio
participant "Link Watchdog" as Watchdog
participant "Flight Manager" as FM
participant "Navigation Estimator" as Nav
participant "Mission Guidance" as Guidance

Radio -> Watchdog: Heartbeats stop
Watchdog -> Watchdog: Start loss timer
alt Link recovers before timeout
  Radio -> Watchdog: Valid authenticated heartbeat
  Watchdog -> FM: Clear transient warning
else Loss timeout expires
  Watchdog -> FM: Declare link lost
  FM -> Guidance: Pause mission and hold
  Nav --> FM: Home position and navigation confidence
  alt Home navigation is reliable
    FM -> Guidance: Return home at failsafe altitude
  else Home navigation is unreliable
    FM -> Guidance: Land at current safe location
  end
  opt Link later recovers
    Radio -> Watchdog: Authenticated control session
    Watchdog -> FM: Link restored
    FM -> FM: Require explicit operator takeover
  end
end
@enduml
```

## 10. Propulsion Fault and Controlled Landing

Intent: Show how actuator feedback drives rapid fault confirmation, control reallocation, and a survivability-based landing decision.

```plantuml
@startuml
participant ESC
participant "Actuator Monitor" as Monitor
participant "Control Allocator" as Allocator
participant "Flight Manager" as FM
participant "Landing Planner" as Landing
participant "Telemetry" as Telemetry

ESC -> Monitor: RPM, current, temperature, fault flags
Monitor -> Monitor: Compare commanded and observed thrust
alt Transient tracking error
  Monitor -> Allocator: Mark motor temporarily constrained
  Allocator -> ESC: Redistribute commands within limits
else Motor failure confirmed
  Monitor -> Allocator: Remove failed actuator authority
  Allocator -> Allocator: Solve achievable force and torque set
  Allocator -> FM: Remaining stability envelope
  alt Controlled flight remains feasible
    FM -> Landing: Find immediate reachable landing site
    Landing -> Allocator: Emergency descent trajectory
    FM -> Telemetry: Report degraded controlled landing
  else Stable flight is not feasible
    FM -> Allocator: Minimize impact energy and protect people
    FM -> Telemetry: Report unrecoverable propulsion failure
  end
end
@enduml
```
