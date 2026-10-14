import React from 'react';
import { 
  Server, 
  X, 
  Thermometer, 
  Wind, 
  Zap, 
  BookOpen, 
  Flame,
  CheckCircle2,
  Droplet,
  Gauge,
  Activity,
  Cpu,
  AlertTriangle,
  Layers,
  Sparkles
} from 'lucide-react';
import { ServerTelemetry, GpuSubsystemTelemetry, CpuCoreTelemetry } from '../types/telemetry';
import { calculateHeatColor } from '../data/rackBaseline';
import { VENDOR_MANUALS } from '../data/vendorManuals';
import { PowerDistributionSection } from './PowerDistributionSection';

interface ServerInspectorModalProps {
  server: ServerTelemetry | null;
  rackId: string;
  onClose: () => void;
  onApplyManualPowerCap?: (serverId: string, watts: number) => void;
}

export const ServerInspectorModal: React.FC<ServerInspectorModalProps> = ({
  server,
  rackId,
  onClose,
  onApplyManualPowerCap,
}) => {
  if (!server) return null;

  const heat = calculateHeatColor(server.outlet_temp_c);
  const deltaT = Number((server.outlet_temp_c - server.inlet_temp_c).toFixed(1));
  const isDlcOnly = server.is_dlc_only || server.model.includes('Vera Rubin');
  const isXE9680 = server.model.includes('XE9680');


  // Fallback CPU & GPU telemetry arrays if not initialized on chassis
  const cpus: CpuCoreTelemetry[] = server.cpus || [
    { id: 'cpu-0', name: 'Intel Xeon Platinum 8480+ [Socket 0]', load_pct: 31.0, temp_c: 44.0, power_w: 350 },
    { id: 'cpu-1', name: 'Intel Xeon Platinum 8480+ [Socket 1]', load_pct: 35.0, temp_c: 46.5, power_w: 350 },
  ];

  const gpus: GpuSubsystemTelemetry[] = server.gpus || Array.from({ length: 8 }, (_, i) => {
    const isHot = server.target_hotspot_gpu_index === i || (server.status === 'critical' && i === 3);
    const core = isHot ? 86.4 : Number((71.8 - (i % 2 === 0 ? 0.6 : 0.2)).toFixed(1));
    return {
      id: `gpu-${i}`,
      index: i,
      name: `GPU ${i}`,
      core_temp_c: core,
      hbm3_temp_c: Number((core + 4.2).toFixed(1)),
      tensor_utilization_pct: isHot ? 99 : 88,
      power_w: isHot ? 690 : 520,
      max_power_w: 700,
      status: core >= 83 ? 'critical' : core >= 75 ? 'warning' : 'healthy',
      is_throttled: core >= 83,
    };
  });

  // Find relevant manual based on model
  const relevantManual = VENDOR_MANUALS.find(m => {
    if (server.model.includes('Rubin')) return m.id.includes('rubin');
    if (server.model.includes('XE9680')) return m.id.includes('xe9680');
    if (server.model.includes('Cisco')) return m.id.includes('cisco');
    if (server.model.includes('HGX')) return m.id.includes('nvidia-hgx');
    if (server.model.includes('PDU')) return m.id.includes('apc');
    return server.model.toLowerCase().includes(m.vendor.toLowerCase());
  }) || VENDOR_MANUALS[0];

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header with Top-Right 'X' button (Only close control per Requirement #4) */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-950/90">
          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-xl border ${
              isDlcOnly
                ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400'
                : 'bg-blue-500/10 border-blue-500/30 text-blue-400'
            }`}>
              {isDlcOnly ? <Droplet className="w-5 h-5 text-cyan-400" /> : <Server className="w-5 h-5 text-blue-400" />}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-bold text-white tracking-tight">
                  {server.model}
                </h3>
                <span className="text-xs px-2 py-0.5 rounded font-mono font-semibold bg-slate-800 text-cyan-300 border border-slate-700">
                  U{server.slot_u}{server.height_u > 1 ? `-U${server.slot_u + server.height_u - 1}` : ''} ({server.height_u}U)
                </span>
                {isXE9680 && (
                  <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                    SXM5 8-WAY COMPLEX
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                {server.server_id} &bull; Rack {rackId.toUpperCase()} &bull; IP {server.ip_address || '10.240.1.14'} &bull; {server.serial_no || 'DELL-XE9680-NODE'}
              </p>
            </div>
          </div>
          {/* Top-Right 'X' button cleanly resets selected equipment */}
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 overflow-y-auto text-xs font-mono">
          {/* Status Banner */}
          <div className={`p-3 rounded-xl border flex items-center justify-between ${
            server.status === 'critical'
              ? 'bg-rose-950/35 border-rose-500/60 text-rose-300 shadow-md shadow-rose-950/30'
              : server.status === 'warning'
              ? 'bg-amber-950/30 border-amber-500/40 text-amber-300'
              : 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300'
          }`}>
            <div className="flex items-center space-x-2">
              {server.status === 'critical' ? (
                <Flame className="w-4 h-4 text-rose-400 animate-pulse" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              )}
              <span className="font-bold tracking-wide uppercase">
                CHASSIS STATUS: {server.status} {isDlcOnly ? '(100% DLC POD)' : `(${heat.label})`}
              </span>
            </div>
            {server.power_capped && (
              <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold">
                REDFISH POWER CAP ENFORCED: {server.power_draw_w}W
              </span>
            )}
          </div>



          {/* 3-PHASE PDU LOAD & RESOURCE UTILIZATION MINI-VISUALIZATION (Requirement #2) */}
          <PowerDistributionSection 
            totalPowerW={server.power_draw_w}
            tensorUtilizationPct={server.gpu_subsystem_load_pct ?? (server.gpus?.[0]?.tensor_utilization_pct || (isXE9680 ? 94 : 88))}
            hbm3BandwidthPct={isXE9680 ? 88 : 82}
          />

          {/* Special Dell PowerEdge XE9680 Subsystem Drill-Down Layout (Requirement #4) */}
          {isXE9680 ? (
            <div className="space-y-4">
              {/* SECTION A: Dual Host Processors (2x Intel Xeon Platinum) */}
              <div className="bg-slate-950/90 rounded-xl p-3.5 border border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                  <div className="flex items-center space-x-2 text-cyan-300 font-bold text-xs">
                    <Cpu className="w-4 h-4 text-cyan-400" />
                    <span>SECTION A: DUAL HOST PROCESSORS (2x INTEL XEON PLATINUM 8480+)</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">
                    Socket 0 &amp; Socket 1 Symmetrical Topology
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {cpus.map((cpu, idx) => (
                    <div 
                      key={cpu.id}
                      className="bg-slate-900/90 rounded-lg p-3 border border-slate-800 flex flex-col justify-between space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white text-xs flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
                          CPU {idx}: Intel Xeon Platinum
                        </span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 border border-slate-700">
                          {cpu.power_w}W TDP
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="bg-slate-950/70 p-2 rounded border border-slate-800/60">
                          <div className="text-[10px] text-slate-400">CORE LOAD</div>
                          <div className="text-sm font-extrabold text-cyan-300">
                            {cpu.load_pct.toFixed(0)}% <span className="text-[10px] text-slate-400 font-normal">Load</span>
                          </div>
                        </div>
                        <div className="bg-slate-950/70 p-2 rounded border border-slate-800/60">
                          <div className="text-[10px] text-slate-400">DIE TEMPERATURE</div>
                          <div className="text-sm font-extrabold text-slate-200">
                            {cpu.temp_c.toFixed(1)}°C
                          </div>
                        </div>
                      </div>

                      <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden border border-slate-800/80">
                        <div 
                          className="bg-cyan-500 h-full"
                          style={{ width: `${cpu.load_pct}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* SECTION B: NVIDIA SXM5 GPU Subsystem (8x H100 SXM5 2x4 Grid) */}
              <div className="bg-slate-950/90 rounded-xl p-3.5 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                  <div className="flex items-center space-x-2 text-amber-300 font-bold text-xs">
                    <Zap className="w-4 h-4 text-amber-400" />
                    <span>SECTION B: NVIDIA SXM5 GPU SUBSYSTEM (8x H100 SXM5 80GB HBM3)</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">
                    Interactive 2x4 Subsystem Grid
                  </span>
                </div>

                {/* 2x4 Interactive Grid of GPUs */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {gpus.map((gpu) => {
                    const isRed = gpu.core_temp_c >= 83;
                    const isAmber = gpu.core_temp_c >= 75 && !isRed;
                    const isGreen = !isRed && !isAmber;

                    return (
                      <div
                        key={gpu.id}
                        className={`rounded-xl p-2.5 border transition-all flex flex-col justify-between ${
                          isRed
                            ? 'bg-rose-950/50 border-rose-500/80 shadow-md shadow-rose-950/40 ring-1 ring-rose-500/40 animate-pulse'
                            : isAmber
                            ? 'bg-amber-950/30 border-amber-500/60'
                            : 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        {/* GPU Header & Status Badge */}
                        <div className="flex items-center justify-between gap-1 mb-1.5">
                          <span className="font-bold text-white text-xs flex items-center gap-1">
                            <span className={`w-2 h-2 rounded-full ${isRed ? 'bg-rose-500 animate-ping' : isAmber ? 'bg-amber-400' : 'bg-emerald-400'}`}></span>
                            GPU {gpu.index}
                          </span>
                          <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase ${
                            isRed 
                              ? 'bg-rose-500/25 text-rose-300 border border-rose-500/50' 
                              : isAmber 
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' 
                              : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                          }`}>
                            {isRed ? 'THROTTLE' : isAmber ? 'WARNING' : 'NOMINAL'}
                          </span>
                        </div>

                        {/* Thermal Metrics (Core Temp & HBM3 Temp) */}
                        <div className="space-y-1 mb-2 text-[11px]">
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400">Core Temp:</span>
                            <span className={`font-extrabold ${isRed ? 'text-rose-400' : isAmber ? 'text-amber-300' : 'text-slate-200'}`}>
                              {gpu.core_temp_c}°C
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400">HBM3 Mem:</span>
                            <span className="font-semibold text-slate-300">
                              {gpu.hbm3_temp_c}°C
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400">Tensor Load:</span>
                            <span className="font-bold text-cyan-300">
                              {gpu.tensor_utilization_pct}%
                            </span>
                          </div>
                        </div>

                        {/* Power Draw & Load Bar */}
                        <div className="pt-1.5 border-t border-slate-800/80">
                          <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                            <span>Draw: <strong className="text-amber-300">{gpu.power_w}W</strong></span>
                            <span>Max 700W</span>
                          </div>
                          <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden border border-slate-800">
                            <div
                              className={`h-full ${
                                isRed ? 'bg-rose-500' : isAmber ? 'bg-amber-500' : 'bg-emerald-500'
                              }`}
                              style={{ width: `${Math.min((gpu.power_w / 700) * 100, 100)}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="text-[10px] text-slate-500 flex items-center justify-between pt-1">
                  <span>Thresholds: Green (&lt;75°C) &bull; Amber (75°C–82°C) &bull; Red (&gt;83°C Thermal Throttle)</span>
                  <span className="text-cyan-400">SXM5 Multi-GPU Baseboard Direct Cold Airflow</span>
                </div>
              </div>

              {/* Airflow & Fan Speed Telemetry */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800">
                  <div className="text-slate-400 text-[10px] mb-1">INLET (COLD)</div>
                  <div className="text-sm font-bold text-white">{server.inlet_temp_c}°C</div>
                  <div className="text-[10px] text-slate-500">Cold-aisle supply</div>
                </div>
                <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800">
                  <div className="text-slate-400 text-[10px] mb-1">EXHAUST (HOT)</div>
                  <div className="text-sm font-bold text-white">{server.outlet_temp_c}°C</div>
                  <div className="text-[10px] text-slate-500">Delta-T +{deltaT}°C</div>
                </div>
                <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800">
                  <div className="text-slate-400 text-[10px] mb-1">CHASSIS FANS</div>
                  <div className="text-sm font-bold text-white">~{server.fan_speed_rpm.toLocaleString()} RPM</div>
                  <div className="text-[10px] text-cyan-400">High-CFM Counter-Rotating</div>
                </div>
                <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800">
                  <div className="text-slate-400 text-[10px] mb-1">TOTAL CHASSIS DRAW</div>
                  <div className="text-sm font-bold text-amber-300">{server.power_draw_w.toLocaleString()}W</div>
                  <div className="text-[10px] text-slate-500">Max {server.max_power_w}W</div>
                </div>
              </div>
            </div>
          ) : isDlcOnly ? (
            /* NVIDIA Vera Rubin NVL72 Liquid-Cooled Pod: Fluid & Manifold Telemetry (No Fan RPM) */
            <div className="space-y-3">
              <div className="flex items-center justify-between text-[11px] text-cyan-300 font-semibold px-1">
                <span className="flex items-center gap-1.5">
                  <Droplet className="w-3.5 h-3.5 text-cyan-400" />
                  100% DIRECT LIQUID COOLING (DLC) MANIFOLD METRICS:
                </span>
                <span className="text-[10px] text-slate-400 font-mono">ASHRAE W4 Warm-Water Standard</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800">
                  <div className="text-slate-400 text-[10px] mb-1 flex items-center justify-between">
                    <span>SUPPLY TEMP</span>
                    <Thermometer className="w-3 h-3 text-cyan-400" />
                  </div>
                  <div className="text-base font-bold text-cyan-300">
                    {server.coolant_supply_temp_c ?? 45.0}°C
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">Target: ~45°C</div>
                </div>

                <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800">
                  <div className="text-slate-400 text-[10px] mb-1 flex items-center justify-between">
                    <span>RETURN TEMP</span>
                    <Thermometer className="w-3 h-3 text-amber-400" />
                  </div>
                  <div className="text-base font-bold text-amber-300">
                    {server.coolant_return_temp_c ?? 59.8}°C
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">Delta-T: 14.8°C</div>
                </div>

                <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800">
                  <div className="text-slate-400 text-[10px] mb-1 flex items-center justify-between">
                    <span>LOOP PRESSURE</span>
                    <Gauge className="w-3 h-3 text-emerald-400" />
                  </div>
                  <div className="text-base font-bold text-emerald-400">
                    {server.manifold_pressure_psi ?? 42.0} <span className="text-[10px] font-normal text-slate-400">PSI</span>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">Nominal: 42 PSI</div>
                </div>

                <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800">
                  <div className="text-slate-400 text-[10px] mb-1 flex items-center justify-between">
                    <span>FLOW RATE</span>
                    <Activity className="w-3 h-3 text-blue-400" />
                  </div>
                  <div className="text-base font-bold text-blue-300">
                    {server.coolant_flow_rate_lpm ?? 130.0} <span className="text-[10px] font-normal text-slate-400">LPM</span>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">Target: 130 LPM</div>
                </div>
              </div>
            </div>
          ) : (
            /* Standard Air-Assisted Chassis (Cisco, QM9700, R760) */
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800">
                <div className="text-slate-400 text-[10px] mb-1">INLET AIR</div>
                <div className="text-base font-bold text-white">{server.inlet_temp_c}°C</div>
                <div className="text-[10px] text-slate-500 mt-1">Cold Aisle Nominal</div>
              </div>
              <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800">
                <div className="text-slate-400 text-[10px] mb-1">OUTLET EXHAUST</div>
                <div className="text-base font-bold text-white">{server.outlet_temp_c}°C</div>
                <div className="text-[10px] text-slate-400 mt-1">Delta T: +{deltaT}°C</div>
              </div>
              <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 col-span-2 sm:col-span-1">
                <div className="text-slate-400 text-[10px] mb-1">INTAKE FANS</div>
                <div className="text-base font-bold text-white">{server.fan_speed_rpm.toLocaleString()} RPM</div>
                <div className="text-[10px] text-slate-500 mt-1">Tachometer OK</div>
              </div>
            </div>
          )}

          {/* Hardware Manual Guidance Box */}
          <div className="p-3 bg-blue-950/20 rounded-xl border border-blue-500/30 space-y-1 font-sans">
            <div className="flex items-center space-x-1.5 text-blue-400 font-mono text-[10px] font-bold">
              <BookOpen className="w-3.5 h-3.5" />
              <span>{relevantManual.vendor.toUpperCase()} SPECIFICATION DIRECTIVE:</span>
            </div>
            <div className="text-xs font-semibold text-white">
              {relevantManual.title} ({relevantManual.section})
            </div>
            <p className="text-slate-300 text-[11px] leading-relaxed">
              "{relevantManual.excerpt}"
            </p>
          </div>
        </div>

        {/* Modal Footer: Clean metadata only (NO 'Close Inspector' button per Requirement #4) */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-950/90 flex items-center justify-between text-slate-400 text-[11px] font-mono">
          <span>
            Equipment: <strong className="text-white">{server.model}</strong> (Slot U{server.slot_u})
          </span>
          <span className="text-slate-500">
            Workload: {server.workload_name || 'Production Tenant'}
          </span>
        </div>
      </div>
    </div>
  );
};
