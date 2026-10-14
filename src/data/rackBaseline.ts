import { RackTelemetry, ServerTelemetry } from '../types/telemetry';

export function createXE9680Cpus(): Array<{ id: string; name: string; load_pct: number; temp_c: number; power_w: number }> {
  return [
    { id: 'cpu-0', name: 'Intel Xeon Platinum 8480+ (Socket 0)', load_pct: 31.0, temp_c: 44.0, power_w: 350 },
    { id: 'cpu-1', name: 'Intel Xeon Platinum 8480+ (Socket 1)', load_pct: 35.0, temp_c: 46.5, power_w: 350 },
  ];
}

export function createXE9680Gpus(baselineTensor: number = 88.0, peakTemp: number = 71.8): Array<{
  id: string;
  index: number;
  name: string;
  core_temp_c: number;
  hbm3_temp_c: number;
  tensor_utilization_pct: number;
  power_w: number;
  max_power_w: number;
  status: 'healthy' | 'warning' | 'critical';
  is_throttled?: boolean;
}> {
  return Array.from({ length: 8 }, (_, i) => {
    // Subtle variances across the 8 SXM5 sockets
    const isCenter = i === 3 || i === 4;
    const coreTemp = Number((peakTemp - (isCenter ? 0 : 0.6 + (i % 3) * 0.3)).toFixed(1));
    const hbmTemp = Number((coreTemp + 4.2).toFixed(1));
    const power = Math.round(510 + (baselineTensor / 100) * 15 + (isCenter ? 15 : -8));
    const status = coreTemp >= 83 ? 'critical' : coreTemp >= 75 ? 'warning' : 'healthy';

    return {
      id: `gpu-${i}`,
      index: i,
      name: `GPU ${i}`,
      core_temp_c: coreTemp,
      hbm3_temp_c: hbmTemp,
      tensor_utilization_pct: Math.min(99, Math.round(baselineTensor + (i % 2 === 0 ? 1 : -1))),
      power_w: power,
      max_power_w: 700,
      status,
      is_throttled: coreTemp >= 83,
    };
  });
}

export function createInitialRacks(): Record<string, RackTelemetry> {
  // RACK A01: Authentic Multi-Tier AI Data Center Configuration
  const rackA01Servers: ServerTelemetry[] = [
    // Slots U41-U42 (Top-of-Rack Networking)
    {
      slot_u: 42,
      height_u: 1,
      server_id: 'srv-rack-a01-u42',
      model: 'Cisco Nexus 9336C [ToR Management Switch]',
      cpu_utilization_pct: 28.0,
      inlet_temp_c: 23.0,
      outlet_temp_c: 31.0,
      fan_speed_rpm: 8200,
      power_draw_w: 580,
      max_power_w: 750,
      power_capped: false,
      status: 'healthy',
      workload_name: 'Out-of-Band Management & Layer 3 Control Plane',
      ip_address: '10.240.1.42',
      serial_no: 'N9K-C9336C-FX2',
      is_dlc_only: false,
    },
    {
      slot_u: 41,
      height_u: 1,
      server_id: 'srv-rack-a01-u41',
      model: 'NVIDIA Quantum-2 QM9700 [400Gb/s InfiniBand Fabric Switch]',
      cpu_utilization_pct: 34.0,
      inlet_temp_c: 23.2,
      outlet_temp_c: 33.0,
      fan_speed_rpm: 8600,
      power_draw_w: 850,
      max_power_w: 950,
      power_capped: false,
      status: 'healthy',
      workload_name: '400Gb/s Non-Blocking InfiniBand Rail-Optimized Spine',
      ip_address: '10.240.1.41',
      serial_no: 'MQM9700-NS2F',
      is_dlc_only: false,
    },
    // Slots U39-U40 (2U Airflow Containment Baffle Panel)
    {
      slot_u: 39,
      height_u: 2,
      server_id: 'baffle-rack-a01-u39-u40',
      model: 'U39-U40 (2U) [Airflow Containment Baffle Panel]',
      cpu_utilization_pct: 0,
      inlet_temp_c: 22.0,
      outlet_temp_c: 22.5,
      fan_speed_rpm: 0,
      power_draw_w: 0,
      max_power_w: 0,
      power_capped: false,
      status: 'healthy',
      is_baffle_panel: true,
      workload_name: 'Airflow Containment & Cold-Aisle Isolation',
    },
    // Slots U37-U38 (Cluster Orchestration)
    {
      slot_u: 37,
      height_u: 2,
      server_id: 'srv-rack-a01-u37',
      model: 'Dell PowerEdge R760 [Head & Storage Node]',
      cpu_utilization_pct: 42.0,
      inlet_temp_c: 23.5,
      outlet_temp_c: 32.0,
      fan_speed_rpm: 7800,
      power_draw_w: 1300,
      max_power_w: 1800,
      power_capped: false,
      status: 'healthy',
      workload_name: 'Slurm Master, Vector Store & NVMe-oF Head Node',
      ip_address: '10.240.1.37',
      serial_no: 'DELL-R760-ORCH-01',
      is_dlc_only: false,
    },
    // Slots U27-U36 (10U Airflow Containment Baffle Panel)
    {
      slot_u: 27,
      height_u: 10,
      server_id: 'baffle-rack-a01-u27-u36',
      model: 'U27-U36 (10U) [Airflow Containment Baffle Panel]',
      cpu_utilization_pct: 0,
      inlet_temp_c: 22.0,
      outlet_temp_c: 22.5,
      fan_speed_rpm: 0,
      power_draw_w: 0,
      max_power_w: 0,
      power_capped: false,
      status: 'healthy',
      is_baffle_panel: true,
      workload_name: 'Airflow Containment & Blanking Plenum',
    },
    // Slots U21-U26 (AI Compute Node 02)
    {
      slot_u: 21,
      height_u: 6,
      server_id: 'srv-rack-a01-u21',
      model: 'Dell PowerEdge XE9680 (8x NVIDIA H100)',
      cpu_utilization_pct: 32.0,
      gpu_utilization_pct: 88.0,
      inlet_temp_c: 24.5,
      outlet_temp_c: 34.0,
      fan_speed_rpm: 10800,
      power_draw_w: 4250,
      max_power_w: 10200,
      power_capped: false,
      status: 'healthy',
      workload_name: 'AI Compute Node 02 &bull; 8x H100 SXM5 Distributed Training Cluster',
      ip_address: '10.240.1.21',
      serial_no: 'DELL-XE9680-NODE-02',
      is_dlc_only: false,
      host_cpu_load_pct: 32.0,
      host_cpu_temp_c: 45.2,
      gpu_subsystem_load_pct: 88.0,
      gpu_subsystem_peak_temp_c: 71.8,
      cpus: createXE9680Cpus(),
      gpus: createXE9680Gpus(88.0, 71.8),
    },
    // Slot U20 (1U Airflow Containment Baffle Panel between Nodes)
    {
      slot_u: 20,
      height_u: 1,
      server_id: 'baffle-rack-a01-u20',
      model: 'U20 (1U) [Airflow Containment Baffle Panel]',
      cpu_utilization_pct: 0,
      inlet_temp_c: 22.0,
      outlet_temp_c: 22.5,
      fan_speed_rpm: 0,
      power_draw_w: 0,
      max_power_w: 0,
      power_capped: false,
      status: 'healthy',
      is_baffle_panel: true,
      workload_name: 'Inter-Node Airflow Containment',
    },
    // Slots U14-U19 (AI Compute Node 01)
    {
      slot_u: 14,
      height_u: 6,
      server_id: 'srv-rack-a01-u14',
      model: 'Dell PowerEdge XE9680 (8x NVIDIA H100)',
      cpu_utilization_pct: 32.0,
      gpu_utilization_pct: 88.0,
      inlet_temp_c: 24.5,
      outlet_temp_c: 33.6,
      fan_speed_rpm: 10639,
      power_draw_w: 4180,
      max_power_w: 10200,
      power_capped: false,
      status: 'healthy',
      workload_name: 'AI Compute Node 01 &bull; 8x H100 SXM5 Distributed Training Cluster',
      ip_address: '10.240.1.14',
      serial_no: 'DELL-XE9680-NODE-01',
      is_dlc_only: false,
      host_cpu_load_pct: 32.0,
      host_cpu_temp_c: 45.2,
      gpu_subsystem_load_pct: 88.0,
      gpu_subsystem_peak_temp_c: 71.8,
      cpus: createXE9680Cpus(),
      gpus: createXE9680Gpus(88.0, 71.8),
    },
    // Slots U1-U13 (13U Airflow Containment Baffle Panel)
    {
      slot_u: 1,
      height_u: 13,
      server_id: 'baffle-rack-a01-u01-u13',
      model: 'U1-U13 (13U) [Airflow Containment Baffle Panel]',
      cpu_utilization_pct: 0,
      inlet_temp_c: 22.0,
      outlet_temp_c: 22.5,
      fan_speed_rpm: 0,
      power_draw_w: 0,
      max_power_w: 0,
      power_capped: false,
      status: 'healthy',
      is_baffle_panel: true,
      workload_name: 'Plenum Airflow Isolation & Cable Management Plenum',
    },
  ];

  // RACK A02: NEXT-GEN HIGH-DENSITY POD: NVIDIA Vera Rubin NVL72 Liquid-Cooled Pod (230 kW rated, ~200 kW baseline)
  // 100% Direct Liquid Cooling (DLC). Fan RPM = 0.
  const rackA02Servers: ServerTelemetry[] = [
    // Top NVLink Spine Switch Trays (9x 1U/2U NVLink switches connecting all 72 GPUs at 1.8 TB/s)
    {
      slot_u: 41,
      height_u: 2,
      server_id: 'srv-rack-a02-u41',
      model: 'NVIDIA Vera Rubin NVL72 NVLink Switch Tray',
      cpu_utilization_pct: 22.0,
      inlet_temp_c: 22.0,
      outlet_temp_c: 56.5,
      fan_speed_rpm: 0,
      power_draw_w: 7200,
      max_power_w: 9000,
      power_capped: false,
      status: 'healthy',
      workload_name: 'NVLink 6 Exascale Crossbar Fabric Primary',
      ip_address: '10.240.2.41',
      serial_no: 'NV-RUBIN-SW-01',
      is_dlc_only: true,
      coolant_supply_temp_c: 45.1,
      coolant_return_temp_c: 57.8,
      coolant_flow_rate_lpm: 130.2,
      manifold_pressure_psi: 42.1,
    },
    // 8x 2U Vera Rubin Compute Trays in upper zone (Trays 11 to 18)
    // Each tray: 2x Vera CPUs + 4x Rubin GPUs (Liquid-cooled Cold Plates)
    {
      slot_u: 37,
      height_u: 4,
      server_id: 'srv-rack-a02-u37',
      model: 'NVIDIA Vera Rubin NVL72 Compute Tray',
      cpu_utilization_pct: 78.5,
      gpu_utilization_pct: 92.0,
      inlet_temp_c: 23.5,
      outlet_temp_c: 59.8,
      fan_speed_rpm: 0,
      power_draw_w: 22800,
      max_power_w: 26000,
      power_capped: false,
      status: 'healthy',
      workload_name: 'Vera Rubin Trays 17-18 (8 Rubin GPUs, 4 Vera CPUs)',
      ip_address: '10.240.2.37',
      serial_no: 'NV-RUBIN-CT-1718',
      is_dlc_only: true,
      coolant_supply_temp_c: 45.0,
      coolant_return_temp_c: 59.5,
      coolant_flow_rate_lpm: 130.0,
      manifold_pressure_psi: 42.0,
    },
    {
      slot_u: 33,
      height_u: 4,
      server_id: 'srv-rack-a02-u33',
      model: 'NVIDIA Vera Rubin NVL72 Compute Tray',
      cpu_utilization_pct: 79.2,
      gpu_utilization_pct: 91.5,
      inlet_temp_c: 23.2,
      outlet_temp_c: 60.1,
      fan_speed_rpm: 0,
      power_draw_w: 23100,
      max_power_w: 26000,
      power_capped: false,
      status: 'healthy',
      workload_name: 'Vera Rubin Trays 15-16 (8 Rubin GPUs, 4 Vera CPUs)',
      ip_address: '10.240.2.33',
      serial_no: 'NV-RUBIN-CT-1516',
      is_dlc_only: true,
      coolant_supply_temp_c: 45.2,
      coolant_return_temp_c: 60.2,
      coolant_flow_rate_lpm: 129.8,
      manifold_pressure_psi: 42.1,
    },
    {
      slot_u: 29,
      height_u: 4,
      server_id: 'srv-rack-a02-u29',
      model: 'NVIDIA Vera Rubin NVL72 Compute Tray',
      cpu_utilization_pct: 82.0,
      gpu_utilization_pct: 94.0,
      inlet_temp_c: 23.4,
      outlet_temp_c: 61.2,
      fan_speed_rpm: 0,
      power_draw_w: 23500,
      max_power_w: 26000,
      power_capped: false,
      status: 'healthy',
      workload_name: 'Vera Rubin Trays 13-14 (8 Rubin GPUs, 4 Vera CPUs)',
      ip_address: '10.240.2.29',
      serial_no: 'NV-RUBIN-CT-1314',
      is_dlc_only: true,
      coolant_supply_temp_c: 45.0,
      coolant_return_temp_c: 61.0,
      coolant_flow_rate_lpm: 130.4,
      manifold_pressure_psi: 42.0,
    },
    {
      slot_u: 25,
      height_u: 4,
      server_id: 'srv-rack-a02-u25',
      model: 'NVIDIA Vera Rubin NVL72 Compute Tray',
      cpu_utilization_pct: 80.0,
      gpu_utilization_pct: 93.0,
      inlet_temp_c: 23.0,
      outlet_temp_c: 59.4,
      fan_speed_rpm: 0,
      power_draw_w: 22900,
      max_power_w: 26000,
      power_capped: false,
      status: 'healthy',
      workload_name: 'Vera Rubin Trays 11-12 (8 Rubin GPUs, 4 Vera CPUs)',
      ip_address: '10.240.2.25',
      serial_no: 'NV-RUBIN-CT-1112',
      is_dlc_only: true,
      coolant_supply_temp_c: 45.1,
      coolant_return_temp_c: 59.2,
      coolant_flow_rate_lpm: 130.1,
      manifold_pressure_psi: 42.2,
    },
    // Mid-Rack Dual Manifold Quick-Disconnect Fluid Distribution Unit (FDU)
    {
      slot_u: 23,
      height_u: 2,
      server_id: 'srv-rack-a02-u23',
      model: 'NVIDIA Vera Rubin NVL72 NVLink Switch Tray',
      cpu_utilization_pct: 24.5,
      inlet_temp_c: 22.8,
      outlet_temp_c: 55.4,
      fan_speed_rpm: 0,
      power_draw_w: 7400,
      max_power_w: 9000,
      power_capped: false,
      status: 'healthy',
      workload_name: 'NVLink 6 Exascale Spine Switch Secondary',
      ip_address: '10.240.2.23',
      serial_no: 'NV-RUBIN-SW-02',
      is_dlc_only: true,
      coolant_supply_temp_c: 44.9,
      coolant_return_temp_c: 56.4,
      coolant_flow_rate_lpm: 130.5,
      manifold_pressure_psi: 42.0,
    },
    // Lower Zone Vera Rubin Compute Trays (Trays 1 to 10)
    {
      slot_u: 19,
      height_u: 4,
      server_id: 'srv-rack-a02-u19',
      model: 'NVIDIA Vera Rubin NVL72 Compute Tray',
      cpu_utilization_pct: 79.5,
      gpu_utilization_pct: 92.5,
      inlet_temp_c: 23.0,
      outlet_temp_c: 59.0,
      fan_speed_rpm: 0,
      power_draw_w: 22700,
      max_power_w: 26000,
      power_capped: false,
      status: 'healthy',
      workload_name: 'Vera Rubin Trays 9-10 (8 Rubin GPUs, 4 Vera CPUs)',
      ip_address: '10.240.2.19',
      serial_no: 'NV-RUBIN-CT-0910',
      is_dlc_only: true,
      coolant_supply_temp_c: 45.0,
      coolant_return_temp_c: 58.8,
      coolant_flow_rate_lpm: 130.0,
      manifold_pressure_psi: 42.0,
    },
    {
      slot_u: 15,
      height_u: 4,
      server_id: 'srv-rack-a02-u15',
      model: 'NVIDIA Vera Rubin NVL72 Compute Tray',
      cpu_utilization_pct: 81.2,
      gpu_utilization_pct: 93.8,
      inlet_temp_c: 23.1,
      outlet_temp_c: 60.5,
      fan_speed_rpm: 0,
      power_draw_w: 23200,
      max_power_w: 26000,
      power_capped: false,
      status: 'healthy',
      workload_name: 'Vera Rubin Trays 7-8 (8 Rubin GPUs, 4 Vera CPUs)',
      ip_address: '10.240.2.15',
      serial_no: 'NV-RUBIN-CT-0708',
      is_dlc_only: true,
      coolant_supply_temp_c: 45.2,
      coolant_return_temp_c: 60.1,
      coolant_flow_rate_lpm: 129.9,
      manifold_pressure_psi: 42.1,
    },
    {
      slot_u: 11,
      height_u: 4,
      server_id: 'srv-rack-a02-u11',
      model: 'NVIDIA Vera Rubin NVL72 Compute Tray',
      cpu_utilization_pct: 83.0,
      gpu_utilization_pct: 95.0,
      inlet_temp_c: 23.5,
      outlet_temp_c: 61.8,
      fan_speed_rpm: 0,
      power_draw_w: 23800,
      max_power_w: 26000,
      power_capped: false,
      status: 'healthy',
      workload_name: 'Vera Rubin Trays 5-6 (8 Rubin GPUs, 4 Vera CPUs)',
      ip_address: '10.240.2.11',
      serial_no: 'NV-RUBIN-CT-0506',
      is_dlc_only: true,
      coolant_supply_temp_c: 45.1,
      coolant_return_temp_c: 61.5,
      coolant_flow_rate_lpm: 130.3,
      manifold_pressure_psi: 42.0,
    },
    {
      slot_u: 7,
      height_u: 4,
      server_id: 'srv-rack-a02-u07',
      model: 'NVIDIA Vera Rubin NVL72 Compute Tray',
      cpu_utilization_pct: 80.4,
      gpu_utilization_pct: 92.8,
      inlet_temp_c: 22.9,
      outlet_temp_c: 59.6,
      fan_speed_rpm: 0,
      power_draw_w: 22600,
      max_power_w: 26000,
      power_capped: false,
      status: 'healthy',
      workload_name: 'Vera Rubin Trays 3-4 (8 Rubin GPUs, 4 Vera CPUs)',
      ip_address: '10.240.2.7',
      serial_no: 'NV-RUBIN-CT-0304',
      is_dlc_only: true,
      coolant_supply_temp_c: 45.0,
      coolant_return_temp_c: 59.2,
      coolant_flow_rate_lpm: 130.0,
      manifold_pressure_psi: 42.2,
    },
    {
      slot_u: 3,
      height_u: 4,
      server_id: 'srv-rack-a02-u03',
      model: 'NVIDIA Vera Rubin NVL72 Compute Tray',
      cpu_utilization_pct: 77.0,
      gpu_utilization_pct: 90.0,
      inlet_temp_c: 22.8,
      outlet_temp_c: 58.2,
      fan_speed_rpm: 0,
      power_draw_w: 21800,
      max_power_w: 26000,
      power_capped: false,
      status: 'healthy',
      workload_name: 'Vera Rubin Trays 1-2 (8 Rubin GPUs, 4 Vera CPUs)',
      ip_address: '10.240.2.3',
      serial_no: 'NV-RUBIN-CT-0102',
      is_dlc_only: true,
      coolant_supply_temp_c: 44.9,
      coolant_return_temp_c: 58.0,
      coolant_flow_rate_lpm: 130.2,
      manifold_pressure_psi: 42.0,
    },
    // Bottom 230kW Busbar Power Infeed & Blind-Mate Cold Plate Shelf (U1-U2)
    {
      slot_u: 1,
      height_u: 2,
      server_id: 'srv-rack-a02-u01',
      model: 'NVIDIA Vera Rubin NVL72 NVLink Switch Tray',
      cpu_utilization_pct: 15.0,
      inlet_temp_c: 22.5,
      outlet_temp_c: 48.0,
      fan_speed_rpm: 0,
      power_draw_w: 3500,
      max_power_w: 6000,
      power_capped: false,
      status: 'healthy',
      workload_name: '230kW 48V-DC Busbar Infeed & Manifold Return Header',
      ip_address: '10.240.2.1',
      serial_no: 'NV-RUBIN-PWR-01',
      is_dlc_only: true,
      coolant_supply_temp_c: 44.8,
      coolant_return_temp_c: 49.2,
      coolant_flow_rate_lpm: 131.0,
      manifold_pressure_psi: 42.0,
    }
  ];

  // RACK B01: Failover & Secondary Inference Pod
  const rackB01Servers = rackA01Servers.map((s) => ({
    ...s,
    server_id: s.server_id.replace('rack-a01', 'rack-b01'),
    ip_address: s.ip_address?.replace('10.240.1.', '10.240.3.'),
    serial_no: s.serial_no?.replace('-1', '-3'),
  }));

  const powerA01 = parseFloat((rackA01Servers.reduce((sum, s) => sum + s.power_draw_w, 0) / 1000).toFixed(2));
  const powerA02 = parseFloat((rackA02Servers.reduce((sum, s) => sum + s.power_draw_w, 0) / 1000).toFixed(2));
  const powerB01 = parseFloat((rackB01Servers.reduce((sum, s) => sum + s.power_draw_w, 0) / 1000).toFixed(2));

  return {
    'rack-a01': {
      rack_id: 'rack-a01',
      rack_name: 'Rack A01 (AI Training Cluster)',
      datacenter_location: 'us-central1-a',
      row: 'A',
      position: 1,
      max_power_kw: 24.0,
      current_power_kw: powerA01,
      ambient_temp_c: 22.2,
      status: 'healthy',
      updated_at: new Date().toISOString(),
      pue: 1.16,
      total_slots_u: 42,
      cooling_type: 'air_hybrid',
      servers: rackA01Servers,
    },
    'rack-a02': {
      rack_id: 'rack-a02',
      rack_name: 'Rack A02 (NVIDIA Vera Rubin NVL72 Liquid-Cooled Pod)',
      datacenter_location: 'us-central1-a',
      row: 'A',
      position: 2,
      max_power_kw: 230.0, // Max rated rack capacity 230 kW
      current_power_kw: powerA02, // Operating draw baseline around 195 kW – 205 kW
      ambient_temp_c: 23.0,
      status: 'healthy',
      updated_at: new Date().toISOString(),
      pue: 1.08, // Direct liquid cooled pods achieve ultra-low PUE
      total_slots_u: 42,
      cooling_type: 'liquid_dlc',
      coolant_supply_temp_c: 45.0, // ASHRAE W4 warm-water standard ~45°C
      coolant_return_temp_c: 59.8, // Return ~58°C - 62°C (Delta-T: 14.8°C)
      manifold_pressure_psi: 42.0, // 42 PSI
      coolant_flow_rate_lpm: 130.0, // 130 LPM
      architecture_summary: '72 Rubin GPUs unified with 36 Vera CPUs over NVLink 6 (100% Direct Liquid Cooling)',
      servers: rackA02Servers,
    },
    'rack-b01': {
      rack_id: 'rack-b01',
      rack_name: 'Rack B01 (Failover & Inference Target)',
      datacenter_location: 'us-central1-a',
      row: 'B',
      position: 1,
      max_power_kw: 24.0,
      current_power_kw: powerB01,
      ambient_temp_c: 22.0,
      status: 'healthy',
      updated_at: new Date().toISOString(),
      pue: 1.15,
      total_slots_u: 42,
      cooling_type: 'air_hybrid',
      servers: rackB01Servers,
    },
  };
}

export function calculateHeatColor(temp: number): {
  colorClass: string;
  badgeBg: string;
  badgeText: string;
  hex: string;
  label: string;
} {
  // Requirement: Green = <35°C, Yellow = 45°C, Red = 75°C+
  if (temp >= 75) {
    return {
      colorClass: 'text-rose-400 border-rose-500 bg-rose-950/70 shadow-rose-900/50',
      badgeBg: 'bg-rose-500/25 border-rose-500/60 text-rose-300',
      badgeText: 'text-rose-400 font-bold',
      hex: '#f43f5e',
      label: 'CRITICAL (75°C+)'
    };
  }
  if (temp >= 45) {
    return {
      colorClass: 'text-amber-300 border-amber-500/70 bg-amber-950/50 shadow-amber-900/30',
      badgeBg: 'bg-amber-500/25 border-amber-500/50 text-amber-300',
      badgeText: 'text-amber-300 font-semibold',
      hex: '#eab308',
      label: 'WARNING (45°C)'
    };
  }
  if (temp >= 35) {
    return {
      colorClass: 'text-emerald-300 border-emerald-500/40 bg-emerald-950/30',
      badgeBg: 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300',
      badgeText: 'text-emerald-300',
      hex: '#10b981',
      label: 'ELEVATED (~35°C-44°C)'
    };
  }
  return {
    colorClass: 'text-emerald-400 border-emerald-500/30 bg-emerald-950/20',
    badgeBg: 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400',
    badgeText: 'text-emerald-400 font-medium',
    hex: '#10b981',
    label: 'NOMINAL (<35°C)'
  };
}
