import { 
  Server, 
  Wind, 
  Zap, 
  AlertOctagon, 
  ChevronRight, 
  Flame, 
  Droplet,
  Gauge,
  Activity,
  Layers,
  AlertTriangle,
  RotateCcw,
  Cpu,
  Lock
} from 'lucide-react';
import { ServerTelemetry } from '../types/telemetry';
import { useTelemetry } from '../context/TelemetryContext';
import { useAuth } from '../context/AuthContext';
import { calculateHeatColor } from '../data/rackBaseline';

export const RackTwinElevation: React.FC = () => {
  const { 
    environment,
    resetSandboxToProductionBaseline,
    racks, 
    activeRackId, 
    selectedServer, 
    setSelectedServer, 
    heatmapOverlay 
  } = useTelemetry();
  const { hasPermission } = useAuth();
  const canViewFacility = hasPermission('canViewFacilityMetrics');

  const rack = racks[activeRackId] || Object.values(racks)[0];
  const isDlcRack = rack.cooling_type === 'liquid_dlc' || rack.rack_name.includes('Rubin');

  // Map servers by their starting slot_u
  const serverMap = new Map<number, ServerTelemetry>();
  const occupiedSlots = new Set<number>();

  rack.servers.forEach((srv) => {
    serverMap.set(srv.slot_u, srv);
    for (let u = srv.slot_u; u < srv.slot_u + srv.height_u; u++) {
      occupiedSlots.add(u);
    }
  });

  // Render slots from U42 down to U1
  const slotElements: React.ReactNode[] = [];
  let u = 42;

  while (u >= 1) {
    if (serverMap.has(u)) {
      const server = serverMap.get(u)!;
      const isSelected = selectedServer?.server_id === server.server_id;
      const heat = calculateHeatColor(server.outlet_temp_c);
      const isCritical = server.status === 'critical' || server.outlet_temp_c >= 75;
      const isWarning = server.status === 'warning' || (server.outlet_temp_c >= 45 && !isCritical);
      const deltaT = Number((server.outlet_temp_c - server.inlet_temp_c).toFixed(1));

      // Exact pixel heights for rack units
      // Dell PowerEdge XE9680 (8x NVIDIA H100) takes exactly 6U: 215px
      // 4U (HGX / NVL72 Trays): 145px
      // 2U (R750 / Switch Tray): 76px
      // 1U (Cisco Nexus, APC PDU): 42px
      const minHeightPx = 
        server.height_u === 6 ? 215 :
        server.height_u === 4 ? 145 :
        server.height_u === 2 ? 76 : 42;

      // Check if this slot is a consolidated airflow containment baffle panel
      if (server.is_baffle_panel) {
        slotElements.push(
          <div
            key={`baffle-${server.slot_u}-${server.server_id}`}
            className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-950/70 border border-slate-800/80 text-slate-400 font-mono text-xs select-none shadow-inner"
            style={{ minHeight: `${Math.max(38, Math.min(75, server.height_u * 6 + 28))}px` }}
          >
            <div className="flex items-center space-x-2.5">
              <span className="font-bold text-slate-400 text-[10px] px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800">
                U{server.slot_u}{server.height_u > 1 ? `-U${server.slot_u + server.height_u - 1}` : ''} ({server.height_u}U)
              </span>
              <span className="tracking-wide text-slate-300 font-medium text-xs">
                {server.model}
              </span>
            </div>
            <div className="flex items-center space-x-2 text-[10px] text-slate-500">
              <span className="hidden sm:inline tracking-wider">AIRFLOW CONTAINMENT</span>
              <div className="flex items-center space-x-1 opacity-60">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-600"></span>
                <span className="w-1.5 h-1.5 rounded-full bg-slate-600"></span>
                <span className="w-1.5 h-1.5 rounded-full bg-slate-600"></span>
              </div>
            </div>
          </div>
        );
        u -= server.height_u;
        continue;
      }

      const isXE9680 = server.model.includes('XE9680');
      const peakGpuTemp = server.gpu_subsystem_peak_temp_c ?? 
        (server.gpus && server.gpus.length > 0 ? Math.max(...server.gpus.map(g => g.core_temp_c)) : 71.8);

      slotElements.push(
        <div
          key={`slot-${server.slot_u}-${server.server_id}`}
          onClick={() => setSelectedServer(server)}
          className={`group relative rounded-xl transition-all cursor-pointer border ${
            isSelected 
              ? 'ring-2 ring-cyan-400 border-cyan-400 z-10' 
              : isCritical
              ? 'border-rose-500 bg-rose-950/50 hover:border-rose-400 animate-pulse-fast shadow-lg shadow-rose-950/40'
              : isWarning
              ? 'border-amber-500/70 bg-amber-950/30 hover:border-amber-400'
              : 'border-slate-800 bg-slate-900/90 hover:border-slate-700 hover:bg-slate-850'
          } ${server.height_u >= 6 ? 'p-4' : server.height_u >= 4 ? 'p-3' : server.height_u === 2 ? 'p-2.5' : 'p-2'}`}
          style={{
            minHeight: `${minHeightPx}px`,
            background: heatmapOverlay 
              ? `linear-gradient(90deg, rgba(15,23,42,0.9) 0%, ${heat.hex}33 55%, ${heat.hex}77 100%)`
              : undefined
          }}
        >
          {/* Unit Tag + Identification */}
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center space-x-2">
              <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-950/90 text-slate-400 border border-slate-800">
                U{server.slot_u}{server.height_u > 1 ? `-U${server.slot_u + server.height_u - 1}` : ''} ({server.height_u}U)
              </span>

              {/* Hardware Model & Chassis Type */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-semibold text-slate-100 tracking-tight flex items-center gap-1">
                  {server.model}
                  {isDlcRack && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-mono font-normal flex items-center gap-0.5">
                      <Droplet className="w-2.5 h-2.5 text-cyan-400 inline" /> 100% DLC
                    </span>
                  )}
                  {isXE9680 && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 font-mono font-normal">
                      6U DUAL-SOCKET XEON + 8x H100
                    </span>
                  )}
                </span>

                {/* Active ML Workload / Slurm Job Telemetry Badge (Requirement #4) */}
                {isXE9680 && (
                  <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 flex items-center gap-1 shadow-xs">
                    <Cpu className="w-2.5 h-2.5 text-indigo-400" />
                    <span>Job: slurm-8821 (Fine-Tuning &bull; 8x H100)</span>
                  </span>
                )}
                {(isDlcRack && (server.model.includes('Compute') || server.model.includes('Rubin'))) && (
                  <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40 flex items-center gap-1 shadow-xs">
                    <Cpu className="w-2.5 h-2.5 text-purple-400" />
                    <span>Job: k8s-rubin-01 (Frontier Foundation Model Training &bull; 72x GPU)</span>
                  </span>
                )}

                <span className="text-[10px] font-mono text-slate-400 hidden sm:inline">
                  [{server.server_id}]
                </span>
              </div>
            </div>

            {/* Status Badges */}
            <div className="flex items-center space-x-2 font-mono">
              {server.power_capped && (
                <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 flex items-center gap-1">
                  <Zap className="w-2.5 h-2.5" />
                  CAPPED {server.power_draw_w}W
                </span>
              )}

              {isCritical ? (
                <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-rose-500/25 text-rose-300 border border-rose-500/60 flex items-center gap-1 animate-pulse">
                  <AlertOctagon className="w-2.5 h-2.5 text-rose-400" />
                  CRITICAL {server.outlet_temp_c}°C
                </span>
              ) : isWarning ? (
                <span className="text-[10px] px-2 py-0.5 rounded font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  WARNING {server.outlet_temp_c}°C
                </span>
              ) : (
                <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                  NOMINAL {server.outlet_temp_c}°C
                </span>
              )}

              <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-cyan-400 transition-colors" />
            </div>
          </div>

          {/* Special Dell PowerEdge XE9680 (6U) Split Workload & Thermal Elevation Card (Requirement #3) */}
          {isXE9680 ? (
            <div className="space-y-2 pt-1 border-t border-slate-800/80 font-mono text-xs">
              {/* Row 1: Split Load & Thermal Metrics */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {/* Host CPU Subsystem */}
                <div className="bg-slate-950/80 rounded-lg p-2 border border-slate-800/80 flex items-center justify-between">
                  <div className="flex items-center space-x-1.5 text-slate-300">
                    <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                    <span className="font-semibold text-[11px]">HOST CPU (DUAL XEON):</span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-cyan-300">{server.host_cpu_load_pct ?? 32}% Load</span>
                    <span className="text-slate-500 mx-1">|</span>
                    <span className="font-semibold text-slate-200">{server.host_cpu_temp_c ?? 45.2}°C</span>
                  </div>
                </div>

                {/* GPU Subsystem (8x H100) */}
                <div className={`rounded-lg p-2 border flex items-center justify-between ${
                  peakGpuTemp >= 83 
                    ? 'bg-rose-950/60 border-rose-500/80 text-rose-300 animate-pulse'
                    : peakGpuTemp >= 75 
                    ? 'bg-amber-950/40 border-amber-500/60 text-amber-300'
                    : 'bg-slate-950/80 border-slate-800/80 text-slate-200'
                }`}>
                  <div className="flex items-center space-x-1.5">
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                    <span className="font-semibold text-[11px]">GPU SUBSYSTEM (8x H100):</span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-amber-300">{server.gpu_subsystem_load_pct ?? 88}% Load</span>
                    <span className="text-slate-500 mx-1">|</span>
                    <span className={`font-bold ${peakGpuTemp >= 83 ? 'text-rose-400' : peakGpuTemp >= 75 ? 'text-amber-300' : 'text-emerald-400'}`}>
                      Peak: {peakGpuTemp}°C
                    </span>
                  </div>
                </div>
              </div>

              {/* Row 2: Airflow Metrics & Total Power Draw */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {/* Inlet Cold */}
                <div className="bg-slate-950/70 rounded px-2 py-1 border border-slate-800/60">
                  <div className="text-[10px] text-slate-400 flex items-center justify-between">
                    <span>INLET (COLD)</span>
                    <span className="text-cyan-400">AIR</span>
                  </div>
                  <div className="text-xs font-bold text-slate-200">
                    {server.inlet_temp_c}°C
                  </div>
                </div>

                {/* Exhaust Hot */}
                <div className={`rounded px-2 py-1 border ${
                  server.outlet_temp_c >= 75 
                    ? 'bg-rose-950/70 border-rose-500/80 text-rose-300' 
                    : server.outlet_temp_c >= 45 
                    ? 'bg-amber-950/50 border-amber-500/60 text-amber-300' 
                    : 'bg-slate-950/70 border-slate-800/60 text-slate-200'
                }`}>
                  <div className="text-[10px] text-slate-400 flex items-center justify-between">
                    <span>EXHAUST (HOT)</span>
                    <span className="font-semibold">{deltaT > 0 ? `+${deltaT}°C` : `${deltaT}°C`}</span>
                  </div>
                  <div className="text-xs font-bold flex items-center gap-1">
                    {server.outlet_temp_c}°C
                    {server.outlet_temp_c >= 75 && <Flame className="w-3 h-3 text-rose-400 inline animate-pulse" />}
                  </div>
                </div>

                {/* Fans */}
                <div className="bg-slate-950/70 rounded px-2 py-1 border border-slate-800/60">
                  <div className="text-[10px] text-slate-400 flex items-center justify-between">
                    <span>FANS</span>
                    <Wind className={`w-2.5 h-2.5 ${server.fan_speed_rpm < 2000 ? 'text-rose-400' : 'text-cyan-400'}`} />
                  </div>
                  <div className={`text-xs font-semibold ${server.fan_speed_rpm < 2000 ? 'text-rose-400 font-bold' : 'text-slate-200'}`}>
                    ~{server.fan_speed_rpm.toLocaleString()} RPM
                  </div>
                </div>

                {/* Total Power Draw */}
                <div className="bg-slate-950/70 rounded px-2 py-1 border border-slate-800/60">
                  <div className="text-[10px] text-slate-400 flex items-center justify-between">
                    <span>TOTAL POWER</span>
                    <Zap className="w-2.5 h-2.5 text-amber-400" />
                  </div>
                  <div className="text-xs font-bold text-amber-300">
                    {server.power_draw_w.toLocaleString()}W
                  </div>
                </div>
              </div>
            </div>
          ) : isDlcRack ? (
            /* NVIDIA Vera Rubin NVL72 100% Direct Liquid Cooling Strip */
            <div className="relative">
              {!canViewFacility && (
                <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-[2px] rounded-lg border border-purple-500/30 flex items-center justify-center z-10 font-mono text-[10px] text-purple-300 gap-1.5 shadow-sm">
                  <Lock className="w-3 h-3 text-purple-400" />
                  <span className="font-semibold uppercase tracking-wider">Facility Restricted</span>
                  <span className="text-[9px] text-slate-400 font-sans hidden sm:inline">(CDU / Fluid Loop Locked for AI Tenant)</span>
                </div>
              )}
              <div className={`grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono pt-1 border-t border-slate-800/80 ${!canViewFacility ? 'filter blur-[3px] opacity-40 select-none' : ''}`}>
                <div className="bg-slate-950/70 rounded px-2 py-1 border border-slate-800/60">
                  <div className="text-[10px] text-slate-400 flex items-center justify-between">
                    <span>COOLANT SUPPLY</span>
                    <Droplet className="w-2.5 h-2.5 text-cyan-400" />
                  </div>
                  <div className="text-xs font-bold text-cyan-300">
                    {server.coolant_supply_temp_c ?? 45.0}°C
                  </div>
                </div>

                <div className={`rounded px-2 py-1 border ${
                  isCritical 
                    ? 'bg-rose-950/70 border-rose-500/80 text-rose-300' 
                    : isWarning
                    ? 'bg-amber-950/50 border-amber-500/60 text-amber-300'
                    : 'bg-slate-950/70 border-slate-800/60 text-amber-300'
                }`}>
                  <div className="text-[10px] text-slate-400 flex items-center justify-between">
                    <span>COOLANT RETURN</span>
                    <span className="font-semibold text-slate-400">ΔT 15°C</span>
                  </div>
                  <div className="text-xs font-bold flex items-center gap-1">
                    {server.coolant_return_temp_c ?? server.outlet_temp_c}°C
                    {isCritical && <Flame className="w-3 h-3 text-rose-400 inline animate-pulse" />}
                  </div>
                </div>

                <div className="bg-slate-950/70 rounded px-2 py-1 border border-slate-800/60">
                  <div className="text-[10px] text-slate-400 flex items-center justify-between">
                    <span>MANIFOLD LOOP</span>
                    <Gauge className="w-2.5 h-2.5 text-emerald-400" />
                  </div>
                  <div className="text-xs font-bold text-emerald-400">
                    {server.manifold_pressure_psi ?? 42.0} <span className="text-[10px] text-slate-400">PSI</span>
                  </div>
                </div>

                <div className="bg-slate-950/70 rounded px-2 py-1 border border-slate-800/60">
                  <div className="text-[10px] text-slate-400 flex items-center justify-between">
                    <span>FLOW RATE</span>
                    <Activity className="w-2.5 h-2.5 text-blue-400" />
                  </div>
                  <div className="text-xs font-semibold text-slate-200 flex items-center justify-between">
                    <span>{server.coolant_flow_rate_lpm ?? 130.0} LPM</span>
                    <span className="text-[10px] text-emerald-400">{(server.power_draw_w / 1000).toFixed(1)} kW</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Standard Air-Assisted Chassis Strip (Cisco Switch, QM9700, R760) */
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono pt-1 border-t border-slate-800/80">
              <div className="bg-slate-950/70 rounded px-2 py-1 border border-slate-800/60">
                <div className="text-[10px] text-slate-400 flex items-center justify-between">
                  <span>INLET (COLD)</span>
                  <span className="text-cyan-400">AIR</span>
                </div>
                <div className={`text-xs font-bold ${server.inlet_temp_c >= 45 ? 'text-amber-400' : 'text-slate-200'}`}>
                  {server.inlet_temp_c}°C
                </div>
              </div>

              <div className={`rounded px-2 py-1 border ${
                isCritical 
                  ? 'bg-rose-950/70 border-rose-500/80 text-rose-300' 
                  : isWarning
                  ? 'bg-amber-950/50 border-amber-500/60 text-amber-300'
                  : 'bg-slate-950/70 border-slate-800/60 text-slate-200'
              }`}>
                <div className="text-[10px] text-slate-400 flex items-center justify-between">
                  <span>OUTLET (HOT)</span>
                  <span className="font-semibold">{deltaT > 0 ? `+${deltaT}°C` : `${deltaT}°C`}</span>
                </div>
                <div className="text-xs font-bold flex items-center gap-1">
                  {server.outlet_temp_c}°C
                  {isCritical && <Flame className="w-3 h-3 text-rose-400 inline animate-pulse" />}
                </div>
              </div>

              <div className="bg-slate-950/70 rounded px-2 py-1 border border-slate-800/60">
                <div className="text-[10px] text-slate-400 flex items-center justify-between">
                  <span>FANS</span>
                  <Wind className={`w-2.5 h-2.5 ${server.fan_speed_rpm < 2000 ? 'text-rose-400' : 'text-cyan-400'}`} />
                </div>
                <div className={`text-xs font-semibold ${server.fan_speed_rpm < 2000 ? 'text-rose-400 font-bold' : 'text-slate-200'}`}>
                  {server.fan_speed_rpm.toLocaleString()} <span className="text-[10px] text-slate-400">RPM</span>
                </div>
              </div>

              <div className="bg-slate-950/70 rounded px-2 py-1 border border-slate-800/60">
                <div className="text-[10px] text-slate-400 flex items-center justify-between">
                  <span>LOAD / POWER</span>
                  <Zap className="w-2.5 h-2.5 text-amber-400" />
                </div>
                <div className="text-xs font-semibold text-slate-200 flex items-center justify-between">
                  <span>{server.power_draw_w}W</span>
                  <span className="text-[10px] text-slate-400">{server.cpu_utilization_pct.toFixed(0)}% CPU</span>
                </div>
              </div>
            </div>
          )}

          {/* Thermal Load Progress Bar */}
          <div className="w-full bg-slate-950/80 h-1.5 rounded-full overflow-hidden mt-2 border border-slate-800">
            <div
              className={`h-full transition-all duration-500 ${
                server.outlet_temp_c >= 75
                  ? 'bg-gradient-to-r from-amber-500 to-rose-500'
                  : server.outlet_temp_c >= 45
                  ? 'bg-gradient-to-r from-emerald-500 to-amber-500'
                  : 'bg-gradient-to-r from-cyan-500 to-emerald-500'
              }`}
              style={{ width: `${Math.min((server.outlet_temp_c / 85) * 100, 100)}%` }}
            />
          </div>
        </div>
      );

      u -= server.height_u;
    } else {
      // Unoccupied slot -> Clean ventilated airflow blanking panel
      slotElements.push(
        <div
          key={`blank-${u}`}
          className="flex items-center justify-between px-3 py-1 rounded bg-slate-950/40 border border-slate-900 text-slate-600 font-mono text-[10px]"
        >
          <div className="flex items-center space-x-2">
            <span className="text-slate-500">U{u}</span>
            <span className="text-slate-500 tracking-wider">
              {isDlcRack ? '[BLIND-MATE FLUID MANIFOLD FILLER]' : '[BLANKING VENT PANEL - AIRFLOW CONTAINMENT]'}
            </span>
          </div>
          <div className="flex items-center space-x-1 opacity-40">
            <span className="w-1 h-1 rounded-full bg-slate-600"></span>
            <span className="w-1 h-1 rounded-full bg-slate-600"></span>
            <span className="w-1 h-1 rounded-full bg-slate-600"></span>
          </div>
        </div>
      );
      u -= 1;
    }
  }

  return (
    <div className={`bg-slate-900/90 rounded-2xl p-4 sm:p-5 shadow-2xl relative overflow-hidden transition-all duration-300 ${
      environment === 'sandbox'
        ? 'border-2 border-amber-500/80 shadow-[0_0_35px_rgba(245,158,11,0.22)] ring-1 ring-amber-400/50'
        : 'border border-slate-800'
    }`}>
      {/* Prominent Warning Banner in Simulation Sandbox Mode */}
      {environment === 'sandbox' && (
        <div className="mb-4 p-3 rounded-xl bg-gradient-to-r from-amber-950/80 via-amber-900/40 to-amber-950/80 border-2 border-amber-500/70 text-amber-200 text-xs font-mono flex flex-wrap items-center justify-between gap-3 shadow-lg shadow-amber-950/40 animate-pulse-subtle">
          <div className="flex items-center space-x-2.5">
            <span className="p-1 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
              <AlertTriangle className="w-4 h-4 text-amber-400 animate-bounce" />
            </span>
            <div>
              <div className="font-extrabold tracking-wide text-white flex items-center gap-2">
                <span>⚠ SIMULATED SHADOW TWIN — ISOLATED TESTING</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/30 text-amber-200 uppercase font-mono">
                  Sandbox Active
                </span>
              </div>
              <div className="text-[11px] text-amber-300/90 font-sans">
                NO IMPACT ON PRODUCTION TELEMETRY &bull; Mutations fork into shadow memory
              </div>
            </div>
          </div>
          <button
            onClick={resetSandboxToProductionBaseline}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500/30 hover:bg-amber-500/50 text-white border border-amber-400/60 shadow transition-all cursor-pointer"
            title="Immediately synchronize sandbox state back to current production telemetry"
          >
            <RotateCcw className="w-3.5 h-3.5 text-amber-300" />
            <span>Reset to Live Baseline</span>
          </button>
        </div>
      )}

      {/* Rack Header info */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-800">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
              <span>{rack.rack_name}</span>
            </h2>
            {/* Cooling Zone & Pod Grouping Badge (Requirement #3) */}
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
              isDlcRack
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
            }`}>
              {isDlcRack ? '[Zone B • 100% Direct Liquid Pod]' : '[Zone A • Hybrid Air-Assisted]'}
            </span>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-bold uppercase tracking-wider ${
              rack.status === 'critical'
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse'
                : rack.status === 'warning'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
            }`}>
              {rack.status}
            </span>
          </div>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            Row {rack.row} &bull; Position {rack.position} &bull; {rack.datacenter_location} &bull; 
            {isDlcRack ? ' 42U Exascale Pod (72 Rubin GPUs + 36 Vera CPUs • Direct Liquid Loop)' : ' 42U Server Cabinet (Air-Assisted Containment)'}
          </p>
        </div>

        {/* Real-time telemetry summary & 3-Phase Electrical PDU */}
        <div className="flex flex-wrap items-center gap-3 font-mono text-xs">
          {/* 3-Phase PDU Balance (Requirement #2) */}
          <div className="bg-slate-950/80 px-3 py-1.5 rounded-lg border border-slate-800">
            <div className="text-[10px] text-slate-400 flex items-center gap-1">
              <Zap className="w-2.5 h-2.5 text-amber-400" />
              <span>3-PHASE PDU</span>
            </div>
            <div className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
              <span>L1 34% ({(rack.current_power_kw * 0.34).toFixed(1)}kW)</span>
              <span className="text-slate-600">&bull;</span>
              <span>L2 33%</span>
              <span className="text-slate-600">&bull;</span>
              <span>L3 33%</span>
            </div>
          </div>

          <div className="bg-slate-950/80 px-3 py-1.5 rounded-lg border border-slate-800">
            <div className="text-[10px] text-slate-400">RACK DRAW</div>
            <div className="text-sm font-bold text-amber-400">
              {rack.current_power_kw} <span className="text-[10px] text-slate-400">kW</span>
            </div>
          </div>
          <div className="bg-slate-950/80 px-3 py-1.5 rounded-lg border border-slate-800">
            <div className="text-[10px] text-slate-400">MAX RATED</div>
            <div className="text-sm font-bold text-slate-200">
              {rack.max_power_kw} <span className="text-[10px] text-slate-400">kW</span>
            </div>
          </div>

          {isDlcRack ? (
            <div className="bg-cyan-950/30 px-3 py-1.5 rounded-lg border border-cyan-500/30">
              <div className="text-[10px] text-cyan-400">COOLANT LOOP</div>
              <div className="text-sm font-bold text-cyan-300">
                42 PSI &bull; 130 LPM
              </div>
            </div>
          ) : (
            <div className="bg-slate-950/80 px-3 py-1.5 rounded-lg border border-slate-800">
              <div className="text-[10px] text-slate-400">AMBIENT AIR</div>
              <div className="text-sm font-bold text-cyan-400">
                {rack.ambient_temp_c}°C
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 100% DLC Pod Banner for NVL72 */}
      {isDlcRack && (
        <div className="mb-3 p-2.5 rounded-xl bg-cyan-950/30 border border-cyan-500/30 text-xs font-mono flex flex-wrap items-center justify-between gap-2 text-cyan-300">
          <div className="flex items-center space-x-2">
            <Droplet className="w-4 h-4 text-cyan-400" />
            <span className="font-semibold">NVIDIA Vera Rubin NVL72: 100% Direct Liquid Cooling (DLC)</span>
          </div>
          <div className="flex items-center space-x-4 text-[11px] text-slate-300">
            <span>Supply: <strong className="text-cyan-300">~45°C</strong> (ASHRAE W4)</span>
            <span>Return: <strong className="text-amber-300">~58°C - 62°C</strong></span>
            <span>Pressure: <strong className="text-emerald-400">42 PSI</strong></span>
            <span>Flow: <strong className="text-blue-300">130 LPM</strong></span>
          </div>
        </div>
      )}

      {/* Rack 42U Vertical Chassis Container */}
      <div className="relative border-2 border-slate-800 rounded-xl bg-slate-950 p-2 sm:p-3 shadow-inner">
        {/* Cabinet posts */}
        <div className="absolute top-0 bottom-0 left-1 w-1 bg-slate-800 pointer-events-none"></div>
        <div className="absolute top-0 bottom-0 right-1 w-1 bg-slate-800 pointer-events-none"></div>

        {/* Stacked U Slots */}
        <div className="space-y-1.5">
          {slotElements}
        </div>
      </div>

      {/* Footer Airflow / Fluid Legend */}
      <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between text-xs text-slate-400 font-mono gap-2">
        {isDlcRack ? (
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
            <span>Coolant Supply (~45°C)</span>
            <span className="text-slate-600">&rarr;</span>
            <span className="w-2 h-2 rounded-full bg-amber-400"></span>
            <span>Coolant Return (~58-62°C, 42 PSI, 130 LPM)</span>
          </div>
        ) : (
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span>Cold Aisle (&lt;35°C Green)</span>
            <span className="text-slate-600">&rarr;</span>
            <span className="w-2 h-2 rounded-full bg-rose-500"></span>
            <span>Hot Aisle Exhaust (75°C+ Red)</span>
          </div>
        )}
        <div className="text-[11px] text-slate-500">
          Click any chassis to inspect deep telemetry and hardware manual directives
        </div>
      </div>
    </div>
  );
};
