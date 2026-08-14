import React, { useState, useEffect } from 'react';
import { X, ShieldAlert, GitBranch, AlertTriangle, CheckCircle2, Bot } from 'lucide-react';
import type { GraphNode, AccountDetailsResponse } from '../types/aml';
import { api } from '../services/api';

interface NodeDetailsPanelProps {
  node: GraphNode | null;
  onClose: () => void;
  onExpandNeighborhood: (accountId: string) => void;
  onOpenHelperBotSAR?: (accountId: string) => void;
  onStatusChanged: () => void;
}

export const NodeDetailsPanel: React.FC<NodeDetailsPanelProps> = ({
  node,
  onClose,
  onExpandNeighborhood,
  onOpenHelperBotSAR,
  onStatusChanged
}) => {
  const [details, setDetails] = useState<AccountDetailsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  useEffect(() => {
    if (!node || node.label !== 'Account') {
      setDetails(null);
      return;
    }

    setLoading(true);
    api.getAccountDetails(node.id)
      .then(res => setDetails(res))
      .catch(err => console.error("Failed to load account details:", err))
      .finally(() => setLoading(false));
  }, [node]);

  if (!node) return null;

  const handleUpdateStatus = async (newStatus: string) => {
    setUpdatingStatus(true);
    try {
      await api.updateAccountStatus(node.id, newStatus);
      onStatusChanged();
    } catch (err) {
      console.error("Failed to update status:", err);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const riskScore = node.riskScore || 0;
  const isHighRisk = riskScore >= 75;

  return (
    <div className="fixed top-[68px] right-4 bottom-4 w-96 glass-panel rounded-2xl p-5 flex flex-col z-20 shadow-2xl border-slate-800 animate-in slide-in-from-right duration-300">
      {/* Header */}
      <div className="flex items-start justify-between pb-4 border-b border-slate-800">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
            {node.label} Entity
          </span>
          <h2 className="text-lg font-bold text-white mt-1 leading-tight">
            {node.holderName}
          </h2>
          <p className="text-xs font-mono text-slate-400 mt-0.5">{node.id}</p>
        </div>
        <button
          onClick={onClose}
          className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-5 py-4 pr-1">
        {/* Risk Score Radial Metric */}
        {node.label === 'Account' && (
          <div className="space-y-3">
            <div className="bg-slate-900/90 p-4 rounded-xl border border-slate-800 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400 font-medium">Risk Assessment Score</p>
                <div className="flex items-baseline space-x-2 mt-1">
                  <span className={`text-3xl font-extrabold ${isHighRisk ? 'text-red-500' : 'text-emerald-400'}`}>
                    {riskScore}
                  </span>
                  <span className="text-xs text-slate-500">/ 100</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  {riskScore >= 85 ? 'Severe AML Pattern / Cluster Detected' :
                   riskScore >= 60 ? 'Elevated Suspicious Behavior' :
                   'Standard Compliant Account Activity'}
                </p>
              </div>

              {/* Risk Badge */}
              <div className={`p-3 rounded-full border ${
                isHighRisk ? 'bg-red-950/60 border-red-500/50 text-red-500' : 'bg-emerald-950/60 border-emerald-500/50 text-emerald-400'
              }`}>
                <ShieldAlert className="w-6 h-6" />
              </div>
            </div>

            {/* Multi-Factor Risk Assessment Breakdown */}
            {details?.riskFactors && (
              <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <span>Risk Factor Breakdown</span>
                  <span className="text-[10px] text-slate-500 font-mono">Multi-Factor Engine</span>
                </div>

                <div className="space-y-1.5 text-xs">
                  {/* Factor 1: Laundering Cycle Involvement */}
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-400"></span>
                      Laundering Flow Match:
                    </span>
                    <span className="font-mono text-slate-200">
                      +{details.riskFactors.launderingScore} pts
                    </span>
                  </div>

                  {/* Factor 2: Structuring & Smurfing */}
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span>
                      Structuring Velocity:
                    </span>
                    <span className="font-mono text-slate-200">
                      +{details.riskFactors.structuringScore} pts
                    </span>
                  </div>

                  {/* Factor 3: Volume Exposure */}
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                      Volume Exposure:
                    </span>
                    <span className="font-mono text-slate-200">
                      +{details.riskFactors.volumeScore} pts
                    </span>
                  </div>

                  {/* Factor 4: Infrastructure & Proxy Linkage */}
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                      Infrastructure / Proxy:
                    </span>
                    <span className="font-mono text-slate-200">
                      +{details.riskFactors.infrastructureScore} pts
                    </span>
                  </div>

                  {/* Factor 5: Entity Type Risk */}
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                      Entity Profile:
                    </span>
                    <span className="font-mono text-slate-200">
                      +{details.riskFactors.entityScore} pts
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Node Properties */}
        <div className="space-y-2">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Entity Attributes</h3>
          <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800/80 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">Current Status:</span>
              <span className={`font-bold px-2 py-0.5 rounded text-[11px] ${
                node.status === 'FLAGGED' || node.status === 'SUSPENDED' ? 'badge-flagged' :
                node.status === 'SUSPICIOUS' ? 'badge-suspicious' : 'badge-normal'
              }`}>
                {node.status}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Account Type:</span>
              <span className="text-slate-200 font-medium">{node.type}</span>
            </div>
            {node.balance !== undefined && (
              <div className="flex justify-between">
                <span className="text-slate-400">Current Balance:</span>
                <span className="text-white font-bold">${node.balance.toLocaleString()}</span>
              </div>
            )}
            {node.ip && (
              <div className="flex justify-between">
                <span className="text-slate-400">IP Address:</span>
                <span className="font-mono text-purple-400">{node.ip}</span>
              </div>
            )}
            {node.deviceId && (
              <div className="flex justify-between">
                <span className="text-slate-400">Device ID:</span>
                <span className="font-mono text-blue-400">{node.deviceId}</span>
              </div>
            )}
          </div>
        </div>

        {/* Recent Transactions List */}
        {node.label === 'Account' && (
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
              <span>Transfer Ledger ({details?.transactions?.length || 0})</span>
            </h3>

            {loading ? (
              <div className="text-xs text-slate-500 py-4 text-center">Loading transactions...</div>
            ) : details?.transactions && details.transactions.length > 0 ? (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {details.transactions.map((tx, idx) => (
                  <div key={idx} className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800 text-xs flex items-center justify-between">
                    <div>
                      <p className="text-slate-300 font-medium truncate max-w-[170px]">{tx.counterparty}</p>
                      <span className="text-[10px] text-slate-500 font-mono">{tx.timestamp}</span>
                    </div>
                    <div className="text-right">
                      <p className={`font-bold ${tx.isLaundering ? 'text-red-400' : 'text-emerald-400'}`}>
                        ${tx.amount.toLocaleString()}
                      </p>
                      {tx.isLaundering && (
                        <span className="text-[9px] bg-red-950/80 text-red-400 px-1.5 py-0.2 rounded border border-red-500/30">
                          Suspicious
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500 py-2">No transfer history recorded for this node.</p>
            )}
          </div>
        )}
      </div>

      {/* Action Deck Buttons */}
      <div className="pt-4 border-t border-slate-800 space-y-2">
        {/* AML HelperBot SAR Generator Button */}
        {node.label === 'Account' && onOpenHelperBotSAR && (
          <button
            onClick={() => onOpenHelperBotSAR(node.id)}
            className="w-full flex items-center justify-center space-x-2 py-2.5 px-3 text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 rounded-xl border border-blue-400/40 shadow-lg shadow-blue-900/30 transition transform active:scale-95"
          >
            <Bot className="w-4 h-4" />
            <span>✨ AML HelperBot: Generate SAR Dossier</span>
          </button>
        )}

        {node.label === 'Account' && (
          <button
            onClick={() => onExpandNeighborhood(node.id)}
            className="w-full flex items-center justify-center space-x-2 py-2 px-3 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-700 transition"
          >
            <GitBranch className="w-4 h-4 text-blue-400" />
            <span>Explore 1-2 Hop Neighborhood</span>
          </button>
        )}

        <div className="grid grid-cols-2 gap-2">
          <button
            disabled={updatingStatus || node.status === 'FLAGGED'}
            onClick={() => handleUpdateStatus('FLAGGED')}
            className="flex items-center justify-center space-x-1.5 py-2 px-3 text-xs font-semibold text-red-300 bg-red-950/60 hover:bg-red-900/80 disabled:opacity-50 border border-red-500/40 rounded-xl transition"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Flag Node</span>
          </button>

          <button
            disabled={updatingStatus || node.status === 'NORMAL'}
            onClick={() => handleUpdateStatus('NORMAL')}
            className="flex items-center justify-center space-x-1.5 py-2 px-3 text-xs font-semibold text-emerald-300 bg-emerald-950/60 hover:bg-emerald-900/80 disabled:opacity-50 border border-emerald-500/40 rounded-xl transition"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Clear Risk</span>
          </button>
        </div>
      </div>
    </div>
  );
};
