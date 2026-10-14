import { VendorManualDoc } from '../types/telemetry';

export const VENDOR_MANUALS: VendorManualDoc[] = [
  {
    id: 'nvidia-rubin-nvl72-dlc',
    vendor: 'NVIDIA',
    title: 'NVIDIA Vera Rubin NVL72 Direct-to-Chip Liquid Cooling Specification',
    section: 'Fluid Dynamics & Manifold Pressure Standards (ASHRAE W4, Page 28)',
    excerpt: 'The NVL72 rack integrates 72 Rubin GPUs unified with 36 Vera CPUs consuming 230 kW peak. Cooling is 100% Direct Liquid Cooling (DLC). Coolant supply must enter the manifold header at 45.0°C (ASHRAE W4 warm-water class) at 130 LPM flow rate and 42 PSI loop pressure. If return temperature exceeds 65°C or pressure drops below 36 PSI, the autonomous controller must command dynamic GPU TDP power capping to prevent phase transition.',
    relevance: 'NVIDIA Vera Rubin NVL72 100% Direct Liquid Cooling (DLC) pod'
  },
  {
    id: 'cisco-nexus-9000-p42',
    vendor: 'Cisco Systems',
    title: 'Cisco Nexus 9000 Series Hardware Installation Guide',
    section: 'Page 42 - Port-Side Exhaust & Thermal Containment Boundaries',
    excerpt: 'Operating intake air temperature must remain below 40.0°C (104°F). If exhaust delta-T exceeds 25°C or port-side airflow is impaired by adjacent thermal spillover, the system triggers stage-1 airflow throttling. Operators must verify blanking panels or reduce adjacent compute power envelope.',
    relevance: 'Cisco Nexus 9336C 1U top-of-rack leaf switches and port exhaust limits'
  },
  {
    id: 'dell-xe9680-8x-h100',
    vendor: 'Dell Technologies',
    title: 'Dell PowerEdge XE9680 (8x NVIDIA H100) Technical Guide',
    section: 'Section 4.2, Page 58 - 6U Chassis Airflow & Dynamic Power Capping',
    excerpt: 'The 6U Dell PowerEdge XE9680 houses 8x NVIDIA H100 SXM5 accelerators. Thermal dissipation relies on high-velocity fan banks (up to 12,500 RPM). If outlet exhaust approaches 75°C under heavy tensor load, the facility management daemon must immediately enforce an active power cap to 1500W or throttle accelerator TDP to prevent thermal throttling and junction cutoff.',
    relevance: 'Dell PowerEdge XE9680 (8x NVIDIA H100) 6U chassis thermal throttling'
  },
  {
    id: 'nvidia-hgx-h100-p114',
    vendor: 'NVIDIA',
    title: 'NVIDIA HGX H100 8-GPU Baseboard Hardware Specification',
    section: 'Thermal Dissipation Appendix, Page 114 - SXM5 Thermal Throttling Matrix',
    excerpt: 'H100 SXM5 accelerators maintain peak performance at outlet temperatures below 65°C. At sustained chassis outlet temperatures >= 75°C or intake fan tachometer drop < 2000 RPM, hardware thermal throttling engages automatically. Recommended autonomous action: enforce power cap mitigation to 1500W immediately.',
    relevance: 'NVIDIA HGX H100 4U AI training node critical thermal thresholds'
  },
  {
    id: 'dell-r750-p31',
    vendor: 'Dell Technologies',
    title: 'Dell PowerEdge R750 Installation and Service Manual',
    section: 'Thermal Architecture, Page 31 - Dual-Socket Intake Air Envelope',
    excerpt: 'Standard operational intake temperature range is 10°C to 35°C (continuous). If intake temperature exceeds 45°C or dual-rotor fan failure occurs, iDRAC initiates thermal protection. Autonomous mitigation should apply a dynamic power cap to 500W or migrate non-critical threads to cold-aisle racks.',
    relevance: 'Dell PowerEdge R750 2U general compute servers'
  },
  {
    id: 'apc-pdu-p19',
    vendor: 'Schneider Electric / APC',
    title: 'APC AP8941 Switched Rack PDU Troubleshooting Guide',
    section: 'Overcurrent Protection, Page 19 - Phase Load Balancing & Derating',
    excerpt: 'If total rack power draw approaches 80% continuous breaker threshold (19.2 kW on a 24.0 kW feed), the power management daemon must enforce sequential power capping on compute nodes to preserve N+1 PDU resilience.',
    relevance: 'APC Switched Rack PDU 1U power distribution and branch breaker limits'
  }
];

export function searchManuals(query: string): VendorManualDoc[] {
  const q = query.toLowerCase();
  return VENDOR_MANUALS.filter(m => 
    m.vendor.toLowerCase().includes(q) ||
    m.title.toLowerCase().includes(q) ||
    m.section.toLowerCase().includes(q) ||
    m.excerpt.toLowerCase().includes(q) ||
    m.relevance.toLowerCase().includes(q)
  );
}
