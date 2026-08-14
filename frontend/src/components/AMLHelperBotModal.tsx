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
  MessageSquare
} from 'lucide-react';
import { api } from '../services/api';
import type { ChatMessage, SARReportResponse, GraphNode } from '../types/aml';

interface AMLHelperBotModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedNode: GraphNode | null;
  onExecuteCypher?: (cypher: string) => void;
}

export const AMLHelperBotModal: React.FC<AMLHelperBotModalProps> = ({
  isOpen,
  onClose,
  selectedNode,
  onExecuteCypher
}) => {
  const [activeTab, setActiveTab] = useState<'chat' | 'sar'>('chat');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: `Hello! I am **AML HelperBot**, your compliance and graph threat intelligence copilot.\n\nI can analyze graph clusters in CognoDB, generate regulatory **FinCEN SAR reports**, explain multi-factor risk scores, or convert natural language questions into optimized openCypher queries.\n\nTry selecting an action below or ask me a question!`
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // SAR Tab State
  const [sarAccountId, setSarAccountId] = useState('');
  const [sarReport, setSarReport] = useState<SARReportResponse | null>(null);
  const [isGeneratingSAR, setIsGeneratingSAR] = useState(false);
  const [sarCopied, setSarCopied] = useState(false);

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
    { label: '🔄 Detect Money Loops', prompt: 'Find all accounts participating in circular money loops' },
    { label: '⚡ Rapid Structuring (<$10k)', prompt: 'Identify smurfing mule aggregators receiving sub-$10k transfers' },
    { label: '🌐 Shared Device/Proxy IPs', prompt: 'Find accounts sharing physical devices or proxy IP addresses' },
    { label: '🛡️ Explain Risk Score', prompt: 'Explain the multi-factor risk scoring formula for accounts' }
  ];

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

      setMessages([
        ...newMessages,
        {
          role: 'assistant',
          content: response.reply,
          suggestedCypher: response.suggestedCypher
        }
      ]);
    } catch (err: any) {
      setMessages([
        ...newMessages,
        {
          role: 'assistant',
          content: `⚠️ Sorry, I encountered an error communicating with the AML Copilot engine: ${err.message}`
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateSAR = async (accId?: string) => {
    const targetId = accId || sarAccountId || (selectedNode ? selectedNode.id : 'ACC-101');
    if (!targetId.trim()) return;

    setIsGeneratingSAR(true);
    try {
      const report = await api.generateSARReport(targetId);
      setSarReport(report);
      setSarAccountId(targetId);
    } catch (err: any) {
      console.error('Failed to generate SAR report:', err);
    } finally {
      setIsGeneratingSAR(false);
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

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 md:p-6 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-4xl h-[680px] flex flex-col shadow-2xl overflow-hidden relative">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-xl shadow-lg shadow-blue-500/20 text-white">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-bold text-white tracking-wide">
                  AML HelperBot
                </h2>
                <span className="flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950/80 text-emerald-400 border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span>AI Copilot Active</span>
                </span>
              </div>
              <p className="text-xs text-slate-400">
                FinCEN SAR Generator & openCypher Natural Language Intelligence
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
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Chat & Cypher</span>
              </button>
              <button
                onClick={() => {
                  setActiveTab('sar');
                  if (!sarReport && (selectedNode || sarAccountId)) {
                    handleGenerateSAR(selectedNode?.id || sarAccountId);
                  }
                }}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg transition font-medium ${
                  activeTab === 'sar'
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>SAR Generator</span>
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

        {/* Tab 1: Chat & NL2Cypher */}
        {activeTab === 'chat' && (
          <div className="flex-1 flex flex-col min-h-0 bg-slate-900/40">
            {/* Message Stream */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl p-4 text-sm leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-blue-600 text-white rounded-tr-none shadow-md'
                        : 'bg-slate-950/80 border border-slate-800 text-slate-200 rounded-tl-none shadow-lg'
                    }`}
                  >
                    {/* Bot Header */}
                    {msg.role === 'assistant' && (
                      <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800/80 text-xs font-bold text-slate-400">
                        <span className="flex items-center space-x-1 text-blue-400">
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>AML HelperBot</span>
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

                    {/* Message Body */}
                    <div className="whitespace-pre-wrap font-sans text-slate-200 text-[13px]">
                      {msg.content}
                    </div>

                    {/* Suggested openCypher Query Block */}
                    {msg.suggestedCypher && (
                      <div className="mt-3 bg-slate-900 border border-slate-800 rounded-xl p-3">
                        <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mb-2">
                          <span className="flex items-center space-x-1 text-amber-400">
                            <Terminal className="w-3.5 h-3.5" />
                            <span>Suggested openCypher Query</span>
                          </span>
                          <button
                            onClick={() => copyToClipboard(msg.suggestedCypher!)}
                            className="hover:text-white transition text-[10px]"
                          >
                            Copy Cypher
                          </button>
                        </div>
                        <pre className="font-mono text-xs text-blue-300 bg-slate-950 p-2.5 rounded-lg overflow-x-auto whitespace-pre">
                          {msg.suggestedCypher}
                        </pre>
                        {onExecuteCypher && (
                          <button
                            onClick={() => {
                              onExecuteCypher(msg.suggestedCypher!);
                              onClose();
                            }}
                            className="mt-2.5 w-full flex items-center justify-center space-x-2 py-1.5 bg-blue-600/30 hover:bg-blue-600 border border-blue-500/50 rounded-lg text-xs font-semibold text-white transition"
                          >
                            <Play className="w-3.5 h-3.5" />
                            <span>Run Query in Console</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 rounded-tl-none flex items-center space-x-3 text-slate-400 text-xs">
                    <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                    <span>AML HelperBot is querying CognoDB & synthesizing compliance insights...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick Action Prompt Chips */}
            <div className="px-6 py-2 bg-slate-950/50 border-t border-slate-800/80 flex items-center space-x-2 overflow-x-auto text-xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider shrink-0">
                Quick Prompts:
              </span>
              {quickPrompts.map((qp, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendMessage(qp.prompt)}
                  className="px-3 py-1 bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white rounded-lg whitespace-nowrap transition text-xs flex items-center space-x-1"
                >
                  <span>{qp.label}</span>
                </button>
              ))}
            </div>

            {/* Input Bar */}
            <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center space-x-3">
              <input
                type="text"
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
                placeholder="Ask AML HelperBot to investigate an entity, convert a query to Cypher, or explain a threat..."
                className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
              />
              <button
                onClick={() => handleSendMessage()}
                disabled={!inputValue.trim() || isLoading}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-white font-medium flex items-center space-x-1.5 transition shadow-lg shadow-blue-500/20"
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
            <div className="glass-panel p-4 rounded-xl border-slate-800 flex items-center justify-between gap-4">
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
                    placeholder="Enter Account ID (e.g. ACC-7401327478 or ACC-101)"
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

            {/* Generated SAR Narrative */}
            {sarReport ? (
              <div className="flex-1 bg-slate-950 border border-slate-800 rounded-xl p-5 overflow-y-auto relative">
                <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800 text-xs">
                  <span className="text-slate-400 font-medium">
                    Engine: <strong className="text-blue-400">{sarReport.generatedBy}</strong> ({sarReport.executionTimeMs}ms)
                  </span>
                  <button
                    onClick={() => copyToClipboard(sarReport.sarNarrative)}
                    className="px-3 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-slate-200 text-xs flex items-center space-x-1.5 transition"
                  >
                    {sarCopied ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>{sarCopied ? 'Copied to Clipboard' : 'Copy Regulatory Report'}</span>
                  </button>
                </div>

                <div className="prose prose-invert prose-slate max-w-none text-xs leading-relaxed font-sans text-slate-300 whitespace-pre-wrap">
                  {sarReport.sarNarrative}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400 space-y-3">
                <FileText className="w-12 h-12 text-slate-600" />
                <h3 className="text-base font-bold text-slate-200">No SAR Dossier Generated Yet</h3>
                <p className="text-xs max-w-md">
                  Select an account from the graph or type an account ID above, then click <strong>"Generate SAR Dossier"</strong> to produce an automated FinCEN regulatory compliance report.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
