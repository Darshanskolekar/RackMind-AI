export type HealthStatus = 'healthy' | 'warning' | 'critical';
export type EnvironmentMode = 'production' | 'sandbox';

export type ServerModel = 
  | 'Cisco Nexus 9336C [ToR Management Switch]'
  | 'NVIDIA Quantum-2 QM9700 [400Gb/s InfiniBand Fabric Switch]'
  | 'Dell PowerEdge R760 [Head & Storage Node]'
  | 'Dell PowerEdge XE9680 (8x NVIDIA H100)'
  | 'Airflow Containment Baffle Panel'
  | 'Cisco Nexus 9336C'
  | 'APC Switched Rack PDU'
  | 'Dell PowerEdge R750'
  | 'NVIDIA Vera Rubin NVL72 Compute Tray'
  | 'NVIDIA Vera Rubin NVL72 NVLink Switch Tray'
  | 'Vertiv In-Row Chiller'
  | string;

export interface CpuCoreTelemetry {
  id: string;
  name: string;
  load_pct: number;
  temp_c: number;
  power_w: number;
}

export interface GpuSubsystemTelemetry {
  id: string;
  index: number;
  name: string;
  core_temp_c: number;
  hbm3_temp_c: number;
  tensor_utilization_pct: number;
  power_w: number;
  max_power_w: number;
  status: HealthStatus;
  is_throttled?: boolean;
}

export interface ServerTelemetry {
  slot_u: number;
  height_u: number;
  server_id: string;
  model: ServerModel;
  cpu_utilization_pct: number;
  gpu_utilization_pct?: number;
  inlet_temp_c: number;
  outlet_temp_c: number;
  fan_speed_rpm: number; // 0 for 100% DLC racks
  power_draw_w: number;
  max_power_w: number;
  power_capped: boolean;
  status: HealthStatus;
  workload_name?: string;
  ip_address?: string;
  serial_no?: string;
  is_baffle_panel?: boolean;
  
  // Split metrics for Dell PowerEdge XE9680
  host_cpu_load_pct?: number;
  host_cpu_temp_c?: number;
  gpu_subsystem_load_pct?: number;
  gpu_subsystem_peak_temp_c?: number;

  // Sub-component level drill-down for Dell XE9680
  cpus?: CpuCoreTelemetry[];
  gpus?: GpuSubsystemTelemetry[];
  target_hotspot_gpu_index?: number;
  
  // 100% Direct Liquid Cooling (DLC) Telemetry for NVL72 / Exascale pods
  is_dlc_only?: boolean;
  coolant_supply_temp_c?: number; // ~45°C (ASHRAE W4 warm-water)
  coolant_return_temp_c?: number; // ~58°C – 62°C (Delta-T: 13°C - 17°C)
  coolant_flow_rate_lpm?: number; // 130 LPM
  manifold_pressure_psi?: number; // 42 PSI
}

export interface RackTelemetry {
  rack_id: string;
  rack_name: string;
  datacenter_location: string;
  row: string;
  position: number;
  max_power_kw: number;
  current_power_kw: number;
  ambient_temp_c: number;
  status: HealthStatus;
  updated_at: string;
  pue: number;
  total_slots_u: number;
  servers: ServerTelemetry[];

  // Rack Cooling Architecture & Manifold Telemetry
  cooling_type: 'air_hybrid' | 'liquid_dlc';
  coolant_supply_temp_c?: number;
  coolant_return_temp_c?: number;
  coolant_flow_rate_lpm?: number;
  manifold_pressure_psi?: number;
  architecture_summary?: string;
}

export interface IncidentAction {
  action_type: 'POWER_CAP_AND_REROUTE' | 'THROTTLE_POWER' | 'FAN_OVERDRIVE' | 'EVACUATE_WORKLOAD' | 'EMERGENCY_SHUTDOWN' | 'DLC_VALVE_ACTUATE';
  target_device: string;
  action_label: string;
  parameters: {
    power_cap_watts?: number;
    target_fan_rpm?: number;
    workload_target_rack?: string;
    flow_rate_lpm?: number;
    [key: string]: any;
  };
}

export interface IncidentLog {
  timestamp: string;
  message: string;
}

export interface IncidentTicket {
  id: string;
  incident_id: string;
  rack_id: string;
  server_id: string;
  severity: 'P1' | 'P2' | 'P3' | 'CRITICAL' | 'HIGH' | 'MEDIUM';
  status: 'AWAITING_APPROVAL' | 'APPROVED_AND_EXECUTED' | 'REJECTED' | 'RESOLVED';
  created_at: string;
  root_cause_analysis: string;
  citation: string;
  recommended_action: IncidentAction;
  execution_logs: IncidentLog[];
  created_by?: string; // e.g. "Autonomous Gemini Monitor" or "Darshan (Lead SRE)"
  mitigated_by?: string; // e.g. "Darshan Skolekar (Lead Infrastructure SRE)"
  mitigated_at?: string; // ISO timestamp of mitigation execution
  is_simulated?: boolean; // Flag to separate simulation sandbox incidents from production audit logs
  environment?: 'PRODUCTION' | 'SANDBOX'; // Isolated environment tag
  metrics_snapshot?: {
    temp_c: number;
    fan_rpm?: number;
    power_w: number;
    coolant_return_c?: number;
    manifold_psi?: number;
  };
}

export interface VendorManualDoc {
  id: string;
  title: string;
  vendor: string;
  section: string;
  excerpt: string;
  relevance: string;
}
