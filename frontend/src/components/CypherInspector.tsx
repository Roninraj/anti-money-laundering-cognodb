import React, { useState, useEffect } from 'react';
import {
  X,
  Terminal,
  Play,
  Copy,
  Check,
  Clock,
  Cpu,
  Table,
  Code2,
  Share2,
  AlertCircle,
  RotateCcw,
  Sparkles,
  Loader2
} from 'lucide-react';
import { api } from '../services/api';
import type { QueryDetails, GraphData, ExecuteCypherResponse } from '../types/aml';

interface CypherInspectorProps {
  queryDetails: QueryDetails | null;
  isOpen: boolean;
  onClose: () => void;
  onApplyGraphToCanvas?: (graph: GraphData, queryName: string) => void;
}

const PRESET_QUERIES = [
  {
    name: "Detect 5-Hop Circular Laundering Loops",
    category: "Typologies",
    cypher: `MATCH (a:Account)-[t1:TRANSFERRED]->(b:Account)-[t2:TRANSFERRED]->(c:Account)-[t3:TRANSFERRED]->(d:Account)-[t4:TRANSFERRED]->(e:Account)-[t5:TRANSFERRED]->(a)
WHERE a.id < b.id AND a.id < c.id AND a.id < d.id AND a.id < e.id
RETURN a.holderName AS account1, b.holderName AS account2, c.holderName AS account3, d.holderName AS account4, e.holderName AS account5, (t1.amount + t2.amount + t3.amount + t4.amount + t5.amount) AS totalVolume
ORDER BY totalVolume DESC
LIMIT 10`
  },
  {
    name: "Detect Structuring & Smurfing Mule Rings",
    category: "Typologies",
    cypher: `MATCH (mule:Account)<-[t:TRANSFERRED]-(source:Account)
WHERE t.launderingType IN ['Smurfing', 'Structuring', 'Deposit-Send', 'Fan_In'] OR (t.amount < 10000.0 AND t.amount >= 1000.0)
WITH mule, count(t) AS txCount, sum(t.amount) AS totalInbound, collect(DISTINCT source.holderName) AS sourceHolders
WHERE txCount >= 3
RETURN mule.id AS muleId, mule.holderName AS muleName, mule.status AS muleStatus, txCount, totalInbound
ORDER BY totalInbound DESC
LIMIT 20`
  },
  {
    name: "Analyze Multi-Branch Layering Hubs",
    category: "Typologies",
    cypher: `MATCH (hub:Account)<-[t1:TRANSFERRED]-(a1:Account)
MATCH (hub)-[t2:TRANSFERRED]->(a2:Account)
WHERE a1.id <> a2.id AND (t1.isLaundering = true OR t2.isLaundering = true OR hub.riskScore >= 60)
RETURN hub.id AS hubId, hub.holderName AS hubName, hub.bank AS bankLocation, a1.holderName AS sourceAccount, a2.holderName AS targetAccount, (t1.amount + t2.amount) AS volume
LIMIT 25`
  },
  {
    name: "Top Flagged High-Risk Entities",
    category: "Risk Intelligence",
    cypher: `MATCH (a:Account)
WHERE a.status = 'FLAGGED' OR a.riskScore >= 85
RETURN a.id AS accountId, a.holderName AS companyName, a.bank AS bank, a.riskScore AS riskScore, a.status AS status, a.balance AS balance
ORDER BY a.riskScore DESC, a.balance DESC
LIMIT 20`
  },
  {
    name: "High-Value Transfers ($100k+)",
    category: "Transactions",
    cypher: `MATCH (src:Account)-[t:TRANSFERRED]->(tgt:Account)
WHERE t.amount >= 100000.0
RETURN src.holderName AS sender, t.amount AS amount, t.paymentFormat AS format, t.paymentCurrency AS currency, tgt.holderName AS recipient, t.timestamp AS timestamp
ORDER BY t.amount DESC
LIMIT 20`
  },
  {
    name: "Full AML Graph Topology Sample",
    category: "Graph Canvas",
    cypher: `MATCH (n:Account)
OPTIONAL MATCH (n)-[r:TRANSFERRED]->(m:Account)
RETURN n, r, m
LIMIT 100`
  }
];

export const CypherInspector: React.FC<CypherInspectorProps> = ({
  queryDetails,
  isOpen,
  onClose,
  onApplyGraphToCanvas
}) => {
  const [cypherText, setCypherText] = useState('');
  const [activeTab, setActiveTab] = useState<'TABLE' | 'JSON' | 'EXPLAIN'>('TABLE');
  const [isRunning, setIsRunning] = useState(false);
  const [copied, setCopied] = useState(false);
  const [executionResult, setExecutionResult] = useState<ExecuteCypherResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sync with active query whenever modal opens or activeQuery changes
  useEffect(() => {
    if (queryDetails) {
      setCypherText(queryDetails.cypher);
      setErrorMessage(null);
      // Automatically show inspector details
      setExecutionResult({
        success: true,
        count: 0,
        columns: [],
        results: [],
        graph: null,
        executionTimeMs: queryDetails.executionTimeMs,
        query: queryDetails.cypher,
        parameters: queryDetails.parameters
      });
    }
  }, [queryDetails, isOpen]);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(cypherText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExecuteCypher = async (queryToRun?: string) => {
    const q = (queryToRun || cypherText).trim();
    if (!q) return;

    setIsRunning(true);
    setErrorMessage(null);

    try {
      const res = await api.executeCypher(q);
      setExecutionResult(res);
      if (!res.success && res.error) {
        setErrorMessage(res.error);
      } else {
        if (res.results && res.results.length > 0) {
          setActiveTab('TABLE');
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Cypher execution failed');
    } finally {
      setIsRunning(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleExecuteCypher();
    }
  };

  const handleSelectPreset = (preset: typeof PRESET_QUERIES[0]) => {
    setCypherText(preset.cypher);
    handleExecuteCypher(preset.cypher);
  };

  const handleVisualizeGraph = () => {
    if (executionResult?.graph && onApplyGraphToCanvas) {
      onApplyGraphToCanvas(executionResult.graph, 'Custom openCypher Query');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="glass-panel w-full max-w-5xl rounded-2xl border-slate-700 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-red-950/60 border border-red-500/30 rounded-xl shadow-lg shadow-red-900/20">
              <Terminal className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                openCypher Query Console
              </h3>
              <p className="text-xs text-slate-400 font-mono">
                CognoDB Cloud Bolt Protocol · Interactive Low-Latency Execution
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {executionResult && (
              <div className="flex items-center space-x-1.5 px-3 py-1 bg-slate-800/90 border border-slate-700 rounded-lg text-xs text-amber-300 font-mono">
                <Clock className="w-3.5 h-3.5" />
                <span>{executionResult.executionTimeMs} ms</span>
              </div>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Console Presets Bar */}
        <div className="px-6 py-2.5 bg-slate-950/80 border-b border-slate-800/80 flex items-center space-x-2 overflow-x-auto text-xs scrollbar-thin">
          <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1 shrink-0">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Preset Queries:</span>
          </span>
          {PRESET_QUERIES.map((preset, idx) => (
            <button
              key={idx}
              onClick={() => handleSelectPreset(preset)}
              className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 text-[11px] font-medium shrink-0 transition"
            >
              {preset.name}
            </button>
          ))}
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {/* Cypher Code Editor */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-mono text-[11px] uppercase tracking-wider text-red-400 font-semibold flex items-center gap-1.5">
                <Code2 className="w-3.5 h-3.5" />
                <span>openCypher Editor (Ctrl + Enter to Execute)</span>
              </span>
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => setCypherText('')}
                  className="flex items-center space-x-1 text-slate-500 hover:text-slate-300 transition text-[11px]"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Clear</span>
                </button>
                <button
                  onClick={handleCopy}
                  className="flex items-center space-x-1 text-slate-400 hover:text-white transition text-[11px]"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copied ? 'Copied!' : 'Copy Cypher'}</span>
                </button>
              </div>
            </div>

            <div className="relative">
              <textarea
                value={cypherText}
                onChange={e => setCypherText(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={5}
                placeholder="Enter openCypher query, e.g. MATCH (a:Account) RETURN a LIMIT 10"
                className="w-full bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs font-mono text-emerald-400 focus:outline-none focus:border-red-500 leading-relaxed shadow-inner resize-y"
                spellCheck={false}
              />

              <button
                onClick={() => handleExecuteCypher()}
                disabled={isRunning || !cypherText.trim()}
                className="absolute bottom-3 right-3 px-4 py-2 bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-lg shadow-red-950/50 flex items-center space-x-2 transition transform active:scale-95"
              >
                {isRunning ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Play className="w-3.5 h-3.5 fill-current" />
                )}
                <span>{isRunning ? 'Running...' : 'Execute Cypher'}</span>
              </button>
            </div>
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div className="p-3.5 bg-red-950/80 border border-red-500/50 rounded-xl text-xs text-red-300 flex items-start space-x-2.5">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Cypher Execution Error</p>
                <p className="font-mono text-[11px] text-red-400/90 mt-0.5">{errorMessage}</p>
              </div>
            </div>
          )}

          {/* Results Navigation Tabs */}
          <div className="border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setActiveTab('TABLE')}
                className={`flex items-center space-x-1.5 px-3 py-2 text-xs font-semibold border-b-2 transition ${
                  activeTab === 'TABLE'
                    ? 'border-red-500 text-white bg-red-500/5'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Table className="w-3.5 h-3.5" />
                <span>Results Table ({executionResult?.count || 0})</span>
              </button>

              <button
                onClick={() => setActiveTab('JSON')}
                className={`flex items-center space-x-1.5 px-3 py-2 text-xs font-semibold border-b-2 transition ${
                  activeTab === 'JSON'
                    ? 'border-red-500 text-white bg-red-500/5'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Code2 className="w-3.5 h-3.5" />
                <span>Raw JSON</span>
              </button>

              {queryDetails?.relationalComparison && (
                <button
                  onClick={() => setActiveTab('EXPLAIN')}
                  className={`flex items-center space-x-1.5 px-3 py-2 text-xs font-semibold border-b-2 transition ${
                    activeTab === 'EXPLAIN'
                      ? 'border-red-500 text-white bg-red-500/5'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Cpu className="w-3.5 h-3.5" />
                  <span>Graph Advantage</span>
                </button>
              )}
            </div>

            {executionResult?.graph && executionResult.graph.nodes.length > 0 && onApplyGraphToCanvas && (
              <button
                onClick={handleVisualizeGraph}
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-blue-600/90 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold border border-blue-400/30 transition shadow-lg shadow-blue-900/30"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Render on Canvas ({executionResult.graph.nodes.length} nodes)</span>
              </button>
            )}
          </div>

          {/* Tab 1: Table View */}
          {activeTab === 'TABLE' && (
            <div className="space-y-2">
              {executionResult?.results && executionResult.results.length > 0 ? (
                <div className="border border-slate-800 rounded-xl overflow-hidden overflow-x-auto bg-slate-950/70 max-h-64 scrollbar-thin">
                  <table className="w-full text-left text-xs border-collapse font-mono">
                    <thead>
                      <tr className="bg-slate-900/90 border-b border-slate-800 text-slate-300">
                        {executionResult.columns.map((col, idx) => (
                          <th key={idx} className="px-4 py-2.5 font-bold uppercase text-[11px] tracking-wider text-red-400">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {executionResult.results.map((row, rIdx) => (
                        <tr key={rIdx} className="hover:bg-slate-900/50 transition">
                          {executionResult.columns.map((col, cIdx) => {
                            const val = row[col];
                            return (
                              <td key={cIdx} className="px-4 py-2 text-slate-300 whitespace-nowrap">
                                {typeof val === 'object' && val !== null ? (
                                  <span className="text-amber-300">{JSON.stringify(val)}</span>
                                ) : typeof val === 'number' ? (
                                  <span className="text-emerald-400">
                                    {col.toLowerCase().includes('volume') || col.toLowerCase().includes('amount') || col.toLowerCase().includes('balance')
                                      ? `$${val.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                                      : val}
                                  </span>
                                ) : (
                                  String(val ?? '')
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-8 text-center text-slate-500 text-xs bg-slate-950/50 rounded-xl border border-slate-800">
                  {isRunning ? 'Executing Cypher query against CognoDB...' : 'Execute a query above to view results.'}
                </div>
              )}
            </div>
          )}

          {/* Tab 2: JSON View */}
          {activeTab === 'JSON' && (
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs font-mono text-blue-300 max-h-64 overflow-y-auto shadow-inner">
              <pre>
                <code>
                  {executionResult?.results && executionResult.results.length > 0
                    ? JSON.stringify(executionResult.results, null, 2)
                    : JSON.stringify(executionResult || { status: 'NO_RESULTS' }, null, 2)}
                </code>
              </pre>
            </div>
          )}

          {/* Tab 3: Graph Advantage / Explanations */}
          {activeTab === 'EXPLAIN' && queryDetails?.relationalComparison && (
            <div className="bg-slate-900/90 p-5 rounded-xl border border-amber-500/30 space-y-2">
              <div className="flex items-center space-x-2 text-xs font-bold text-amber-400">
                <Cpu className="w-4 h-4" />
                <span>Why openCypher Graph Traversal vs Relational SQL?</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                {queryDetails.relationalComparison}
              </p>
              {queryDetails.description && (
                <p className="text-xs text-slate-400 border-t border-slate-800 pt-2 mt-2">
                  <span className="font-semibold text-slate-300">Description:</span> {queryDetails.description}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between">
          <span className="text-[11px] text-slate-400 font-mono">
            {executionResult ? `Returned ${executionResult.count} row(s) in ${executionResult.executionTimeMs}ms` : 'Ready'}
          </span>
          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-700 transition"
            >
              Close Console
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
