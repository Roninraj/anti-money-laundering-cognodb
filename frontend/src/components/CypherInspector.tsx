import React, { useState } from 'react';
import { X, Terminal, Copy, Check, Clock, Cpu } from 'lucide-react';
import type { QueryDetails } from '../types/aml';

interface CypherInspectorProps {
  queryDetails: QueryDetails | null;
  isOpen: boolean;
  onClose: () => void;
}

export const CypherInspector: React.FC<CypherInspectorProps> = ({
  queryDetails,
  isOpen,
  onClose
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !queryDetails) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(queryDetails.cypher);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="glass-panel w-full max-w-3xl rounded-2xl border-slate-700 shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-red-950/60 border border-red-500/30 rounded-xl">
              <Terminal className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                openCypher Query Inspector
              </h3>
              <p className="text-xs text-slate-400 font-mono">
                CognoDB Bolt Protocol · Parameterized Execution
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-1.5 px-3 py-1 bg-slate-800 rounded-lg text-xs text-amber-300 font-mono">
              <Clock className="w-3.5 h-3.5" />
              <span>{queryDetails.executionTimeMs} ms</span>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Query Name & Description */}
          <div>
            <h4 className="text-sm font-bold text-slate-200">{queryDetails.name}</h4>
            {queryDetails.description && (
              <p className="text-xs text-slate-400 mt-1">{queryDetails.description}</p>
            )}
          </div>

          {/* Cypher Code Box */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-mono text-[11px] uppercase tracking-wider text-red-400">
                Parameterized Cypher Statement
              </span>
              <button
                onClick={handleCopy}
                className="flex items-center space-x-1 hover:text-white transition"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied!' : 'Copy Code'}</span>
              </button>
            </div>
            <pre className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs font-mono text-emerald-400 overflow-x-auto leading-relaxed shadow-inner">
              <code>{queryDetails.cypher}</code>
            </pre>
          </div>

          {/* Execution Parameters */}
          {queryDetails.parameters && Object.keys(queryDetails.parameters).length > 0 && (
            <div className="space-y-1.5">
              <span className="text-xs font-mono text-[11px] uppercase tracking-wider text-slate-400">
                Query Parameters ($vars)
              </span>
              <pre className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 text-xs font-mono text-blue-300">
                <code>{JSON.stringify(queryDetails.parameters, null, 2)}</code>
              </pre>
            </div>
          )}

          {/* Relational Database Comparison Box */}
          {queryDetails.relationalComparison && (
            <div className="bg-slate-900/90 p-4 rounded-xl border border-amber-500/30 space-y-1.5">
              <div className="flex items-center space-x-2 text-xs font-bold text-amber-400">
                <Cpu className="w-4 h-4" />
                <span>Why a Graph Database for this query?</span>
              </div>
              <p className="text-xs text-slate-300 leading-normal">
                {queryDetails.relationalComparison}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-900/90 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-700 transition"
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
};
