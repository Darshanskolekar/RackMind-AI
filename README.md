# RackMind AI (TwinOps) — Autonomous Enterprise Data Center Digital Twin & SRE Orchestrator

[![Google Cloud AI Builder Cup 2026](https://img.shields.io/badge/Google%20Cloud-AI%20Builder%20Cup%202026-4285F4?style=for-the-badge&logo=googlecloud&logoColor=white)](https://cloud.google.com/)
[![Gemini 2.5 Flash Grounded](https://img.shields.io/badge/Gemini%20API-Search%20Grounding-8E75C2?style=for-the-badge&logo=googlegemini&logoColor=white)](https://ai.google.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x%20%2F%20React%2019-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg?style=for-the-badge)](LICENSE)

> **Built for the Google Cloud AI Builder Cup 2026 (JAPAC Edition)**  
> **Build Timeline:** September – October 2026  
> **Evaluation Track:** AI Agents, Digital Twins & Enterprise Infrastructure SRE  

---

### 📌 Competition Quick Links
- 🌐 **Live Deployed Prototype:** `[https://rackmind-ai-preview.run.app]` *(or Firebase / Cloud Run active deployment URL)*
- 🎥 **3-Minute Video Walkthrough:** `[https://youtu.be/rackmind-ai-demo-2026]`
- 📊 **Executive Pitch Deck (PDF/Slides):** `[https://storage.googleapis.com/rackmind-cup2026/RackMind-AI-PitchDeck.pdf]`
- 👥 **Team Credits:**
  - **Darshan Somanath** — Technical Program Manager & Infrastructure Architect
  - **Kritika Gupta** — Software Engineer & UI/UX Lead

---

## 1. Executive Summary & Problem Statement
*(Evaluation Rubric: 25% Problem Alignment & Real-World Impact)*

### The "Silo Blindness" Crisis in AI Data Centers
Modern AI data centers housing ultra-high-density compute racks are facing an operational breaking point. A single modern AI training cabinet—such as a **Dell PowerEdge XE9680 (10.2 kW)** cluster or an **NVIDIA Vera Rubin NVL72 pod (drawing 230 kW)**—operates under extreme thermal and electrical dynamics:

```
+-----------------------------------------------------------------------------------+
|                        THE THREE DISCONNECTED SILOS                               |
+-----------------------------------------------------------------------------------+
| 1. FACILITIES & COOLING  | Vertiv CDUs, chilled-water loops, 3-Phase PDUs (Modbus) |
| 2. SERVER & CHASSIS      | Dell iDRAC Redfish, Cisco NX-OS ToR switches, NVLink   |
| 3. WORKLOAD SCHEDULER    | Slurm, Kubernetes, MPI gradient descent checkpoints     |
+-----------------------------------------------------------------------------------+
                                         │
                                         ▼
                     ❌ "SILO BLINDNESS" FAILURE MODES:
 🚨 Local CDU valve derate causes GPU throttling; Slurm scheduler has no visibility.
 🚨 3-Phase PDU phase imbalance (L1 > 34A) trips upstream breaker; terminates job.
 🚨 SRE deploys 2 additional 6U nodes; blows thermal budget and triggers runaway.
 🚨 $100K+ in GPU hardware damage and days of lost distributed checkpoint progress.
```

### The Solution: Autonomous TwinOps Orchestration
**RackMind AI** eliminates Silo Blindness by fusing physical facilities telemetry (CDU pressure/flow, 3-phase electrical loads), hardware telemetry (Redfish BMC sensor streams, ToR switch thermals), and AI workload queues (Slurm job states) into an interactive **42U Digital Twin**. 

Powered by **Google Gemini** with real-time **Google Search Grounding**, RackMind AI continuously calculates live electrical headroom, audits physical rack elevation constraints, detects pre-failure anomalies, and surfaces audited, **Human-in-the-Loop (HITL)** remediation plans before catastrophic thermal or electrical trips occur.

---

## 2. 60-Second Judge Evaluation Walkthrough / Quick Start
*(Evaluation Rubric: Execution & UI/UX Quality)*


```
[ Step 1: Select Rack Elevation ] ──▶ [ Step 2: Inspect Action Hub ] ──▶ [ Step 3: HITL Mitigation ] ──▶ [ Step 4: TwinOps Copilot ]
   Toggle RACK-A01 (Air)               Review active incident             Click "Approve & Execute"           Ask capacity questions
   vs RACK-A02 (Liquid DLC)            telemetry snapshot                 Watch safe Slurm eviction           with real-time grounding
```

1. **Cabinet Selection & Elevation Inspection:**
   - In the top header toolbar, click the **Rack Selector Dropdown** (`RACK-A01`, `RACK-A02`, or `RACK-B01`).
   - Switch between **RACK-A01** (42U hybrid air-cooled cabinet with Dell PowerEdge XE9680 8× H100 GPU nodes) and **RACK-A02** (NVIDIA Vera Rubin NVL72 100% Direct Liquid Cooled pod operating at 42 PSI / 130 LPM).
   - Toggle **Heatmap View** to visualize cold-aisle to hot-aisle thermal gradient dissipation across U-slots.

2. **Action Hub Incident Triage:**
   - Locate the **Action Hub** panel on the right sidebar.
   - Inspect active tickets: e.g., `INC-8921: Coolant Flow Derate on NVL72 Secondary Loop` or `INC-4412: Phase L1 PDU Over-subscription`.
   - Review the hardware telemetry snapshot, severity classification, and root-cause analysis generated by TwinOps.

3. **Safe Human-in-the-Loop (HITL) Mitigation:**
   - Click **`Approve & Execute Mitigation`** on an open ticket.
   - Observe the step-by-step remediation sequence:
     1. Automatic Slurm job checkpointing (`scontrol checkpoint job-8821`).
     2. Controlled workload migration away from degraded GPU nodes.
     3. CDU proportional valve recalibration or dynamic PDU phase shedding.
     4. Cryptographic audit trail entry logged for compliance.

4. **Query the Gemini-Powered TwinOps Copilot:**
   - Open the **TwinOps Copilot** terminal at the bottom and submit the following benchmark prompts:
     - **Capacity & Power Math Benchmark:**
       > *"Can I add 2 more Dell PowerEdge XE9680 servers to RACK-A01?"*  
       *(Watch Gemini evaluate the nominal 11.16 kW draw against the 24.0 kW breaker limit, compute the remaining 12.84 kW headroom, verify contiguous 6U slot availability in U10–U15, and return a conclusive YES/NO recommendation).*
     - **Grounded Technical Reasoning Benchmark:**
       > *"What is the difference between ASHRAE A1 air limits and W4 liquid cooling limits for NVL72?"*  
       *(Demonstrates real-time Gemini reasoning with Google Search Grounding to quote official ASHRAE TC 9.9 standards and liquid supply temperature ranges).*

---

## 3. System Architecture & Telemetry Pipeline
*(Evaluation Rubric: 25% Technical Quality & Innovation)*

```
                       ┌────────────────────────────────────────────────────────┐
                       │          PHYSICAL INFRASTRUCTURE SENSORS              │
                       │  • Redfish BMC (Inlet, Outlet, GPU ASIC, Fan RPM)      │
                       │  • Modbus / SNMP (Vertiv CDU, 3-Phase PDU L1/L2/L3)    │
                       │  • Workload Telemetry (Slurm Job API, K8s DaemonSet)   │
                       └──────────────────────────┬─────────────────────────────┘
                                                  │ WebSockets / SSE / REST
                                                  ▼
                       ┌────────────────────────────────────────────────────────┐
                       │              TWINOPS TELEMETRY INGESTION               │
                       │  • Real-time delta normalization (1 Hz polling)        │
                       │  • 3-Phase Electrical Load Balancer (Amps/kW/Phase)    │
                       │  • Thermal Runaway Physics & ASHRAE Envelope Engine    │
                       └──────────────────────────┬─────────────────────────────┘
                                                  │ Live Telemetry State Vector
                                                  ▼
         ┌─────────────────────────────────────────────────────────────────────────────┐
         │              GEMINI 2.5 INTELLIGENCE & ORCHESTRATION ENGINE                 │
         │  • Dynamic System Instruction Injection (Live Rack State + JSON Snapshot)   │
         │  • Autonomous Incident Detection & Root-Cause Analysis                      │
         │  • Google Search Grounding for Hardware Specs & ASHRAE TC 9.9 Standards    │
         │  • Real-time Streaming Token Delivery with AbortController Guardrails       │
         └───────────────────────────────┬─────────────────────────────────────────────┘
                                         │
                 ┌───────────────────────┴─────────────────────────┐
                 ▼                                                 ▼
┌─────────────────────────────────────────┐     ┌──────────────────────────────────────┐
│       ACTION HUB (HITL ORCHESTRATOR)    │     │      INTERACTIVE 42U DIGITAL TWIN    │
│  • Automated Ticket Queue               │     │  • 2D Vector Elevation (U1 to U42)   │
│  • Human Approval Barrier               │     │  • Thermal Heatmap Overlay           │
│  • Slurm Job Checkpoint & Migration     │     │  • DLC Coolant Loop Status (PSI/LPM) │
│  • Immutable SRE Audit Trail            │     │  • Responsive Vite + React 19 UI     │
└─────────────────────────────────────────┘     └──────────────────────────────────────┘
```

---

## 4. Key Innovation Highlights

| Feature | Legacy DCIM Systems | RackMind AI (TwinOps) |
|---|---|---|
| **Incident Response** | Static threshold alerts; manual SRE investigation across 3 tools. | **Autonomous root-cause triage** with Gemini reasoning & automated remediation proposals. |
| **Expansion Planning** | Spreadsheets; prone to breaker trips from power factor spikes. | **Dynamic Headroom & U-Slot Math** auditing electrical capacity & physical space in real time. |
| **Cooling Telemetry** | Basic ambient room thermals. | **100% Direct Liquid Cooling (DLC)** tracking 42 PSI supply loop, return delta-T, and flow rates. |
| **Workload Awareness** | Zero awareness of Slurm/K8s jobs running on servers. | **Deep scheduler integration** checkpointing training runs before executing hardware actions. |
| **Search Grounding** | Outdated static manuals. | **Google Search Grounding** retrieving live manufacturer errata and ASHRAE guidelines. |

---

## 5. Local Development & Quick Start Guide

### Prerequisites
- **Node.js**: `v18.0.0` or higher (Node 20+ recommended)
- **Package Manager**: `npm` (v9+) or `bun`
- **Gemini API Key**: Obtain a key from [Google AI Studio](https://aistudio.google.com/)

### Step-by-Step Installation

1. **Clone the Repository:**
   ```bash
   git clone https://github.com/your-org/rackmind-ai.git
   cd rackmind-ai
   ```

2. **Install Dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and provide your Gemini API key:
   ```env
   GEMINI_API_KEY="your-google-ai-studio-api-key"
   PORT=3000
   ```

4. **Launch Local Development Server:**
   ```bash
   npm run dev
   ```
   The development server will start at `http://localhost:3000` with full Express API routes, live telemetry simulation, and Vite HMR.

---

## 6. Verification & Quality Gates

Run the automated verification suite before submitting pull requests or deploying:

```bash
# Type check and lint validation
npm run lint

# Production bundle compilation
npm run build
```

---

## 7. Judge FAQ & Technical Proof Points

### Q1: Why use Gemini with Search Grounding instead of a fine-tuned small model?
**Answer:** Enterprise data centers deploy heterogeneous hardware generations (e.g., Dell R760, XE9680, Supermicro, NVIDIA HGX H100, B200, Vera Rubin NVL72). Fine-tuned models suffer from knowledge cutoff when new hardware revisions, firmware errata, or cooling standards (like ASHRAE TC 9.9 liquid-cooling guidelines) are published. Gemini with Google Search Grounding dynamically retrieves up-to-date OEM thermal tolerances, peak draw curves, and firmware errata in real time.

### Q2: How does RackMind AI prevent dangerous automated actions?
**Answer:** RackMind AI implements strict **Human-in-the-Loop (HITL)** governance. Autonomous models analyze, diagnose, and construct verified remediation runbooks, but physical actions (such as PDU breaker tripping, valve adjustments, or node reboots) require explicit operator cryptographic authorization with safety checks (e.g., Slurm checkpointing before evacuation).

---

## 👥 Authors & Acknowledgments

- **Darshan Somanath** — Technical Program Manager & Infrastructure Architect  
- **Kritika Gupta** — Software Engineer & UI/UX Lead  

Developed for the **Google Cloud AI Builder Cup 2026**. Powered by Google Gemini.
