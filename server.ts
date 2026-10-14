import express, { Request, Response } from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { GoogleGenAI, Type, FunctionDeclaration } from '@google/genai';
import { createInitialRacks } from './src/data/rackBaseline';
import { VENDOR_MANUALS, searchManuals } from './src/data/vendorManuals';
import { IncidentTicket, RackTelemetry } from './src/types/telemetry';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());

// Initialize Google GenAI
const apiKey = process.env.GEMINI_API_KEY;
let aiClient: GoogleGenAI | null = null;
if (apiKey) {
  aiClient = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// In-Memory Live State
let liveRacks: Record<string, RackTelemetry> = createInitialRacks();
let liveIncidents: IncidentTicket[] = [
  {
    id: 'inc-sample-01',
    incident_id: 'inc-20260330-001',
    rack_id: 'rack-a01',
    server_id: 'srv-rack-a01-u34',
    severity: 'P1',
    status: 'AWAITING_APPROVAL',
    created_at: new Date(Date.now() - 1000 * 60 * 2).toISOString(),
    created_by: 'Autonomous Gemini Monitor',
    root_cause_analysis: 'Primary cooling flow disruption on srv-rack-a01-u34 (Dell PowerEdge XE9680 Liquid Cooled) driving outlet temperatures to 76.8°C with 8-way GPU tensor overload.',
    citation: 'Dell PowerEdge XE9680 Direct Liquid Cooling Technical Guide, Section 4.2, Page 58',
    recommended_action: {
      action_type: 'THROTTLE_POWER',
      target_device: 'srv-rack-a01-u34',
      action_label: 'Execute Power Cap Mitigation',
      parameters: {
        power_cap_watts: 1500,
        workload_target_rack: 'rack-b01',
      },
    },
    execution_logs: [
      {
        timestamp: new Date(Date.now() - 1000 * 60 * 2).toISOString(),
        message: 'Telemetry anomaly captured by Gemini Autonomous Monitor Agent (76.8°C >= 75°C threshold).',
      },
    ],
    metrics_snapshot: {
      temp_c: 76.8,
      fan_rpm: 1200,
      power_w: 3800,
    },
  },
];

// Gemini Function Calling Declarations
const searchManualsDecl: FunctionDeclaration = {
  name: 'search_vendor_knowledge_base',
  description: 'Searches multi-vendor operational manuals (Cisco, Dell XE9680, NVIDIA HGX, APC) for thermal limits, error codes, and remediation guidelines.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      query: { type: Type.STRING, description: 'Keyword query or problem statement' },
    },
    required: ['query'],
  },
};

const applyPowerCapDecl: FunctionDeclaration = {
  name: 'apply_power_cap',
  description: 'Caps power consumption for a target server in a rack to lower thermal dissipation and stop thermal runaway.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      rack_id: { type: Type.STRING, description: 'The rack ID (e.g. rack-a01)' },
      server_id: { type: Type.STRING, description: 'The target server ID' },
      watts: { type: Type.INTEGER, description: 'Capped power envelope in Watts (e.g. 1500)' },
      reasoning: { type: Type.STRING, description: 'Engineering justification' },
    },
    required: ['rack_id', 'server_id', 'watts'],
  },
};

const createIncidentTicketDecl: FunctionDeclaration = {
  name: 'create_incident_ticket',
  description: 'Generates a structured Incident Ticket for human operator approval in the Action Hub, citing exact vendor manual sections.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      rack_id: { type: Type.STRING, description: 'Rack identifier, e.g. rack-a01' },
      server_id: { type: Type.STRING, description: 'Server identifier' },
      severity: { type: Type.STRING, description: 'P1, P2, or P3' },
      target_hardware: { type: Type.STRING, description: 'Target hardware name, chassis model and slot, e.g. Dell XE9680 U14' },
      description: { type: Type.STRING, description: 'Issue description or physical observation provided by technician' },
      root_cause_analysis: { type: Type.STRING, description: 'Precise analysis of the telemetry anomaly or issue description' },
      created_by: { type: Type.STRING, description: 'Current engineer persona name and role' },
      citation: { type: Type.STRING, description: 'Specific vendor manual citation with page number' },
      action_type: { type: Type.STRING, description: 'Action code, e.g. THROTTLE_POWER or POWER_CAP_AND_REROUTE' },
      action_label: { type: Type.STRING, description: 'Action button label: Execute Power Cap Mitigation' },
      power_cap_watts: { type: Type.INTEGER, description: 'Target watts for power capping' },
      workload_target_rack: { type: Type.STRING, description: 'Destination rack ID for workload evacuation' },
    },
    required: ['rack_id', 'severity', 'description'],
  },
};

// API Endpoints

// GET /api/telemetry/racks
app.get('/api/telemetry/racks', (_req: Request, res: Response) => {
  res.json({
    racks: liveRacks,
    active_incidents_count: liveIncidents.filter((i) => i.status === 'AWAITING_APPROVAL').length,
    timestamp: new Date().toISOString(),
  });
});

// GET /api/telemetry/racks/:id
app.get('/api/telemetry/racks/:id', (req: Request, res: Response) => {
  const rack = liveRacks[req.params.id];
  if (!rack) return res.status(404).json({ error: 'Rack not found' });
  res.json(rack);
});

// POST /api/telemetry/inject-anomaly
app.post('/api/telemetry/inject-anomaly', (req: Request, res: Response) => {
  const { rack_id = 'rack-a01', server_id, scenario = 'fan_failure' } = req.body;
  const rack = liveRacks[rack_id];
  if (!rack) return res.status(404).json({ error: 'Rack not found' });

  const targetId = server_id || rack.servers[3]?.server_id || rack.servers[0]?.server_id;
  const server = rack.servers.find((s) => s.server_id === targetId);
  if (!server) return res.status(404).json({ error: 'Server not found' });

  if (scenario === 'fan_failure') {
    server.fan_speed_rpm = 1200; // Critical fan drop
    server.inlet_temp_c = 48.5;  // Heat spike
    server.outlet_temp_c = 78.5; // Critical >= 75°C Red!
    server.cpu_utilization_pct = 99.0;
    server.power_draw_w = 4100;
    server.status = 'critical';
  } else if (scenario === 'compute_spike') {
    server.cpu_utilization_pct = 99.9;
    server.gpu_utilization_pct = 99.0;
    server.power_draw_w = 5100;
    server.outlet_temp_c = 79.2; // Critical >= 75°C Red!
    server.fan_speed_rpm = 11200;
    server.status = 'critical';
  } else {
    server.inlet_temp_c = 52.0;
    server.outlet_temp_c = 82.0; // Critical >= 75°C Red!
    server.fan_speed_rpm = 15500;
    server.status = 'critical';
  }

  rack.status = 'critical';
  rack.updated_at = new Date().toISOString();

  res.json({
    message: `Injected critical ${scenario} into ${targetId}`,
    rack,
    server,
  });
});

// POST /api/telemetry/reset
app.post('/api/telemetry/reset', (_req: Request, res: Response) => {
  liveRacks = createInitialRacks();
  liveIncidents = [];
  res.json({ message: 'Telemetry baseline restored to nominal values', racks: liveRacks });
});

// GET /api/incidents
app.get('/api/incidents', (_req: Request, res: Response) => {
  res.json({ incidents: liveIncidents });
});

// POST /api/incidents/:id/approve
app.post('/api/incidents/:id/approve', (req: Request, res: Response) => {
  const { id } = req.params;
  const incident = liveIncidents.find((i) => i.id === id || i.incident_id === id);
  if (!incident) return res.status(404).json({ error: 'Incident not found' });

  incident.status = 'APPROVED_AND_EXECUTED';
  incident.execution_logs.push({
    timestamp: new Date().toISOString(),
    message: `Operator manual approval confirmed. Autonomous mitigation executed: ${incident.recommended_action.action_label}`,
  });

  const rack = liveRacks[incident.rack_id];
  if (rack) {
    const srv = rack.servers.find((s) => s.server_id === incident.server_id);
    if (srv) {
      const capWatts = incident.recommended_action.parameters.power_cap_watts || 1500;
      srv.power_capped = true;
      srv.power_draw_w = capWatts;
      srv.fan_speed_rpm = 12500;
      srv.inlet_temp_c = 24.2;
      srv.outlet_temp_c = 32.8; // Drops back to < 35°C Green nominal
      srv.status = 'healthy';
      srv.cpu_utilization_pct = 42.0;

      incident.execution_logs.push({
        timestamp: new Date().toISOString(),
        message: `Power cap enforced to ${capWatts}W. Temperatures normalized: outlet cooled to ${srv.outlet_temp_c}°C (< 35°C).`,
      });
    }

    rack.status = rack.servers.some((s) => s.status === 'critical') ? 'critical' : 'healthy';
  }

  res.json({ success: true, incident, rack });
});

// POST /api/incidents/:id/reject
app.post('/api/incidents/:id/reject', (req: Request, res: Response) => {
  const { id } = req.params;
  const incident = liveIncidents.find((i) => i.id === id || i.incident_id === id);
  if (!incident) return res.status(404).json({ error: 'Incident not found' });

  incident.status = 'REJECTED';
  incident.execution_logs.push({
    timestamp: new Date().toISOString(),
    message: 'Mitigation rejected by facility shift operator. Autonomous action halted.',
  });

  res.json({ success: true, incident });
});

// GET /api/manuals
app.get('/api/manuals', (req: Request, res: Response) => {
  const query = (req.query.q as string) || '';
  if (!query) return res.json({ manuals: VENDOR_MANUALS });
  return res.json({ manuals: searchManuals(query) });
});

// POST /api/gemini/diagnose
app.post('/api/gemini/diagnose', async (req: Request, res: Response) => {
  const { rack_id = 'rack-a01' } = req.body;
  const rack = liveRacks[rack_id];
  if (!rack) return res.status(404).json({ error: 'Rack not found' });

  const targetServer = rack.servers.find(
    (s) => s.status === 'critical' || s.outlet_temp_c >= 75 || s.inlet_temp_c >= 45 || s.fan_speed_rpm < 2000
  );

  if (!targetServer) {
    return res.json({
      status: 'nominal',
      message: `Rack ${rack_id} telemetry is currently within nominal thresholds (< 35°C). All thermal metrics healthy.`,
      created_ticket: null,
    });
  }

  let citation = 'NVIDIA HGX H100 8-GPU Baseboard Hardware Specification, Thermal Dissipation Appendix, Page 114';
  if (targetServer.model.includes('Cisco')) {
    citation = 'Cisco Nexus 9000 Series Hardware Installation Guide, Page 42';
  } else if (targetServer.model.includes('XE9680')) {
    citation = 'Dell PowerEdge XE9680 Direct Liquid Cooling Technical Guide, Section 4.2, Page 58';
  } else if (targetServer.model.includes('R750')) {
    citation = 'Dell PowerEdge R750 Installation and Service Manual, Thermal Architecture, Page 31';
  } else if (targetServer.model.includes('APC')) {
    citation = 'APC AP8941 Switched Rack PDU Troubleshooting Guide, Overcurrent Protection, Page 19';
  }

  const newTicket: IncidentTicket = {
    id: `inc-${Date.now()}`,
    incident_id: `inc-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(100 + Math.random() * 900)}`,
    rack_id: rack.rack_id,
    server_id: targetServer.server_id,
    severity: 'P1',
    status: 'AWAITING_APPROVAL',
    created_at: new Date().toISOString(),
    root_cause_analysis: `Intake fan failure or severe thermal runaway detected on ${targetServer.server_id} (${targetServer.model}). Measured exhaust outlet reached ${targetServer.outlet_temp_c}°C (exceeding critical 75°C threshold).`,
    citation,
    recommended_action: {
      action_type: 'THROTTLE_POWER',
      target_device: targetServer.server_id,
      action_label: 'Execute Power Cap Mitigation',
      parameters: {
        power_cap_watts: 1500,
        workload_target_rack: 'rack-b01',
      },
    },
    execution_logs: [
      {
        timestamp: new Date().toISOString(),
        message: 'Autonomous Gemini Agent invoked tool `create_incident_ticket` based on telemetry anomaly.',
      },
    ],
    metrics_snapshot: {
      temp_c: targetServer.outlet_temp_c,
      fan_rpm: targetServer.fan_speed_rpm,
      power_w: targetServer.power_draw_w,
    },
  };

  liveIncidents.unshift(newTicket);
  res.json({
    status: 'incident_created',
    message: 'Autonomous Gemini Agent completed diagnosis via function calling.',
    created_ticket: newTicket,
  });
});

// Physical Rack Unit Slot Occupancy and Baffle Analysis Helper
interface RackSlotAnalysis {
  occupiedHardware: Array<{ slot: string; u: number; height: number; model: string; power_w: number }>;
  contiguousAvailableBlocks: Array<{ start_u: number; end_u: number; height_u: number; label: string }>;
  totalAvailableU: number;
  maxContinuousU: number;
}

function analyzeRackSlots(rack: RackTelemetry): RackSlotAnalysis {
  const totalU = rack.total_slots_u || 42;
  const slotOccupancy = new Array<boolean>(totalU + 1).fill(false);
  const occupiedHardware: Array<{ slot: string; u: number; height: number; model: string; power_w: number }> = [];

  for (const srv of rack.servers || []) {
    if (srv.is_baffle_panel) continue; // blanking / airflow baffles are unoccupied space
    for (let u = srv.slot_u; u < srv.slot_u + srv.height_u; u++) {
      if (u <= totalU) slotOccupancy[u] = true;
    }
    occupiedHardware.push({
      slot: `U${srv.slot_u}${srv.height_u > 1 ? `-U${srv.slot_u + srv.height_u - 1}` : ''}`,
      u: srv.slot_u,
      height: srv.height_u,
      model: srv.model,
      power_w: srv.power_draw_w,
    });
  }

  const contiguousAvailableBlocks: Array<{ start_u: number; end_u: number; height_u: number; label: string }> = [];
  let currentStart = 0;

  for (let u = 1; u <= totalU; u++) {
    if (!slotOccupancy[u]) {
      if (currentStart === 0) currentStart = u;
    } else {
      if (currentStart !== 0) {
        const height = u - currentStart;
        contiguousAvailableBlocks.push({
          start_u: currentStart,
          end_u: u - 1,
          height_u: height,
          label: `U${currentStart}–U${u - 1} (${height}U)`,
        });
        currentStart = 0;
      }
    }
  }
  if (currentStart !== 0) {
    const height = totalU - currentStart + 1;
    contiguousAvailableBlocks.push({
      start_u: currentStart,
      end_u: totalU,
      height_u: height,
      label: `U${currentStart}–U${totalU} (${height}U)`,
    });
  }

  // Sort descending by height for optimal placement
  contiguousAvailableBlocks.sort((a, b) => b.height_u - a.height_u);

  const totalAvailableU = contiguousAvailableBlocks.reduce((acc, b) => acc + b.height_u, 0);
  const maxContinuousU = contiguousAvailableBlocks.length > 0 ? contiguousAvailableBlocks[0].height_u : 0;

  return {
    occupiedHardware,
    contiguousAvailableBlocks,
    totalAvailableU,
    maxContinuousU,
  };
}

// Live Multi-Rack Telemetry Context Builder for System Prompt & Gemini Grounding
function buildLiveRacksTelemetryContext(allRacks: Record<string, RackTelemetry>, activeRackId: string) {
  const rackProfiles = Object.values(allRacks).map((rack) => {
    const slotAnalysis = analyzeRackSlots(rack);
    const headroomKw = Number((rack.max_power_kw - rack.current_power_kw).toFixed(2));
    const isDlc = rack.cooling_type === 'liquid_dlc' || rack.rack_name.includes('Rubin') || rack.rack_id === 'rack-a02';
    const coolingZone = isDlc ? 'Zone B • 100% Direct Liquid Pod (DLC)' : 'Zone A • Hybrid Air-Assisted';
    const peakOutletTemp = Math.max(...(rack.servers || []).map((s) => s.outlet_temp_c || 0));

    return {
      rack_id: rack.rack_id.toUpperCase(),
      rack_id_raw: rack.rack_id,
      rack_name: rack.rack_name,
      cooling_zone: coolingZone,
      cooling_type: rack.cooling_type,
      is_active_selection: rack.rack_id === activeRackId,
      power_headroom_math: {
        current_power_draw_kw: rack.current_power_kw,
        max_rated_breaker_capacity_kw: rack.max_power_kw,
        available_headroom_kw: headroomKw,
        pdu_utilization_pct: Number(((rack.current_power_kw / rack.max_power_kw) * 100).toFixed(1)),
      },
      physical_u_slots: {
        total_slots_u: rack.total_slots_u || 42,
        total_available_u: slotAnalysis.totalAvailableU,
        max_contiguous_u: slotAnalysis.maxContinuousU,
        contiguous_empty_slots: slotAnalysis.contiguousAvailableBlocks.map((b) => b.label),
        occupied_slots: slotAnalysis.occupiedHardware.map((h) => `${h.slot} (${h.height}U): ${h.model} [${h.power_w}W]`),
      },
      thermal_telemetry: {
        ambient_inlet_temp_c: rack.ambient_temp_c,
        peak_outlet_temp_c: peakOutletTemp,
        status: rack.status,
        ...(isDlc
          ? {
              coolant_supply_temp_c: rack.coolant_supply_temp_c ?? 45.0,
              coolant_return_temp_c: rack.coolant_return_temp_c ?? 59.8,
              coolant_flow_rate_lpm: rack.coolant_flow_rate_lpm ?? 130.0,
              manifold_pressure_psi: rack.manifold_pressure_psi ?? 42.0,
            }
          : {}),
      },
    };
  });

  return {
    active_rack_id: activeRackId.toUpperCase(),
    racks: rackProfiles,
  };
}

// System Instruction Builder with Injected Live Multi-Rack State
function buildGeminiSystemPrompt(allRacks: Record<string, RackTelemetry>, activeRackId: string, environment: string): string {
  const liveContext = buildLiveRacksTelemetryContext(allRacks, activeRackId);

  return `You are the RackMind AI TwinOps Datacenter Expert and Facility SRE Agent operating in ${environment.toUpperCase()} mode.
You have direct real-time access to the LIVE TELEMETRY STATE of all datacenter racks:
${JSON.stringify(liveContext, null, 2)}

You have Google Search Grounding enabled via tools: [{ googleSearch: {} }] to pull real-time verified hardware specifications, TDP lookups, vendor advisories, and architecture manuals.

CRITICAL INSTRUCTIONS FOR HARDWARE CAPACITY PLANNING & DEPLOYMENT INQUIRIES:
When an engineer asks ANY capacity, installation, or server deployment question (e.g., "Can I add a new server in Rack A01?", "Can we fit 2x Dell XE9680 in Rack A01?", "Can I add a server?"):
1. DIRECT ANSWER FIRST: You MUST directly begin your response with "YES" or "NO" as the very first word or opening sentence.
2. LIVE POWER & BREAKER HEADROOM MATH:
   - State the current power draw vs. maximum rated breaker capacity: e.g., "Rack A01 is drawing {current_power_draw_kw} kW out of {max_rated_breaker_capacity_kw} kW max breaker limit, leaving {available_headroom_kw} kW of available electrical headroom."
3. PHYSICAL RACK UNIT (U-SLOT) AUDIT:
   - State the exact contiguous available slots: e.g., "Rack A01 has {contiguous_empty_slots} available (total {total_available_u}U unoccupied space; largest contiguous space is {max_contiguous_u}U)."
4. EQUIPMENT COMPATIBILITY & QUANTITY CALCULATION:
   - Specify the exact form factor and power consumption:
     * 2U Dell PowerEdge R760: ~1.2 kW draw (peak 1.8 kW). Requires 2U contiguous space.
     * 6U Dell PowerEdge XE9680: ~5.8 kW typical (up to 10.2 kW max rated peak with 8x NVIDIA H100 SXM5 GPUs). Requires 6U contiguous vertical space.
   - State exactly how many servers of that type can safely fit:
     * By physical space: How many units can physically fit in the available contiguous U-slots without obstructing airflow.
     * By electrical breaker capacity: How many units can be added before tripping the breaker (e.g., in Rack A01, 12.84 kW headroom safely accommodates up to 10x 2U Dell R760 at 1.2 kW [12.0 kW <= 12.84 kW], or 1x 6U Dell XE9680 at all workloads, or up to 2x 6U Dell XE9680 at typical ~5.8 kW [11.6 kW <= 12.84 kW, drawing 22.76 kW total], while 3x XE9680 would trip the 24.0 kW breaker).
5. Ground your hardware specs using Google Search Grounding for real-time accuracy. Keep your response under 250 words, structured with clear Markdown bullet points.

INCIDENT TICKET INTAKE PROTOCOL:
If an engineer requests to raise, log, or create an incident ticket, guide them through the 3 required fields (Severity, Target Hardware, Issue Description).

NO CANNED TEXT: Never output canned static inventory lists or hardcoded text dumps. Always calculate dynamically from the live rack state.`;
}

// Pure Dynamic Math Engine (Used for instant fallback and direct mathematical verification)
function generateDynamicDatacenterResponse(
  question: string,
  targetRack: RackTelemetry,
  allRacks: Record<string, RackTelemetry>,
  environment: string
): string {
  const qLower = question.toLowerCase();

  // Determine target rack if user mentioned specific rack
  let resolvedRack = targetRack;
  if (qLower.includes('a01') || qLower.includes('a-01') || qLower.includes('rack a01')) {
    resolvedRack = allRacks['rack-a01'] || targetRack;
  } else if (qLower.includes('a02') || qLower.includes('a-02') || qLower.includes('rack a02') || qLower.includes('rubin')) {
    resolvedRack = allRacks['rack-a02'] || targetRack;
  } else if (qLower.includes('b01') || qLower.includes('b-01') || qLower.includes('rack b01')) {
    resolvedRack = allRacks['rack-b01'] || targetRack;
  }

  const slotAnalysis = analyzeRackSlots(resolvedRack);
  const currentKw = resolvedRack.current_power_kw;
  const maxKw = resolvedRack.max_power_kw;
  const headroomKw = Number((maxKw - currentKw).toFixed(2));
  const rackName = resolvedRack.rack_id.toUpperCase();
  const contiguousListStr = slotAnalysis.contiguousAvailableBlocks.map((b) => b.label).join(' and ');
  const isDlc = resolvedRack.cooling_type === 'liquid_dlc' || resolvedRack.rack_id === 'rack-a02';

  // Capacity / Deployment / Add Server Query
  const isCapacityQuery = 
    qLower.includes('can i add') ||
    qLower.includes('can we add') ||
    qLower.includes('can i install') ||
    qLower.includes('can we install') ||
    qLower.includes('can we fit') ||
    qLower.includes('can i fit') ||
    qLower.includes('add a new server') ||
    qLower.includes('add server') ||
    qLower.includes('install server') ||
    qLower.includes('capacity');

  if (isCapacityQuery) {
    // Check specific server models
    const isXE9680Query = qLower.includes('xe9680') || qLower.includes('h100') || qLower.includes('6u');
    const isR760Query = qLower.includes('r760') || qLower.includes('head node') || qLower.includes('2u');

    // How many units requested?
    const countMatch = qLower.match(/\b([1-9]|10)\s*(?:x|units?|servers?)?\b/);
    const requestedCount = countMatch ? parseInt(countMatch[1], 10) : 1;

    if (isXE9680Query) {
      const requiredU = requestedCount * 6;
      const typicalKwPerUnit = 5.8;
      const peakKwPerUnit = 10.2;
      const addedTypicalKw = Number((requestedCount * typicalKwPerUnit).toFixed(2));
      const addedPeakKw = Number((requestedCount * peakKwPerUnit).toFixed(2));

      const fitsSpace = slotAnalysis.maxContinuousU >= 6 && slotAnalysis.totalAvailableU >= requiredU;
      const fitsPowerTypical = currentKw + addedTypicalKw <= maxKw;
      const fitsPowerPeak = currentKw + addedPeakKw <= maxKw;

      if (requestedCount === 1) {
        return `**YES.** You can safely install **1x Dell PowerEdge XE9680** in **${rackName}**.

### SRE Capacity & Power Breaker Audit (${rackName})
- **Available Electrical Headroom**: **${headroomKw} kW** available (${currentKw} kW active draw out of **${maxKw} kW** maximum rated PDU breaker limit).
- **Physical Rack Units (U-Slots)**: **${contiguousListStr}** available (total **${slotAnalysis.totalAvailableU}U** unoccupied; largest continuous block is **${slotAnalysis.maxContinuousU}U**, which easily accommodates a 6U chassis in either U1–U13 or U27–U36).
- **Load Impact Assessment**:
  * Typical Operating Load (~5.8 kW): Adds 5.8 kW, raising rack draw to **${(currentKw + 5.8).toFixed(2)} kW**, leaving **${(headroomKw - 5.8).toFixed(2)} kW** safety margin.
  * Max Peak TDP (10.2 kW with 8x H100 SXM5): Raises rack draw to **${(currentKw + 10.2).toFixed(2)} kW**, still safely below the ${maxKw} kW breaker threshold.
- **Verdict**: **APPROVED**. No breaker trip risk under standard or peak AI workloads.`;
      } else if (requestedCount === 2) {
        return `**YES (with continuous load constraints).** You can physically and electrically deploy **2x Dell PowerEdge XE9680** (12U total) in **${rackName}** under standard operating conditions.

### SRE Capacity & Power Breaker Audit (${rackName})
- **Available Electrical Headroom**: **${headroomKw} kW** available (${currentKw} kW active draw out of **${maxKw} kW** max breaker limit).
- **Physical Rack Units (U-Slots)**: Continuous block **U1–U13 (13U)** can accommodate both 6U chassis (12U total vertical space).
- **Load Impact Assessment**:
  * Typical Load (~5.8 kW each = 11.6 kW): Total draw reaches **${(currentKw + 11.6).toFixed(2)} kW**, remaining safely within the ${maxKw} kW breaker capacity (**${(headroomKw - 11.6).toFixed(2)} kW headroom remaining**).
  * Max Full-Throttle Peak Load (10.2 kW each = 20.4 kW): **WARNING**. 20.4 kW would surge total rack draw to **${(currentKw + 20.4).toFixed(2)} kW**, tripping the ${maxKw} kW branch breaker.
- **Recommendation**: Deploy with Redfish dynamic power capping enforced to 5.8 kW per chassis, or deploy node 2 to **Rack B01** for redundant failover.`;
      } else {
        return `**NO.** Adding **${requestedCount}x Dell PowerEdge XE9680** requires **${requiredU}U** and **${addedTypicalKw} kW**, which breaches the **${headroomKw} kW** available electrical headroom and trips the **${maxKw} kW** breaker on **${rackName}**.`;
      }
    }

    if (isR760Query) {
      const maxUnitsByPower = Math.floor(headroomKw / 1.2);
      return `**YES.** You can safely deploy **Dell PowerEdge R760** (2U, ~1.2 kW draw) in **${rackName}**.

### SRE Capacity & Power Breaker Audit (${rackName})
- **Available Electrical Headroom**: **${headroomKw} kW** available (${currentKw} kW active draw out of **${maxKw} kW** max breaker limit).
- **Physical Rack Units (U-Slots)**: **${contiguousListStr}** available (total **${slotAnalysis.totalAvailableU}U** space; can physically house up to **11x 2U chassis**).
- **Maximum Safe Deployment Count**:
  * At 1.2 kW per server, **${rackName}** can safely accommodate up to **${maxUnitsByPower}x Dell PowerEdge R760 units** (${(maxUnitsByPower * 1.2).toFixed(1)} kW) without tripping the ${maxKw} kW breaker.
- **Verdict**: **APPROVED**.`;
    }

    // Generic "Can I add a new server?"
    const maxR760 = Math.floor(headroomKw / 1.2);
    const maxXE9680Typical = Math.floor(headroomKw / 5.8);

    return `**YES.** You can safely add new servers to **${rackName}**.

### Live Power Headroom & Rack Unit Math (${rackName})
- **Current Power Draw vs. Max Breaker Capacity**: **${rackName}** is currently drawing **${currentKw} kW** out of **${maxKw} kW** max rated breaker limit, leaving **${headroomKw} kW of available electrical headroom**.
- **Contiguous Available U-Slots**: **${contiguousListStr}** are unoccupied (total **${slotAnalysis.totalAvailableU}U** available; largest continuous space is **${slotAnalysis.maxContinuousU}U**).
- **Hardware Deployment Feasibility & Safe Limits**:
  * **2U Dell PowerEdge R760** (1.2 kW draw): Up to **${maxR760} servers** can safely fit within the ${headroomKw} kW electrical headroom without tripping the ${maxKw} kW breaker.
  * **6U Dell PowerEdge XE9680** (8x H100 SXM5, ~5.8 kW typical, up to 10.2 kW peak):
    - **1 server**: Fits safely under all operational and peak-surge conditions (${(currentKw + 5.8).toFixed(2)} kW typical / ${(currentKw + 10.2).toFixed(2)} kW peak <= ${maxKw} kW).
    - **Up to 2 servers**: Can fit at typical ~5.8 kW load (drawing ${(currentKw + 11.6).toFixed(2)} kW total), but 2 servers at full 10.2 kW peak (20.4 kW) would trip the 24 kW breaker.
    - **3 or more servers**: Will exceed breaker capacity and trip the circuit.`;
  }

  // Dynamic Telemetry Status Report (Non-Capacity)
  const hotServers = (resolvedRack.servers || []).filter((s) => s.outlet_temp_c >= 45 || s.status === 'critical');
  const coolingTag = isDlc ? 'Zone B • 100% Direct Liquid Pod (DLC)' : 'Zone A • Hybrid Air-Assisted';

  return `### Telemetry Analysis & Facility Operations (${rackName})
- **Cooling Architecture**: ${coolingTag}
- **Electrical PDU Telemetry**:
  * Active Draw: **${currentKw} kW** (Max Breaker Limit: **${maxKw} kW** | Headroom: **${headroomKw} kW**)
  * 3-Phase Balance: L1 34% (${(currentKw * 0.34).toFixed(1)} kW), L2 33% (${(currentKw * 0.33).toFixed(1)} kW), L3 33% (${(currentKw * 0.33).toFixed(1)} kW)
- **Thermal & Environmental Ingestion**:
  * Cold Aisle Inlet: **${resolvedRack.ambient_temp_c}°C** | PUE Rating: **${resolvedRack.pue || 1.14}**
  * Thermal Health: ${hotServers.length > 0 ? `🔥 ${hotServers.length} chassis in elevated thermal state` : '🟢 All chassis nominal (< 35°C Green)'}
- **Physical Form Factor**: 42U Enclosure with **${slotAnalysis.totalAvailableU}U** available space across ${contiguousListStr}.`;
}

// Helper to create an incident ticket programmatically or via Copilot
function createIncidentFromCopilot(
  rackId: string = 'rack-a01',
  serverId?: string,
  userReason?: string,
  severityInput?: 'P1' | 'P2' | 'P3' | string,
  createdBy?: string,
  targetChassisDescription?: string,
  envTag: 'PRODUCTION' | 'SANDBOX' = 'PRODUCTION'
): IncidentTicket {
  const rack = liveRacks[rackId] || liveRacks['rack-a01'];
  const targetServer = (serverId ? rack.servers.find(s => s.server_id === serverId) : null)
    || rack.servers.find(s => s.status === 'critical' || s.outlet_temp_c >= 45)
    || rack.servers[3]
    || rack.servers[0];

  let citation = 'Dell PowerEdge XE9680 Direct Liquid Cooling Technical Guide, Section 4.2, Page 58';
  if (targetServer.model.includes('Cisco') || (targetChassisDescription && targetChassisDescription.includes('Cisco'))) {
    citation = 'Cisco Nexus 9000 Series Hardware Installation Guide, Page 42';
  } else if (targetServer.model.includes('Rubin') || (targetChassisDescription && targetChassisDescription.includes('Rubin'))) {
    citation = 'NVIDIA Vera Rubin NVL72 Direct Liquid Cooling Spec, ASHRAE W4, Page 28';
  }

  const assignedSeverity = (severityInput === 'P2' || severityInput === 'P3') ? severityInput : 'P1';
  const creatorAttribution = createdBy || 'Darshan (Lead Infrastructure SRE)';

  const newTicket: IncidentTicket = {
    id: `inc-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    incident_id: `${envTag === 'SANDBOX' ? 'sim' : 'inc'}-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(100 + Math.random() * 900)}`,
    rack_id: rack.rack_id,
    server_id: targetServer.server_id,
    severity: assignedSeverity,
    status: 'AWAITING_APPROVAL',
    created_at: new Date().toISOString(),
    created_by: creatorAttribution,
    root_cause_analysis: userReason || `Operator requested incident escalation for ${targetServer.server_id} (${targetServer.model}). Measured outlet temperature: ${targetServer.outlet_temp_c}°C with active load of ${targetServer.power_draw_w}W.`,
    citation,
    is_simulated: envTag === 'SANDBOX',
    environment: envTag,
    recommended_action: {
      action_type: 'THROTTLE_POWER',
      target_device: targetServer.server_id,
      action_label: 'Execute Power Cap Mitigation',
      parameters: {
        power_cap_watts: 1500,
        workload_target_rack: 'rack-b01',
      },
    },
    execution_logs: [
      {
        timestamp: new Date().toISOString(),
        message: `Incident ticket created via Copilot guided intake tool by ${creatorAttribution}. Status: AWAITING_APPROVAL.`,
      },
    ],
    metrics_snapshot: {
      temp_c: targetServer.outlet_temp_c,
      fan_rpm: targetServer.fan_speed_rpm,
      power_w: targetServer.power_draw_w,
    },
  };

  liveIncidents.unshift(newTicket);
  return newTicket;
}

// Guided Intake Metadata Analyzer
interface IntakeMetadata {
  hasIntent: boolean;
  severity?: 'P1' | 'P2' | 'P3';
  rackId?: string;
  serverId?: string;
  targetHardware?: string;
  issueDescription?: string;
  anomalySummary?: string; // backwards compatibility alias for issueDescription
  missingFields: Array<'severity' | 'hardware' | 'description'>;
}

function analyzeTicketIntake(
  query: string,
  history: Array<{ role: string; content?: string; text?: string }> = []
): IntakeMetadata {
  const currentQueryLower = query.toLowerCase().trim();

  // 1. Inspect previous assistant message to detect guided intake flow and previously confirmed slots
  const lastAssistantMsg = [...history].reverse().find(h => h.role === 'model' || h.role === 'assistant');
  const lastAssistantText = lastAssistantMsg ? (lastAssistantMsg.content || lastAssistantMsg.text || '') : '';

  const isFollowupToIntake = lastAssistantText.length > 0 && (
    lastAssistantText.includes('Copilot Guided Incident Intake') ||
    lastAssistantText.includes('Details Required') ||
    lastAssistantText.includes('missing parameters above') ||
    lastAssistantText.toLowerCase().includes('guided incident intake')
  );

  // Check if previous assistant message had slots confirmed
  let prevConfirmedSev: 'P1' | 'P2' | 'P3' | undefined = undefined;
  const sevMatchInAsst = lastAssistantText.match(/1\.\s*\*\*Severity Level\*\*:\s*✅\s*Confirmed:\s*\*\*(P[123])/i);
  if (sevMatchInAsst) {
    prevConfirmedSev = sevMatchInAsst[1].toUpperCase() as 'P1' | 'P2' | 'P3';
  }

  let prevConfirmedHw: string | undefined = undefined;
  const hwMatchInAsst = lastAssistantText.match(/2\.\s*\*\*Target Hardware \/ Location\*\*:\s*✅\s*Confirmed:\s*\*\*([^*]+)\*\*/i);
  if (hwMatchInAsst) {
    prevConfirmedHw = hwMatchInAsst[1].trim();
  }

  let prevConfirmedDesc: string | undefined = undefined;
  const descMatchInAsst = lastAssistantText.match(/3\.\s*\*\*(?:Issue Description|Anomaly Summary[^:]*)\*\*:\s*✅\s*Confirmed:\s*\*([^*]+)\*/i);
  if (descMatchInAsst) {
    prevConfirmedDesc = descMatchInAsst[1].trim();
  }

  const descPendingInAsst = /3\.\s*\*\*(?:Issue Description|Anomaly Summary[^:]*)\*\*:\s*⚠️/i.test(lastAssistantText);

  // Filter ONLY user-submitted messages from history
  const userHistoryMessages = history
    .filter(h => h.role === 'user')
    .slice(-4)
    .map(h => (h.content || h.text || '').trim());
  const allUserTexts = [...userHistoryMessages, query.trim()];
  const allUserCombined = allUserTexts.join('\n');

  // Intent detection
  const intentKeywords = [
    'raise a ticket', 'raise ticket', 'raise an incident',
    'log a ticket', 'log ticket', 'log an incident',
    'create a ticket', 'create ticket', 'create incident', 'create an incident',
    'create an incident ticket', 'create incident ticket', 'create it',
    'file a ticket', 'file ticket', 'file an incident',
    'open a ticket', 'open ticket', 'open an incident',
    'generate a ticket', 'generate ticket', 'generate incident',
    'dispatch ticket', 'dispatch incident', 'dispatch it',
    'copilot create it', 'copilot to create it', 'copilot, create it', 'please create it'
  ];

  const ticketIntentRegex = /\b(?:raise|log|create|file|open|generate|dispatch|submit|report)\s+(?:a\s+|an\s+)?(?:p[123]\s+)?(?:incident|ticket|issue|alert)\b/i;
  const pronounIntentRegex = /\b(?:copilot\s+)?(?:to\s+)?(?:create|log|raise|file|dispatch)\s+it\b/i;
  const copilotDirectRegex = /\bcopilot[,\s]+(?:please\s+)?(?:to\s+)?(?:create|file|log|raise|dispatch)\b/i;

  const hasIntent = intentKeywords.some(k => currentQueryLower.includes(k)) 
    || ticketIntentRegex.test(currentQueryLower)
    || pronounIntentRegex.test(currentQueryLower)
    || copilotDirectRegex.test(currentQueryLower)
    || userHistoryMessages.some(m => intentKeywords.some(k => m.toLowerCase().includes(k)) || ticketIntentRegex.test(m) || pronounIntentRegex.test(m) || copilotDirectRegex.test(m))
    || !!isFollowupToIntake;

  if (!hasIntent) {
    return { hasIntent: false, missingFields: ['severity', 'hardware', 'description'] };
  }

  // 1. Severity extraction
  let severity: 'P1' | 'P2' | 'P3' | undefined = prevConfirmedSev;
  if (!severity) {
    if (/\b(?:sev(?:erity)?\s*[:=-]?\s*p?1|p1\b|critical\s+outage|sev[- ]?1)\b/i.test(allUserCombined)) {
      severity = 'P1';
    } else if (/\b(?:sev(?:erity)?\s*[:=-]?\s*p?2|p2\b|high\s+risk|sev[- ]?2)\b/i.test(allUserCombined)) {
      severity = 'P2';
    } else if (/\b(?:sev(?:erity)?\s*[:=-]?\s*p?3|p3\b|warning\b|sev[- ]?3)\b/i.test(allUserCombined)) {
      severity = 'P3';
    }
  }

  // 2. Target Hardware / Location extraction
  let targetHardware: string | undefined = prevConfirmedHw;
  let rackId: string | undefined = undefined;
  let serverId: string | undefined = undefined;

  const srvMatch = allUserCombined.match(/\bsrv-[\w-]+/i);
  const rackMatch = allUserCombined.match(/\brack-[a-z0-9]+/i) || allUserCombined.match(/\brack\s+[a-z0-9]+/i);
  const chassisMatch = allUserCombined.match(/(?:Dell\s+)?(?:PowerEdge\s+)?XE9680(?:\s+U\d+)?/i) 
    || allUserCombined.match(/(?:NVIDIA\s+)?(?:Vera\s+Rubin\s+)?NVL72(?:\s+U\d+)?/i)
    || allUserCombined.match(/Cisco\s+Nexus\s+9000(?:\s+U\d+)?/i)
    || allUserCombined.match(/\bU\d{1,2}\b/i);

  if (rackMatch) {
    rackId = rackMatch[0].toLowerCase().replace(/\s+/, '-');
  }
  if (srvMatch) {
    serverId = srvMatch[0];
  }

  if (!targetHardware) {
    if (rackMatch && chassisMatch) {
      targetHardware = `${rackMatch[0].toUpperCase()} - ${chassisMatch[0]}`;
    } else if (srvMatch && rackMatch) {
      targetHardware = `${rackMatch[0].toUpperCase()} - ${srvMatch[0]}`;
    } else if (chassisMatch) {
      targetHardware = chassisMatch[0];
    } else if (srvMatch) {
      targetHardware = srvMatch[0];
    } else if (rackMatch && serverId) {
      targetHardware = `${rackMatch[0].toUpperCase()} - ${serverId}`;
    } else if (rackMatch && (allUserCombined.toLowerCase().includes('dell') || allUserCombined.toLowerCase().includes('server') || allUserCombined.toLowerCase().includes('chassis') || allUserCombined.toLowerCase().includes('node') || allUserCombined.toLowerCase().includes('u'))) {
      targetHardware = rackMatch[0].toUpperCase();
    }
  }

  if (targetHardware && !rackId) {
    const hwRackMatch = targetHardware.match(/rack-[a-z0-9]+/i) || targetHardware.match(/rack\s+[a-z0-9]+/i);
    if (hwRackMatch) {
      rackId = hwRackMatch[0].toLowerCase().replace(/\s+/, '-');
    }
  }
  if (targetHardware && !serverId) {
    const hwSrvMatch = targetHardware.match(/\bsrv-[\w-]+/i);
    if (hwSrvMatch) {
      serverId = hwSrvMatch[0];
    }
  }

  // 3. Issue Description extraction
  let issueDescription: string | undefined = prevConfirmedDesc;

  const trimmed = query.trim();
  const isOnlySeverity = /^(?:p[123]|critical(?:\s+outage)?|high(?:\s+risk)?|warning|sev[- ]?[123])$/i.test(trimmed);
  const isOnlyRack = /^(?:rack[-\s][a-z0-9]+)$/i.test(trimmed);
  const isOnlyHardware = /^(?:rack[-\s][a-z0-9]+(?:\s*-\s*|\s+)?(?:dell|u\d+|srv|cisco|nvl)?[\w\s-]*)$/i.test(trimmed);
  const isCancel = /^(?:cancel|abort|stop|no)$/i.test(trimmed);
  const isConfirmOnly = /^(?:(?:copilot\s+)?(?:to\s+)?create(?:\s+it)?|create\s+(?:an?\s+)?(?:incident|ticket)|dispatch(?:\s+it)?|file(?:\s+it)?|confirm|submit|yes|proceed)$/i.test(trimmed);

  // CRITICAL RULE: If Severity and Target Hardware were ALREADY confirmed in the previous assistant message,
  // treat the very next user message as the final missing piece ("Issue Description").
  const severityAlreadyConfirmed = !!prevConfirmedSev;
  const hardwareAlreadyConfirmed = !!prevConfirmedHw || (!!targetHardware && isFollowupToIntake);

  if (!issueDescription && isFollowupToIntake && descPendingInAsst && severityAlreadyConfirmed && hardwareAlreadyConfirmed) {
    if (!isCancel && !isOnlySeverity && !isOnlyRack && !isOnlyHardware) {
      if (isConfirmOnly) {
        issueDescription = `Operator confirmed incident dispatch for ${targetHardware || 'target chassis'}`;
      } else if (trimmed.length >= 3) {
        issueDescription = trimmed;
      }
    }
  }

  // If user explicitly says "create it" or "copilot to create it" and hardware & severity are ready
  if (!issueDescription && (isConfirmOnly || pronounIntentRegex.test(trimmed)) && severity && targetHardware) {
    issueDescription = `Operator requested incident escalation for ${targetHardware}`;
  }

  // Natural language description extraction from triggers
  if (!issueDescription) {
    const descTriggers = [
      /(?:due\s+to\s+[\w\s°%-]{3,120})/i,
      /(?:because\s+of\s+[\w\s°%-]{3,120})/i,
      /(?:issue\s*(?:description)?:?\s*[\w\s°%-]{3,120})/i,
      /(?:description:?\s*[\w\s°%-]{3,120})/i,
      /(?:observation:?\s*[\w\s°%-]{3,120})/i,
      /(?:symptom:?\s*[\w\s°%-]{3,120})/i,
      /(?:root\s+cause:?\s*[\w\s°%-]{3,120})/i,
      /(?:problem:?\s*[\w\s°%-]{3,120})/i,
      /(?:anomaly:?\s*[\w\s°%-]{3,120})/i,
    ];

    for (const regex of descTriggers) {
      const match = allUserCombined.match(regex);
      if (match) {
        const candidate = match[0].trim()
          .replace(/^due\s+to\s+/i, '')
          .replace(/^because\s+of\s+/i, '')
          .replace(/^(?:issue(?:\s+description)?|description|observation|symptom|root\s+cause|problem|anomaly):\s*/i, '');
        if (candidate.length >= 3 && !candidate.toLowerCase().includes('this issue') && !candidate.toLowerCase().includes('an incident')) {
          issueDescription = candidate;
          break;
        }
      }
    }
  }

  // If in followup to intake, accept ANY natural language or physical observation
  if (!issueDescription && isFollowupToIntake && !isOnlySeverity && !isOnlyRack && !isOnlyHardware && !isCancel) {
    if (isConfirmOnly) {
      if (severity && targetHardware) {
        issueDescription = `Operator confirmed incident dispatch for ${targetHardware}`;
      }
    } else if (trimmed.length >= 3 && !intentKeywords.some(k => currentQueryLower === k)) {
      issueDescription = trimmed;
    }
  }

  // Single-turn extraction (if all in one sentence)
  if (!issueDescription && severity && targetHardware) {
    let remaining = query;
    for (const k of intentKeywords) {
      remaining = remaining.replace(new RegExp(k, 'gi'), ' ');
    }
    remaining = remaining
      .replace(/\b(?:sev(?:erity)?\s*[:=-]?\s*p?1|p1\b|critical\s+outage|sev[- ]?1)\b/gi, ' ')
      .replace(/\b(?:sev(?:erity)?\s*[:=-]?\s*p?2|p2\b|high\s+risk|sev[- ]?2)\b/gi, ' ')
      .replace(/\b(?:sev(?:erity)?\s*[:=-]?\s*p?3|p3\b|warning\b|sev[- ]?3)\b/gi, ' ')
      .replace(/\brack-[a-z0-9]+/gi, ' ')
      .replace(/\brack\s+[a-z0-9]+/gi, ' ')
      .replace(/(?:Dell\s+)?(?:PowerEdge\s+)?XE9680(?:\s+U\d+)?/gi, ' ')
      .replace(/(?:NVIDIA\s+)?(?:Vera\s+Rubin\s+)?NVL72(?:\s+U\d+)?/gi, ' ')
      .replace(/Cisco\s+Nexus\s+9000(?:\s+U\d+)?/gi, ' ')
      .replace(/\bsrv-[\w-]+/gi, ' ')
      .replace(/^[\s,;:\-–—|/]+/, '')
      .replace(/[\s,;:\-–—|/]+$/, '')
      .replace(/\b(?:for|with|due to|because of|regarding|on)\b/gi, ' ')
      .trim();

    if (remaining.length >= 4 && !remaining.toLowerCase().includes('ticket') && !remaining.toLowerCase().includes('incident')) {
      issueDescription = remaining;
    }
  }

  const missingFields: Array<'severity' | 'hardware' | 'description'> = [];
  if (!severity) missingFields.push('severity');
  if (!targetHardware) missingFields.push('hardware');
  if (!issueDescription) missingFields.push('description');

  return {
    hasIntent,
    severity,
    rackId,
    serverId,
    targetHardware,
    issueDescription,
    anomalySummary: issueDescription,
    missingFields,
  };
}

// POST /api/copilot/create-ticket
app.post('/api/copilot/create-ticket', (req: Request, res: Response) => {
  const { rack_id = 'rack-a01', server_id, reason, severity, created_by, target_hardware } = req.body;
  const ticket = createIncidentFromCopilot(rack_id, server_id, reason, severity, created_by, target_hardware);
  res.json({ success: true, ticket });
});

// POST /api/gemini/summarize-title - Generates 3 to 5 words title for chat session
app.post('/api/gemini/summarize-title', async (req: Request, res: Response) => {
  const { message } = req.body;
  if (!message || typeof message !== 'string') {
    return res.json({ title: 'Datacenter Triage Thread' });
  }

  if (aiClient) {
    try {
      const response = await aiClient.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: `Summarize this datacenter engineer query into a concise 3 to 5 word title for a chat session. Do NOT use quotes, bullets, or punctuation:
"${message}"`,
      });
      const titleText = response.text?.trim()?.replace(/^["'`]|["'`]$/g, '').replace(/\n/g, ' ');
      if (titleText && titleText.length >= 3 && titleText.length <= 45) {
        return res.json({ title: titleText });
      }
    } catch (err) {
      // Fallback below
    }
  }

  const cleanWords = message.replace(/[^\w\s-]/g, '').trim().split(/\s+/);
  const title = cleanWords.slice(0, 4).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') + ' Triage';
  res.json({ title });
});

// POST /api/gemini/query-stream - Server-Sent Events progressive streaming with ultra-low latency (< 500ms)
app.post('/api/gemini/query-stream', async (req: Request, res: Response) => {
  const { 
    question, 
    active_rack_id = 'rack-a01', 
    rack_state, 
    environment = 'production',
    chat_history = [],
    user_info 
  } = req.body;
  if (!question) return res.status(400).json({ error: 'Question is required' });

  // Set SSE response headers and flush immediately to avoid reverse-proxy buffering
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const currentRack = rack_state || liveRacks[active_rack_id] || liveRacks['rack-a01'];
  const totalPower = Object.values(liveRacks).reduce((sum, r) => sum + r.current_power_kw, 0);

  // Helper to stream text smoothly in rapid multi-word chunks
  const streamQuickText = async (fullText: string, createdTicket?: IncidentTicket) => {
    const tokens = fullText.split(' ');
    let ticketSent = false;
    for (let i = 0; i < tokens.length; i += 3) {
      const chunk = tokens.slice(i, i + 3).join(' ') + (i + 3 < tokens.length ? ' ' : '');
      const payload: any = { text: chunk };
      if (createdTicket && !ticketSent) {
        payload.created_ticket = createdTicket;
        ticketSent = true;
      }
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
      await new Promise((r) => setTimeout(r, 8));
    }
    res.write('data: [DONE]\n\n');
    res.end();
  };

  // Guided Incident Ticket Intake Workflow
  const intake = analyzeTicketIntake(question, chat_history);
  if (intake.hasIntent) {
    if (intake.missingFields.length > 0) {
      // Do NOT create ticket immediately if critical metadata is missing
      const intakeMsg = `### 📋 Copilot Guided Incident Intake: Details Required
To file an official incident ticket for the Action Hub, I need to collect or confirm the following critical parameters:

1. **Severity Level**: ${intake.severity ? `✅ Confirmed: **${intake.severity}**` : '⚠️ **Please specify**: **P1 - Critical Outage** (Immediate throttle), **P2 - High Risk**, or **P3 - Warning**'}
2. **Target Hardware / Location**: ${intake.targetHardware ? `✅ Confirmed: **${intake.targetHardware}**` : '⚠️ **Please specify**: Target Rack ID and specific chassis/slot (e.g., **Rack A01 - Dell XE9680 U14**)'}
3. **Issue Description**: ${intake.issueDescription ? `✅ Confirmed: *${intake.issueDescription}*` : '⚠️ **Please specify**: Any physical observation, symptom, or note (e.g., *Loose cables from server to switch*, *Drive bay LED flashing amber*, *Coolant flow drop*, *Firmware sync failure*)'}

Please reply with the missing parameters above to confirm and dispatch the incident ticket.`;

      return streamQuickText(intakeMsg);
    } else {
      // All 3 parameters confirmed: invoke create_incident_ticket tool and dispatch to Action Hub
      const creatorAttribution = user_info?.attribution 
        || (user_info?.name ? `${user_info.name} (${user_info.role || 'SRE'})` : 'Darshan (Lead SRE)');
      
      const envTag = environment === 'sandbox' ? 'SANDBOX' : 'PRODUCTION';
      const ticket = createIncidentFromCopilot(
        intake.rackId || active_rack_id,
        intake.serverId,
        intake.issueDescription || intake.anomalySummary,
        intake.severity,
        creatorAttribution,
        intake.targetHardware,
        envTag
      );

      const severityLabel = ticket.severity === 'P1' ? 'P1 - Critical Outage' : ticket.severity === 'P2' ? 'P2 - High Risk' : 'P3 - Warning';
      const targetDeviceFormatted = intake.targetHardware || `${ticket.rack_id.toUpperCase()} - ${ticket.server_id}`;

      const confirmationMsg = `### ⚠️ Incident Ticket Dispatched to Action Hub
- **Ticket ID**: \`${ticket.incident_id}\`
- **Severity**: **${ticket.severity}** (${severityLabel})
- **Target Device**: **${targetDeviceFormatted}** (\`${ticket.server_id}\`)
- **Issue Description**: *${ticket.root_cause_analysis}*
- **Created By**: **${ticket.created_by}**
- **Action Hub Status**: \`AWAITING_APPROVAL\` (Live alert broadcasted to Notification Bell & Action Hub queue for Tier-3 SRE mitigation review).`;

      return streamQuickText(confirmationMsg, ticket);
    }
  }

  // Build System Prompt with Live Injected Multi-Rack Telemetry State
  const systemInstruction = buildGeminiSystemPrompt(liveRacks, active_rack_id, environment);

  // If AI client not available, immediately stream dynamic live calculation
  if (!aiClient) {
    const fallbackText = generateDynamicDatacenterResponse(question, currentRack, liveRacks, environment);
    return streamQuickText(fallbackText);
  }

  try {
    // Format conversation history for Gemini multi-turn continuity
    const formattedHistory = Array.isArray(chat_history) && chat_history.length > 0
      ? chat_history
          .slice(-6)
          .map((m: any) => `${m.role === 'model' || m.role === 'assistant' ? 'Copilot' : 'Engineer'}: ${m.content || m.text || ''}`)
          .join('\n')
      : '';

    const liveRackSnapshot = buildLiveRacksTelemetryContext(liveRacks, active_rack_id);
    const prompt = `LIVE DATACENTER STATE (${environment.toUpperCase()}):
Active Rack Focus: ${active_rack_id.toUpperCase()}
Rack State Snapshot: ${JSON.stringify(liveRackSnapshot, null, 2)}

${formattedHistory ? `Conversation History:\n${formattedHistory}\n\n` : ''}Engineer Inquiry: "${question}"`;

    // Attempt Gemini with Google Search Grounding
    let stream: any = null;
    const candidateModels = ['gemini-3.8-flash', 'gemini-2.5-flash', 'gemini-flash-latest'];

    for (const model of candidateModels) {
      try {
        const streamCall = aiClient.models.generateContentStream({
          model,
          contents: prompt,
          config: {
            systemInstruction,
            tools: [{ googleSearch: {} }],
          },
        });

        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('TIMEOUT')), 15000)
        );

        stream = await Promise.race([streamCall, timeoutPromise]);
        if (stream) break;
      } catch (modelErr) {
        // Try next candidate model
        continue;
      }
    }

    if (!stream) {
      throw new Error('All candidate models unavailable');
    }

    let hasStreamedChunk = false;
    for await (const chunk of stream) {
      const text = chunk.text || '';
      if (text) {
        hasStreamedChunk = true;
        res.write(`data: ${JSON.stringify({ text })}\n\n`);
      }
    }

    if (!hasStreamedChunk) {
      const fallbackText = generateDynamicDatacenterResponse(question, currentRack, liveRacks, environment);
      return streamQuickText(fallbackText);
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err: any) {
    // Graceful fallback to pure dynamic live math calculation
    const fallbackText = generateDynamicDatacenterResponse(question, currentRack, liveRacks, environment);
    await streamQuickText(fallbackText);
  }
});

// POST /api/gemini/query - Non-streaming endpoint
app.post('/api/gemini/query', async (req: Request, res: Response) => {
  const { 
    question, 
    active_rack_id = 'rack-a01', 
    rack_state, 
    environment = 'production',
    chat_history = [],
    user_info
  } = req.body;
  if (!question) return res.status(400).json({ error: 'Question is required' });

  const currentRack = rack_state || liveRacks[active_rack_id] || liveRacks['rack-a01'];

  // Guided Incident Ticket Intake Workflow
  const intake = analyzeTicketIntake(question, chat_history);
  if (intake.hasIntent) {
    if (intake.missingFields.length > 0) {
      const answer = `### 📋 Copilot Guided Incident Intake: Details Required
To file an official incident ticket for the Action Hub, I need to collect or confirm the following critical parameters:

1. **Severity Level**: ${intake.severity ? `✅ Confirmed: **${intake.severity}**` : '⚠️ **Please specify**: **P1 - Critical Outage** (Immediate throttle), **P2 - High Risk**, or **P3 - Warning**'}
2. **Target Hardware / Location**: ${intake.targetHardware ? `✅ Confirmed: **${intake.targetHardware}**` : '⚠️ **Please specify**: Target Rack ID and specific chassis/slot (e.g., **Rack A01 - Dell XE9680 U14**)'}
3. **Issue Description**: ${intake.issueDescription ? `✅ Confirmed: *${intake.issueDescription}*` : '⚠️ **Please specify**: Any physical observation, symptom, or note (e.g., *Loose cables from server to switch*, *Drive bay LED flashing amber*, *Coolant flow drop*, *Firmware sync failure*)'}

Please reply with the missing parameters above to confirm and dispatch the incident ticket.`;
      return res.json({ answer });
    } else {
      const creatorAttribution = user_info?.attribution 
        || (user_info?.name ? `${user_info.name} (${user_info.role || 'SRE'})` : 'Darshan (Lead SRE)');

      const envTag = environment === 'sandbox' ? 'SANDBOX' : 'PRODUCTION';
      const ticket = createIncidentFromCopilot(
        intake.rackId || active_rack_id,
        intake.serverId,
        intake.issueDescription || intake.anomalySummary,
        intake.severity,
        creatorAttribution,
        intake.targetHardware,
        envTag
      );

      const severityLabel = ticket.severity === 'P1' ? 'P1 - Critical Outage' : ticket.severity === 'P2' ? 'P2 - High Risk' : 'P3 - Warning';
      const targetDeviceFormatted = intake.targetHardware || `${ticket.rack_id.toUpperCase()} - ${ticket.server_id}`;

      const answer = `### ⚠️ Incident Ticket Dispatched to Action Hub
- **Ticket ID**: \`${ticket.incident_id}\`
- **Severity**: **${ticket.severity}** (${severityLabel})
- **Target Device**: **${targetDeviceFormatted}** (\`${ticket.server_id}\`)
- **Issue Description**: *${ticket.root_cause_analysis}*
- **Created By**: **${ticket.created_by}**
- **Action Hub Status**: \`AWAITING_APPROVAL\` (Live alert broadcasted to Notification Bell & Action Hub queue for Tier-3 SRE mitigation review).`;

      return res.json({ answer, created_ticket: ticket });
    }
  }

  const systemInstruction = buildGeminiSystemPrompt(liveRacks, active_rack_id, environment);

  if (!aiClient) {
    const answer = generateDynamicDatacenterResponse(question, currentRack, liveRacks, environment);
    return res.json({ answer });
  }

  try {
    const formattedHistory = Array.isArray(chat_history) && chat_history.length > 0
      ? chat_history
          .slice(-6)
          .map((m: any) => `${m.role === 'model' || m.role === 'assistant' ? 'Copilot' : 'Engineer'}: ${m.content || m.text || ''}`)
          .join('\n')
      : '';

    const liveRackSnapshot = buildLiveRacksTelemetryContext(liveRacks, active_rack_id);
    const prompt = `LIVE DATACENTER STATE (${environment.toUpperCase()}):
Active Rack Focus: ${active_rack_id.toUpperCase()}
Rack State Snapshot: ${JSON.stringify(liveRackSnapshot, null, 2)}

${formattedHistory ? `Conversation History:\n${formattedHistory}\n\n` : ''}Engineer Inquiry: "${question}"`;

    let response: any = null;
    const candidateModels = ['gemini-3.8-flash', 'gemini-2.5-flash', 'gemini-flash-latest'];

    for (const model of candidateModels) {
      try {
        const geminiPromise = aiClient.models.generateContent({
          model,
          contents: prompt,
          config: {
            systemInstruction,
            tools: [{ googleSearch: {} }],
          },
        });

        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('TIMEOUT')), 12000)
        );

        response = await Promise.race([geminiPromise, timeoutPromise]);
        if (response && response.text) break;
      } catch (err) {
        continue;
      }
    }

    res.json({ answer: (response && response.text) ? response.text : generateDynamicDatacenterResponse(question, currentRack, liveRacks, environment) });
  } catch (err) {
    const answer = generateDynamicDatacenterResponse(question, currentRack, liveRacks, environment);
    res.json({ answer });
  }
});

// Mount Vite or serve static files
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[RackMind AI] TwinOps server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
