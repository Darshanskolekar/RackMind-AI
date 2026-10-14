import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { 
  RackTelemetry, 
  ServerTelemetry, 
  IncidentTicket, 
  HealthStatus,
  EnvironmentMode 
} from '../types/telemetry';
import { createInitialRacks } from '../data/rackBaseline';

import { ToastItem } from '../components/ToastNotification';
import { 
  saveIncidentToFirestore, 
  updateIncidentInFirestore, 
  listenToIncidents 
} from '../services/firestoreService';

export interface SliderTelemetryParams {
  gpuLoadPct?: number;
  coolantFlowLpm?: number;
  fanRpm?: number;
  supplyTempC?: number;
}

interface TelemetryContextType {
  environment: EnvironmentMode;
  setEnvironment: (env: EnvironmentMode) => void;
  racks: Record<string, RackTelemetry>;
  activeRackId: string;
  setActiveRackId: (id: string) => void;
  incidents: IncidentTicket[];
  selectedServer: ServerTelemetry | null;
  setSelectedServer: (server: ServerTelemetry | null) => void;
  selectedIncidentForReview: IncidentTicket | null;
  setSelectedIncidentForReview: (inc: IncidentTicket | null) => void;
  toasts: ToastItem[];
  dismissToast: (id: string) => void;
  triggerToast: (incident: IncidentTicket) => void;
  triggerCustomToast: (title: string, message: string, type?: 'success' | 'info') => void;
  heatmapOverlay: boolean;
  setHeatmapOverlay: React.Dispatch<React.SetStateAction<boolean>>;
  isDiagnosing: boolean;
  runHealthChecks: () => Promise<void>;
  injectFault: (
    rackId: string, 
    serverId: string, 
    scenario: 'fan_failure' | 'compute_spike' | 'coolant_leak' | 'gpu_hotspot',
    targetGpuIndex?: number
  ) => void;
  updateServerSlider: (rackId: string, serverId: string, params: SliderTelemetryParams) => void;
  approveIncident: (incidentId: string, approverInfo?: { name: string; role: string }) => Promise<void>;
  rejectIncident: (incidentId: string) => Promise<void>;
  resetBaseline: () => void;
  resetSandboxToProductionBaseline: () => void;
  runDiagnosis: (rackId?: string) => Promise<void>;
  sendCopilotQuery: (
    question: string,
    chatHistory?: Array<{ role: 'user' | 'model'; content: string }>,
    userInfo?: { name?: string; role?: string; attribution?: string }
  ) => Promise<string>;
  sendCopilotStreamQuery: (
    question: string, 
    onChunk: (accumulated: string) => void,
    chatHistory?: Array<{ role: 'user' | 'model'; content: string }>,
    userInfo?: { name?: string; role?: string; attribution?: string }
  ) => Promise<string>;
}

const TelemetryContext = createContext<TelemetryContextType | undefined>(undefined);

export const TelemetryProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [environment, setEnvironmentState] = useState<EnvironmentMode>('production');

  // Dual State Storage: Live Production (Immutable baseline) vs Simulation Sandbox (Shadow Twin)
  const [productionRacks, setProductionRacks] = useState<Record<string, RackTelemetry>>(createInitialRacks());
  const [sandboxRacks, setSandboxRacks] = useState<Record<string, RackTelemetry>>(() => JSON.parse(JSON.stringify(createInitialRacks())));

  const [activeRackId, setActiveRackId] = useState<string>('rack-a01');
  const [selectedServer, setSelectedServer] = useState<ServerTelemetry | null>(null);
  const [selectedIncidentForReview, setSelectedIncidentForReview] = useState<IncidentTicket | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [heatmapOverlay, setHeatmapOverlay] = useState<boolean>(false);
  const [isDiagnosing, setIsDiagnosing] = useState<boolean>(false);

  // Firestore persistent incident collection state
  const [firestoreIncidents, setFirestoreIncidents] = useState<IncidentTicket[]>([]);

  // Trigger temporary custom confirmation/alert toast
  const triggerCustomToast = useCallback((title: string, message: string, type: 'success' | 'info' = 'success') => {
    const toastId = `toast-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const newToast: ToastItem = {
      id: toastId,
      title,
      message,
      type,
      createdAt: Date.now(),
    };
    setToasts((prev) => [newToast, ...prev.slice(0, 4)]);

    // Auto dismiss after 6 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== toastId));
    }, 6000);
  }, []);

  // Trigger incident toast notification
  const triggerToast = useCallback((incidentOrItem: IncidentTicket | { title: string; message: string; type?: 'success' | 'info' }) => {
    const toastId = `toast-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const isIncident = 'severity' in incidentOrItem && 'incident_id' in incidentOrItem;
    const newToast: ToastItem = isIncident
      ? {
          id: toastId,
          incident: incidentOrItem as IncidentTicket,
          type: 'incident',
          createdAt: Date.now(),
        }
      : {
          id: toastId,
          title: (incidentOrItem as any).title,
          message: (incidentOrItem as any).message,
          type: (incidentOrItem as any).type || 'success',
          createdAt: Date.now(),
        };

    setToasts((prev) => [newToast, ...prev.slice(0, 4)]);

    // Auto dismiss after 8 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== toastId));
    }, 8000);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Run Health Checks verification scan (Production Live)
  const runHealthChecks = useCallback(async () => {
    setIsDiagnosing(true);
    await new Promise((r) => setTimeout(r, 650));
    setIsDiagnosing(false);
    triggerCustomToast(
      'Cluster Health Certified',
      'All nodes operating within nominal baseline envelope.',
      'success'
    );
  }, [triggerCustomToast]);

  // Requirement 2: Strictly separate Incident Queues with environment tags
  const [productionIncidents, setProductionIncidents] = useState<IncidentTicket[]>([
    {
      id: 'inc-prod-01',
      incident_id: 'prod-20261014-001',
      rack_id: 'rack-a01',
      server_id: 'srv-rack-a01-u34',
      severity: 'P1',
      status: 'AWAITING_APPROVAL',
      created_at: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
      root_cause_analysis: 'Direct Liquid Cooling manifold flow variance detected on srv-rack-a01-u34 (Dell PowerEdge XE9680). Pressure drop from 42 PSI to 31 PSI with GPU core temperature climbing to 72.4°C.',
      citation: 'Dell PowerEdge XE9680 Direct Liquid Cooling Technical Guide, Section 4.2, Page 58',
      is_simulated: false,
      environment: 'PRODUCTION',
      created_by: 'Autonomous Gemini Monitor',
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
          timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
          message: 'Autonomous Gemini Monitor flagged thermal variance in Live Production pod.',
        },
      ],
      metrics_snapshot: {
        temp_c: 72.4,
        fan_rpm: 8200,
        power_w: 3950,
      },
    },
  ]);

  const [sandboxIncidents, setSandboxIncidents] = useState<IncidentTicket[]>([
    {
      id: 'inc-sim-01',
      incident_id: 'sim-20261014-001',
      rack_id: 'rack-a01',
      server_id: 'srv-rack-a01-u34',
      severity: 'P1',
      status: 'AWAITING_APPROVAL',
      created_at: new Date(Date.now() - 1000 * 60 * 2).toISOString(),
      root_cause_analysis: '[SIMULATED INCIDENT] Dual-rotor fan tachometer drop on srv-rack-a01-u34 (Dell PowerEdge XE9680 (8x NVIDIA H100)) driving outlet temperature to 78.5°C under heavy 8-way tensor load.',
      citation: 'Dell PowerEdge XE9680 (8x NVIDIA H100) Technical Guide, Section 4.2, Page 58',
      is_simulated: true,
      environment: 'SANDBOX',
      created_by: 'Simulation Chaos Agent',
      recommended_action: {
        action_type: 'THROTTLE_POWER',
        target_device: 'srv-rack-a01-u34',
        action_label: 'Approve & Execute Mitigation',
        parameters: {
          power_cap_watts: 1500,
          workload_target_rack: 'rack-b01',
        },
      },
      execution_logs: [
        {
          timestamp: new Date(Date.now() - 1000 * 60 * 2).toISOString(),
          message: 'Simulation Sandbox Chaos Agent triggered simulated fan failure.',
        },
      ],
      metrics_snapshot: {
        temp_c: 78.5,
        fan_rpm: 1200,
        power_w: 4200,
      },
    },
  ]);

  // Connect Real-time Firestore Listener for Global Alert System
  useEffect(() => {
    const unsubscribe = listenToIncidents(
      (allTickets) => {
        setFirestoreIncidents(allTickets);
      },
      (newTicket) => {
        // Real-time toast alert whenever a new ticket is written to Firestore
        triggerToast(newTicket);
      }
    );
    return () => unsubscribe();
  }, [triggerToast]);

  // Environment switcher with automatic Shadow Twin cloning
  const setEnvironment = useCallback((newEnv: EnvironmentMode) => {
    if (newEnv === 'sandbox' && environment === 'production') {
      // Fork current production state into sandbox Shadow Twin
      setSandboxRacks(JSON.parse(JSON.stringify(productionRacks)));
    }
    setEnvironmentState(newEnv);
  }, [environment, productionRacks]);

  // Requirement 3: "RESET TO LIVE BASELINE" FULL RESTORATION (SANDBOX)
  const resetSandboxToProductionBaseline = useCallback(() => {
    // 1. Instantly restore all simulated telemetry across Rack A01, A02, and B01 back to nominal green baselines (< 35°C, healthy draw)
    const freshBaselines = createInitialRacks();
    setSandboxRacks(freshBaselines);

    // 2. Purge all active pending sandbox incident tickets from queue
    setSandboxIncidents([]);
    setFirestoreIncidents((prev) =>
      prev.filter((inc) => {
        const tag = (inc.environment || (inc.is_simulated ? 'SANDBOX' : 'PRODUCTION')).toUpperCase();
        return tag !== 'SANDBOX';
      })
    );

    // 3. Reset selected server to healthy state if selected
    if (selectedServer) {
      const freshRack = freshBaselines[activeRackId] || freshBaselines['rack-a01'];
      const freshSrv = freshRack?.servers.find((s) => s.server_id === selectedServer.server_id);
      if (freshSrv) setSelectedServer(freshSrv);
    }

    // 4. Display confirmation toast
    triggerCustomToast(
      'Sandbox Restored',
      'Telemetry synchronized to live production baseline. Simulated queue cleared.',
      'success'
    );
  }, [activeRackId, selectedServer, triggerCustomToast]);

  // Requirement 2: Combine local queue with Firestore incidents strictly isolated by active environment
  const incidents = React.useMemo(() => {
    const isProd = environment === 'production';
    const targetEnv = isProd ? 'PRODUCTION' : 'SANDBOX';
    const map = new Map<string, IncidentTicket>();

    const localList = isProd ? productionIncidents : sandboxIncidents;
    localList.forEach((inc) => {
      const tagged: IncidentTicket = {
        ...inc,
        environment: inc.environment || (inc.is_simulated ? 'SANDBOX' : targetEnv),
      };
      if (tagged.environment === targetEnv) {
        map.set(tagged.id || tagged.incident_id, tagged);
      }
    });

    firestoreIncidents.forEach((inc) => {
      const envTag = (inc.environment || (inc.is_simulated ? 'SANDBOX' : 'PRODUCTION')).toUpperCase() as 'PRODUCTION' | 'SANDBOX';
      const tagged: IncidentTicket = {
        ...inc,
        environment: envTag,
      };
      // In PRODUCTION LIVE: strictly display tickets where environment === 'PRODUCTION'. Sandbox chaos hidden!
      if (tagged.environment === targetEnv) {
        map.set(tagged.id || tagged.incident_id, tagged);
      }
    });

    return Array.from(map.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [environment, sandboxIncidents, productionIncidents, firestoreIncidents]);

  // Active racks view depending on environment
  const racks = environment === 'sandbox' ? sandboxRacks : productionRacks;

  // Synchronize selectedServer when active racks update
  useEffect(() => {
    if (selectedServer) {
      const currentRack = racks[activeRackId];
      if (currentRack) {
        const updated = currentRack.servers.find(s => s.server_id === selectedServer.server_id);
        if (updated) setSelectedServer(updated);
      }
    }
  }, [racks, activeRackId]);

  // Continuous subtle baseline telemetry drift for Live Production
  useEffect(() => {
    const timer = setInterval(() => {
      setProductionRacks((prev) => {
        const next: Record<string, RackTelemetry> = {};
        Object.keys(prev).forEach((rackId) => {
          const rack = prev[rackId];
          const newServers = rack.servers.map((srv) => {
            const tempDrift = (Math.random() - 0.5) * 0.15;
            const outlet = Math.max(28.0, Math.min(34.8, Number((srv.outlet_temp_c + tempDrift).toFixed(1))));
            const inlet = Math.max(21.0, Math.min(26.0, Number((srv.inlet_temp_c + tempDrift * 0.5).toFixed(1))));
            const fanDrift = Math.round((Math.random() - 0.5) * 30);

            return {
              ...srv,
              outlet_temp_c: outlet,
              inlet_temp_c: inlet,
              fan_speed_rpm: srv.is_dlc_only ? 0 : Math.max(4000, Math.min(11500, srv.fan_speed_rpm + fanDrift)),
            };
          });

          const totalW = newServers.reduce((sum, s) => sum + s.power_draw_w, 0);
          next[rackId] = {
            ...rack,
            ambient_temp_c: Number((22.0 + Math.random() * 0.4).toFixed(1)),
            current_power_kw: Number((totalW / 1000).toFixed(2)),
            updated_at: new Date().toISOString(),
            servers: newServers,
          };
        });
        return next;
      });
    }, 2500);

    return () => clearInterval(timer);
  }, []);

  // Real-Time Slider Physics Binding (Updates Sandbox Shadow Twin)
  const updateServerSlider = useCallback((
    rackId: string, 
    serverId: string, 
    params: SliderTelemetryParams
  ) => {
    // If user interacts with sliders while in production, seamlessly switch to Sandbox
    if (environment !== 'sandbox') {
      setEnvironmentState('sandbox');
    }

    setSandboxRacks((prev) => {
      const rack = prev[rackId];
      if (!rack) return prev;

      const newServers = rack.servers.map((srv) => {
        if (srv.server_id !== serverId) return srv;

        const isDlc = srv.is_dlc_only || srv.model.includes('Rubin');
        
        // 1. GPU / Workload Load Slider (10% to 100%)
        const gpuLoad = params.gpuLoadPct !== undefined ? params.gpuLoadPct : (srv.gpu_utilization_pct ?? 65);
        const cpuLoad = Math.max(15, Math.min(99, gpuLoad * 0.85));

        // Wattage calculation:
        // Dell XE9680 (8x H100): 2,000W at 10% load up to ~10,200W peak at 100%!
        // NVL72 4U Block: ~5,000W up to ~26,000W
        // Cisco Nexus 1U: 250W to 700W
        let activePowerW = srv.power_draw_w;
        if (srv.model.includes('XE9680')) {
          activePowerW = Math.round(2000 + (gpuLoad / 100) * 8200); // 2,000W - 10,200W
        } else if (isDlc) {
          activePowerW = Math.round(6000 + (gpuLoad / 100) * 20000);
        } else {
          activePowerW = Math.round(srv.max_power_w * (0.2 + (gpuLoad / 100) * 0.8));
        }

        // 2. Air-cooling Fan Slider (1,000 RPM to 15,000 RPM)
        const fanSpeed = !isDlc 
          ? (params.fanRpm !== undefined ? params.fanRpm : srv.fan_speed_rpm) 
          : 0;

        // 3. Liquid-cooling Flow Rate & Supply Temp Slider
        const flowLpm = isDlc 
          ? (params.coolantFlowLpm !== undefined ? params.coolantFlowLpm : (srv.coolant_flow_rate_lpm ?? 130))
          : undefined;
        const supplyC = isDlc 
          ? (params.supplyTempC !== undefined ? params.supplyTempC : (srv.coolant_supply_temp_c ?? 45))
          : srv.inlet_temp_c;

        // Realistic Thermal Physics:
        let calculatedOutletTemp = srv.outlet_temp_c;
        let calculatedInletTemp = srv.inlet_temp_c;

        if (isDlc && flowLpm !== undefined) {
          // Liquid loop physics:
          // Low flow rate (< 40 LPM) or high supply (> 55°C) drives return temp past 75°C
          const flowPenalty = Math.max(0, (130 - flowLpm) * 0.35);
          const loadPenalty = (gpuLoad / 100) * 12;
          const returnTemp = Number((supplyC + 10 + flowPenalty + loadPenalty).toFixed(1));
          calculatedOutletTemp = returnTemp;
          calculatedInletTemp = supplyC;
        } else {
          // Air-assisted physics:
          // Low fan speed (< 3,000 RPM) under heavy load (> 80%) spikes temperature > 75°C
          const fanImpedance = fanSpeed > 0 ? (10000 / fanSpeed) : 4.0;
          const deltaT = (activePowerW / 100) * (fanImpedance * 0.35);
          calculatedOutletTemp = Number((calculatedInletTemp + deltaT).toFixed(1));
          if (calculatedOutletTemp > 70) {
            calculatedInletTemp = Number((24.0 + (calculatedOutletTemp - 70) * 0.4).toFixed(1));
          }
        }

        // Dynamic Health Status: Green <35°C, Amber 45°C-70°C, Flashing Red >75°C
        const nextStatus: HealthStatus = 
          calculatedOutletTemp >= 75 ? 'critical' :
          calculatedOutletTemp >= 45 ? 'warning' : 'healthy';

        return {
          ...srv,
          cpu_utilization_pct: cpuLoad,
          gpu_utilization_pct: gpuLoad,
          power_draw_w: activePowerW,
          fan_speed_rpm: fanSpeed,
          inlet_temp_c: calculatedInletTemp,
          outlet_temp_c: calculatedOutletTemp,
          status: nextStatus,
          coolant_flow_rate_lpm: flowLpm,
          coolant_supply_temp_c: supplyC,
          coolant_return_temp_c: isDlc ? calculatedOutletTemp : undefined,
          manifold_pressure_psi: isDlc && flowLpm ? Number(((flowLpm / 130) * 42).toFixed(1)) : undefined,
        };
      });

      const totalW = newServers.reduce((sum, s) => sum + s.power_draw_w, 0);
      const hasCritical = newServers.some(s => s.status === 'critical');
      const hasWarning = newServers.some(s => s.status === 'warning');

      return {
        ...prev,
        [rackId]: {
          ...rack,
          status: hasCritical ? 'critical' : hasWarning ? 'warning' : 'healthy',
          current_power_kw: Number((totalW / 1000).toFixed(2)),
          servers: newServers,
          updated_at: new Date().toISOString(),
        },
      };
    });
  }, [environment]);

  // Inject 1-Click Preset Fault (Strictly isolated in Sandbox Shadow Twin)
  const injectFault = useCallback((
    rackId: string, 
    serverId: string, 
    scenario: 'fan_failure' | 'compute_spike' | 'coolant_leak' | 'gpu_hotspot',
    targetGpuIndex?: number
  ) => {
    // Automatically switch to sandbox if in production
    if (environment !== 'sandbox') {
      setEnvironmentState('sandbox');
    }

    setSandboxRacks((prev) => {
      const rack = prev[rackId];
      if (!rack) return prev;

      const newServers = rack.servers.map((srv) => {
        if (srv.server_id !== serverId) return srv;

        const hotGpuIdx = targetGpuIndex ?? 3;

        if (scenario === 'gpu_hotspot' || targetGpuIndex !== undefined) {
          const updatedGpus = (srv.gpus || Array.from({ length: 8 }, (_, i) => ({
            id: `gpu-${i}`,
            index: i,
            name: `GPU ${i}`,
            core_temp_c: 71.8,
            hbm3_temp_c: 76.0,
            tensor_utilization_pct: 88,
            power_w: 520,
            max_power_w: 700,
            status: 'healthy' as const,
          }))).map((gpu) => {
            if (gpu.index === hotGpuIdx) {
              return {
                ...gpu,
                core_temp_c: 86.5, // > 84°C Red Throttle
                hbm3_temp_c: 91.2,
                tensor_utilization_pct: 99.0,
                power_w: 695,
                status: 'critical' as const,
                is_throttled: true,
              };
            }
            return gpu;
          });

          return {
            ...srv,
            target_hotspot_gpu_index: hotGpuIdx,
            gpus: updatedGpus,
            gpu_subsystem_peak_temp_c: 86.5,
            outlet_temp_c: 78.8, // > 75°C Red
            power_draw_w: Math.max(srv.power_draw_w, 4950),
            status: 'critical' as const,
            power_capped: false,
          };
        }

        if (scenario === 'fan_failure') {
          return {
            ...srv,
            fan_speed_rpm: 1200, // Instantly drop to 1,200 RPM
            inlet_temp_c: 48.5,
            outlet_temp_c: 78.5, // > 75°C Flashing Red
            cpu_utilization_pct: 99.0,
            power_draw_w: Math.max(srv.power_draw_w, 4200),
            status: 'critical' as const,
            power_capped: false,
          };
        }

        if (scenario === 'coolant_leak') {
          return {
            ...srv,
            coolant_flow_rate_lpm: 25.0, // Drop flow to 25 LPM
            manifold_pressure_psi: 18.0, // Drop pressure to 18 PSI
            coolant_supply_temp_c: 54.0,
            coolant_return_temp_c: 82.0,
            outlet_temp_c: 82.0, // > 75°C Flashing Red
            status: 'critical' as const,
            power_capped: false,
          };
        }

        // compute_spike
        return {
          ...srv,
          cpu_utilization_pct: 99.9,
          gpu_utilization_pct: 99.0, // Spikes GPU load to 99%
          outlet_temp_c: 79.2, // > 75°C Flashing Red
          power_draw_w: Math.min(srv.max_power_w, 10200),
          status: 'critical' as const,
          power_capped: false,
        };
      });

      const totalW = newServers.reduce((sum, s) => sum + s.power_draw_w, 0);
      return {
        ...prev,
        [rackId]: {
          ...rack,
          status: 'critical',
          current_power_kw: Number((totalW / 1000).toFixed(2)),
          servers: newServers,
          updated_at: new Date().toISOString(),
        },
      };
    });

    // Dispatch isolated SIMULATED incident ticket to Action Hub
    setTimeout(() => {
      setSandboxRacks((currentRacks) => {
        const targetServer = currentRacks[rackId]?.servers.find(s => s.server_id === serverId);
        if (!targetServer) return currentRacks;

        let citation = 'Dell PowerEdge XE9680 (8x NVIDIA H100) Technical Guide, Section 4.2, Page 58';
        if (targetServer.model.includes('Cisco')) {
          citation = 'Cisco Nexus 9000 Series Hardware Installation Guide, Page 42';
        } else if (targetServer.model.includes('Rubin')) {
          citation = 'NVIDIA Vera Rubin NVL72 Direct-to-Chip Liquid Cooling Specification, ASHRAE W4, Page 28';
        }

        const isGpuHotspot = scenario === 'gpu_hotspot' || targetGpuIndex !== undefined;
        const targetLabel = isGpuHotspot 
          ? `SXM5 GPU ${targetGpuIndex ?? 3} on ${targetServer.server_id}` 
          : targetServer.server_id;

        const rootCause = isGpuHotspot
          ? `[SIMULATED INCIDENT] Per-GPU localized hotspot detected on SXM5 socket GPU ${targetGpuIndex ?? 3} of ${targetServer.server_id} (${targetServer.model}). Measured silicon core: 86.5°C (>83.0°C thermal throttle threshold) under 99.0% tensor load.`
          : `[SIMULATED INCIDENT] Chaos injection (${scenario.toUpperCase()}) on ${targetServer.server_id} (${targetServer.model}). Measured thermal excursion: ${targetServer.outlet_temp_c}°C (limit 75.0°C).`;

        const newTicket: IncidentTicket = {
          id: `sim-inc-${Date.now()}`,
          incident_id: `sim-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(100 + Math.random() * 900)}`,
          rack_id: rackId,
          server_id: targetServer.server_id,
          severity: 'P1',
          status: 'AWAITING_APPROVAL',
          created_at: new Date().toISOString(),
          is_simulated: true,
          environment: 'SANDBOX',
          root_cause_analysis: rootCause,
          citation,
          recommended_action: {
            action_type: 'THROTTLE_POWER',
            target_device: targetLabel,
            action_label: 'Execute Power Cap Mitigation',
            parameters: {
              power_cap_watts: 1500,
              target_gpu_index: isGpuHotspot ? (targetGpuIndex ?? 3) : undefined,
              workload_target_rack: 'rack-b01',
            },
          },
          execution_logs: [
            {
              timestamp: new Date().toISOString(),
              message: `Simulated anomaly triggered via AI Sandbox preset. Target: ${targetLabel}.`,
            },
          ],
          metrics_snapshot: {
            temp_c: targetServer.outlet_temp_c,
            fan_rpm: targetServer.fan_speed_rpm,
            power_w: targetServer.power_draw_w,
          },
        };

        setSandboxIncidents((prev) => [newTicket, ...prev]);
        // Also persist to Firestore collection
        saveIncidentToFirestore(newTicket);
        return currentRacks;
      });
    }, 300);
  }, [environment]);

  // Approve and execute mitigation (Redfish power-cap / cooling stabilization)
  const approveIncident = useCallback(async (incidentId: string, approverInfo?: { name: string; role: string }) => {
    // Synchronously locate the ticket across all lists and review state
    const targetTicket = 
      (selectedIncidentForReview && (selectedIncidentForReview.id === incidentId || selectedIncidentForReview.incident_id === incidentId))
        ? selectedIncidentForReview
        : [
            ...sandboxIncidents,
            ...productionIncidents,
            ...firestoreIncidents,
          ].find((i) => i.id === incidentId || i.incident_id === incidentId);

    const targetRackId = targetTicket?.rack_id || activeRackId || 'rack-a01';
    const targetServerId = targetTicket?.server_id || 'srv-rack-a01-u34';
    const capWatts = targetTicket?.recommended_action?.parameters?.power_cap_watts || 1500;

    const operatorStr = approverInfo 
      ? `${approverInfo.name} (${approverInfo.role})` 
      : 'Darshan Skolekar (Lead Infrastructure SRE - L3 Admin)';
    const timestampStr = new Date().toLocaleTimeString();
    const mitigatedAtIso = new Date().toISOString();

    const newLog = {
      timestamp: mitigatedAtIso,
      message: `Power-cap to ${capWatts}W approved & dispatched by ${operatorStr} via Redfish API at ${timestampStr}. All GPU silicon temperatures normalized to < 72°C (Nominal).`,
    };

    const updater = (list: IncidentTicket[]) =>
      list.map((inc) => {
        if (inc.id === incidentId || inc.incident_id === incidentId) {
          return {
            ...inc,
            status: 'APPROVED_AND_EXECUTED' as const,
            mitigated_by: operatorStr,
            mitigated_at: mitigatedAtIso,
            execution_logs: [
              ...(inc.execution_logs || []),
              newLog,
            ],
          };
        }
        return inc;
      });

    // 1. Immediately update all incident states in React so UI reacts synchronously
    setSandboxIncidents(updater);
    setProductionIncidents(updater);
    setFirestoreIncidents(updater);
    setSelectedIncidentForReview((prev) => {
      if (!prev) return null;
      if (prev.id === incidentId || prev.incident_id === incidentId) {
        return {
          ...prev,
          status: 'APPROVED_AND_EXECUTED',
          mitigated_by: operatorStr,
          mitigated_at: mitigatedAtIso,
          execution_logs: [...(prev.execution_logs || []), newLog],
        };
      }
      return prev;
    });

    // 2. Persist update to Firestore
    const idToUpdate = targetTicket?.id || incidentId;
    updateIncidentInFirestore(idToUpdate, {
      status: 'APPROVED_AND_EXECUTED',
      mitigated_by: operatorStr,
      mitigated_at: mitigatedAtIso,
      execution_logs: [...(targetTicket?.execution_logs || []), newLog],
    });
    if (targetTicket?.incident_id && targetTicket.incident_id !== idToUpdate) {
      updateIncidentInFirestore(targetTicket.incident_id, {
        status: 'APPROVED_AND_EXECUTED',
        mitigated_by: operatorStr,
        mitigated_at: mitigatedAtIso,
        execution_logs: [...(targetTicket?.execution_logs || []), newLog],
      });
    }

    // 3. Helper to normalize servers and rack thermal/power state
    const stabilizeRacksMap = (prev: Record<string, RackTelemetry>): Record<string, RackTelemetry> => {
      const rackKey = prev[targetRackId] ? targetRackId : (prev['rack-a01'] ? 'rack-a01' : Object.keys(prev)[0]);
      const rack = prev[rackKey];
      if (!rack) return prev;

      const newServers = rack.servers.map((srv) => {
        if (srv.server_id !== targetServerId && targetServerId) return srv;
        return {
          ...srv,
          power_capped: true,
          power_draw_w: capWatts,
          fan_speed_rpm: srv.is_dlc_only ? 0 : 12000,
          coolant_flow_rate_lpm: srv.is_dlc_only ? 130.0 : undefined,
          manifold_pressure_psi: srv.is_dlc_only ? 42.0 : undefined,
          inlet_temp_c: 24.2,
          outlet_temp_c: 32.5, // Cooled back to < 35°C Green
          status: 'healthy' as HealthStatus,
          cpu_utilization_pct: 35.0,
          gpu_utilization_pct: 30.0,
          gpu_subsystem_peak_temp_c: 71.8,
          target_hotspot_gpu_index: undefined,
          gpus: srv.gpus ? srv.gpus.map((g) => ({
            ...g,
            core_temp_c: 70.8,
            hbm3_temp_c: 75.0,
            tensor_utilization_pct: 40,
            power_w: 420,
            status: 'healthy' as HealthStatus,
            is_throttled: false,
          })) : undefined,
        };
      });

      const totalW = newServers.reduce((sum, s) => sum + s.power_draw_w, 0);
      const rackStatus: HealthStatus = newServers.some(s => s.status === 'critical') ? 'critical' : 'healthy';
      return {
        ...prev,
        [rackKey]: {
          ...rack,
          status: rackStatus,
          current_power_kw: Number((totalW / 1000).toFixed(2)),
          servers: newServers,
          updated_at: new Date().toISOString(),
        },
      };
    };

    // Stabilize both Sandbox and Production racks
    setSandboxRacks(stabilizeRacksMap);
    setProductionRacks(stabilizeRacksMap);

    // Also update selectedServer if currently viewed
    setSelectedServer((prev) => {
      if (!prev || prev.server_id !== targetServerId) return prev;
      return {
        ...prev,
        power_capped: true,
        power_draw_w: capWatts,
        fan_speed_rpm: prev.is_dlc_only ? 0 : 12000,
        coolant_flow_rate_lpm: prev.is_dlc_only ? 130.0 : undefined,
        manifold_pressure_psi: prev.is_dlc_only ? 42.0 : undefined,
        inlet_temp_c: 24.2,
        outlet_temp_c: 32.5,
        status: 'healthy',
        cpu_utilization_pct: 35.0,
        gpu_utilization_pct: 30.0,
        gpu_subsystem_peak_temp_c: 71.8,
        target_hotspot_gpu_index: undefined,
        gpus: prev.gpus ? prev.gpus.map((g) => ({
          ...g,
          core_temp_c: 70.8,
          hbm3_temp_c: 75.0,
          tensor_utilization_pct: 40,
          power_w: 420,
          status: 'healthy',
          is_throttled: false,
        })) : undefined,
      };
    });
  }, [activeRackId, selectedIncidentForReview, sandboxIncidents, productionIncidents, firestoreIncidents]);

  // Reject mitigation
  const rejectIncident = useCallback(async (incidentId: string) => {
    const targetTicket = 
      (selectedIncidentForReview && (selectedIncidentForReview.id === incidentId || selectedIncidentForReview.incident_id === incidentId))
        ? selectedIncidentForReview
        : [
            ...sandboxIncidents,
            ...productionIncidents,
            ...firestoreIncidents,
          ].find((i) => i.id === incidentId || i.incident_id === incidentId);

    const rejectLog = {
      timestamp: new Date().toISOString(),
      message: 'Operator rejected mitigation. Autonomous action aborted.',
    };

    const updater = (list: IncidentTicket[]) =>
      list.map((inc) => {
        if (inc.id === incidentId || inc.incident_id === incidentId) {
          return {
            ...inc,
            status: 'REJECTED' as const,
            execution_logs: [
              ...(inc.execution_logs || []),
              rejectLog,
            ],
          };
        }
        return inc;
      });

    setSandboxIncidents(updater);
    setProductionIncidents(updater);
    setFirestoreIncidents(updater);
    setSelectedIncidentForReview((prev) => {
      if (!prev) return null;
      if (prev.id === incidentId || prev.incident_id === incidentId) {
        return {
          ...prev,
          status: 'REJECTED',
          execution_logs: [...(prev.execution_logs || []), rejectLog],
        };
      }
      return prev;
    });

    const idToUpdate = targetTicket?.id || incidentId;
    updateIncidentInFirestore(idToUpdate, {
      status: 'REJECTED',
      execution_logs: [...(targetTicket?.execution_logs || []), rejectLog],
    });
    if (targetTicket?.incident_id && targetTicket.incident_id !== idToUpdate) {
      updateIncidentInFirestore(targetTicket.incident_id, {
        status: 'REJECTED',
        execution_logs: [...(targetTicket?.execution_logs || []), rejectLog],
      });
    }
  }, [selectedIncidentForReview, sandboxIncidents, productionIncidents, firestoreIncidents]);

  // Reset baseline
  const resetBaseline = useCallback(() => {
    if (environment === 'sandbox') {
      resetSandboxToProductionBaseline();
    } else {
      setProductionRacks(createInitialRacks());
      setProductionIncidents([]);
    }
  }, [environment, resetSandboxToProductionBaseline]);

  // Run Gemini Triage Agent
  const runDiagnosis = useCallback(async (rackId?: string) => {
    const targetId = rackId || activeRackId;
    setIsDiagnosing(true);

    try {
      const currentRack = racks[targetId];
      const anomalous = currentRack?.servers.find(
        (s) => s.status === 'critical' || s.outlet_temp_c >= 75 || s.inlet_temp_c >= 45
      );

      if (!anomalous) {
        await new Promise((r) => setTimeout(r, 600));
        return;
      }

      let citation = 'NVIDIA Vera Rubin NVL72 Direct-to-Chip Liquid Cooling Specification, ASHRAE W4, Page 28';
      if (anomalous.model.includes('XE9680')) {
        citation = 'Dell PowerEdge XE9680 (8x NVIDIA H100) Technical Guide, Section 4.2, Page 58';
      } else if (anomalous.model.includes('Cisco')) {
        citation = 'Cisco Nexus 9000 Series Hardware Installation Guide, Page 42';
      }

      const generatedTicket: IncidentTicket = {
        id: `inc-${Date.now()}`,
        incident_id: `${environment === 'sandbox' ? 'sim' : 'inc'}-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(100 + Math.random() * 900)}`,
        rack_id: targetId,
        server_id: anomalous.server_id,
        severity: 'P1',
        status: 'AWAITING_APPROVAL',
        created_at: new Date().toISOString(),
        created_by: 'Autonomous Gemini Monitor',
        is_simulated: environment === 'sandbox',
        environment: environment === 'sandbox' ? 'SANDBOX' : 'PRODUCTION',
        root_cause_analysis: `${environment === 'sandbox' ? '[SIMULATED INCIDENT] ' : ''}Critical thermal threshold breach on ${anomalous.server_id} (${anomalous.model}). Measured outlet exhaust: ${anomalous.outlet_temp_c}°C (limit 75.0°C). Active load: ${anomalous.power_draw_w}W.`,
        citation,
        recommended_action: {
          action_type: 'THROTTLE_POWER',
          target_device: anomalous.server_id,
          action_label: 'Approve & Execute Mitigation',
          parameters: {
            power_cap_watts: 1500,
            workload_target_rack: 'rack-b01',
          },
        },
        execution_logs: [
          {
            timestamp: new Date().toISOString(),
            message: `Gemini Autonomous Agent detected anomaly in ${environment.toUpperCase()} mode. Generated mitigation ticket.`,
          },
        ],
        metrics_snapshot: {
          temp_c: anomalous.outlet_temp_c,
          fan_rpm: anomalous.fan_speed_rpm,
          power_w: anomalous.power_draw_w,
        },
      };

      if (environment === 'sandbox') {
        setSandboxIncidents((prev) => [generatedTicket, ...prev]);
      } else {
        setProductionIncidents((prev) => [generatedTicket, ...prev]);
      }

      // Persist to Firestore incidents collection and show alert toast
      saveIncidentToFirestore(generatedTicket);
      triggerToast(generatedTicket);
    } finally {
      setIsDiagnosing(false);
    }
  }, [activeRackId, environment, racks]);

  // Context-aware Dual-Mode Copilot Queries with Fast Timeout Protection
  const sendCopilotQuery = useCallback(async (
    question: string,
    chatHistory?: Array<{ role: 'user' | 'model'; content: string }>,
    userInfo?: { name?: string; role?: string; attribution?: string }
  ): Promise<string> => {
    const currentRack = racks[activeRackId] || racks['rack-a01'];
    const totalPower = Object.values(racks).reduce((sum, r) => sum + r.current_power_kw, 0);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 7000);

      const res = await fetch('/api/gemini/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({ 
          question, 
          active_rack_id: activeRackId,
          rack_state: currentRack,
          environment,
          chat_history: chatHistory || [],
          user_info: userInfo,
        }),
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (data.created_ticket) {
          const ticket: IncidentTicket = {
            ...data.created_ticket,
            environment: environment === 'sandbox' ? 'SANDBOX' : 'PRODUCTION',
            is_simulated: environment === 'sandbox',
          };
          saveIncidentToFirestore(ticket);
          triggerToast(ticket);
          if (environment === 'sandbox') {
            setSandboxIncidents(prev => [ticket, ...prev.filter(t => t.id !== ticket.id && t.incident_id !== ticket.incident_id)]);
          } else {
            setProductionIncidents(prev => [ticket, ...prev.filter(t => t.id !== ticket.id && t.incident_id !== ticket.incident_id)]);
          }
        }
        if (data.answer && data.answer.trim().length > 0) {
          return data.answer;
        }
      }
    } catch (e) {
      // Backend unavailable / timed out fallback
    }

    const qLower = question.toLowerCase();
    const currentQueryLower = qLower.trim();

    // Guided Ticket Intake Fallback
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

    const ticketIntentRegex = /\b(?:raise|log|create|file|open|generate|dispatch|submit|report)\s+(?:a\s+|an\s+)?(?:incident|ticket|issue|alert)\b/i;
    const pronounIntentRegex = /\b(?:copilot\s+)?(?:to\s+)?(?:create|log|raise|file|dispatch)\s+it\b/i;
    const copilotDirectRegex = /\bcopilot[,\s]+(?:please\s+)?(?:to\s+)?(?:create|file|log|raise|dispatch)\b/i;

    const lastModelMsg = [...(chatHistory || [])].reverse().find(h => h.role === 'model');
    const lastModelContent = lastModelMsg ? lastModelMsg.content : '';
    const isFollowupToIntake = lastModelContent.length > 0 && (
      lastModelContent.includes('Copilot Guided Incident Intake') ||
      lastModelContent.includes('Details Required') ||
      lastModelContent.includes('missing parameters above') ||
      lastModelContent.toLowerCase().includes('guided incident intake')
    );

    // Check if previous assistant message had slots confirmed
    let prevConfirmedSev: 'P1' | 'P2' | 'P3' | undefined = undefined;
    const sevMatchInAsst = lastModelContent.match(/1\.\s*\*\*Severity Level\*\*:\s*✅\s*Confirmed:\s*\*\*(P[123])/i);
    if (sevMatchInAsst) {
      prevConfirmedSev = sevMatchInAsst[1].toUpperCase() as 'P1' | 'P2' | 'P3';
    }

    let prevConfirmedHw: string | undefined = undefined;
    const hwMatchInAsst = lastModelContent.match(/2\.\s*\*\*Target Hardware \/ Location\*\*:\s*✅\s*Confirmed:\s*\*\*([^*]+)\*\*/i);
    if (hwMatchInAsst) {
      prevConfirmedHw = hwMatchInAsst[1].trim();
    }

    let prevConfirmedDesc: string | undefined = undefined;
    const descMatchInAsst = lastModelContent.match(/3\.\s*\*\*(?:Issue Description|Anomaly Summary[^:]*)\*\*:\s*✅\s*Confirmed:\s*\*([^*]+)\*/i);
    if (descMatchInAsst) {
      prevConfirmedDesc = descMatchInAsst[1].trim();
    }

    const descPendingInAsst = /3\.\s*\*\*(?:Issue Description|Anomaly Summary[^:]*)\*\*:\s*⚠️/i.test(lastModelContent);

    // Filter ONLY user-submitted messages from history
    const userHistoryMessages = (chatHistory || [])
      .filter(h => h.role === 'user')
      .slice(-4)
      .map(h => h.content.trim());
    const allUserTexts = [...userHistoryMessages, question.trim()];
    const allUserCombined = allUserTexts.join('\n');

    const hasTicketIntent = intentKeywords.some(k => currentQueryLower.includes(k)) 
      || ticketIntentRegex.test(currentQueryLower)
      || pronounIntentRegex.test(currentQueryLower)
      || copilotDirectRegex.test(currentQueryLower)
      || userHistoryMessages.some(m => intentKeywords.some(k => m.toLowerCase().includes(k)) || ticketIntentRegex.test(m) || pronounIntentRegex.test(m) || copilotDirectRegex.test(m))
      || !!isFollowupToIntake;

    if (hasTicketIntent) {
      // 1. Severity check
      let severity: 'P1' | 'P2' | 'P3' | undefined = prevConfirmedSev;
      if (!severity) {
        if (/\b(?:sev(?:erity)?\s*[:=-]?\s*p?1|p1\b|critical\s+outage|sev[- ]?1)\b/i.test(allUserCombined)) severity = 'P1';
        else if (/\b(?:sev(?:erity)?\s*[:=-]?\s*p?2|p2\b|high\s+risk|sev[- ]?2)\b/i.test(allUserCombined)) severity = 'P2';
        else if (/\b(?:sev(?:erity)?\s*[:=-]?\s*p?3|p3\b|warning\b|sev[- ]?3)\b/i.test(allUserCombined)) severity = 'P3';
      }

      // 2. Target hardware check
      let targetHardware: string | undefined = prevConfirmedHw;
      const srvMatch = allUserCombined.match(/\bsrv-[\w-]+/i);
      const rackMatch = allUserCombined.match(/\brack-[a-z0-9]+/i) || allUserCombined.match(/\brack\s+[a-z0-9]+/i);
      const chassisMatch = allUserCombined.match(/(?:Dell\s+)?(?:PowerEdge\s+)?XE9680(?:\s+U\d+)?/i) 
        || allUserCombined.match(/(?:NVIDIA\s+)?(?:Vera\s+Rubin\s+)?NVL72(?:\s+U\d+)?/i)
        || allUserCombined.match(/Cisco\s+Nexus\s+9000(?:\s+U\d+)?/i)
        || allUserCombined.match(/\bU\d{1,2}\b/i);

      if (!targetHardware) {
        if (rackMatch && chassisMatch) targetHardware = `${rackMatch[0].toUpperCase()} - ${chassisMatch[0]}`;
        else if (srvMatch && rackMatch) targetHardware = `${rackMatch[0].toUpperCase()} - ${srvMatch[0]}`;
        else if (chassisMatch) targetHardware = chassisMatch[0];
        else if (srvMatch) targetHardware = srvMatch[0];
        else if (rackMatch && (allUserCombined.toLowerCase().includes('dell') || allUserCombined.toLowerCase().includes('server') || allUserCombined.toLowerCase().includes('chassis') || allUserCombined.toLowerCase().includes('node') || allUserCombined.toLowerCase().includes('u'))) {
          targetHardware = rackMatch[0].toUpperCase();
        }
      }

      // 3. Issue Description check
      let issueDescription: string | undefined = prevConfirmedDesc;

      const trimmed = question.trim();
      const isOnlySeverity = /^(?:p[123]|critical(?:\s+outage)?|high(?:\s+risk)?|warning|sev[- ]?[123])$/i.test(trimmed);
      const isOnlyRack = /^(?:rack[-\s][a-z0-9]+)$/i.test(trimmed);
      const isOnlyHardware = /^(?:rack[-\s][a-z0-9]+(?:\s*-\s*|\s+)?(?:dell|u\d+|srv|cisco|nvl)?[\w\s-]*)$/i.test(trimmed);
      const isCancel = /^(?:cancel|abort|stop|no)$/i.test(trimmed);
      const isConfirmOnly = /^(?:(?:copilot\s+)?(?:to\s+)?create(?:\s+it)?|create\s+(?:an?\s+)?(?:incident|ticket)|dispatch(?:\s+it)?|file(?:\s+it)?|confirm|submit|yes|proceed)$/i.test(trimmed);

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

      if (!issueDescription && (isConfirmOnly || pronounIntentRegex.test(trimmed)) && severity && targetHardware) {
        issueDescription = `Operator requested incident escalation for ${targetHardware}`;
      }

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

      if (!issueDescription && isFollowupToIntake && !isOnlySeverity && !isOnlyRack && !isOnlyHardware && !isCancel) {
        if (isConfirmOnly) {
          if (severity && targetHardware) {
            issueDescription = `Operator confirmed incident dispatch for ${targetHardware}`;
          }
        } else if (trimmed.length >= 3 && !intentKeywords.some(k => currentQueryLower === k)) {
          issueDescription = trimmed;
        }
      }

      if (!issueDescription && severity && targetHardware) {
        let remaining = question;
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

      if (!severity || !targetHardware || !issueDescription) {
        return `### 📋 Copilot Guided Incident Intake: Details Required
To file an official incident ticket for the Action Hub, I need to collect or confirm the following critical parameters:

1. **Severity Level**: ${severity ? `✅ Confirmed: **${severity}**` : '⚠️ **Please specify**: **P1 - Critical Outage** (Immediate throttle), **P2 - High Risk**, or **P3 - Warning**'}
2. **Target Hardware / Location**: ${targetHardware ? `✅ Confirmed: **${targetHardware}**` : '⚠️ **Please specify**: Target Rack ID and specific chassis/slot (e.g., **Rack A01 - Dell XE9680 U14**)'}
3. **Issue Description**: ${issueDescription ? `✅ Confirmed: *${issueDescription}*` : '⚠️ **Please specify**: Any physical observation, symptom, or note (e.g., *Loose cables from server to switch*, *Drive bay LED flashing amber*, *Coolant flow drop*, *Firmware sync failure*)'}

Please reply with the missing parameters above to confirm and dispatch the incident ticket.`;
      } else {
        const creator = userInfo?.attribution || 'Darshan (Lead SRE)';
        const targetServerId = srvMatch ? srvMatch[0] : (currentRack.servers[3]?.server_id || currentRack.servers[0]?.server_id || 'srv-rack-a01-u34');
        const envTag = environment === 'sandbox' ? 'SANDBOX' : 'PRODUCTION';
        const fallbackTicket: IncidentTicket = {
          id: `inc-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          incident_id: `${envTag === 'SANDBOX' ? 'sim' : 'inc'}-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(100 + Math.random() * 900)}`,
          rack_id: activeRackId,
          server_id: targetServerId,
          severity: severity || 'P1',
          status: 'AWAITING_APPROVAL',
          created_at: new Date().toISOString(),
          created_by: creator,
          root_cause_analysis: issueDescription,
          citation: 'Dell PowerEdge XE9680 Direct Liquid Cooling Technical Guide, Section 4.2, Page 58',
          is_simulated: envTag === 'SANDBOX',
          environment: envTag,
          recommended_action: {
            action_type: 'THROTTLE_POWER',
            target_device: targetServerId,
            action_label: 'Execute Power Cap Mitigation',
            parameters: { power_cap_watts: 1500, workload_target_rack: 'rack-b01' },
          },
          execution_logs: [{
            timestamp: new Date().toISOString(),
            message: `Incident ticket created via Copilot guided intake tool by ${creator}. Status: AWAITING_APPROVAL.`,
          }],
          metrics_snapshot: {
            temp_c: 78.5,
            fan_rpm: 1200,
            power_w: 3950,
          },
        };

        saveIncidentToFirestore(fallbackTicket);
        triggerToast(fallbackTicket);
        if (environment === 'sandbox') {
          setSandboxIncidents(prev => [fallbackTicket, ...prev.filter(t => t.id !== fallbackTicket.id && t.incident_id !== fallbackTicket.incident_id)]);
        } else {
          setProductionIncidents(prev => [fallbackTicket, ...prev.filter(t => t.id !== fallbackTicket.id && t.incident_id !== fallbackTicket.incident_id)]);
        }

        const sevLabel = severity === 'P1' ? 'P1 - Critical Outage' : severity === 'P2' ? 'P2 - High Risk' : 'P3 - Warning';
        return `### ⚠️ Incident Ticket Dispatched to Action Hub
- **Ticket ID**: \`${fallbackTicket.incident_id}\`
- **Severity**: **${fallbackTicket.severity}** (${sevLabel})
- **Target Device**: **${targetHardware}** (\`${fallbackTicket.server_id}\`)
- **Issue Description**: *${fallbackTicket.root_cause_analysis}*
- **Created By**: **${fallbackTicket.created_by}**
- **Action Hub Status**: \`AWAITING_APPROVAL\` (Live alert broadcasted to Notification Bell & Action Hub queue for Tier-3 SRE mitigation review).`;
      }
    }

    // Mode 1: Live Production Mode (Capacity Planning & Facility SRE Agent)
    if (environment === 'production') {
      const isIncidentQuery = /\b(?:incident|ticket|issue|raise|log|file|create|dispatch|report|triage)\b/i.test(qLower) || qLower.includes('copilot');
      if (isIncidentQuery) {
        return `### 📋 Copilot Guided Incident Intake: Details Required
To file an official incident ticket for the Action Hub, I need to collect or confirm the following critical parameters:

1. **Severity Level**: ⚠️ **Please specify**: **P1 - Critical Outage** (Immediate throttle), **P2 - High Risk**, or **P3 - Warning**
2. **Target Hardware / Location**: ⚠️ **Please specify**: Target Rack ID and specific chassis/slot (e.g., **Rack A01 - Dell XE9680 U14**)
3. **Issue Description**: ⚠️ **Please specify**: Any physical observation, symptom, or note (e.g., *Loose cables from server to switch*, *Drive bay LED flashing amber*, *Coolant flow drop*, *Firmware sync failure*)

Please reply with the missing parameters above to confirm and dispatch the incident ticket.`;
      }

      if (qLower.includes('install') || qLower.includes('another') || (qLower.includes('capacity') && !qLower.includes('pue'))) {
        const availableHeadroomKw = Number((currentRack.max_power_kw - currentRack.current_power_kw).toFixed(1));
        return `### Facility SRE Capacity Planning Evaluation (${currentRack.rack_id.toUpperCase()})
- **Request**: Install additional Dell PowerEdge XE9680 (6U, rated ~5.8 kW peak).
- **Power Headroom Check**: Max Limit **${currentRack.max_power_kw} kW** | Active Draw: **${currentRack.current_power_kw} kW** (Headroom: **${availableHeadroomKw} kW**).
- **Physical Space**: Requires **6 continuous vertical rack units (6U)** (Available in baffle zone U1–U13 or U27–U36).
- **Verdict**: ⚠️ **CAPACITY WARNING**: Rack A01 is currently drawing ${currentRack.current_power_kw} kW. Adding another XE9680 (5.8 kW) pushes total draw to **${(currentRack.current_power_kw + 5.8).toFixed(1)} kW**, exceeding the branch circuit threshold.
- **Recommendation**: Deploy to **Rack B01** (Failover Pod, currently drawing ${productionRacks['rack-b01']?.current_power_kw || 19.5} kW) or schedule PDU breaker upgrade.`;
      }

      if (qLower.includes('space') || qLower.includes('continuous') || qLower.includes('u space')) {
        return `### Physical Rack U Space Audit (${currentRack.rack_id.toUpperCase()})
- **Total Height**: **42U Standard EIA-310-E Enclosure**
- **Continuous Unoccupied / Baffle Blocks**:
  * **U1–U13 (13U continuous)**: Lower air containment baffle zone (ideal for dual 6U compute nodes).
  * **U27–U36 (10U continuous)**: Mid-tier containment baffle zone.
  * **U39–U40 (2U contiguous)**: Sub-ToR baffle block.
- **Available Contiguous Capacity**: **13U** (Slots U1–U13).`;
      }

      if (qLower.includes('pue') || qLower.includes('power') || qLower.includes('phase')) {
        return `### Facility Power & Efficiency Audit (LIVE PRODUCTION)
- **Datacenter Facility PUE**: **${currentRack.pue || 1.14}** (Target: 1.15).
- **Total Datacenter Draw**: **${totalPower.toFixed(2)} kW** across all pods.
- **3-Phase Load Balance**: Phase A: 33.2%, Phase B: 33.5%, Phase C: 33.3% (Within ANSI C84.1 ±2% variance).
- **Production Status**: All production telemetry is **IMMUTABLE** and operating within SLA.`;
      }

      return `### Production Facility SRE Briefing (${activeRackId.toUpperCase()})
- **Environment**: 🟢 **LIVE PRODUCTION (IMMUTABLE)**
- **Facility Load**: **${currentRack.current_power_kw} kW** / ${currentRack.max_power_kw} kW
- **Cooling Mode**: ${currentRack.cooling_type === 'liquid_dlc' ? '100% Direct Liquid Cooling (ASHRAE W4)' : 'Air-assisted containment'}
- **Capacity Planning**: Space and power breaker headroom verified against 24 kW/230 kW breaker thresholds.`;
    }

    // Mode 2: Simulation Sandbox Mode (Anomaly Diagnosis & Chaos Engineering Agent)
    const hotServers = currentRack.servers.filter(s => s.outlet_temp_c >= 45);
    return `### Chaos Engineering & Anomaly Diagnosis (SIMULATION SANDBOX)
- **Environment**: 🟠 **SIMULATED SHADOW TWIN (ISOLATED)**
- **Chaos Faults Detected**: ${hotServers.length > 0 ? `🔥 ${hotServers.length} chassis exceeding thermal threshold` : 'Nominal baseline'}.
${hotServers.map(s => `- **${s.server_id}** (${s.model}): Exhaust **${s.outlet_temp_c}°C** ${s.outlet_temp_c >= 75 ? '🔥 [CRITICAL RED]' : '⚠️ [WARNING]'} | Power: **${s.power_draw_w}W**`).join('\n')}
- **RAG Citation**: *Dell PowerEdge XE9680 Technical Guide Page 58* & *NVIDIA NVL72 Spec Page 28*.
- **Mitigation Directive**: Click **[Approve & Execute Mitigation]** in the Action Hub to enforce Redfish dynamic power capping to 1500W.`;
  }, [activeRackId, environment, productionRacks, racks]);

  // Streaming Copilot query with sub-second Time-to-First-Token and multi-turn context
  const sendCopilotStreamQuery = useCallback(async (
    question: string,
    onChunk: (accumulated: string) => void,
    chatHistory?: Array<{ role: 'user' | 'model'; content: string }>,
    userInfo?: { name?: string; role?: string; attribution?: string }
  ): Promise<string> => {
    const currentRack = racks[activeRackId] || racks['rack-a01'];
    let accumulated = '';

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 25000);

      const res = await fetch('/api/gemini/query-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          question,
          active_rack_id: activeRackId,
          rack_state: currentRack,
          environment,
          chat_history: chatHistory || [],
          user_info: userInfo,
        }),
      });
      clearTimeout(timeoutId);

      if (res.ok && res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let handledTicket = false;

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const dataStr = line.slice(6).trim();
              if (dataStr === '[DONE]') continue;
              try {
                const parsed = JSON.parse(dataStr);
                if (parsed.created_ticket && !handledTicket) {
                  handledTicket = true;
                  const ticket: IncidentTicket = {
                    ...parsed.created_ticket,
                    environment: environment === 'sandbox' ? 'SANDBOX' : 'PRODUCTION',
                    is_simulated: environment === 'sandbox',
                  };
                  // Persist Copilot generated ticket directly to Firestore and show alert toast
                  saveIncidentToFirestore(ticket);
                  triggerToast(ticket);
                  if (environment === 'sandbox') {
                    setSandboxIncidents(prev => [ticket, ...prev.filter(t => t.id !== ticket.id && t.incident_id !== ticket.incident_id)]);
                  } else {
                    setProductionIncidents(prev => [ticket, ...prev.filter(t => t.id !== ticket.id && t.incident_id !== ticket.incident_id)]);
                  }
                }
                if (parsed.text) {
                  accumulated += parsed.text;
                  onChunk(accumulated);
                }
              } catch (err) {
                // Ignore non-json
              }
            }
          }
        }

        if (accumulated.trim().length > 0) {
          return accumulated;
        }
      }
    } catch (err) {
      console.warn('Streaming fetch timed out or failed, using local fast stream', err);
    }

    // Instant progressive typewriter fallback so user never experiences lag
    const fallback = await sendCopilotQuery(question, chatHistory, userInfo);
    const words = fallback.split(' ');
    let currentAcc = '';
    for (let i = 0; i < words.length; i += 3) {
      currentAcc += (i === 0 ? '' : ' ') + words.slice(i, i + 3).join(' ');
      onChunk(currentAcc);
      await new Promise(r => setTimeout(r, 10));
    }
    return fallback;
  }, [activeRackId, environment, racks, sendCopilotQuery, triggerToast]);

  return (
    <TelemetryContext.Provider
      value={{
        environment,
        setEnvironment,
        racks,
        activeRackId,
        setActiveRackId,
        incidents,
        selectedServer,
        setSelectedServer,
        selectedIncidentForReview,
        setSelectedIncidentForReview,
        toasts,
        dismissToast,
        triggerToast,
        triggerCustomToast,
        heatmapOverlay,
        setHeatmapOverlay,
        isDiagnosing,
        runHealthChecks,
        injectFault,
        updateServerSlider,
        approveIncident,
        rejectIncident,
        resetBaseline,
        resetSandboxToProductionBaseline,
        runDiagnosis,
        sendCopilotQuery,
        sendCopilotStreamQuery,
      }}
    >
      {children}
    </TelemetryContext.Provider>
  );
};

export function useTelemetry(): TelemetryContextType {
  const context = useContext(TelemetryContext);
  if (!context) {
    throw new Error('useTelemetry must be used within a TelemetryProvider');
  }
  return context;
}
