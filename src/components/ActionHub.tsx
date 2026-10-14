import React, { useState } from 'react';
import { 
  ShieldAlert, 
  CheckCircle2, 
  XCircle, 
  BookOpen, 
  Zap, 
  Clock, 
  Server, 
  History, 
  Check, 
  AlertTriangle, 
  User, 
  ShieldCheck, 
  Lock 
} from 'lucide-react';
import { useTelemetry } from '../context/TelemetryContext';
import { useAuth } from '../context/AuthContext';

// Formatted timestamp: "Logged: [YYYY-MM-DD HH:MM:SS UTC]"
function formatUtcTimestamp(dateStr?: string): string {
  if (!dateStr) return 'N/A';
  try {
    const d = new Date(dateStr);
    const pad = (n: number) => n.toString().padStart(2, '0');
    const yyyy = d.getUTCFullYear();
    const mm = pad(d.getUTCMonth() + 1);
    const dd = pad(d.getUTCDate());
    const hh = pad(d.getUTCHours());
    const min = pad(d.getUTCMinutes());
    const ss = pad(d.getUTCSeconds());
    return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss} UTC`;
  } catch {
    return dateStr;
  }
}

export const ActionHub: React.FC = () => {
  const { 
    environment,
    incidents, 
    approveIncident, 
    rejectIncident, 
  } = useTelemetry();
  const { currentUser, hasPermission } = useAuth();

  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
  const [processingId, setProcessingId] = useState<string | null>(null);

  const canExecute = hasPermission('canExecuteMitigation');

  const pendingIncidents = incidents.filter(i => i.status === 'AWAITING_APPROVAL');
  const historyIncidents = incidents.filter(i => i.status !== 'AWAITING_APPROVAL');

  const handleApprove = async (id: string) => {
    if (!canExecute) return;
    try {
      setProcessingId(id);
      await approveIncident(id, currentUser ? { name: currentUser.name, role: `${currentUser.roleTitle} - ${currentUser.badgeLabel}` } : undefined);
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (id: string) => {
    if (!canExecute) return;
    try {
      setProcessingId(id);
      await rejectIncident(id);
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-4 sm:p-5 shadow-2xl flex flex-col h-full max-h-[calc(100vh-220px)] overflow-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800 mb-3 shrink-0">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-amber-400" />
              <span>Action Hub</span>
            </h2>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 font-medium">
              Autonomous Decision Queue
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Structured Incident Tickets &bull; Human-in-the-Loop Safe Execution
          </p>
        </div>

        {/* Tabs */}
        <div className="flex items-center space-x-2 bg-slate-950/80 p-1 rounded-lg border border-slate-800 text-xs font-mono">
          <button
            onClick={() => setActiveTab('pending')}
            className={`flex items-center space-x-1.5 px-3 py-1 rounded transition-colors cursor-pointer ${
              activeTab === 'pending'
                ? 'bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/40 shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>Pending</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
              pendingIncidents.length > 0 ? 'bg-rose-500 text-white font-bold animate-pulse' : 'bg-slate-800 text-slate-400'
            }`}>
              {pendingIncidents.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center space-x-1.5 px-3 py-1 rounded transition-colors cursor-pointer ${
              activeTab === 'history'
                ? 'bg-blue-500/20 text-blue-300 font-semibold border border-blue-500/40 shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Audit History ({historyIncidents.length})</span>
          </button>
        </div>
      </div>

      {/* Main List with proper flex shrink and scroll */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1.5 min-h-0">
        {activeTab === 'pending' ? (
          pendingIncidents.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center rounded-xl bg-slate-950/40 border border-dashed border-slate-800 my-auto">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 mb-2 opacity-80" />
              <p className="text-sm font-semibold text-slate-200">No Pending Autonomous Actions</p>
              <p className="text-xs text-slate-500 max-w-sm mt-1">
                {environment === 'production'
                  ? 'All production nodes operating within nominal baseline envelope (< 35°C). Production telemetry is certified healthy.'
                  : 'All server racks are operating within nominal thresholds (< 35°C). Inject a fault in the AI Sandbox to generate an incident ticket.'}
              </p>
            </div>
          ) : (
            pendingIncidents.map((inc) => {
              const targetId = inc.id || inc.incident_id;
              const isProcessing = processingId === targetId;
              const isP1 = inc.severity === 'P1' || inc.severity === 'CRITICAL';

              return (
                <div
                  key={targetId}
                  className={`rounded-xl p-3.5 border transition-all ${
                    isP1
                      ? 'bg-rose-950/25 border-rose-500/50 shadow-lg shadow-rose-950/30 ring-1 ring-rose-500/20'
                      : 'bg-amber-950/20 border-amber-500/40'
                  }`}
                >
                  {/* Top Header: Severity, ID, Target Server */}
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <div className="flex items-center space-x-2">
                      <span className={`px-2.5 py-0.5 rounded text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                        isP1
                          ? 'bg-rose-500/25 text-rose-300 border border-rose-500/60 animate-pulse'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      }`}>
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Severity: {inc.severity}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider ${
                        inc.environment === 'SANDBOX' || inc.is_simulated
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      }`}>
                        ● {inc.environment || (inc.is_simulated ? 'SANDBOX' : 'PRODUCTION')}
                      </span>
                      <span className="text-xs font-mono text-slate-400">
                        {inc.incident_id || inc.id}
                      </span>
                    </div>

                    <div className="flex items-center space-x-2 text-xs font-mono text-slate-300">
                      <Server className="w-3.5 h-3.5 text-cyan-400" />
                      <span>{inc.rack_id.toUpperCase()}</span>
                      <span className="text-slate-500">&bull;</span>
                      <span className="font-semibold text-white">{inc.server_id}</span>
                    </div>
                  </div>

                  {/* Creator Attribution & Formatted Timestamp Audit Metadata */}
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono bg-slate-950/90 px-3 py-1 rounded-lg border border-slate-800/90 mb-2 text-slate-300">
                    <div className="flex items-center space-x-1.5">
                      <User className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Created by: <strong className="text-white font-semibold">{inc.created_by || 'Autonomous Gemini Monitor'}</strong></span>
                    </div>
                    <div className="flex items-center space-x-1 text-slate-400">
                      <Clock className="w-3 h-3 text-slate-500" />
                      <span>Logged: {formatUtcTimestamp(inc.created_at)}</span>
                    </div>
                  </div>

                  {/* Telemetry Snapshot Pill */}
                  {inc.metrics_snapshot && (
                    <div className="flex items-center space-x-3 text-xs font-mono bg-slate-950/80 px-3 py-1.5 rounded-lg border border-slate-800/80 mb-2.5 text-slate-300">
                      <span className="text-rose-400 font-bold">
                        Temp: {inc.metrics_snapshot.temp_c}°C (75°C+ Red)
                      </span>
                      <span className="text-slate-600">|</span>
                      <span className="text-cyan-400">
                        {inc.metrics_snapshot.fan_rpm !== undefined && inc.metrics_snapshot.fan_rpm > 0 
                          ? `Fans: ${inc.metrics_snapshot.fan_rpm.toLocaleString()} RPM` 
                          : 'DLC: 130 LPM (42 PSI)'}
                      </span>
                      <span className="text-slate-600">|</span>
                      <span className="text-amber-400">
                        Draw: {inc.metrics_snapshot.power_w}W
                      </span>
                    </div>
                  )}

                  {/* Root Cause / Issue Description */}
                  <div className="mb-2.5">
                    <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1 font-semibold">
                      <span>ISSUE DESCRIPTION / ROOT CAUSE:</span>
                    </div>
                    <p className="text-xs text-slate-100 leading-relaxed bg-slate-950/70 p-2.5 rounded-lg border border-slate-800/80 font-sans">
                      {inc.root_cause_analysis}
                    </p>
                  </div>

                  {/* RAG Citation */}
                  <div className="mb-3 flex items-start space-x-2 bg-blue-950/30 border border-blue-500/40 p-2.5 rounded-lg text-xs">
                    <BookOpen className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-mono text-[10px] text-blue-300 uppercase tracking-wider font-bold">
                        RAG CITATION:
                      </div>
                      <p className="text-slate-200 font-medium text-xs mt-0.5 font-mono">
                        {inc.citation}
                      </p>
                    </div>
                  </div>

                  {/* Actionable Buttons: Approve & Execute Mitigation (RBAC Gated) & Reject */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    {canExecute ? (
                      <button
                        onClick={() => handleApprove(targetId)}
                        disabled={isProcessing}
                        className="flex-1 flex items-center justify-center space-x-2 py-2 px-3 rounded-lg text-xs font-bold text-white bg-gradient-to-r from-blue-600 via-cyan-600 to-emerald-600 hover:from-blue-500 hover:via-cyan-500 hover:to-emerald-500 shadow-md shadow-blue-900/40 transition-all cursor-pointer disabled:opacity-50"
                      >
                        <Zap className="w-4 h-4 text-amber-300" />
                        <span>{isProcessing ? 'Executing Mitigation...' : 'Approve & Execute Mitigation'}</span>
                      </button>
                    ) : (
                      <div 
                        className="flex-1 flex items-center justify-center space-x-2 py-2 px-3 rounded-lg text-xs font-medium text-slate-400 bg-slate-950/80 border border-slate-800 cursor-not-allowed group relative"
                        title="Mitigation locked: Requires Tier-3 SRE Authorization"
                      >
                        <Lock className="w-4 h-4 text-amber-500/80" />
                        <span>Approve &amp; Execute Mitigation (Locked)</span>
                        <div className="hidden group-hover:block absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 w-64 p-2 bg-slate-900 text-amber-300 text-[10px] rounded-lg border border-amber-500/40 shadow-xl z-20 text-center font-mono">
                          ⚠️ Requires Tier-3 SRE Authorization to power cap production/cluster servers. Switch to Darshan (L3 Admin) to approve.
                        </div>
                      </div>
                    )}

                    <button
                      onClick={() => handleReject(targetId)}
                      disabled={isProcessing || !canExecute}
                      className="py-2 px-3 rounded-lg text-xs font-medium text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 border border-slate-800 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      title={canExecute ? "Reject autonomous proposal" : "Requires Tier-3 SRE Authorization"}
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )
        ) : (
          historyIncidents.length === 0 ? (
            <div className="p-8 text-center rounded-xl bg-slate-950/40 border border-dashed border-slate-800 text-slate-400 text-xs">
              No historical incident logs yet.
            </div>
          ) : (
            historyIncidents.map((inc) => (
              <div
                key={inc.id || inc.incident_id}
                className="rounded-xl p-3 bg-slate-950/70 border border-slate-800 text-xs space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                      <Check className="w-3 h-3" />
                      {inc.status}
                    </span>
                    <span className="font-mono text-slate-400 text-[11px]">{inc.incident_id || inc.id}</span>
                  </div>
                  <span className="text-slate-400 text-[10px] font-mono flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-500" />
                    <span>Logged: {formatUtcTimestamp(inc.created_at)}</span>
                  </span>
                </div>

                <div className="text-[11px] font-mono text-slate-400 flex items-center gap-1.5 bg-slate-950/60 px-2.5 py-1 rounded border border-slate-800/70">
                  <User className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Created by: <strong className="text-slate-200">{inc.created_by || 'Autonomous Gemini Monitor'}</strong></span>
                </div>

                <p className="text-slate-300 text-xs">
                  <strong className="text-white">{inc.server_id}:</strong> {inc.root_cause_analysis}
                </p>

                {/* Retained Execution Audit Trail */}
                <div className="bg-emerald-950/20 border border-emerald-500/30 p-2 rounded-lg text-[11px] font-mono text-emerald-300">
                  <div className="flex items-center gap-1.5 font-bold mb-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Mitigated by: {inc.mitigated_by || 'Darshan Skolekar (Lead Infrastructure SRE)'} at {formatUtcTimestamp(inc.mitigated_at || (inc.execution_logs?.[0]?.timestamp))}</span>
                  </div>
                  {inc.execution_logs && inc.execution_logs.length > 0 && (
                    <div className="space-y-1 text-slate-300 pt-1.5 border-t border-emerald-500/20 text-[10px]">
                      {inc.execution_logs.map((log, idx) => (
                        <div key={idx} className="flex items-start gap-1">
                          <span className="text-emerald-400">&gt;</span>
                          <span>{log.message}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))
          )
        )}
      </div>

      {/* Action Hub Footer */}
      <div className="mt-3 pt-2.5 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400 font-mono shrink-0">
        <span>Policy: Human-in-the-Loop Safe Execution</span>
        <span>Action: [Approve &amp; Execute Mitigation]</span>
      </div>
    </div>
  );
};
