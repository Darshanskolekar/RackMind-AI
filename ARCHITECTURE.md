# RackMind AI (TwinOps) — System Architecture & Engineering Specifications

This document provides a deep-dive technical reference into the architectural design, data models, integration protocols, and AI orchestration pipelines powering **RackMind AI (TwinOps)**.

---

## 1. High-Level Component Topology

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                CLIENT BROWSER RUNTIME                                  │
│                                                                                        │
│   ┌─────────────────────┐  ┌─────────────────────┐  ┌──────────────────────────────┐   │
│   │   Header & Switcher │  │   42U Digital Twin  │  │   Action Hub (HITL Queue)    │   │
│   │   • Rack selector   │  │   • Vector chassis  │  │   • Incident tickets         │   │
│   │   • Zone filters    │  │   • Heatmap shader  │  │   • Slurm checkpointing      │   │
│   │   • Global metrics  │  │   • Server modal    │  │   • Audit log stream         │   │
│   └──────────┬──────────┘  └──────────┬──────────┘  └──────────────┬───────────────┘   │
│              │                        │                            │                   │
│              └────────────────────────┼────────────────────────────┘                   │
│                                       ▼                                                │
│                        ┌──────────────────────────────┐                                │
│                        │     TelemetryContext.tsx     │                                │
│                        │   • Live SSE / Polling loop  │                                │
│                        │   • Optimistic state cache   │                                │
│                        │   • Copilot Stream Client    │                                │
│                        └──────────────┬───────────────┘                                │
└───────────────────────────────────────┼────────────────────────────────────────────────┘
                                        │ HTTP / JSON / SSE (Port 3000)
                                        ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              EXPRESS + VITE NODE.JS SERVER                             │
│                                                                                        │
│   ┌────────────────────────────────────────────────────────────────────────────────┐   │
│   │                            HTTP ROUTE CONTROLLERS                              │   │
│   │   • GET  /api/health            ── Health check & Gemini API connectivity      │   │
│   │   • GET  /api/telemetry/racks   ── Multi-rack telemetry & electrical state    │   │
│   │   • GET  /api/incidents         ── Active triage queue & audit trails          │   │
│   │   • POST /api/incidents/:id/mitigate ── Executes HITL mitigation runbooks       │   │
│   │   • POST /api/copilot/stream    ── SSE stream with dynamic system instructions │   │
│   └───────────────────────────────────────┬────────────────────────────────────────┘   │
│                                           │                                            │
│   ┌───────────────────────────────────────┴────────────────────────────────────────┐   │
│   │                      TWINOPS SIMULATION & INGESTION CORE                       │   │
│   │   • rackBaseline.ts: Baseline 42U layouts (RACK-A01, RACK-A02, RACK-B01)       │   │
│   │   • 3-Phase PDU Balancer: Phase L1 / L2 / L3 amperage & neutral return         │   │
│   │   • Cooling Loop Physics: Ambient air vs 100% DLC (42 PSI, 130 LPM, Delta-T)   │   │
│   │   • analyzeRackSlots(): Contiguous U-block & physical clearance calculator    │   │
│   └───────────────────────────────────────┬────────────────────────────────────────┘   │
│                                           │                                            │
│   ┌───────────────────────────────────────┴────────────────────────────────────────┐   │
│   │                      GEMINI 2.5 ORCHESTRATION ENGINE                           │   │
│   │   • Dynamic System Prompt Assembly (Injects live JSON rack snapshot)           │   │
│   │   • Capacity Math Grounding (Enforces YES/NO + Headroom + Slot allocation)     │   │
│   │   • Google Search Grounding Tool integration for OEM & ASHRAE specifications   │   │
│   └────────────────────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Telemetry Ingestion & Protocol Adapters

Modern data centers utilize heterogeneous telemetry standards. RackMind AI models and normalizes these data streams into unified TypeScript schemas:

### A. Redfish BMC Hardware Telemetry (DMTF Standard)
- **Target Nodes:** Dell PowerEdge R760, XE9680 (8× NVIDIA H100 SXM5), Supermicro GPU servers.
- **Protocol:** HTTPS RESTful JSON over Redfish Specification v1.19.0.
- **Extracted Datapoints:**
  ```json
  {
    "InletTempCelsius": 23.4,
    "OutletTempCelsius": 34.2,
    "GpuSubsystem": [
      { "Id": "GPU0", "AsicTempC": 68.2, "PowerDrawWatts": 680, "ThrottleReason": "None" }
    ],
    "FanSubsystem": { "Rpm": 8400, "DutyCyclePercent": 62.0 },
    "PowerSupplyStatus": { "InputVoltage": 230, "PowerFactor": 0.98 }
  }
  ```

### B. Modbus TCP / SNMP Facilities Telemetry
- **Target Systems:** Vertiv Liebert Extreme Density CDUs, Raritan 3-Phase Intelligent PDUs.
- **Protocol:** Modbus TCP (Port 502) register reading & SNMP v3 traps.
- **Extracted Datapoints:**
  - 3-Phase Electrical Amperage: `L1_Amps`, `L2_Amps`, `L3_Amps`, `NeutralCurrent_Amps`.
  - Coolant Distribution Unit (CDU): `SupplyPressure_PSI` (target: 42 PSI), `ReturnTemp_C`, `FlowRate_LPM` (target: 130 LPM), `FilterDeltaPressure_PSI`.

### C. Slurm / Kubernetes Workload Telemetry
- **Target Systems:** Distributed AI training clusters (LLM pretraining, fine-tuning).
- **Extracted Datapoints:**
  - Active Job ID (`slurm-8821`, `k8s-rubin-01`), allocated GPU indices, checkpoint frequency, node health status.

---

## 3. Physical & Electrical Constraint Analysis (`analyzeRackSlots`)

A core innovation in RackMind AI is eliminating **false-positive deployment approvals**. When an infrastructure engineer or capacity planner queries the AI Copilot:
> *"Can I install 2 more Dell PowerEdge XE9680 servers in Rack A01?"*

Traditional DCIM tools perform simple database queries on total empty U-slots, often ignoring contiguous slot height and 3-phase electrical headroom. RackMind AI executes a strict multi-layer mathematical verification:

```
[ Incoming Deployment Request ]
              │
              ▼
[ Layer 1: Electrical Headroom Audit ]
  • Current Load: 11.16 kW
  • Rated Breaker: 24.00 kW
  • Available Headroom = 24.00 kW - 11.16 kW = 12.84 kW
  • Requested Load = 2 × 6.20 kW (typical) = 12.40 kW  ──▶ PASS (0.44 kW buffer remaining)
  • (Note: Peak 2 × 10.20 kW = 20.40 kW would trip breaker; Gemini notes this constraint)
              │
              ▼
[ Layer 2: Contiguous Physical Slot Audit ]
  • Total Empty U-Slots: 23 Units
  • Dell XE9680 Chassis Height: 6U per unit (requires 6 contiguous unobstructed slots)
  • Contiguous Free Blocks in RACK-A01:
    - U10 to U15: 6 Contiguous Slots  ──▶ Allocates Server #1
    - U16 to U21: 6 Contiguous Slots  ──▶ Allocates Server #2
  • Result: PHYSICAL FIT CONFIRMED
              │
              ▼
[ Layer 3: Cooling Envelope Audit ]
  • Verify airflow containment and cold-aisle static pressure.
              │
              ▼
[ Gemini Response: Definitive "YES" with explicit slot allocations & electrical math ]
```

---

## 4. Gemini Prompt Orchestration & Real-Time Grounding

### Dynamic System Instruction Pipeline
Every request to the TwinOps Copilot stream endpoint (`/api/copilot/stream`) injects the exact real-time operational state of the datacenter into Gemini's system instruction:

1. **Live JSON State Injection:** Racks, servers, phase draws, coolant flow, active tickets.
2. **Dynamic Capacity Rule Enforcement:** Strict instruction for capacity queries:
   - Begin immediately with a clear **YES** or **NO**.
   - Provide exact power math: Current draw, Rated limit, Remaining headroom (kW).
   - Detail physical U-slot assignments (e.g., U10–U15 for 6U chassis).
3. **Google Search Grounding:**
   - When users query hardware specifications, thermal thresholds, or ASHRAE standards (e.g., ASHRAE A1 air cooling limits vs W4 liquid cooling limits), Gemini executes real-time Google Search grounding to retrieve verified technical parameters without hallucination.

---

## 5. Human-in-the-Loop (HITL) Safety Guardrails

Autonomous SRE operations in mission-critical infrastructure must follow zero-trust execution principles:

```
┌────────────────────────────────┐
│   Gemini Incident Detection    │  (Anomalous CDU pressure drop or PDU phase spike)
└───────────────┬────────────────┘
                │
                ▼
┌────────────────────────────────┐
│   Triage & Ticket Generation   │  (Generated with ticket ID, severity, root-cause)
└───────────────┬────────────────┘
                │
                ▼
┌────────────────────────────────┐
│  HUMAN OPERATOR AUTHORIZATION  │  ◄── Requires manual operator review in Action Hub
└───────────────┬────────────────┘
                │ Approved
                ▼
┌────────────────────────────────┐
│ Slurm Pre-Evacuation Protocol  │  (Executes checkpointing to save model weights)
└───────────────┬────────────────┘
                │
                ▼
┌────────────────────────────────┐
│ Physical Actuator Execution    │  (CDU bypass valve modulation / PDU load shedding)
└───────────────┬────────────────┘
                │
                ▼
┌────────────────────────────────┐
│ Cryptographic Audit Logging    │  (Logged with operator ID, timestamp, telemetry delta)
└────────────────────────────────┘
```
