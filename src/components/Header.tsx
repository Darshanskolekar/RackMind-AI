import React, { useState, useRef, useEffect } from 'react';
import { 
  Server, 
  Activity, 
  Cpu, 
  Zap, 
  Thermometer, 
  AlertTriangle, 
  Terminal, 
  RotateCcw,
  Flame,
  Layers,
  Lock,
  EyeOff,
  Bell,
  ChevronDown,
  Check
} from 'lucide-react';
import { useTelemetry } from '../context/TelemetryContext';
import { useAuth } from '../context/AuthContext';
import { PersonaSwitcher } from './PersonaSwitcher';

interface HeaderProps {
  onOpenSandbox: () => void;
  onOpenChat: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenSandbox,
  onOpenChat,
}) => {
  const {
    environment,
    setEnvironment,
    racks,
    activeRackId,
    setActiveRackId,
    incidents,
    setSelectedIncidentForReview,
    heatmapOverlay,
    setHeatmapOverlay,
    isDiagnosing,
    runDiagnosis,
    runHealthChecks,
    resetBaseline,
    resetSandboxToProductionBaseline,
  } = useTelemetry();

  const { currentUser, hasPermission } = useAuth();
  const [sandboxRestrictedNotice, setSandboxRestrictedNotice] = React.useState<string | null>(null);
  const [showAlertsDropdown, setShowAlertsDropdown] = useState(false);

  const canAccessSandbox = hasPermission('canAccessSandbox');
  const canViewFacility = hasPermission('canViewFacilityMetrics');

  const handleSandboxToggle = () => {
    if (!canAccessSandbox) {
      setSandboxRestrictedNotice('Restricted to Infrastructure SREs (Darshan). ML Workload Engineers and Tier-1 Techs cannot mutate shadow twins.');
      setTimeout(() => setSandboxRestrictedNotice(null), 4000);
      return;
    }
    setEnvironment('sandbox');
  };

  const [zoneFilter, setZoneFilter] = useState<'all' | 'air' | 'dlc'>('all');
  const [isRackDropdownOpen, setIsRackDropdownOpen] = useState(false);
  const rackDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (rackDropdownRef.current && !rackDropdownRef.current.contains(event.target as Node)) {
        setIsRackDropdownOpen(false);
      }
    }
    if (isRackDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isRackDropdownOpen]);

  const currentRack = racks[activeRackId] || Object.values(racks)[0];
  const totalPowerKw = Object.values(racks).reduce((sum, r) => sum + r.current_power_kw, 0);
  const totalMaxPowerKw = Object.values(racks).reduce((sum, r) => sum + r.max_power_kw, 0);
  const criticalCount = Object.values(racks).reduce((sum, r) => 
    sum + r.servers.filter(s => s.status === 'critical' || s.outlet_temp_c >= 75).length, 0);

  return (
    <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur-md sticky top-0 z-40">
      {/* Top Bar: Brand, Status, Facility Metrics */}
      <div className="max-w-7xl mx-auto px-4 py-3 sm:px-6 flex flex-wrap items-center justify-between gap-4">
        
        {/* Brand & TwinOps Identifier */}
        <div className="flex items-center space-x-3">
          <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 shadow-lg shadow-cyan-500/20 text-white font-bold">
            <Server className="w-5 h-5" />
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-500"></span>
            </span>
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-base sm:text-lg font-extrabold tracking-tight text-white flex items-center gap-1.5">
                RackMind <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400">AI</span>
                <span className="text-xs px-2 py-0.5 rounded font-mono font-medium bg-slate-800 text-cyan-300 border border-slate-700">TwinOps</span>
              </h1>
            </div>
            <p className="text-xs text-slate-400 font-mono">
              Autonomous Datacenter Digital Twin &bull; us-central1-a
            </p>
          </div>
        </div>

        {/* Enterprise Environment Mode Toggle & Persona Profile Badge */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center bg-slate-950/90 p-1 rounded-xl border border-slate-800 font-mono text-xs shadow-inner">
            <button
              onClick={() => setEnvironment('production')}
              className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg transition-all font-semibold cursor-pointer ${
                environment === 'production'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 shadow-sm shadow-emerald-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent'
              }`}
              title="Switch to immutable Live Production telemetry"
            >
              <span className={`w-2 h-2 rounded-full ${environment === 'production' ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`}></span>
              <span>● PRODUCTION LIVE (IMMUTABLE)</span>
            </button>

            <button
              onClick={handleSandboxToggle}
              className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg transition-all font-semibold cursor-pointer ${
                environment === 'sandbox'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50 shadow-sm shadow-amber-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent'
              }`}
              title={canAccessSandbox ? "Switch to isolated Simulation Sandbox Shadow Twin" : "Restricted to Infrastructure SREs (Darshan)"}
            >
              <span className={`w-2 h-2 rounded-full ${environment === 'sandbox' ? 'bg-amber-400 animate-ping' : 'bg-slate-500'}`}></span>
              <span>● SIMULATION SANDBOX</span>
              {!canAccessSandbox && <Lock className="w-3 h-3 text-amber-500/70 ml-1" />}
            </button>
          </div>

          {/* Top-Nav Persona Switcher */}
          <PersonaSwitcher />
        </div>

        {/* Global Facility KPIs */}
        <div className="hidden lg:flex items-center space-x-6 border-x border-slate-800/80 px-6 py-1 font-mono text-xs relative">
          {!canViewFacility && (
            <div className="absolute inset-0 bg-slate-900/85 backdrop-blur-[2px] rounded-lg border border-purple-500/30 flex items-center justify-center z-10 font-mono text-[11px] text-purple-300 gap-1.5 shadow-sm">
              <Lock className="w-3.5 h-3.5 text-purple-400" />
              <span className="font-semibold uppercase tracking-wider">Facility Restricted</span>
              <span className="text-[10px] text-slate-400 font-sans hidden xl:inline">(AI Tenant: GPU View Only)</span>
            </div>
          )}
          <div className={!canViewFacility ? 'filter blur-[3px] opacity-40 select-none' : ''}>
            <div className="text-slate-400 flex items-center gap-1">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>TOTAL POWER</span>
            </div>
            <div className="text-sm font-semibold text-slate-100 font-mono">
              {totalPowerKw.toFixed(1)} <span className="text-slate-400 text-xs">kW / {totalMaxPowerKw.toFixed(0)} kW</span>
            </div>
          </div>

          <div className={!canViewFacility ? 'filter blur-[3px] opacity-40 select-none' : ''}>
            <div className="text-slate-400 flex items-center gap-1">
              <Thermometer className="w-3.5 h-3.5 text-cyan-400" />
              <span>{currentRack?.cooling_type === 'liquid_dlc' ? 'COOLANT INLET' : 'AMBIENT AIR'}</span>
            </div>
            <div className="text-sm font-semibold text-slate-100 font-mono">
              {currentRack?.cooling_type === 'liquid_dlc' ? '45.0°C (W4)' : `${currentRack?.ambient_temp_c ?? 22.2}°C`}
            </div>
          </div>

          <div className={!canViewFacility ? 'filter blur-[3px] opacity-40 select-none' : ''}>
            <div className="text-slate-400 flex items-center gap-1">
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              <span>FACILITY PUE</span>
            </div>
            <div className="text-sm font-semibold text-emerald-400 font-mono">
              1.16 <span className="text-slate-400 text-xs font-normal">Optimal</span>
            </div>
          </div>

          <div>
            <div className="text-slate-400 flex items-center gap-1">
              <AlertTriangle className={`w-3.5 h-3.5 ${criticalCount > 0 ? 'text-rose-400' : 'text-slate-400'}`} />
              <span>CRITICAL HOTSPOTS</span>
            </div>
            <div className={`text-sm font-semibold font-mono ${criticalCount > 0 ? 'text-rose-400 animate-pulse' : 'text-slate-200'}`}>
              {criticalCount} {criticalCount > 0 ? 'UNITS (75°C+)' : 'None'}
            </div>
          </div>
        </div>

        {/* Operational Control Bar */}
        <div className="flex items-center space-x-2">
          {/* Action Button: Run Health Checks in PRODUCTION vs Run Gemini Triage in SANDBOX */}
          {environment === 'production' ? (
            <button
              onClick={() => runHealthChecks()}
              disabled={isDiagnosing}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold shadow transition-all ${
                isDiagnosing 
                  ? 'bg-purple-900/60 text-purple-300 border border-purple-500/40 cursor-wait'
                  : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-purple-500/20 hover:shadow-purple-500/40 cursor-pointer'
              }`}
              title="Run Cluster Verification Scan & Health Certification"
            >
              <Cpu className={`w-3.5 h-3.5 ${isDiagnosing ? 'animate-spin' : ''}`} />
              <span>{isDiagnosing ? 'Running Health Checks...' : 'Run Health Checks'}</span>
            </button>
          ) : (
            <button
              onClick={() => runDiagnosis()}
              disabled={isDiagnosing}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold shadow transition-all ${
                isDiagnosing 
                  ? 'bg-purple-900/60 text-purple-300 border border-purple-500/40 cursor-wait'
                  : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-purple-500/20 hover:shadow-purple-500/40 cursor-pointer'
              }`}
              title="Trigger Gemini Autonomous Reasoning Agent with Function Calling"
            >
              <Cpu className={`w-3.5 h-3.5 ${isDiagnosing ? 'animate-spin' : ''}`} />
              <span>{isDiagnosing ? 'Agent Reasoning...' : 'Run Gemini Triage'}</span>
            </button>
          )}

          {/* Fault Injector Sandbox - Conditionally HIDDEN in Live Production mode per Requirement #1 */}
          {environment === 'sandbox' && (
            <button
              onClick={onOpenSandbox}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 transition-colors cursor-pointer"
              title="Open AI Remediation & Stress-Testing Sandbox"
            >
              <Flame className="w-3.5 h-3.5 text-amber-400" />
              <span>AI Sandbox</span>
            </button>
          )}

          {/* Chat Window to pull information */}
          <button
            onClick={onOpenChat}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
            title="Open Operational Intelligence Console"
          >
            <Terminal className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">Copilot</span>
          </button>

          {/* Global Alert Notification Bell with Real-time pending count badge */}
          <div className="relative">
            <button
              onClick={() => setShowAlertsDropdown((prev) => !prev)}
              className="relative p-2 rounded-lg text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors cursor-pointer"
              title="Global Incident Alerts"
            >
              <Bell className="w-4 h-4 text-amber-400" />
              {incidents.filter((i) => i.status === 'AWAITING_APPROVAL').length > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white shadow-lg shadow-rose-500/50 animate-pulse">
                  {incidents.filter((i) => i.status === 'AWAITING_APPROVAL').length}
                </span>
              )}
            </button>

            {/* Notification Bell Dropdown Popover */}
            {showAlertsDropdown && (
              <div 
                className="absolute right-0 mt-2 w-80 sm:w-96 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden font-mono text-xs animate-fadeIn"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-3 bg-slate-950/90 border-b border-slate-800 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
                    <span className="font-bold text-white text-[11px] uppercase tracking-wider">
                      Incident Alerts ({incidents.filter((i) => i.status === 'AWAITING_APPROVAL').length})
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400">Real-time Firestore</span>
                </div>

                <div className="max-h-72 overflow-y-auto divide-y divide-slate-800/80 p-1">
                  {incidents.filter((i) => i.status === 'AWAITING_APPROVAL').length === 0 ? (
                    <div className="p-4 text-center text-slate-400 text-xs">
                      Zero active alerts. All hardware nominal.
                    </div>
                  ) : (
                    incidents
                      .filter((i) => i.status === 'AWAITING_APPROVAL')
                      .map((ticket) => (
                        <div
                          key={ticket.id}
                          onClick={() => {
                            setSelectedIncidentForReview(ticket);
                            setShowAlertsDropdown(false);
                          }}
                          className="p-3 hover:bg-slate-800/60 rounded-lg cursor-pointer transition-colors space-y-1"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-1.5">
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                                {ticket.severity}
                              </span>
                              <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase font-mono ${
                                ticket.environment === 'SANDBOX' || ticket.is_simulated
                                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                              }`}>
                                [{ticket.environment || (ticket.is_simulated ? 'SANDBOX' : 'PRODUCTION')}]
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-400">
                              {new Date(ticket.created_at).toLocaleTimeString()}
                            </span>
                          </div>
                          <div className="text-white font-semibold flex items-center gap-1.5">
                            <span className="text-cyan-400">{ticket.rack_id.toUpperCase()}</span>
                            <span className="text-slate-500">&bull;</span>
                            <span>{ticket.server_id}</span>
                          </div>
                          <p className="text-[11px] text-slate-300 line-clamp-1 font-sans">
                            {ticket.root_cause_analysis}
                          </p>
                          <div className="text-[10px] text-cyan-300 font-semibold pt-0.5">
                            Review incident & mitigation &rarr;
                          </div>
                        </div>
                      ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Reset button: ONLY shown in simulation sandbox. Production telemetry is immutable and has no manual reset icon */}
          {environment === 'sandbox' && (
            <button
              onClick={resetSandboxToProductionBaseline}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/40 shadow-sm transition-colors cursor-pointer"
              title="Reset sandbox state and synchronize with current live production baseline"
            >
              <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
              <span>Reset to Live Baseline</span>
            </button>
          )}
        </div>
      </div>

      {/* Sub Bar: Rack Selector Tabs & Visual Heatmap Mode Toggle */}
      {sandboxRestrictedNotice && (
        <div className="bg-amber-950/90 border-t border-b border-amber-500/50 px-4 py-2 text-xs font-mono text-amber-200 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Lock className="w-3.5 h-3.5 text-amber-400" />
            <span className="font-bold">ACCESS RESTRICTED:</span>
            <span>{sandboxRestrictedNotice}</span>
          </div>
          <button 
            onClick={() => setSandboxRestrictedNotice(null)}
            className="text-amber-400 hover:text-white px-2 cursor-pointer font-bold"
          >
            ✕
          </button>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 py-2 sm:px-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-800/60 bg-slate-950/40 text-xs">
        {/* Rack Dropdown Selector & Cooling Zone Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center space-x-2">
            <span className="text-slate-400 font-mono text-[11px] uppercase tracking-wider font-semibold">RACK:</span>
            
            {/* Compact, Sleek Dropdown Option */}
            <div className="relative" ref={rackDropdownRef}>
              <button
                type="button"
                onClick={() => setIsRackDropdownOpen(prev => !prev)}
                className={`flex items-center space-x-2.5 px-3.5 py-1.5 rounded-xl font-mono text-xs transition-all cursor-pointer border ${
                  isRackDropdownOpen
                    ? 'bg-slate-900 border-cyan-400 shadow-md shadow-cyan-500/20 ring-2 ring-cyan-400/40 text-white'
                    : 'bg-slate-900/90 hover:bg-slate-850 border-slate-700 hover:border-cyan-400/70 text-slate-200 shadow-sm'
                }`}
                aria-expanded={isRackDropdownOpen}
                aria-haspopup="listbox"
              >
                {(() => {
                  const selectedRack = racks[activeRackId] || Object.values(racks)[0];
                  const selectedIsDlc = selectedRack.cooling_type === 'liquid_dlc' || selectedRack.rack_name.includes('Rubin') || selectedRack.rack_id === 'rack-a02';
                  const selectedRackHasCritical = selectedRack.servers.some(s => s.status === 'critical' || s.outlet_temp_c >= 75);

                  return (
                    <>
                      <div className="flex items-center space-x-2">
                        <span className="font-extrabold text-sm text-white tracking-tight">
                          {selectedRack.rack_id.toUpperCase()}
                        </span>
                        {selectedRackHasCritical ? (
                          <span className="relative flex h-2.5 w-2.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
                          </span>
                        ) : (
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]"></span>
                        )}
                      </div>

                      {/* Cooling Zone Badge */}
                      <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-medium ${
                        selectedIsDlc 
                          ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-500/40' 
                          : 'bg-slate-950 text-slate-300 border border-slate-700'
                      }`}>
                        {selectedIsDlc ? 'Zone B • DLC' : 'Zone A • Air'}
                      </span>

                      <span className="text-xs text-amber-300 font-bold ml-0.5">
                        {selectedRack.current_power_kw} kW
                      </span>

                      <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isRackDropdownOpen ? 'rotate-180 text-cyan-400' : ''}`} />
                    </>
                  );
                })()}
              </button>

              {/* Dropdown Menu Options */}
              {isRackDropdownOpen && (
                <div className="absolute left-0 top-full mt-2 w-80 sm:w-96 rounded-2xl bg-slate-900/95 border border-slate-700 shadow-2xl p-2 z-50 text-xs font-mono space-y-1.5 backdrop-blur-xl animate-fade-in ring-1 ring-black/40">
                  <div className="px-2.5 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800 flex items-center justify-between">
                    <span>Select Monitored Rack</span>
                    <span className="text-slate-500">{Object.keys(racks).length} Cabinets Available</span>
                  </div>

                  <div className="space-y-1.5 max-h-72 overflow-y-auto pr-0.5">
                    {Object.values(racks)
                      .filter(rack => {
                        const isDlc = rack.cooling_type === 'liquid_dlc' || rack.rack_name.includes('Rubin') || rack.rack_id === 'rack-a02';
                        if (zoneFilter === 'air') return !isDlc;
                        if (zoneFilter === 'dlc') return isDlc;
                        return true;
                      })
                      .map((rack) => {
                        const isSelected = rack.rack_id === activeRackId;
                        const isDlc = rack.cooling_type === 'liquid_dlc' || rack.rack_name.includes('Rubin') || rack.rack_id === 'rack-a02';
                        const zoneBadge = isDlc ? 'Zone B • 100% Direct Liquid Pod' : 'Zone A • Hybrid Air-Assisted';
                        const hasCritical = rack.servers.some(s => s.status === 'critical' || s.outlet_temp_c >= 75);

                        return (
                          <button
                            key={rack.rack_id}
                            type="button"
                            onClick={() => {
                              setActiveRackId(rack.rack_id);
                              setIsRackDropdownOpen(false);
                            }}
                            className={`w-full text-left p-2.5 rounded-xl transition-all flex items-center justify-between cursor-pointer border ${
                              isSelected
                                ? 'bg-gradient-to-r from-cyan-950/90 via-slate-900 to-slate-900 border-cyan-400 text-white shadow-md shadow-cyan-950/40 ring-1 ring-cyan-400/40'
                                : 'bg-slate-950/70 hover:bg-slate-850 border-slate-800/80 text-slate-300 hover:text-white'
                            }`}
                          >
                            <div className="flex items-center space-x-2.5">
                              {hasCritical ? (
                                <span className="relative flex h-2.5 w-2.5 shrink-0">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
                                </span>
                              ) : (
                                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)] shrink-0"></span>
                              )}
                              <div>
                                <div className="flex items-center space-x-2">
                                  <span className="font-extrabold text-sm text-white">
                                    {rack.rack_id.toUpperCase()}
                                  </span>
                                  <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono font-medium ${
                                    isDlc 
                                      ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-500/40' 
                                      : 'bg-slate-900 text-slate-300 border border-slate-700'
                                  }`}>
                                    {isDlc ? '100% DLC' : 'Air-Assisted'}
                                  </span>
                                </div>
                                <div className="text-[11px] text-slate-400 font-sans truncate max-w-[200px] mt-0.5">
                                  {rack.rack_name}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center space-x-2 shrink-0">
                              <span className="text-xs font-bold text-amber-300">
                                {rack.current_power_kw} kW
                              </span>
                              {isSelected ? (
                                <Check className="w-4 h-4 text-cyan-400" />
                              ) : (
                                <div className="w-4 h-4" />
                              )}
                            </div>
                          </button>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Quick Zone Filter Pills Beside Dropdown */}
          <div className="flex items-center bg-slate-900/90 p-0.5 rounded-lg border border-slate-800 text-[10px] font-mono">
            <button
              onClick={() => setZoneFilter('all')}
              className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                zoneFilter === 'all'
                  ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40 shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setZoneFilter('air')}
              className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                zoneFilter === 'air'
                  ? 'bg-blue-500/20 text-blue-300 font-bold border border-blue-500/40 shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Air
            </button>
            <button
              onClick={() => setZoneFilter('dlc')}
              className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                zoneFilter === 'dlc'
                  ? 'bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40 shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              DLC
            </button>
          </div>
        </div>

        {/* 3-Phase PDU Load & Resource Distribution Summary + Thermal Gradient View Mode (Requirement #2) */}
        <div className="flex items-center space-x-3">
          {/* Compact 3-Phase PDU Balance & Resource Distribution Indicator with Hover Dropdown */}
          <div className="group relative">
            <div className="flex items-center space-x-2 bg-slate-900/90 px-2.5 py-1 rounded-lg border border-slate-800 font-mono text-[11px] text-slate-300 cursor-help hover:border-slate-700">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-slate-400 text-[10px]">3-PHASE PDU:</span>
              <span className="font-bold text-amber-300">
                L1 34% ({(currentRack.current_power_kw * 0.34).toFixed(1)}kW)
              </span>
              <span className="text-slate-600">&bull;</span>
              <span className="font-bold text-amber-300">
                L2 33% ({(currentRack.current_power_kw * 0.33).toFixed(1)}kW)
              </span>
              <span className="text-slate-600">&bull;</span>
              <span className="font-bold text-amber-300">
                L3 33% ({(currentRack.current_power_kw * 0.33).toFixed(1)}kW)
              </span>
              <span className="px-1 py-0.2 rounded bg-emerald-500/15 text-emerald-400 text-[9px] font-bold border border-emerald-500/30">
                BALANCED
              </span>
            </div>

            {/* Hover Tooltip: Power & Resource Distribution */}
            <div className="hidden group-hover:block absolute right-0 top-full mt-2 w-80 p-3 bg-slate-900/95 backdrop-blur-md rounded-xl border border-slate-700 shadow-2xl z-50 font-mono text-xs animate-in fade-in zoom-in-95">
              <div className="text-[10px] uppercase font-bold text-amber-400 mb-2 flex items-center justify-between border-b border-slate-800 pb-1.5">
                <span>{currentRack.rack_id.toUpperCase()} 3-Phase &amp; Silicon Distribution</span>
                <span className="text-emerald-400 text-[9px]">0.8% Delta</span>
              </div>
              <div className="space-y-2 text-[10px]">
                <div>
                  <div className="flex justify-between text-slate-300 mb-0.5">
                    <span>Phase L1 (34% Draw):</span>
                    <span className="text-amber-300 font-bold">{(currentRack.current_power_kw * 0.34).toFixed(2)} kW</span>
                  </div>
                  <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden border border-slate-800">
                    <div className="bg-cyan-400 h-full rounded-full" style={{ width: '34%' }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-slate-300 mb-0.5">
                    <span>Phase L2 (33% Draw):</span>
                    <span className="text-blue-300 font-bold">{(currentRack.current_power_kw * 0.33).toFixed(2)} kW</span>
                  </div>
                  <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden border border-slate-800">
                    <div className="bg-blue-400 h-full rounded-full" style={{ width: '33%' }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-slate-300 mb-0.5">
                    <span>Phase L3 (33% Draw):</span>
                    <span className="text-indigo-300 font-bold">{(currentRack.current_power_kw * 0.33).toFixed(2)} kW</span>
                  </div>
                  <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden border border-slate-800">
                    <div className="bg-indigo-400 h-full rounded-full" style={{ width: '33%' }} />
                  </div>
                </div>
                <div className="pt-2 border-t border-slate-800 space-y-1">
                  <div className="flex justify-between text-slate-300">
                    <span>GPU Tensor Core Utilization:</span>
                    <span className="text-amber-300 font-bold">94%</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>HBM3 Memory Bandwidth:</span>
                    <span className="text-cyan-300 font-bold">88%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Thermal Legend indicator */}
          <div className="hidden lg:flex items-center space-x-2 text-[11px] text-slate-400 font-mono">
            <span>SCALE:</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400"></span> &lt;35°C</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400"></span> 45°C</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500"></span> 75°C+</span>
          </div>

          <button
            onClick={() => setHeatmapOverlay(prev => !prev)}
            className={`flex items-center space-x-1.5 px-2.5 py-1 rounded border font-mono text-[11px] transition-all cursor-pointer ${
              heatmapOverlay
                ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 font-medium'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>{heatmapOverlay ? 'Heatmap: ACTIVE' : 'Chassis Elevation'}</span>
          </button>
        </div>
      </div>
    </header>
  );
};
