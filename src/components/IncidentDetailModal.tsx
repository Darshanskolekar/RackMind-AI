import React from 'react';
import { 
  X, 
  AlertTriangle, 
  Server, 
  Clock, 
  BookOpen, 
  Zap, 
  Thermometer, 
  Wind, 
  Activity, 
  Lock, 
  CheckCircle2, 
  ShieldCheck,
  Cpu
} from 'lucide-react';
import { IncidentTicket } from '../types/telemetry';
import { useAuth } from '../context/AuthContext';
import { useTelemetry } from '../context/TelemetryContext';

interface IncidentDetailModalProps {
  incident: IncidentTicket | null;
  onClose: () => void;
  onExecute?: (incidentId: string) => void;
}

export const IncidentDetailModal: React.FC<IncidentDetailModalProps> = ({
  incident,
  onClose,
  onExecute,
}) => {
  const { hasPermission, currentUser } = useAuth();
  const { approveIncident } = useTelemetry();
  const [isExecuting, setIsExecuting] = React.useState(false);
  const [executedSuccess, setExecutedSuccess] = React.useState(false);

  if (!incident) return null;

  const canExecute = hasPermission('canExecuteMitigation');
  const isP1 = incident.severity === 'P1' || incident.severity === 'CRITICAL';
  const isApproved = incident.status === 'APPROVED_AND_EXECUTED' || executedSuccess;
  const isRejected = incident.status === 'REJECTED';

  const handleApprove = async () => {
    if (!canExecute || isExecuting) return;
    setIsExecuting(true);
    try {
      const targetId = incident.id || incident.incident_id;
      if (onExecute) {
        await onExecute(targetId);
      } else {
        await approveIncident(targetId, currentUser ? {
          name: currentUser.name,
          role: `${currentUser.roleTitle} - ${currentUser.badgeLabel}`,
        } : undefined);
      }
      setExecutedSuccess(true);
      setTimeout(() => {
        onClose();
      }, 1800);
    } catch (err) {
      console.error('Failed to execute mitigation:', err);
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div 
        className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className={`px-6 py-4 border-b flex items-center justify-between ${
          isP1 ? 'bg-rose-950/40 border-rose-500/30' : 'bg-slate-950/60 border-slate-800'
        }`}>
          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-xl flex items-center justify-center ${
              isP1 
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40' 
                : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
            }`}>
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2.5">
                <h3 className="text-base font-bold text-white tracking-tight">
                  Detailed Incident Review
                </h3>
                {/* Severity Badge */}
                <span className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold uppercase tracking-wider ${
                  isP1
                    ? 'bg-rose-500/30 text-rose-300 border border-rose-500/60 animate-pulse'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                }`}>
                  {incident.severity}
                </span>
                {/* Status Badge */}
                <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider ${
                  isApproved
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : isRejected
                    ? 'bg-slate-800 text-slate-400 border border-slate-700'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                }`}>
                  {incident.status}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5 flex items-center gap-2">
                <span>Ticket: {incident.incident_id || incident.id}</span>
                <span>&bull;</span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3 text-slate-500" />
                  {new Date(incident.created_at).toLocaleString()}
                </span>
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
        <div className="p-6 overflow-y-auto space-y-5 flex-1 text-xs font-mono">
          {/* Target Hardware Section */}
          <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800 space-y-2">
            <div className="text-[11px] text-slate-400 uppercase tracking-wider font-bold flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5 text-cyan-400" />
              <span>Target Hardware Specification</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 text-slate-300">
              <div className="flex items-center justify-between p-2 rounded bg-slate-900 border border-slate-800/80">
                <span className="text-slate-500">Rack Identifier:</span>
                <span className="font-bold text-cyan-300 uppercase">{incident.rack_id}</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-slate-900 border border-slate-800/80">
                <span className="text-slate-500">Chassis Unit ID:</span>
                <span className="font-bold text-white">{incident.server_id}</span>
              </div>
            </div>
          </div>


          {/* Snapshot Telemetry at Incident Creation */}
          <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800 space-y-2.5">
            <div className="text-[11px] text-slate-400 uppercase tracking-wider font-bold flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-rose-400" />
              <span>Snapshot Telemetry (Exact Creation State)</span>
            </div>
            
            <div className="grid grid-cols-3 gap-3 pt-1">
              {/* Outlet Temperature */}
              <div className="p-3 rounded-lg bg-rose-950/30 border border-rose-500/40 text-center">
                <div className="flex items-center justify-center gap-1 text-[10px] text-rose-300 uppercase font-semibold">
                  <Thermometer className="w-3 h-3" />
                  <span>Exhaust Temp</span>
                </div>
                <div className="text-lg font-bold text-rose-400 mt-1">
                  {incident.metrics_snapshot?.temp_c ?? 78.5}°C
                </div>
                <div className="text-[9px] text-rose-300/80 mt-0.5">&gt;= 75°C Critical Red</div>
              </div>

              {/* Fan RPM or DLC */}
              <div className="p-3 rounded-lg bg-cyan-950/30 border border-cyan-500/40 text-center">
                <div className="flex items-center justify-center gap-1 text-[10px] text-cyan-300 uppercase font-semibold">
                  <Wind className="w-3 h-3" />
                  <span>Fan / Fluid Flow</span>
                </div>
                <div className="text-lg font-bold text-cyan-300 mt-1">
                  {incident.metrics_snapshot?.fan_rpm !== undefined && incident.metrics_snapshot.fan_rpm > 0
                    ? `${incident.metrics_snapshot.fan_rpm.toLocaleString()} RPM`
                    : '130 LPM (42 PSI)'}
                </div>
                <div className="text-[9px] text-cyan-400/80 mt-0.5">
                  {incident.metrics_snapshot?.fan_rpm !== undefined && incident.metrics_snapshot.fan_rpm < 2000
                    ? '⚠️ Tachometer Drop'
                    : 'Cooling Loop Active'}
                </div>
              </div>

              {/* Power Draw */}
              <div className="p-3 rounded-lg bg-amber-950/30 border border-amber-500/40 text-center">
                <div className="flex items-center justify-center gap-1 text-[10px] text-amber-300 uppercase font-semibold">
                  <Zap className="w-3 h-3" />
                  <span>Active Power Draw</span>
                </div>
                <div className="text-lg font-bold text-amber-300 mt-1">
                  {incident.metrics_snapshot?.power_w ?? 4200}W
                </div>
                <div className="text-[9px] text-amber-400/80 mt-0.5">High Tensor Load</div>
              </div>
            </div>
          </div>

          {/* Root Cause Analysis (Copilot / Autonomous Agent) */}
          <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800 space-y-2">
            <div className="text-[11px] text-slate-400 uppercase tracking-wider font-bold flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-cyan-400" />
              <span>Copilot / Agent Root Cause Analysis</span>
            </div>
            <p className="text-xs text-slate-200 leading-relaxed font-sans bg-slate-900 p-3 rounded-lg border border-slate-800">
              {incident.root_cause_analysis}
            </p>
          </div>

          {/* RAG Citation */}
          <div className="bg-blue-950/30 border border-blue-500/40 p-4 rounded-xl space-y-1.5">
            <div className="text-[10px] text-blue-300 uppercase tracking-wider font-bold flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-blue-400" />
              <span>Vendor Manual RAG Citation</span>
            </div>
            <p className="text-xs text-blue-100 font-medium font-sans">
              {incident.citation}
            </p>
          </div>

          {/* Execution Logs Audit Trail */}
          {incident.execution_logs && incident.execution_logs.length > 0 && (
            <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800 space-y-1.5">
              <div className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">
                Incident Audit Trail:
              </div>
              <div className="space-y-1 max-h-24 overflow-y-auto pr-1">
                {incident.execution_logs.map((log, idx) => (
                  <div key={idx} className="text-[11px] text-slate-300 flex items-start gap-1.5">
                    <span className="text-cyan-500 font-mono">&gt;</span>
                    <span className="text-slate-400 font-mono">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                    <span>{log.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer with RBAC Protected Action Button */}
        <div className="p-4 bg-slate-950/90 border-t border-slate-800 flex items-center justify-between gap-3">
          <div className="text-[11px] text-slate-400 font-mono">
            <span>Policy: Redfish BMC Dynamic Power Cap (1500W target)</span>
          </div>

          <div className="flex items-center space-x-2">
            {/* [Approve & Execute Mitigation] Button */}
            {!isApproved ? (
              canExecute ? (
                <button
                  onClick={handleApprove}
                  disabled={isExecuting}
                  className="flex items-center space-x-2 px-5 py-2 rounded-lg text-xs font-bold text-white bg-gradient-to-r from-blue-600 via-cyan-600 to-emerald-600 hover:from-blue-500 hover:via-cyan-500 hover:to-emerald-500 shadow-lg shadow-blue-900/40 transition-all cursor-pointer disabled:opacity-50"
                >
                  <ShieldCheck className="w-4 h-4 text-emerald-300" />
                  <span>{isExecuting ? 'Dispatching Redfish Cap...' : 'Approve & Execute Mitigation'}</span>
                </button>
              ) : (
                <div className="relative group">
                  <button
                    disabled
                    className="flex items-center space-x-2 px-5 py-2 rounded-lg text-xs font-semibold text-slate-400 bg-slate-800/80 border border-slate-700 cursor-not-allowed opacity-60"
                  >
                    <Lock className="w-4 h-4 text-amber-400" />
                    <span>Approve & Execute Mitigation</span>
                  </button>
                  <div className="hidden group-hover:block absolute bottom-full mb-2 right-0 w-72 p-2.5 bg-slate-900 text-amber-300 text-[10px] rounded-lg border border-amber-500/50 shadow-2xl z-30 font-mono text-center">
                    🔒 RBAC Protected: Requires Lead Infrastructure SRE (Darshan Skolekar). Current persona ({currentUser?.roleTitle}) has read-only audit access.
                  </div>
                </div>
              )
            ) : (
              <div className="flex items-center space-x-1.5 px-4 py-2 rounded-lg text-xs font-bold text-emerald-300 bg-emerald-500/20 border border-emerald-500/40">
                <CheckCircle2 className="w-4 h-4" />
                <span>Mitigation Executed</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
