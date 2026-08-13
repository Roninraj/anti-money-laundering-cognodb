import React from 'react';
import { Repeat, Network, Layers, ShieldCheck } from 'lucide-react';

interface FraudDetectorControlsProps {
  activeDetector: 'LOOPS' | 'INFRA' | 'SMURFING' | null;
  loading: boolean;
  onRunMoneyLoops: () => void;
  onRunSharedInfra: () => void;
  onRunSmurfing: () => void;
  onReset: () => void;
}

export const FraudDetectorControls: React.FC<FraudDetectorControlsProps> = ({
  activeDetector,
  loading,
  onRunMoneyLoops,
  onRunSharedInfra,
  onRunSmurfing,
  onReset
}) => {
  return (
    <div className="glass-panel p-3.5 rounded-2xl flex items-center justify-between shadow-2xl border-slate-800">
      <div className="flex items-center space-x-2">
        <div className="p-2 bg-red-950/60 border border-red-500/30 rounded-lg">
          <ShieldCheck className="w-4 h-4 text-red-400" />
        </div>
        <div>
          <h4 className="text-xs font-bold text-white uppercase tracking-wider">
            Graph Fraud Detectors
          </h4>
          <p className="text-[11px] text-slate-400">
            Execute openCypher multi-hop graph algorithms
          </p>
        </div>
      </div>

      {/* Action Buttons Deck */}
      <div className="flex items-center space-x-3">
        {/* Button 1: Money Loops */}
        <button
          disabled={loading}
          onClick={onRunMoneyLoops}
          className={`flex items-center space-x-2 px-4 py-2 text-xs font-semibold rounded-xl border transition transform active:scale-95 ${
            activeDetector === 'LOOPS'
              ? 'bg-red-600 text-white border-red-400 shadow-lg shadow-red-950/60'
              : 'bg-slate-900/80 hover:bg-slate-800 text-slate-200 border-slate-700'
          }`}
        >
          <Repeat className={`w-4 h-4 ${activeDetector === 'LOOPS' ? 'animate-spin' : 'text-red-400'}`} />
          <span>Detect Money Loops</span>
        </button>

        {/* Button 2: Shared Infrastructure */}
        <button
          disabled={loading}
          onClick={onRunSharedInfra}
          className={`flex items-center space-x-2 px-4 py-2 text-xs font-semibold rounded-xl border transition transform active:scale-95 ${
            activeDetector === 'INFRA'
              ? 'bg-blue-600 text-white border-blue-400 shadow-lg shadow-blue-950/60'
              : 'bg-slate-900/80 hover:bg-slate-800 text-slate-200 border-slate-700'
          }`}
        >
          <Network className={`w-4 h-4 ${activeDetector === 'INFRA' ? 'animate-pulse' : 'text-blue-400'}`} />
          <span>Shared Infrastructure</span>
        </button>

        {/* Button 3: Smurfing Alert */}
        <button
          disabled={loading}
          onClick={onRunSmurfing}
          className={`flex items-center space-x-2 px-4 py-2 text-xs font-semibold rounded-xl border transition transform active:scale-95 ${
            activeDetector === 'SMURFING'
              ? 'bg-purple-600 text-white border-purple-400 shadow-lg shadow-purple-950/60'
              : 'bg-slate-900/80 hover:bg-slate-800 text-slate-200 border-slate-700'
          }`}
        >
          <Layers className={`w-4 h-4 ${activeDetector === 'SMURFING' ? 'animate-bounce' : 'text-purple-400'}`} />
          <span>Smurfing Alert</span>
        </button>

        {activeDetector && (
          <button
            onClick={onReset}
            className="text-xs text-slate-400 hover:text-slate-200 underline ml-2 transition"
          >
            Clear Filters
          </button>
        )}
      </div>
    </div>
  );
};
