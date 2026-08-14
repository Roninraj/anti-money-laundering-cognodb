import React, { useState, useEffect, useRef } from 'react';
import {
  Bot,
  Sparkles,
  Send,
  FileText,
  Copy,
  Check,
  Play,
  X,
  ShieldAlert,
  Loader2,
  Terminal,
  MessageSquare,
  Download,
  Table as TableIcon,
  ChevronDown,
  ChevronRight,
  Cpu,
  ArrowRight,
  RotateCcw,
  Wrench
} from 'lucide-react';
import { api } from '../services/api';
import type { ChatMessage, SARReportResponse, GraphNode, ExecuteCypherResponse, AgentAction } from '../types/aml';

interface AMLHelperBotModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedNode: GraphNode | null;
  onExecuteCypher?: (cypher: string) => void;
}

const SAMPLE_SAR_ACCOUNTS = [
  { id: 'ACC-7401327478', name: 'Cobalt Nexus International Ltd', score: 75, status: 'SUSPICIOUS' },
  { id: 'ACC-4497771501', name: 'Golden Oak International Holdings', score: 98, status: 'FLAGGED' },
  { id: 'ACC-2987279234', name: 'Omni Matrix Biotech Co', score: 98, status: 'FLAGGED' },
  { id: 'ACC-2369776263', name: 'Redstone Commodities Holdings', score: 90, status: 'FLAGGED' },
  { id: 'ACC-8891878216', name: 'Redstone Energy Inc', score: 65, status: 'SUSPICIOUS' }
];

interface ScrollableResultsTableProps {
  data: ExecuteCypherResponse;
}

const ScrollableResultsTable: React.FC<ScrollableResultsTableProps> = ({ data }) => {
  if (!data || !data.results || data.results.length === 0) {
    return (
      <div className="mt-3 p-3 bg-slate-950/90 rounded-xl border border-slate-800 text-xs text-slate-400 font-mono text-center">
        No records returned. ({data.executionTimeMs}ms)
      </div>
    );
  }

  const columns = data.columns && data.columns.length > 0
    ? data.columns
    : Object.keys(data.results[0] || {});

  const formatCellValue = (key: string, val: any) => {
    if (val === null || val === undefined) return <span className="text-slate-600">-</span>;

    const kLower = key.toLowerCase();

    if (typeof val === 'number') {
      if (kLower.includes('volume') || kLower.includes('amount') || kLower.includes('balance') || kLower.includes('inbound') || kLower.includes('total')) {
        return <span className="text-emerald-400 font-semibold">${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>;
      }
      if (kLower.includes('score') || kLower.includes('risk')) {
        const color = val >= 85 ? 'text-red-400 bg-red-950/60 border-red-500/30' : (val >= 60 ? 'text-amber-400 bg-amber-950/60 border-amber-500/30' : 'text-emerald-400 bg-emerald-950/60 border-emerald-500/30');
        return <span className={`px-1.5 py-0.5 rounded border text-[11px] font-bold ${color}`}>{val}/100</span>;
      }
      return <span className="text-blue-300">{val.toLocaleString()}</span>;
    }

    if (typeof val === 'string') {
      if (['FLAGGED', 'SUSPICIOUS', 'SUSPENDED', 'NORMAL'].includes(val.toUpperCase())) {
        const color = val.toUpperCase() === 'FLAGGED' ? 'bg-red-500/20 text-red-400 border-red-500/30' : (val.toUpperCase() === 'SUSPICIOUS' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30');
        return <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${color}`}>{val}</span>;
      }
      if (val.startsWith('ACC-')) {
        return <span className="text-amber-300 font-mono font-medium">{val}</span>;
      }
      return <span className="text-slate-200">{val}</span>;
    }

    if (Array.isArray(val)) {
      return (
        <span className="text-cyan-300">
          [{val.map(item => (typeof item === 'object' ? JSON.stringify(item) : String(item))).join(', ')}]
        </span>
      );
    }

    if (typeof val === 'object') {
      return <span className="text-slate-400">{JSON.stringify(val)}</span>;
    }

    return String(val);
  };

  return (
    <div className="mt-3 bg-slate-950/95 rounded-xl border border-slate-800 overflow-hidden flex flex-col shadow-inner">
      {/* Table Top Bar */}
      <div className="px-3.5 py-2 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between text-xs font-mono">
        <div className="flex items-center space-x-2">
          <TableIcon className="w-3.5 h-3.5 text-blue-400" />
          <span className="text-slate-300 font-bold">Execution Results:</span>
          <span className="px-2 py-0.5 rounded bg-blue-950 text-blue-300 text-[11px] font-bold border border-blue-800">
            {data.count} Row{data.count !== 1 ? 's' : ''}
          </span>
        </div>
        <span className="text-amber-400 text-[11px] font-bold">
          ⚡ {data.executionTimeMs} ms
        </span>
      </div>

      {/* Truly Scrollable Table Container */}
      <div className="max-h-60 overflow-x-auto overflow-y-auto scrollbar-thin border-t border-slate-800/40">
        <table className="w-full text-left text-xs border-collapse font-mono min-w-max">
          <thead className="sticky top-0 bg-slate-900/95 backdrop-blur z-10 border-b border-slate-800">
            <tr>
              <th className="px-3 py-2 text-[11px] font-bold text-slate-500 uppercase tracking-wider w-10 text-center">
                #
              </th>
              {columns.map((col, idx) => (
                <th
                  key={idx}
                  className="px-3.5 py-2 font-bold uppercase text-[11px] tracking-wider text-red-400 whitespace-nowrap"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {data.results.map((row, rIdx) => (
              <tr key={rIdx} className="hover:bg-slate-900/60 transition">
                <td className="px-3 py-2 text-[10px] text-slate-500 font-mono text-center select-none">
                  {rIdx + 1}
                </td>
                {columns.map((col, cIdx) => (
                  <td
                    key={cIdx}
                    className="px-3.5 py-2 text-slate-300 whitespace-nowrap text-xs max-w-xs truncate"
                    title={typeof row[col] === 'object' ? JSON.stringify(row[col]) : String(row[col] ?? '')}
                  >
                    {formatCellValue(col, row[col])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Table Footer */}
      <div className="px-3.5 py-1.5 bg-slate-900/70 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-500 font-mono">
        <span>Scroll vertically and horizontally to inspect records</span>
        <span>{columns.length} Columns</span>
      </div>
    </div>
  );
};

export const AMLHelperBotModal: React.FC<AMLHelperBotModalProps> = ({
  isOpen,
  onClose,
  selectedNode,
  onExecuteCypher
}) => {
  const [activeTab, setActiveTab] = useState<'chat' | 'sar' | 'nl2cypher'>('chat');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: `Hello! I am **AML HelperBot**, an autonomous Graph Threat Intelligence & Compliance Agent.\n\nI dynamically plan queries, invoke graph execution tools across CognoDB Cloud, analyze 17 AML typologies, and synthesize regulatory FinCEN SAR filings.\n\nAsk me any investigation question or select a prompt below!`
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [expandedTraceIdxs, setExpandedTraceIdxs] = useState<Record<number, boolean>>({});

  // Inline execution state for chat cypher blocks
  const [inlineResults, setInlineResults] = useState<Record<number, ExecuteCypherResponse>>({});
  const [executingInlineIdx, setExecutingInlineIdx] = useState<number | null>(null);

  // SAR Tab State
  const [sarAccountId, setSarAccountId] = useState(selectedNode?.id || 'ACC-7401327478');
  const [sarReport, setSarReport] = useState<SARReportResponse | null>(null);
  const [isGeneratingSAR, setIsGeneratingSAR] = useState(false);
  const [sarCopied, setSarCopied] = useState(false);

  // NL2Cypher Tab State
  const [nlPrompt, setNlPrompt] = useState('');
  const [nlResult, setNlResult] = useState<{ cypher: string; explanation: string } | null>(null);
  const [isTranslatingNL, setIsTranslatingNL] = useState(false);
  const [nlExecutionResult, setNlExecutionResult] = useState<ExecuteCypherResponse | null>(null);
  const [isExecutingNL, setIsExecutingNL] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedNode) {
      setSarAccountId(selectedNode.id);
    }
  }, [selectedNode]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  if (!isOpen) return null;

  const quickPrompts = [
    { label: '🔄 Detect Money Loops', prompt: 'Find all accounts participating in 5-hop circular money loops' },
    { label: '⚡ Smurfing Mule Rings', prompt: 'Identify smurfing mule aggregators receiving sub-$10k transfers' },
    { label: '🌐 Multi-Branch Hubs', prompt: 'Find scatter-gather intermediary layering hubs in the network' },
    { label: '🚨 Top Flagged Accounts', prompt: 'Show me the top flagged high-risk accounts' },
    { label: '💱 High-Value Transfers', prompt: 'Show me large transactions exceeding $100k' },
    { label: '📊 Graph Summary', prompt: 'Summarize total accounts, transfers, and flagged volume in the graph' }
  ];

  const toggleTrace = (idx: number) => {
    setExpandedTraceIdxs(prev => ({
      ...prev,
      [idx]: !prev[idx]
    }));
  };

  const handleSendMessage = async (textToSend?: string) => {
    const text = textToSend || inputValue;
    if (!text.trim() || isLoading) return;

    const newMessages: ChatMessage[] = [
      ...messages,
      { role: 'user', content: text }
    ];
    setMessages(newMessages);
    setInputValue('');
    setIsLoading(true);

    try {
      const response = await api.chatWithHelperBot(
        text,
        newMessages,
        selectedNode?.id
      );

      const botMessageIdx = newMessages.length;

      setMessages([
        ...newMessages,
        {
          role: 'assistant',
          content: response.reply,
          suggestedCypher: response.suggestedCypher,
          thoughtProcess: response.thoughtProcess,
          steps: response.steps,
          queryResults: response.queryResults,
          suggestedActions: response.suggestedActions
        }
      ]);

      // Automatically expand trace for transparency
      setExpandedTraceIdxs(prev => ({ ...prev, [botMessageIdx]: true }));
    } catch (err: any) {
      setMessages([
        ...newMessages,
        {
          role: 'assistant',
          content: `⚠️ Agent execution error: ${err.message}`
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleActionClick = (action: AgentAction) => {
    if (action.action === 'GENERATE_SAR' && action.accountId) {
      setActiveTab('sar');
      handleGenerateSAR(action.accountId);
    } else if (action.action === 'SEND_MESSAGE' && action.prompt) {
      handleSendMessage(action.prompt);
    } else if (action.action === 'OPEN_CYPHER' && action.payload && onExecuteCypher) {
      onExecuteCypher(action.payload);
      onClose();
    }
  };

  const handleGenerateSAR = async (accId?: string) => {
    const targetId = (accId || sarAccountId || selectedNode?.id || 'ACC-7401327478').trim();
    if (!targetId) return;

    setIsGeneratingSAR(true);
    setSarAccountId(targetId);

    try {
      const report = await api.generateSARReport(targetId);
      setSarReport(report);
    } catch (err: any) {
      console.error('Failed to generate SAR report:', err);
    } finally {
      setIsGeneratingSAR(false);
    }
  };

  const handleExecuteInline = async (cypher: string, msgIdx: number) => {
    setExecutingInlineIdx(msgIdx);
    try {
      const res = await api.executeCypher(cypher);
      setInlineResults(prev => ({ ...prev, [msgIdx]: res }));
    } catch (err) {
      console.error('Inline execution failed:', err);
    } finally {
      setExecutingInlineIdx(null);
    }
  };

  const handleTranslateNL2Cypher = async (promptToTranslate?: string) => {
    const p = (promptToTranslate || nlPrompt).trim();
    if (!p) return;

    setIsTranslatingNL(true);
    setNlExecutionResult(null);
    try {
      const res = await api.translateNLToCypher(p);
      setNlResult(res);
    } catch (err: any) {
      console.error('NL2Cypher failed:', err);
    } finally {
      setIsTranslatingNL(false);
    }
  };

  const handleExecuteNLCypher = async () => {
    if (!nlResult?.cypher) return;
    setIsExecutingNL(true);
    try {
      const res = await api.executeCypher(nlResult.cypher);
      setNlExecutionResult(res);
    } catch (err) {
      console.error('NL Cypher execution failed:', err);
    } finally {
      setIsExecutingNL(false);
    }
  };

  const copyToClipboard = (text: string, index?: number) => {
    navigator.clipboard.writeText(text);
    if (index !== undefined) {
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } else {
      setSarCopied(true);
      setTimeout(() => setSarCopied(false), 2000);
    }
  };

  const handleDownloadSAR = () => {
    if (!sarReport) return;
    const blob = new Blob([sarReport.sarNarrative], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SAR_Dossier_${sarReport.accountId}_${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 md:p-6 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-4xl h-[720px] flex flex-col shadow-2xl overflow-hidden relative">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 rounded-xl shadow-lg shadow-blue-500/20 text-white">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-bold text-white tracking-wide">
                  AML HelperBot Agent
                </h2>
                <span className="flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950/80 text-emerald-400 border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span>Agentic Copilot Online</span>
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Autonomous openCypher Tool Execution · Reasoning Traces · FinCEN SAR Filing
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Tabs */}
            <div className="flex bg-slate-800/80 p-1 rounded-xl border border-slate-700/60 text-xs">
              <button
                onClick={() => setActiveTab('chat')}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg transition font-medium ${
                  activeTab === 'chat'
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Agentic Chat</span>
              </button>
              <button
                onClick={() => {
                  setActiveTab('sar');
                  if (!sarReport) {
                    handleGenerateSAR(selectedNode?.id || sarAccountId);
                  }
                }}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg transition font-medium ${
                  activeTab === 'sar'
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>SAR Generator</span>
              </button>
              <button
                onClick={() => setActiveTab('nl2cypher')}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg transition font-medium ${
                  activeTab === 'nl2cypher'
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Terminal className="w-3.5 h-3.5" />
                <span>NL to Cypher</span>
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Selected Context Banner */}
        {selectedNode && (
          <div className="px-6 py-2 bg-blue-950/40 border-b border-blue-500/20 flex items-center justify-between text-xs">
            <div className="flex items-center space-x-2 text-blue-300">
              <ShieldAlert className="w-4 h-4 text-blue-400" />
              <span>
                Active Target: <strong>{selectedNode.holderName}</strong> ({selectedNode.id}) · Risk <strong>{selectedNode.riskScore}/100</strong> ({selectedNode.status})
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => handleSendMessage(`Investigate and analyze account ${selectedNode.id} (${selectedNode.holderName})`)}
                className="px-2.5 py-0.5 rounded bg-blue-600/30 hover:bg-blue-600 text-blue-200 text-[11px] font-semibold border border-blue-400/30 transition"
              >
                Investigate in Chat
              </button>
              <button
                onClick={() => {
                  setActiveTab('sar');
                  handleGenerateSAR(selectedNode.id);
                }}
                className="px-2.5 py-0.5 rounded bg-red-600/30 hover:bg-red-600 text-red-200 text-[11px] font-semibold border border-red-400/30 transition"
              >
                Generate SAR
              </button>
            </div>
          </div>
        )}

        {/* Tab 1: Agentic Chat & Copilot */}
        {activeTab === 'chat' && (
          <div className="flex-1 flex flex-col min-h-0 bg-slate-900/40">
            {/* Message Stream */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[88%] rounded-2xl p-4 text-sm leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-tr-none shadow-md'
                        : 'bg-slate-950/90 border border-slate-800 text-slate-200 rounded-tl-none shadow-xl'
                    }`}
                  >
                    {/* Bot Header */}
                    {msg.role === 'assistant' && (
                      <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800/80 text-xs font-bold text-slate-400">
                        <span className="flex items-center space-x-1.5 text-blue-400">
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>AML HelperBot Agent</span>
                        </span>
                        <button
                          onClick={() => copyToClipboard(msg.content, idx)}
                          className="hover:text-white transition flex items-center space-x-1"
                        >
                          {copiedIndex === idx ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                          <span className="text-[10px]">{copiedIndex === idx ? 'Copied' : 'Copy'}</span>
                        </button>
                      </div>
                    )}

                    {/* Agent Reasoning & Tool Trace Accordion */}
                    {msg.steps && msg.steps.length > 0 && (
                      <div className="mb-3 bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden">
                        <button
                          onClick={() => toggleTrace(idx)}
                          className="w-full px-3.5 py-2 flex items-center justify-between text-xs font-mono text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition"
                        >
                          <div className="flex items-center space-x-2">
                            <Cpu className="w-3.5 h-3.5 text-indigo-400" />
                            <span className="font-bold text-slate-300">
                              Agent Reasoning & Tool Calls ({msg.steps.length} steps)
                            </span>
                          </div>
                          <div className="flex items-center space-x-1 text-slate-500">
                            {expandedTraceIdxs[idx] ? (
                              <ChevronDown className="w-4 h-4 text-slate-400" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-slate-400" />
                            )}
                          </div>
                        </button>

                        {expandedTraceIdxs[idx] && (
                          <div className="p-3 pt-1 border-t border-slate-800/80 space-y-2 bg-slate-950/60 font-mono text-xs">
                            {msg.steps.map((step, sIdx) => (
                              <div key={sIdx} className="flex items-start space-x-2.5 text-[11px]">
                                <div className="mt-0.5 w-2 h-2 rounded-full bg-emerald-400 shrink-0"></div>
                                <div className="flex-1 space-y-1">
                                  <div className="flex items-center justify-between">
                                    <span className="font-bold text-slate-300">{step.name}</span>
                                    {step.executionTimeMs !== undefined && (
                                      <span className="text-[10px] text-amber-400 font-semibold">
                                        {step.executionTimeMs}ms
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-slate-400">{step.detail}</p>
                                  {step.tool && (
                                    <div className="flex items-center space-x-1 text-blue-400 text-[10px]">
                                      <Wrench className="w-3 h-3" />
                                      <span>Tool: {step.tool}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Agent Response Markdown Content */}
                    <div className="whitespace-pre-wrap font-sans text-slate-200 text-[13px] leading-relaxed">
                      {msg.content}
                    </div>

                    {/* Auto-Rendered Structured Query Results Table */}
                    {msg.queryResults && (
                      <ScrollableResultsTable data={msg.queryResults} />
                    )}

                    {/* Suggested openCypher Query Block */}
                    {msg.suggestedCypher && (
                      <div className="mt-3 bg-slate-900/90 border border-slate-800 rounded-xl p-3">
                        <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mb-2">
                          <span className="flex items-center space-x-1 text-amber-400">
                            <Terminal className="w-3.5 h-3.5" />
                            <span>openCypher Tool Query</span>
                          </span>
                          <button
                            onClick={() => copyToClipboard(msg.suggestedCypher!)}
                            className="hover:text-white transition text-[10px]"
                          >
                            Copy Cypher
                          </button>
                        </div>
                        <pre className="font-mono text-xs text-blue-300 bg-slate-950 p-2.5 rounded-lg overflow-x-auto whitespace-pre leading-relaxed border border-slate-800/80">
                          {msg.suggestedCypher}
                        </pre>

                        <div className="mt-2.5 flex items-center space-x-2">
                          {!msg.queryResults && (
                            <button
                              onClick={() => handleExecuteInline(msg.suggestedCypher!, idx)}
                              disabled={executingInlineIdx === idx}
                              className="flex-1 flex items-center justify-center space-x-1.5 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs font-semibold text-slate-200 transition"
                            >
                              {executingInlineIdx === idx ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
                              ) : (
                                <TableIcon className="w-3.5 h-3.5 text-blue-400" />
                              )}
                              <span>{executingInlineIdx === idx ? 'Executing Query...' : 'Execute & View Table'}</span>
                            </button>
                          )}

                          {onExecuteCypher && (
                            <button
                              onClick={() => {
                                onExecuteCypher(msg.suggestedCypher!);
                                onClose();
                              }}
                              className="flex-1 flex items-center justify-center space-x-1.5 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 rounded-lg text-xs font-semibold text-white transition shadow-lg shadow-blue-900/30"
                            >
                              <Play className="w-3.5 h-3.5 fill-current" />
                              <span>Open in Cypher Console</span>
                            </button>
                          )}
                        </div>

                        {/* Inline Results Preview on Manual Execution */}
                        {inlineResults[idx] && !msg.queryResults && (
                          <ScrollableResultsTable data={inlineResults[idx]} />
                        )}
                      </div>
                    )}

                    {/* Agent Action Suggestions */}
                    {msg.suggestedActions && msg.suggestedActions.length > 0 && (
                      <div className="mt-3.5 pt-3 border-t border-slate-800/80 flex flex-wrap gap-2">
                        {msg.suggestedActions.map((action, aIdx) => (
                          <button
                            key={aIdx}
                            onClick={() => handleActionClick(action)}
                            className="px-3 py-1.5 rounded-lg bg-blue-950/80 hover:bg-blue-900 border border-blue-600/40 text-blue-200 text-xs font-semibold flex items-center space-x-1.5 transition shadow-sm hover:scale-[1.02] active:scale-[0.98]"
                          >
                            <span>{action.label}</span>
                            <ArrowRight className="w-3 h-3 text-blue-400" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Agent Active Working State */}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-4 rounded-tl-none flex items-center space-x-3 text-slate-300 text-xs shadow-xl">
                    <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                    <div className="space-y-0.5">
                      <p className="font-bold text-white flex items-center gap-1.5">
                        <span>AML HelperBot is thinking & executing graph tools...</span>
                      </p>
                      <p className="text-[11px] text-slate-400 font-mono">
                        Querying CognoDB Cloud topology (16,110 nodes) & evaluating risk vectors
                      </p>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick Action Prompt Chips */}
            <div className="px-6 py-2.5 bg-slate-950/70 border-t border-slate-800/80 flex items-center space-x-2 overflow-x-auto text-xs scrollbar-thin">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-400" />
                <span>Quick Actions:</span>
              </span>
              {quickPrompts.map((qp, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendMessage(qp.prompt)}
                  className="px-3 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white rounded-lg whitespace-nowrap transition text-xs flex items-center space-x-1"
                >
                  <span>{qp.label}</span>
                </button>
              ))}
            </div>

            {/* Input Bar */}
            <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center space-x-3">
              <button
                onClick={() => setMessages([{
                  role: 'assistant',
                  content: 'Conversation reset. How can I assist your financial crime investigation today?'
                }])}
                title="Reset Agent Conversation"
                className="p-2.5 text-slate-500 hover:text-slate-300 hover:bg-slate-900 rounded-xl transition"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <input
                type="text"
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
                placeholder="Instruct AML HelperBot (e.g., 'Find accounts participating in 5-hop loops', 'Investigate ACC-7401327478')..."
                className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
              />
              <button
                onClick={() => handleSendMessage()}
                disabled={!inputValue.trim() || isLoading}
                className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-white font-medium flex items-center space-x-1.5 transition shadow-lg shadow-blue-500/20"
              >
                <Send className="w-4 h-4" />
                <span>Send</span>
              </button>
            </div>
          </div>
        )}

        {/* Tab 2: SAR Report Generator */}
        {activeTab === 'sar' && (
          <div className="flex-1 flex flex-col min-h-0 p-6 space-y-4 bg-slate-900/40 overflow-y-auto">
            {/* Account Selector & Generator Bar */}
            <div className="glass-panel p-4 rounded-xl border-slate-800 space-y-3">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 flex items-center space-x-3">
                  <ShieldAlert className="w-5 h-5 text-red-400 shrink-0" />
                  <div className="flex-1">
                    <label className="text-xs text-slate-400 font-medium block">
                      Target Account ID for SAR Filing:
                    </label>
                    <input
                      type="text"
                      value={sarAccountId}
                      onChange={e => setSarAccountId(e.target.value)}
                      placeholder="Enter Account ID (e.g. ACC-7401327478 or ACC-8891878216)"
                      className="w-full mt-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white font-mono placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
                <button
                  onClick={() => handleGenerateSAR()}
                  disabled={isGeneratingSAR || !sarAccountId.trim()}
                  className="px-5 py-2.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl flex items-center space-x-2 transition shadow-lg shadow-red-500/20"
                >
                  {isGeneratingSAR ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  <span>{isGeneratingSAR ? 'Synthesizing SAR...' : 'Generate SAR Dossier'}</span>
                </button>
              </div>

              {/* Sample Target Accounts Quick Select */}
              <div className="pt-2 border-t border-slate-800 flex items-center space-x-2 overflow-x-auto text-[11px] scrollbar-thin">
                <span className="text-slate-400 font-medium shrink-0">Sample Targets:</span>
                {SAMPLE_SAR_ACCOUNTS.map((acc, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleGenerateSAR(acc.id)}
                    className={`px-2.5 py-1 rounded-lg border text-xs font-mono shrink-0 transition flex items-center space-x-1.5 ${
                      sarAccountId === acc.id
                        ? 'bg-red-950 border-red-500 text-white'
                        : 'bg-slate-950/80 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <span>{acc.id}</span>
                    <span className="text-[10px] px-1 bg-red-500/20 text-red-400 rounded">
                      {acc.score}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Generated SAR Narrative */}
            {sarReport ? (
              <div className="flex-1 bg-slate-950 border border-slate-800 rounded-xl p-5 overflow-y-auto relative flex flex-col space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800 text-xs">
                  <div className="flex items-center space-x-3">
                    <span className="text-slate-400 font-medium">
                      Target: <strong className="text-white font-mono">{sarReport.accountId}</strong> ({sarReport.holderName})
                    </span>
                    <span className="px-2 py-0.5 bg-red-500/20 text-red-400 rounded-full font-mono text-[10px] font-bold border border-red-500/30">
                      Risk {sarReport.riskScore}/100 ({sarReport.status})
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={handleDownloadSAR}
                      className="px-3 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-slate-200 text-xs flex items-center space-x-1.5 transition"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download .txt</span>
                    </button>
                    <button
                      onClick={() => copyToClipboard(sarReport.sarNarrative)}
                      className="px-3 py-1 bg-blue-600 hover:bg-blue-500 rounded-lg text-white text-xs flex items-center space-x-1.5 transition font-semibold"
                    >
                      {sarCopied ? (
                        <Check className="w-3.5 h-3.5 text-emerald-300" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      <span>{sarCopied ? 'Copied' : 'Copy Narrative'}</span>
                    </button>
                  </div>
                </div>

                <div className="prose prose-invert prose-slate max-w-none text-xs leading-relaxed font-sans text-slate-300 whitespace-pre-wrap flex-1 overflow-y-auto">
                  {sarReport.sarNarrative}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400 space-y-3 bg-slate-950/50 rounded-xl border border-slate-800">
                <FileText className="w-12 h-12 text-slate-600" />
                <h3 className="text-base font-bold text-slate-200">No SAR Dossier Generated Yet</h3>
                <p className="text-xs max-w-md">
                  Select a sample account above or type an account ID, then click <strong>"Generate SAR Dossier"</strong> to produce an automated FinCEN regulatory compliance narrative citing Bank Secrecy Act and FATF recommendations.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Natural Language to Cypher */}
        {activeTab === 'nl2cypher' && (
          <div className="flex-1 flex flex-col min-h-0 p-6 space-y-4 bg-slate-900/40 overflow-y-auto">
            <div className="glass-panel p-4 rounded-xl border-slate-800 space-y-3">
              <label className="text-xs text-slate-300 font-bold block flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>Natural Language to openCypher Translator:</span>
              </label>
              <div className="flex items-center space-x-3">
                <input
                  type="text"
                  value={nlPrompt}
                  onChange={e => setNlPrompt(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleTranslateNL2Cypher()}
                  placeholder="e.g. Find all shell corporations with risk score over 80, or show transfers to Bank-Panama"
                  className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
                />
                <button
                  onClick={() => handleTranslateNL2Cypher()}
                  disabled={isTranslatingNL || !nlPrompt.trim()}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl flex items-center space-x-2 transition shadow-lg shadow-blue-500/20"
                >
                  {isTranslatingNL ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Terminal className="w-4 h-4" />
                  )}
                  <span>{isTranslatingNL ? 'Translating...' : 'Generate Cypher'}</span>
                </button>
              </div>

              {/* Sample NL Prompts */}
              <div className="pt-2 border-t border-slate-800 flex items-center space-x-2 overflow-x-auto text-[11px] scrollbar-thin">
                <span className="text-slate-400 font-medium shrink-0">Try Asking:</span>
                {[
                  'Find offshore shell companies',
                  'Show high volume transfers over 100k',
                  'Detect money loop rings',
                  'Find mule structuring accounts'
                ].map((sample, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setNlPrompt(sample);
                      handleTranslateNL2Cypher(sample);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-slate-950/80 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs shrink-0 transition"
                  >
                    {sample}
                  </button>
                ))}
              </div>
            </div>

            {/* Translation Results & Scrollable Table */}
            {nlResult ? (
              <div className="flex-1 bg-slate-950 border border-slate-800 rounded-xl p-5 overflow-y-auto space-y-4">
                <div>
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Explanation
                  </h4>
                  <p className="text-xs text-slate-200 mt-1 font-sans">
                    {nlResult.explanation}
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="font-mono text-red-400 font-bold uppercase text-[11px]">
                      Generated openCypher Statement
                    </span>
                    <button
                      onClick={() => copyToClipboard(nlResult.cypher)}
                      className="hover:text-white transition flex items-center space-x-1"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Cypher</span>
                    </button>
                  </div>
                  <pre className="p-4 bg-slate-900 border border-slate-800 rounded-xl font-mono text-xs text-emerald-400 overflow-x-auto leading-relaxed shadow-inner">
                    <code>{nlResult.cypher}</code>
                  </pre>
                </div>

                <div className="flex items-center justify-end space-x-3 pt-2">
                  <button
                    onClick={handleExecuteNLCypher}
                    disabled={isExecutingNL}
                    className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-bold text-xs rounded-xl flex items-center space-x-2 transition"
                  >
                    {isExecutingNL ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
                    ) : (
                      <TableIcon className="w-3.5 h-3.5 text-blue-400" />
                    )}
                    <span>{isExecutingNL ? 'Executing Query...' : 'Execute & View Table'}</span>
                  </button>

                  {onExecuteCypher && (
                    <button
                      onClick={() => {
                        onExecuteCypher(nlResult.cypher);
                        onClose();
                      }}
                      className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl flex items-center space-x-2 transition shadow-lg shadow-blue-900/40"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Run in Cypher Console</span>
                    </button>
                  )}
                </div>

                {/* NL Execution Scrollable Results Table */}
                {nlExecutionResult && (
                  <ScrollableResultsTable data={nlExecutionResult} />
                )}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400 space-y-3 bg-slate-950/50 rounded-xl border border-slate-800">
                <Terminal className="w-12 h-12 text-slate-600" />
                <h3 className="text-base font-bold text-slate-200">Natural Language to Cypher</h3>
                <p className="text-xs max-w-md">
                  Type any natural language inquiry regarding AML entities, high-risk bank transfers, or laundering patterns above to automatically generate executable openCypher queries for CognoDB.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
