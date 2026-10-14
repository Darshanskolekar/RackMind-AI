import React, { useState, useEffect } from 'react';
import { 
  Flame, 
  Cpu, 
  RotateCcw, 
  X, 
  AlertTriangle, 
  Wind, 
  Zap, 
  Droplet, 
  Play,
  Server,
  Sliders,
  Gauge,
  Activity,
  CheckCircle2,
  AlertOctagon
} from 'lucide-react';
import { useTelemetry } from '../context/TelemetryContext';
import { useAuth } from '../context/AuthContext';
import { Lock } from 'lucide-react';

interface AISandboxModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AISandboxModal: React.FC<AISandboxModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { hasPermission, currentUser } = useAuth();
  const canAccessSandbox = hasPermission('canAccessSandbox');
  const { 
    environment,
    setEnvironment,
    racks, 
    activeRackId, 
    injectFault, 
    updateServerSlider,
    runDiagnosis, 
    resetBaseline,
    resetSandboxToProductionBaseline,
    isDiagnosing 
  } = useTelemetry();

  const currentRack = racks[activeRackId] || Object.values(racks)[0];
  const servers = currentRack.servers || [];

  const selectableServers = servers.filter(s => !s.is_baffle_panel);

  const [selectedServerId, setSelectedServerId] = useState<string>(
    selectableServers.find(s => s.model.includes('XE9680') || s.model.includes('Rubin'))?.server_id || selectableServers[0]?.server_id || ''
  );

  const [selectedGpuIndex, setSelectedGpuIndex] = useState<number>(3); // Default GPU 3 hotspot per Requirement #5

  useEffect(() => {
    if (selectableServers.length > 0 && !selectableServers.some(s => s.server_id === selectedServerId)) {
      setSelectedServerId(selectableServers.find(s => s.model.includes('XE9680'))?.server_id || selectableServers[0].server_id);
    }
  }, [activeRackId, selectableServers, selectedServerId]);

  const targetServerObj = servers.find(s => s.server_id === selectedServerId) || selectableServers[0] || servers[0];
  const isDlcTarget = targetServerObj?.is_dlc_only || targetServerObj?.model.includes('Rubin') || currentRack.cooling_type === 'liquid_dlc';
  const isXE9680Target = targetServerObj?.model.includes('XE9680');

  // Slider local states synchronized to selected target server
  const [gpuLoad, setGpuLoad] = useState<number>(targetServerObj?.gpu_utilization_pct ?? 65);
  const [coolantFlow, setCoolantFlow] = useState<number>(targetServerObj?.coolant_flow_rate_lpm ?? 130);
  const [coolantSupplyTemp, setCoolantSupplyTemp] = useState<number>(targetServerObj?.coolant_supply_temp_c ?? 45);
  const [fanSpeed, setFanSpeed] = useState<number>(targetServerObj?.fan_speed_rpm || 7500);

  // Sync sliders when selected server changes
  useEffect(() => {
    if (targetServerObj) {
      setGpuLoad(targetServerObj.gpu_utilization_pct ?? 65);
      setCoolantFlow(targetServerObj.coolant_flow_rate_lpm ?? 130);
      setCoolantSupplyTemp(targetServerObj.coolant_supply_temp_c ?? 45);
      setFanSpeed(targetServerObj.fan_speed_rpm || 7500);
    }
  }, [selectedServerId, targetServerObj]);

  const [selectedScenario, setSelectedScenario] = useState<'fan_failure' | 'compute_spike' | 'coolant_leak' | 'gpu_hotspot'>('gpu_hotspot');
  const [injecting, setInjecting] = useState(false);
  const [logMessages, setLogMessages] = useState<string[]>([
    '[SANDBOX] Ready to inject synthetic telemetry faults.',
    '[SANDBOX] Sub-component per-GPU hotspotting targeting active.',
  ]);

  if (!isOpen) return null;

  if (!canAccessSandbox) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md">
        <div className="bg-slate-900 border border-amber-500/50 rounded-2xl p-6 max-w-md w-full shadow-2xl text-center space-y-4">
          <div className="w-12 h-12 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Access Denied: SRE Clearance Required</h3>
            <p className="text-xs text-amber-300 font-mono mt-1">
              Restricted to Infrastructure SREs (Darshan - L3 Admin)
            </p>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Your current persona ({currentUser?.name || 'User'} - {currentUser?.roleTitle || 'Operator'}) does not possess cluster fault injection and Chaos Sandbox permissions.
          </p>
          <div className="pt-2">
            <button
              onClick={onClose}
              className="w-full py-2 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 cursor-pointer"
            >
              Return to Telemetry Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Real-time slider handlers with instant state propagation
  const handleGpuSliderChange = (newLoad: number) => {
    setGpuLoad(newLoad);
    updateServerSlider(activeRackId, selectedServerId, {
      gpuLoadPct: newLoad,
      coolantFlowLpm: coolantFlow,
      supplyTempC: coolantSupplyTemp,
      fanRpm: fanSpeed,
    });
  };

  const handleCoolantFlowChange = (newFlow: number) => {
    setCoolantFlow(newFlow);
    updateServerSlider(activeRackId, selectedServerId, {
      gpuLoadPct: gpuLoad,
      coolantFlowLpm: newFlow,
      supplyTempC: coolantSupplyTemp,
      fanRpm: fanSpeed,
    });
  };

  const handleCoolantSupplyChange = (newSupply: number) => {
    setCoolantSupplyTemp(newSupply);
    updateServerSlider(activeRackId, selectedServerId, {
      gpuLoadPct: gpuLoad,
      coolantFlowLpm: coolantFlow,
      supplyTempC: newSupply,
      fanRpm: fanSpeed,
    });
  };

  const handleFanSpeedChange = (newRpm: number) => {
    setFanSpeed(newRpm);
    updateServerSlider(activeRackId, selectedServerId, {
      gpuLoadPct: gpuLoad,
      coolantFlowLpm: coolantFlow,
      supplyTempC: coolantSupplyTemp,
      fanRpm: newRpm,
    });
  };

  // 1-Click Preset Fault Handlers (including Per-GPU Hotspotting)
  const handlePresetTrigger = (scenario: 'fan_failure' | 'compute_spike' | 'coolant_leak' | 'gpu_hotspot') => {
    setSelectedScenario(scenario);
    setInjecting(true);

    const srvName = targetServerObj?.model || selectedServerId;
    const targetLabel = isXE9680Target && scenario === 'gpu_hotspot'
      ? `${selectedServerId} -> GPU ${selectedGpuIndex}`
      : `${selectedServerId} (${srvName})`;

    setLogMessages((prev) => [
      ...prev,
      `[PRESET] Target Sub-Component: ${targetLabel}`,
      `[PRESET] Executing Anomaly: ${scenario.toUpperCase()}...`,
    ]);

    injectFault(
      activeRackId, 
      selectedServerId, 
      scenario, 
      isXE9680Target ? selectedGpuIndex : undefined
    );

    if (scenario === 'gpu_hotspot') {
      setGpuLoad(99);
      setLogMessages((prev) => [
        ...prev, 
        `[MUTATION] SXM5 GPU ${selectedGpuIndex} silicon core spiked to 86.5°C (>84°C Red Thermal Throttle).`,
        `[MUTATION] Rack elevation peak temperature updated to Red. Action Hub ticket dispatched.`
      ]);
    } else if (scenario === 'fan_failure') {
      setFanSpeed(1200);
      setLogMessages((prev) => [...prev, '[MUTATION] Dropped fan RPM to 1,200. Temperatures surging to > 75°C (Red).']);
    } else if (scenario === 'coolant_leak') {
      setCoolantFlow(25);
      setLogMessages((prev) => [...prev, '[MUTATION] Dropped fluid manifold pressure to 18 PSI (25 LPM flow). Fluid return spiked to > 82°C.']);
    } else {
      setGpuLoad(99);
      setLogMessages((prev) => [...prev, '[MUTATION] Spiked GPU workload tensor load to 99.0%. Active power surged to peak capacity.']);
    }

    setTimeout(() => {
      setLogMessages((prev) => [
        ...prev,
        `[SANDBOX] Mutation committed to Shadow Twin. Action Hub received P1 ticket for targeted mitigation.`,
      ]);
      setInjecting(false);
    }, 250);
  };

  const handleRunAgent = async () => {
    setLogMessages((prev) => [
      ...prev,
      `[GEMINI] Invoking Autonomous Triage Agent with Function Calling in ${environment.toUpperCase()} mode...`,
      `[GEMINI] Analyzing active slider metrics & thermal heatmaps against hardware manuals...`,
    ]);
    await runDiagnosis(activeRackId);
    setLogMessages((prev) => [
      ...prev,
      `[GEMINI] Reasoning complete! Generated remediation proposal: [Execute Power Cap Mitigation].`,
    ]);
  };

  // Temperature color classifier: Green <35°C, Amber 45°C-70°C, Flashing Red >75°C
  const currentTemp = targetServerObj?.outlet_temp_c ?? 32;
  const tempColorClass = 
    currentTemp >= 75 ? 'text-rose-400 bg-rose-500/20 border-rose-500/60 animate-pulse' :
    currentTemp >= 45 ? 'text-amber-400 bg-amber-500/20 border-amber-500/50' :
    'text-emerald-400 bg-emerald-500/15 border-emerald-500/40';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-950/90">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/40 text-amber-400">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-bold text-white tracking-tight">
                  AI Remediation &amp; Stress-Testing Sandbox
                </h3>
                <span className="text-xs px-2 py-0.5 rounded font-mono font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  SHADOW TWIN
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Targeted Fault Injection &bull; Dynamic Telemetry Sliders &bull; Real-Time Heatmap Binding
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-5 text-xs font-mono">
          
          {/* Target Server Selector Dropdown */}
          <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800 space-y-2">
            <label className="text-slate-200 font-bold flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5">
                <Server className="w-4 h-4 text-cyan-400" />
                <span>TARGET SERVER (SELECT RECIPIENT OF FAULT):</span>
              </span>
              <span className="text-[11px] text-cyan-400 font-normal">
                Rack: {activeRackId.toUpperCase()}
              </span>
            </label>
            <select
              value={selectedServerId}
              onChange={(e) => setSelectedServerId(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:ring-2 focus:ring-cyan-500 cursor-pointer"
            >
              {servers.map((srv) => (
                <option key={srv.server_id} value={srv.server_id}>
                  U{srv.slot_u} &bull; {srv.model} ({srv.height_u}U) — [{srv.server_id}] {srv.status === 'critical' ? '🔥 [CRITICAL RED]' : `(Exhaust: ${srv.outlet_temp_c}°C)`}
                </option>
              ))}
            </select>
          </div>

          {/* Live Reactive Telemetry HUD Banner for Selected Server */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-xl bg-slate-950/90 border border-slate-800">
            {/* Live Temperature Gauge */}
            <div className="rounded-lg p-2.5 bg-slate-900 border border-slate-800">
              <div className="text-[10px] text-slate-400 flex items-center justify-between">
                <span>EXHAUST TEMP</span>
                <Flame className="w-3 h-3 text-rose-400" />
              </div>
              <div className="text-base font-extrabold flex items-center gap-1.5 mt-0.5">
                <span className={`px-2 py-0.5 rounded text-xs font-bold border ${tempColorClass}`}>
                  {currentTemp}°C
                </span>
                <span className="text-[10px] text-slate-400">
                  {currentTemp >= 75 ? 'Red' : currentTemp >= 45 ? 'Amber' : 'Green'}
                </span>
              </div>
            </div>

            {/* Active Wattage */}
            <div className="rounded-lg p-2.5 bg-slate-900 border border-slate-800">
              <div className="text-[10px] text-slate-400 flex items-center justify-between">
                <span>ACTIVE POWER</span>
                <Zap className="w-3 h-3 text-amber-400" />
              </div>
              <div className="text-sm font-bold text-amber-300 mt-1">
                {targetServerObj?.power_draw_w?.toLocaleString()}W
              </div>
              <div className="text-[10px] text-slate-500">
                Peak: {targetServerObj?.max_power_w?.toLocaleString()}W
              </div>
            </div>

            {/* Cooling Type / Air or Fluid Metric */}
            <div className="rounded-lg p-2.5 bg-slate-900 border border-slate-800">
              <div className="text-[10px] text-slate-400 flex items-center justify-between">
                <span>{isDlcTarget ? 'MANIFOLD PRESSURE' : 'FAN SPEED'}</span>
                {isDlcTarget ? <Gauge className="w-3 h-3 text-emerald-400" /> : <Wind className="w-3 h-3 text-cyan-400" />}
              </div>
              <div className="text-sm font-bold text-white mt-1">
                {isDlcTarget ? (
                  <span className="text-emerald-400">
                    {targetServerObj?.manifold_pressure_psi ?? 42.0} PSI
                  </span>
                ) : (
                  <span className={targetServerObj?.fan_speed_rpm && targetServerObj.fan_speed_rpm < 2000 ? 'text-rose-400 font-bold' : 'text-cyan-300'}>
                    {targetServerObj?.fan_speed_rpm?.toLocaleString() ?? 0} RPM
                  </span>
                )}
              </div>
              <div className="text-[10px] text-slate-500">
                {isDlcTarget ? `${coolantFlow} LPM Flow` : targetServerObj?.fan_speed_rpm && targetServerObj.fan_speed_rpm < 2000 ? '⚠️ RPM Low' : '2+2 Rotor OK'}
              </div>
            </div>

            {/* Target Server Model Badge */}
            <div className="rounded-lg p-2.5 bg-slate-900 border border-slate-800 flex flex-col justify-between">
              <div className="text-[10px] text-slate-400">CHASSIS CLASS</div>
              <div className="text-xs font-bold text-slate-200 truncate" title={targetServerObj?.model}>
                {targetServerObj?.model}
              </div>
              <div className="text-[10px] text-cyan-400 font-mono">
                {isDlcTarget ? 'Direct Liquid Cooling' : 'Air-Assisted Hybrid'}
              </div>
            </div>
          </div>

          {/* Section 1: 1-Click Anomaly Presets */}
          <div>
            <div className="text-slate-300 font-semibold mb-2 flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <span>1-CLICK ANOMALY PRESETS (CHAOS TRIGGERS):</span>
              </span>
              <span className="text-[11px] text-slate-400 font-sans">
                Immediate stress-test injections
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {/* Preset 1: Compute Surge */}
              <button
                onClick={() => handlePresetTrigger('compute_spike')}
                disabled={injecting}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  selectedScenario === 'compute_spike'
                    ? 'bg-amber-950/50 border-amber-500 text-white shadow-md ring-1 ring-amber-400'
                    : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between text-amber-400 font-bold mb-1">
                  <div className="flex items-center space-x-1.5">
                    <Zap className="w-4 h-4" />
                    <span>Compute Surge</span>
                  </div>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">99% Load</span>
                </div>
                <p className="text-[11px] text-slate-400 font-sans">
                  Spikes GPU tensor workload to 99%; active wattage surges to peak limit, temperature climbs to &gt; 79°C (Red).
                </p>
              </button>

              {/* Preset 2: Fan Failure */}
              <button
                onClick={() => handlePresetTrigger('fan_failure')}
                disabled={injecting}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  selectedScenario === 'fan_failure'
                    ? 'bg-rose-950/50 border-rose-500 text-white shadow-md ring-1 ring-rose-400'
                    : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between text-rose-400 font-bold mb-1">
                  <div className="flex items-center space-x-1.5">
                    <Wind className="w-4 h-4" />
                    <span>Fan Failure</span>
                  </div>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">1,200 RPM</span>
                </div>
                <p className="text-[11px] text-slate-400 font-sans">
                  Instantly drops fan speed to 1,200 RPM; exhaust air hits 78.5°C (Flashing Red threshold).
                </p>
              </button>

              {/* Preset 3: Coolant Drop */}
              <button
                onClick={() => handlePresetTrigger('coolant_leak')}
                disabled={injecting}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  selectedScenario === 'coolant_leak'
                    ? 'bg-cyan-950/50 border-cyan-500 text-white shadow-md ring-1 ring-cyan-400'
                    : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between text-cyan-400 font-bold mb-1">
                  <div className="flex items-center space-x-1.5">
                    <Droplet className="w-4 h-4" />
                    <span>Coolant Drop</span>
                  </div>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">18 PSI</span>
                </div>
                <p className="text-[11px] text-slate-400 font-sans">
                  Drops fluid pressure to 18 PSI (flow to 25 LPM); coolant return surges to 82.0°C (Red).
                </p>
              </button>
            </div>
          </div>

          {/* Section 2: Dynamic Fine-Tuning Sliders (Live Binding to Heatmap) */}
          <div className="bg-slate-950/90 p-4 rounded-xl border border-slate-800 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
              <span className="text-xs font-bold text-white flex items-center gap-2">
                <Sliders className="w-4 h-4 text-cyan-400" />
                <span>DYNAMIC FINE-TUNING SLIDERS (REAL-TIME HEATMAP BINDING):</span>
              </span>
              <span className="text-[10px] text-emerald-400 font-mono">
                Dragging updates rack elevation live
              </span>
            </div>

            {/* Slider 1: Workload & GPU Load (Range: 10% to 100%) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300 font-semibold flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  <span>SLIDER 1: WORKLOAD &amp; GPU LOAD</span>
                </span>
                <div className="flex items-center space-x-2">
                  <span className="text-amber-400 font-extrabold text-sm">{gpuLoad}%</span>
                  <span className="text-slate-400 text-[11px]">
                    (Power: <strong className="text-white">{targetServerObj?.power_draw_w}W</strong>
                    {targetServerObj?.model.includes('XE9680') ? ' | Dell XE9680: 2,000W–10,200W' : ''})
                  </span>
                </div>
              </div>
              <input
                type="range"
                min="10"
                max="100"
                step="1"
                value={gpuLoad}
                onChange={(e) => handleGpuSliderChange(Number(e.target.value))}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                <span>10% Idle (~2,000W)</span>
                <span>50% Mid Workload</span>
                <span>80% Warning (45°C+)</span>
                <span className="text-rose-400">100% Full Stress (10,200W)</span>
              </div>
            </div>

            {/* Slider 2: Coolant Flow Rate & Supply Temp (For Liquid-Cooled Pods / Dell DLC) */}
            <div className="space-y-1.5 pt-2 border-t border-slate-800/60">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300 font-semibold flex items-center gap-1.5">
                  <Droplet className="w-3.5 h-3.5 text-cyan-400" />
                  <span>SLIDER 2: COOLANT FLOW RATE &amp; PRESSURE (DIRECT LIQUID COOLING)</span>
                </span>
                <div className="flex items-center space-x-2">
                  <span className="text-cyan-300 font-extrabold text-sm">{coolantFlow} LPM</span>
                  <span className="text-emerald-400 text-[11px]">
                    ({((coolantFlow / 130) * 42).toFixed(1)} PSI Manifold Loop)
                  </span>
                </div>
              </div>
              <input
                type="range"
                min="20"
                max="140"
                step="1"
                value={coolantFlow}
                onChange={(e) => handleCoolantFlowChange(Number(e.target.value))}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                <span className="text-rose-400">20 LPM (Low Pressure 6 PSI - Thermal Spike)</span>
                <span>80 LPM Reduced Flow</span>
                <span className="text-cyan-400">130 LPM (Nominal 42 PSI - ASHRAE W4)</span>
                <span>140 LPM Overdrive</span>
              </div>

              {/* Secondary Sub-Slider: Supply Temperature (30°C to 65°C) */}
              <div className="flex items-center justify-between text-xs pt-1.5">
                <span className="text-slate-400 text-[11px]">
                  Coolant Supply Temperature (ASHRAE W4 Warm-Water):
                </span>
                <span className="text-cyan-300 font-bold">{coolantSupplyTemp}°C</span>
              </div>
              <input
                type="range"
                min="30"
                max="65"
                step="1"
                value={coolantSupplyTemp}
                onChange={(e) => handleCoolantSupplyChange(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-400"
              />
            </div>

            {/* Slider 3: Intake Fan Speed (Range: 1,000 RPM to 15,000 RPM) */}
            <div className="space-y-1.5 pt-2 border-t border-slate-800/60">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300 font-semibold flex items-center gap-1.5">
                  <Wind className="w-3.5 h-3.5 text-blue-400" />
                  <span>SLIDER 3: INTAKE FAN SPEED (AIR-COOLED / HYBRID DEVICES)</span>
                </span>
                <div className="flex items-center space-x-2">
                  <span className={`font-extrabold text-sm ${fanSpeed < 2000 ? 'text-rose-400' : 'text-blue-300'}`}>
                    {fanSpeed.toLocaleString()} RPM
                  </span>
                  <span className="text-slate-400 text-[11px]">
                    (Cisco Nexus / Dell Air Banks)
                  </span>
                </div>
              </div>
              <input
                type="range"
                min="1000"
                max="15000"
                step="250"
                value={fanSpeed}
                onChange={(e) => handleFanSpeedChange(Number(e.target.value))}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                <span className="text-rose-400">1,000 RPM (Failed Rotor)</span>
                <span>5,000 RPM Acoustic Silent</span>
                <span>10,000 RPM High Performance</span>
                <span className="text-cyan-400">15,000 RPM Maximum CFM</span>
              </div>
            </div>
          </div>

          {/* Action Trigger Buttons */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              onClick={handleRunAgent}
              disabled={isDiagnosing}
              className="flex-1 flex items-center justify-center space-x-2 py-2.5 px-4 rounded-xl font-bold text-white bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:via-indigo-500 hover:to-purple-500 shadow-md shadow-blue-950/50 transition-all cursor-pointer disabled:opacity-50"
            >
              <Cpu className={`w-4 h-4 ${isDiagnosing ? 'animate-spin' : ''}`} />
              <span>{isDiagnosing ? 'Agent Reasoning...' : 'Run Gemini Triage on Injected State'}</span>
            </button>

            <button
              onClick={resetSandboxToProductionBaseline}
              className="py-2.5 px-3.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 transition-colors font-bold flex items-center gap-1.5 cursor-pointer"
              title="Reset sandbox state back to live production telemetry"
            >
              <RotateCcw className="w-4 h-4 text-amber-400" />
              <span>Reset to Live Baseline</span>
            </button>
          </div>

          {/* Live Reasoning Output Stream Terminal */}
          <div>
            <div className="text-slate-400 text-[11px] font-semibold mb-1 flex items-center justify-between">
              <span>LIVE REASONING &amp; EXECUTION STREAM:</span>
              <span className="text-emerald-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                ACTIVE
              </span>
            </div>
            <div className="bg-slate-950 rounded-xl p-3 border border-slate-800 h-32 overflow-y-auto space-y-1 text-slate-300 text-[11px]">
              {logMessages.map((log, idx) => (
                <div key={idx} className="leading-relaxed">
                  <span className="text-cyan-400">&gt;</span> {log}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-950/90 flex items-center justify-between text-slate-400 text-[11px] font-mono">
          <span>Targeting: <strong className="text-white">{targetServerObj?.model}</strong> (Slot U{targetServerObj?.slot_u})</span>
          <span className="text-slate-500">Autonomous Chaos Simulation Engine</span>
        </div>
      </div>
    </div>
  );
};
