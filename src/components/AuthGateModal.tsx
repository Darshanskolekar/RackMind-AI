import React from 'react';
import { 
  ShieldCheck, 
  Lock, 
  KeyRound, 
  UserCheck, 
  ArrowRight, 
  Server,
  Zap,
  Cpu,
  Layers,
  ChevronRight,
  ExternalLink
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { PERSONAS } from '../types/auth';

interface AuthGateModalProps {
  isOpen: boolean;
}

export const AuthGateModal: React.FC<AuthGateModalProps> = ({ isOpen }) => {
  const { loginAs, loginWithSSO, isAuthenticated } = useAuth();

  if (!isOpen || isAuthenticated) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/95 backdrop-blur-xl animate-fade-in">
      {/* Background Decorative Tech Grid */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(14,165,233,0.15),rgba(255,255,255,0))] pointer-events-none" />

      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl shadow-cyan-950/50 overflow-hidden flex flex-col">
        {/* BeyondCorp Top Banner */}
        <div className="bg-gradient-to-r from-blue-950/80 via-slate-900 to-indigo-950/80 px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2 text-xs font-mono text-cyan-400">
            <Lock className="w-3.5 h-3.5 text-cyan-400" />
            <span className="font-semibold tracking-wider uppercase">BeyondCorp Zero-Trust Enforced</span>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
            Auth Level: PIV / FIDO2
          </span>
        </div>

        {/* Header Content */}
        <div className="p-6 sm:p-8 space-y-3 text-center sm:text-left border-b border-slate-800/80">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
            <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 shadow-xl shadow-cyan-500/20 text-white font-bold shrink-0">
              <Server className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                RackMind <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400">AI</span>
                <span className="ml-2 text-xs font-normal font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                  Data Center Orchestrator
                </span>
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 mt-1">
                Enterprise Infrastructure Orchestrator & Autonomous Digital Twin
              </p>
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-2 font-mono justify-center sm:justify-start">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Protected under Google Cloud BeyondCorp / Zero-Trust Security Architecture</span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Body */}
        <div className="p-6 sm:p-8 space-y-6">
          {/* Option 1: Google Cloud Identity SSO */}
          <div>
            <div className="text-xs font-mono text-slate-400 uppercase tracking-wider mb-2 font-semibold">
              Option 1: Enterprise SSO Access
            </div>
            <button
              onClick={loginWithSSO}
              className="w-full flex items-center justify-center space-x-3 py-3 px-4 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-lg shadow-blue-600/30 border border-blue-400/30 transition-all cursor-pointer group"
            >
              <KeyRound className="w-4 h-4 text-cyan-200 group-hover:scale-110 transition-transform" />
              <span>Continue with Google Cloud Identity (BeyondCorp SSO)</span>
              <ArrowRight className="w-4 h-4 text-cyan-200 ml-auto group-hover:translate-x-1 transition-transform" />
            </button>
          </div>

          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-slate-800"></div>
            <span className="flex-shrink mx-4 text-xs font-mono text-slate-500 uppercase">
              Or Select Hackathon Evaluation Persona
            </span>
            <div className="flex-grow border-t border-slate-800"></div>
          </div>

          {/* Option 2: 3 Frictionless Evaluation Personas */}
          <div className="space-y-3">
            <div className="text-xs font-mono text-slate-400 uppercase tracking-wider font-semibold">
              Option 2: Frictionless Evaluation Personas
            </div>

            <div className="grid grid-cols-1 gap-2.5">
              {/* Persona A: Darshan */}
              <button
                onClick={() => loginAs('darshan')}
                className="flex items-start gap-3.5 p-3.5 rounded-xl bg-slate-950/60 hover:bg-slate-800/80 border border-slate-800 hover:border-cyan-500/50 text-left transition-all group cursor-pointer"
              >
                <div className="text-2xl p-2 rounded-lg bg-cyan-950/40 border border-cyan-800/40 shrink-0">
                  {PERSONAS.darshan.avatar}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div className="font-bold text-sm text-white group-hover:text-cyan-300 transition-colors">
                      {PERSONAS.darshan.name}
                    </div>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded-full font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                      [{PERSONAS.darshan.badgeLabel}]
                    </span>
                  </div>
                  <div className="text-xs text-cyan-400 font-mono mt-0.5">
                    {PERSONAS.darshan.roleTitle}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                    {PERSONAS.darshan.description}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-cyan-400 group-hover:translate-x-0.5 transition-all self-center shrink-0" />
              </button>

              {/* Persona B: Kritika */}
              <button
                onClick={() => loginAs('kritika')}
                className="flex items-start gap-3.5 p-3.5 rounded-xl bg-slate-950/60 hover:bg-slate-800/80 border border-slate-800 hover:border-purple-500/50 text-left transition-all group cursor-pointer"
              >
                <div className="text-2xl p-2 rounded-lg bg-purple-950/40 border border-purple-800/40 shrink-0">
                  {PERSONAS.kritika.avatar}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div className="font-bold text-sm text-white group-hover:text-purple-300 transition-colors">
                      {PERSONAS.kritika.name}
                    </div>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded-full font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40">
                      [{PERSONAS.kritika.badgeLabel}]
                    </span>
                  </div>
                  <div className="text-xs text-purple-400 font-mono mt-0.5">
                    {PERSONAS.kritika.roleTitle}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                    {PERSONAS.kritika.description}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-purple-400 group-hover:translate-x-0.5 transition-all self-center shrink-0" />
              </button>

              {/* Persona C: Marcus */}
              <button
                onClick={() => loginAs('tech')}
                className="flex items-start gap-3.5 p-3.5 rounded-xl bg-slate-950/60 hover:bg-slate-800/80 border border-slate-800 hover:border-amber-500/50 text-left transition-all group cursor-pointer"
              >
                <div className="text-2xl p-2 rounded-lg bg-amber-950/40 border border-amber-800/40 shrink-0">
                  {PERSONAS.tech.avatar}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div className="font-bold text-sm text-white group-hover:text-amber-300 transition-colors">
                      {PERSONAS.tech.name}
                    </div>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded-full font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                      [{PERSONAS.tech.badgeLabel}]
                    </span>
                  </div>
                  <div className="text-xs text-amber-400 font-mono mt-0.5">
                    {PERSONAS.tech.roleTitle}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                    {PERSONAS.tech.description}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all self-center shrink-0" />
              </button>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="px-6 py-3.5 bg-slate-950/90 border-t border-slate-800 text-[11px] font-mono text-slate-500 flex flex-wrap items-center justify-between gap-2">
          <span>Enterprise IAM Protocol: RBAC-v2.4 &bull; Redfish API Authorization</span>
          <span>Target Cluster: us-central1-a (Production & Twin)</span>
        </div>
      </div>
    </div>
  );
};
