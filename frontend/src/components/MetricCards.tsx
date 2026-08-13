import React from 'react';
import { Users, AlertTriangle, DollarSign, GitFork } from 'lucide-react';
import type { OverviewStats } from '../types/aml';

interface MetricCardsProps {
  stats: OverviewStats | null;
  activeDetectorName?: string | null;
  detectedCount?: number;
}

export const MetricCards: React.FC<MetricCardsProps> = ({
  stats,
  activeDetectorName,
  detectedCount = 0
}) => {
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(val);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 px-6 pt-4">
      {/* Metric 1: Monitored Accounts */}
      <div className="glass-panel p-4 rounded-xl flex items-center justify-between border-slate-800">
        <div>
          <p className="text-xs text-slate-400 font-medium">Monitored Accounts</p>
          <h3 className="text-2xl font-bold text-white mt-1">
            {stats?.totalAccounts ?? '--'}
          </h3>
          <p className="text-[11px] text-emerald-400 mt-1">
            SAML Topology Active
          </p>
        </div>
        <div className="p-3 bg-blue-950/50 border border-blue-500/30 rounded-xl">
          <Users className="w-5 h-5 text-blue-400" />
        </div>
      </div>

      {/* Metric 2: Flagged Risk Nodes */}
      <div className="glass-panel p-4 rounded-xl flex items-center justify-between border-slate-800">
        <div>
          <p className="text-xs text-slate-400 font-medium">Flagged & Suspicious</p>
          <h3 className="text-2xl font-bold text-red-400 mt-1">
            {stats?.flaggedAccounts ?? '--'}
          </h3>
          <p className="text-[11px] text-red-400/80 mt-1">
            Requires Analyst Action
          </p>
        </div>
        <div className="p-3 bg-red-950/50 border border-red-500/30 rounded-xl">
          <AlertTriangle className="w-5 h-5 text-red-500 animate-pulse" />
        </div>
      </div>

      {/* Metric 3: Total Transaction Volume */}
      <div className="glass-panel p-4 rounded-xl flex items-center justify-between border-slate-800">
        <div>
          <p className="text-xs text-slate-400 font-medium">Monitored Volume</p>
          <h3 className="text-xl font-bold text-amber-300 mt-1">
            {stats ? formatCurrency(stats.totalVolume) : '--'}
          </h3>
          <p className="text-[11px] text-amber-400/80 mt-1">
            {stats?.totalTransactions ?? 0} Total Transfers
          </p>
        </div>
        <div className="p-3 bg-amber-950/50 border border-amber-500/30 rounded-xl">
          <DollarSign className="w-5 h-5 text-amber-400" />
        </div>
      </div>

      {/* Metric 4: Active Fraud Detector Results */}
      <div className="glass-panel p-4 rounded-xl flex items-center justify-between border-slate-800">
        <div>
          <p className="text-xs text-slate-400 font-medium">Active Graph Detector</p>
          <h3 className="text-lg font-bold text-white mt-1 truncate max-w-[170px]">
            {activeDetectorName ? `${detectedCount} Pattern(s)` : 'Standby'}
          </h3>
          <p className="text-[11px] text-purple-400 mt-1 truncate max-w-[170px]">
            {activeDetectorName || 'Select Detector Below'}
          </p>
        </div>
        <div className="p-3 bg-purple-950/50 border border-purple-500/30 rounded-xl">
          <GitFork className="w-5 h-5 text-purple-400" />
        </div>
      </div>
    </div>
  );
};
