import React, { useState, useRef, useEffect } from 'react';
import { 
  User, 
  ChevronDown, 
  LogOut, 
  Shield, 
  Check, 
  Sparkles,
  Lock
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { PERSONAS, UserPersona } from '../types/auth';

export const PersonaSwitcher: React.FC = () => {
  const { currentUser, switchPersona, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!currentUser) return null;

  const roleColorBadge = 
    currentUser.role === 'L3_ADMIN' 
      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40' 
      : currentUser.role === 'AI_TENANT'
      ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
      : 'bg-amber-500/20 text-amber-300 border-amber-500/40';

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Persona Profile Badge Button */}
      <button
        onClick={() => setIsOpen(prev => !prev)}
        className="flex items-center space-x-2 py-1.5 px-2.5 rounded-xl bg-slate-950/80 hover:bg-slate-800/90 border border-slate-800 hover:border-slate-700 transition-all cursor-pointer font-mono text-xs shadow-sm"
        title="Switch active user persona or log out"
      >
        <span className="text-base select-none">{currentUser.avatar}</span>
        <div className="flex flex-col text-left">
          <div className="flex items-center space-x-1.5">
            <span className="font-bold text-white tracking-tight">{currentUser.name.split(' ')[0]}</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded border font-semibold ${roleColorBadge}`}>
              {currentUser.badgeLabel}
            </span>
          </div>
        </div>
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl z-50 overflow-hidden font-sans animate-fade-in">
          {/* Header */}
          <div className="p-3.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Shield className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider">
                Active Identity
              </span>
            </div>
            <span className="text-[10px] font-mono text-slate-400">BeyondCorp IAM</span>
          </div>

          {/* Active User Card */}
          <div className="p-3 bg-slate-900/80 border-b border-slate-800/80">
            <div className="flex items-center space-x-3">
              <div className="text-2xl p-1.5 rounded-lg bg-slate-800/80 border border-slate-700">
                {currentUser.avatar}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-bold text-xs text-white truncate">{currentUser.name}</div>
                <div className="text-[11px] text-cyan-400 font-mono">{currentUser.roleTitle}</div>
                <div className="text-[10px] text-slate-400 truncate font-mono mt-0.5">{currentUser.email}</div>
              </div>
            </div>
          </div>

          {/* Switch Persona Options */}
          <div className="p-2 space-y-1">
            <div className="px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-slate-400 font-semibold">
              Switch Persona (Evaluation)
            </div>

            {Object.values(PERSONAS).map((p) => {
              const isActive = p.id === currentUser.id;
              return (
                <button
                  key={p.id}
                  onClick={() => {
                    switchPersona(p.id as keyof typeof PERSONAS);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center space-x-2.5 p-2 rounded-xl text-left transition-colors cursor-pointer text-xs ${
                    isActive 
                      ? 'bg-cyan-500/10 text-white border border-cyan-500/30 font-semibold' 
                      : 'hover:bg-slate-800/70 text-slate-300'
                  }`}
                >
                  <span className="text-lg">{p.avatar}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-white">{p.name}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 border border-slate-700">
                        {p.badgeLabel}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400 truncate">{p.roleTitle}</div>
                  </div>
                  {isActive && <Check className="w-4 h-4 text-cyan-400 shrink-0" />}
                </button>
              );
            })}
          </div>

          {/* Log Out */}
          <div className="p-2 border-t border-slate-800 bg-slate-950/60">
            <button
              onClick={() => {
                logout();
                setIsOpen(false);
              }}
              className="w-full flex items-center justify-center space-x-2 py-2 px-3 rounded-xl text-xs font-semibold text-rose-300 bg-rose-950/20 hover:bg-rose-950/40 border border-rose-900/40 hover:border-rose-700/60 transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Log Out to Zero-Trust Gate</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
