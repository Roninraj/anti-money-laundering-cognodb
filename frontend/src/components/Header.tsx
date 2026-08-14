import React from 'react';
import { ShieldAlert, Database, Terminal, RefreshCw } from 'lucide-react';
import { SearchDropdown } from './SearchDropdown';
import type { ConnectionStatus, QueryDetails, SearchAccountResult } from '../types/aml';

interface HeaderProps {
  connection: ConnectionStatus | null;
  activeQuery: QueryDetails | null;
  onOpenInspector: () => void;
  onOpenHelperBot: () => void;
  onSelectAccount: (account: SearchAccountResult, queryDetails?: QueryDetails) => void;
  onResetGraph: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  connection,
  activeQuery,
  onOpenInspector,
  onOpenHelperBot,
  onSelectAccount,
  onResetGraph
}) => {
  const isOnline = connection?.status === 'ONLINE';

  return (
    <header className="glass-header sticky top-0 z-30 px-6 py-3.5 flex items-center justify-between shadow-xl">
      {/* Brand & Title */}
      <div className="flex items-center space-x-3.5">
        <div className="p-2.5 bg-red-950/60 border border-red-500/40 rounded-xl shadow-lg shadow-red-900/20">
          <ShieldAlert className="w-6 h-6 text-red-500 animate-pulse-glow" />
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
              WEXA <span className="text-red-500 font-extrabold">AML</span> Intelligence Console
            </h1>
            <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 font-mono">
              CognoDB openCypher
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Real-time Financial Crime & Multi-Hop Network Fraud Detection
          </p>
        </div>
      </div>

      {/* Middle: Interactive Search Dropdown */}
      <SearchDropdown
        onSelectAccount={onSelectAccount}
        onOpenInspector={onOpenInspector}
      />

      {/* Right Controls & Connection Status */}
      <div className="flex items-center space-x-2.5">
        {/* Connection Status Pill */}
        <div
          title={connection?.reason || connection?.uri || 'Connecting to database...'}
          className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg border text-xs font-mono transition ${
            isOnline
              ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-400'
              : 'bg-amber-950/40 border-amber-500/40 text-amber-400'
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500 animate-ping' : 'bg-amber-500'}`} />
          <Database className="w-3.5 h-3.5" />
          <span>{isOnline ? 'CognoDB Live' : 'Demo Engine'}</span>
        </div>

        {/* Reset Graph Button */}
        <button
          onClick={onResetGraph}
          className="flex items-center space-x-1.5 px-3 py-1.5 text-xs text-slate-300 bg-slate-800/80 hover:bg-slate-700 border border-slate-700 rounded-lg transition"
          title="Reset Graph View"
        >
          <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
          <span>Reset</span>
        </button>

        {/* AML HelperBot Trigger Button */}
        <button
          onClick={onOpenHelperBot}
          className="flex items-center space-x-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 rounded-lg border border-blue-400/30 shadow-lg shadow-blue-900/30 transition transform active:scale-95"
          title="Open AML HelperBot AI Assistant"
        >
          <span className="w-2 h-2 rounded-full bg-blue-300 animate-ping" />
          <span>AML HelperBot</span>
        </button>

        {/* Cypher Console Trigger Button */}
        <button
          onClick={onOpenInspector}
          className="flex items-center space-x-2 px-3.5 py-1.5 text-xs font-semibold text-white bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 rounded-lg border border-red-500/30 shadow-lg shadow-red-950/40 transition transform active:scale-95"
        >
          <Terminal className="w-3.5 h-3.5" />
          <span>Cypher Console</span>
          {activeQuery && (
            <span className="ml-1 text-[10px] px-1.5 py-0.2 bg-black/40 rounded text-amber-300 font-mono">
              {activeQuery.executionTimeMs}ms
            </span>
          )}
        </button>
      </div>
    </header>
  );
};
