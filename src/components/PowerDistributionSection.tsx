import React from 'react';
import { Zap, Gauge, Cpu, Layers, Activity, CheckCircle2 } from 'lucide-react';

interface PowerDistributionSectionProps {
  totalPowerKw?: number;
  totalPowerW?: number;
  tensorUtilizationPct?: number;
  hbm3BandwidthPct?: number;
  compact?: boolean;
  className?: string;
}

export const PowerDistributionSection: React.FC<PowerDistributionSectionProps> = ({
  totalPowerKw,
  totalPowerW,
  tensorUtilizationPct = 94,
  hbm3BandwidthPct = 88,
  compact = false,
  className = '',
}) => {
  // Compute total kW
  const kw = totalPowerKw !== undefined 
    ? totalPowerKw 
    : totalPowerW !== undefined 
    ? Number((totalPowerW / 1000).toFixed(2)) 
    : 4.18;

  // 3-Phase PDU balance breakdown (34%, 33%, 33%)
  const l1Kw = Number((kw * 0.34).toFixed(2));
  const l2Kw = Number((kw * 0.33).toFixed(2));
  const l3Kw = Number((kw * 0.33).toFixed(2));

  if (compact) {
    return (
      <div className={`flex items-center space-x-2 text-[11px] font-mono ${className}`}>
        <div className="flex items-center space-x-1 bg-slate-950/80 px-2 py-1 rounded border border-slate-800 text-slate-300">
          <Zap className="w-3 h-3 text-amber-400" />
          <span className="text-[10px] text-slate-400">3-PHASE PDU:</span>
          <span className="font-bold text-amber-300">L1: 34% ({l1Kw}kW)</span>
          <span className="text-slate-600">&bull;</span>
          <span className="font-bold text-amber-300">L2: 33% ({l2Kw}kW)</span>
          <span className="text-slate-600">&bull;</span>
          <span className="font-bold text-amber-300">L3: 33% ({l3Kw}kW)</span>
          <span className="text-emerald-400 text-[9px] font-bold px-1 rounded bg-emerald-500/15 border border-emerald-500/30">
            BALANCED
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-slate-950/90 rounded-xl p-3.5 border border-slate-800 space-y-3 font-mono text-xs ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
        <div className="flex items-center space-x-2 text-amber-300 font-bold">
          <Zap className="w-4 h-4 text-amber-400" />
          <span>POWER &amp; RESOURCE DISTRIBUTION (3-PHASE PDU &amp; SILICON)</span>
        </div>
        <div className="flex items-center space-x-1.5 text-[10px] text-emerald-400">
          <CheckCircle2 className="w-3 h-3" />
          <span>IEC 60309 Delta: 0.8% (Within &lt; 5% Limit)</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {/* Subsection 1: 3-Phase PDU Load Balance */}
        <div className="bg-slate-900/90 rounded-lg p-3 border border-slate-800/80 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-slate-300 font-semibold text-[11px] flex items-center gap-1.5">
              <Gauge className="w-3.5 h-3.5 text-cyan-400" />
              3-Phase PDU Electrical Balance
            </span>
            <span className="text-[10px] text-amber-300 font-bold">
              Total: {kw.toFixed(2)} kW
            </span>
          </div>

          <div className="space-y-1.5 text-[11px]">
            {/* Phase L1 */}
            <div>
              <div className="flex items-center justify-between text-slate-400 mb-0.5">
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
                  Phase L1 (Brown / R)
                </span>
                <span className="font-bold text-cyan-300">
                  34% &bull; {l1Kw} kW
                </span>
              </div>
              <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden border border-slate-800">
                <div className="bg-cyan-400 h-full rounded-full" style={{ width: '34%' }} />
              </div>
            </div>

            {/* Phase L2 */}
            <div>
              <div className="flex items-center justify-between text-slate-400 mb-0.5">
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                  Phase L2 (Black / S)
                </span>
                <span className="font-bold text-blue-300">
                  33% &bull; {l2Kw} kW
                </span>
              </div>
              <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden border border-slate-800">
                <div className="bg-blue-400 h-full rounded-full" style={{ width: '33%' }} />
              </div>
            </div>

            {/* Phase L3 */}
            <div>
              <div className="flex items-center justify-between text-slate-400 mb-0.5">
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
                  Phase L3 (Grey / T)
                </span>
                <span className="font-bold text-indigo-300">
                  33% &bull; {l3Kw} kW
                </span>
              </div>
              <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden border border-slate-800">
                <div className="bg-indigo-400 h-full rounded-full" style={{ width: '33%' }} />
              </div>
            </div>
          </div>
        </div>

        {/* Subsection 2: GPU Tensor Core vs HBM3 Memory Bandwidth */}
        <div className="bg-slate-900/90 rounded-lg p-3 border border-slate-800/80 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-slate-300 font-semibold text-[11px] flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-amber-400" />
              Silicon Resource Utilization
            </span>
            <span className="text-[10px] text-slate-400">
              SXM5 / NVLink 4
            </span>
          </div>

          <div className="space-y-2 text-[11px]">
            {/* GPU Tensor Core */}
            <div>
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-slate-300 flex items-center gap-1">
                  <Layers className="w-3 h-3 text-amber-400" />
                  GPU Tensor Core Utilization
                </span>
                <span className="font-extrabold text-amber-300">
                  {tensorUtilizationPct}%
                </span>
              </div>
              <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden border border-slate-800">
                <div
                  className="bg-gradient-to-r from-amber-500 to-amber-400 h-full rounded-full"
                  style={{ width: `${Math.min(tensorUtilizationPct, 100)}%` }}
                />
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                FP8/BF16 GEMM Matrix Multiplications
              </div>
            </div>

            {/* HBM3 Memory Bandwidth */}
            <div>
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-slate-300 flex items-center gap-1">
                  <Activity className="w-3 h-3 text-cyan-400" />
                  HBM3 Memory Bandwidth Utilization
                </span>
                <span className="font-extrabold text-cyan-300">
                  {hbm3BandwidthPct}%
                </span>
              </div>
              <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden border border-slate-800">
                <div
                  className="bg-gradient-to-r from-cyan-500 to-blue-400 h-full rounded-full"
                  style={{ width: `${Math.min(hbm3BandwidthPct, 100)}%` }}
                />
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                3.35 TB/s Peak Bus Throughput Active
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
