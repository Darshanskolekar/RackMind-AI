import React from 'react';
import { AlertTriangle, X, ArrowRight, ShieldAlert, CheckCircle2, Info } from 'lucide-react';
import { IncidentTicket } from '../types/telemetry';

export interface ToastItem {
  id: string;
  incident?: IncidentTicket;
  title?: string;
  message?: string;
  type?: 'incident' | 'success' | 'info';
  createdAt: number;
}

interface ToastNotificationProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
  onReview: (incident: IncidentTicket) => void;
}

export const ToastNotification: React.FC<ToastNotificationProps> = ({
  toasts,
  onDismiss,
  onReview,
}) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col space-y-2.5 max-w-sm sm:max-w-md w-full pointer-events-none">
      {toasts.map((toast) => {
        // Confirmation / Success Toast (e.g. Health checks certified, sandbox restored)
        if (toast.type === 'success' || (!toast.incident && toast.message)) {
          return (
            <div
              key={toast.id}
              className="pointer-events-auto transform transition-all duration-300 ease-out hover:scale-[1.02] bg-slate-900/95 backdrop-blur-md border border-emerald-500/60 shadow-2xl shadow-emerald-950/50 rounded-xl p-3.5 flex items-start space-x-3 text-xs text-white"
            >
              <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shrink-0 mt-0.5 animate-pulse">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="font-bold text-emerald-300 font-mono uppercase tracking-wider text-[11px]">
                  {toast.title || 'Action Certified'}
                </div>
                <p className="text-slate-200 mt-1 font-sans font-medium text-[11px] leading-snug">
                  {toast.message}
                </p>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDismiss(toast.id);
                }}
                className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        }

        // Incident Notification Toast
        const incident = toast.incident;
        if (!incident) return null;
        const isP1 = incident.severity === 'P1' || incident.severity === 'CRITICAL';

        return (
          <div
            key={toast.id}
            onClick={() => onReview(incident)}
            className="pointer-events-auto transform transition-all duration-300 ease-out hover:scale-[1.02] cursor-pointer bg-slate-900/95 backdrop-blur-md border border-rose-500/60 shadow-2xl shadow-rose-950/50 rounded-xl p-3.5 flex items-start space-x-3 text-xs text-white"
          >
            <div className="p-2 rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/40 shrink-0 mt-0.5 animate-pulse">
              <ShieldAlert className="w-4 h-4" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2">
                <span className="font-bold text-rose-300 font-mono uppercase tracking-wider text-[11px] flex items-center gap-1">
                  <span>⚠️ New {incident.severity} Incident Created</span>
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  {incident.rack_id.toUpperCase()}
                </span>
                {incident.environment === 'SANDBOX' && (
                  <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold">
                    [SANDBOX]
                  </span>
                )}
              </div>

              <p className="text-slate-200 mt-1 line-clamp-2 font-sans font-medium text-[11px]">
                Target: <strong className="text-white font-mono">{incident.server_id}</strong> &bull; {incident.root_cause_analysis}
              </p>

              <div className="mt-2 flex items-center text-[10px] text-cyan-300 font-mono font-bold space-x-1 hover:text-cyan-200">
                <span>Click to review & execute mitigation</span>
                <ArrowRight className="w-3 h-3" />
              </div>
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                onDismiss(toast.id);
              }}
              className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
