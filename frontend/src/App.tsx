import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { MetricCards } from './components/MetricCards';
import { GraphCanvas } from './components/GraphCanvas';
import { NodeDetailsPanel } from './components/NodeDetailsPanel';
import { FraudDetectorControls } from './components/FraudDetectorControls';
import { CypherInspector } from './components/CypherInspector';
import { LoadingSkeleton } from './components/LoadingSkeleton';
import { api } from './services/api';
import type {
  ConnectionStatus,
  OverviewStats,
  GraphData,
  GraphNode,
  QueryDetails,
  MoneyLoopResponse,
  SharedInfraResponse,
  SmurfingResponse
} from './types/aml';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

export const App: React.FC = () => {
  // App State
  const [connection, setConnection] = useState<ConnectionStatus | null>(null);
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] });
  const [loading, setLoading] = useState(true);

  // Selection & Inspector State
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [highlightedNodeIds, setHighlightedNodeIds] = useState<string[]>([]);
  const [highlightedLinkIds, setHighlightedLinkIds] = useState<string[]>([]);

  // Detector State
  const [activeDetector, setActiveDetector] = useState<'LOOPS' | 'INFRA' | 'SMURFING' | null>(null);
  const [detectorName, setDetectorName] = useState<string | null>(null);
  const [detectedCount, setDetectedCount] = useState(0);

  // Inspector & Toast State
  const [activeQuery, setActiveQuery] = useState<QueryDetails | null>(null);
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'info' | 'error' | 'success' } | null>(null);

  const showToast = (message: string, type: 'info' | 'error' | 'success' = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Initial Data Loading
  const loadInitialData = useCallback(async () => {
    setLoading(true);
    try {
      const [healthRes, statsRes, graphRes] = await Promise.all([
        api.getHealth(),
        api.getDashboardStats(),
        api.getFullGraph()
      ]);

      setConnection(healthRes);
      setStats(statsRes.stats);
      setGraphData(graphRes.graph);
      setActiveQuery(graphRes.queryDetails);

      if (healthRes.status === 'ONLINE') {
        showToast('Connected to CognoDB Cloud over Bolt Protocol', 'success');
      } else {
        showToast('Running in High-Fidelity Standby Demo Engine', 'info');
      }
    } catch (err: any) {
      console.error('Error loading initial data:', err);
      showToast('Backend unreachable. Running fallback engine.', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Handler 1: Search Accounts
  const handleSearch = async (term: string) => {
    try {
      const res = await api.searchAccounts(term);
      setActiveQuery(res.queryDetails);
      if (res.results.length > 0) {
        const foundId = res.results[0].id;
        const matchingNode = graphData.nodes.find(n => n.id === foundId);
        if (matchingNode) {
          setSelectedNode(matchingNode);
          showToast(`Found account: ${matchingNode.holderName}`, 'success');
        } else {
          // Fetch neighborhood for search result
          handleExpandNeighborhood(foundId);
        }
      } else {
        showToast(`No accounts matching "${term}"`, 'info');
      }
    } catch (err) {
      showToast('Search query failed', 'error');
    }
  };

  // Handler 2: Expand 1-2 Hop Neighborhood
  const handleExpandNeighborhood = async (accountId: string) => {
    setLoading(true);
    try {
      const res = await api.getNeighborhood(accountId);
      setGraphData(res.graph);
      setActiveQuery(res.queryDetails);

      const target = res.graph.nodes.find(n => n.id === accountId);
      if (target) setSelectedNode(target);

      showToast(`Loaded 1-2 Hop Neighborhood for ${accountId}`, 'success');
    } catch (err) {
      showToast(`Failed to load neighborhood for ${accountId}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Handler 3: Detect Money Loops (2-4 Hop Circular Traversal)
  const handleRunMoneyLoops = async () => {
    setLoading(true);
    try {
      const res: MoneyLoopResponse = await api.detectMoneyLoops();
      setActiveDetector('LOOPS');
      setDetectorName(res.detector);
      setDetectedCount(res.detectedCount);
      setActiveQuery(res.queryDetails);

      // Collect all node IDs involved in circular loops
      const loopNodeIds = new Set<string>();
      res.loops.forEach(loop => {
        loop.nodeIds.forEach(id => loopNodeIds.add(id));
      });

      setHighlightedNodeIds(Array.from(loopNodeIds));
      showToast(`Detected ${res.detectedCount} Circular Money Loop(s)!`, 'success');
    } catch (err) {
      showToast('Failed to run Money Loop detector', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Handler 4: Analyze Shared Infrastructure
  const handleRunSharedInfra = async () => {
    setLoading(true);
    try {
      const res: SharedInfraResponse = await api.analyzeSharedInfra();
      setActiveDetector('INFRA');
      setDetectorName(res.detector);
      setDetectedCount(res.detectedCount);
      setActiveQuery(res.queryDetails);

      const infraNodeIds = new Set<string>();
      res.sharedRings.forEach(ring => {
        infraNodeIds.add(ring.account1Id);
        infraNodeIds.add(ring.account2Id);
        infraNodeIds.add(ring.infraId);
      });

      setHighlightedNodeIds(Array.from(infraNodeIds));
      showToast(`Found ${res.detectedCount} Shared Device/IP Ring(s)!`, 'success');
    } catch (err) {
      showToast('Failed to analyze shared infrastructure', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Handler 5: Smurfing / Structuring Alert
  const handleRunSmurfing = async () => {
    setLoading(true);
    try {
      const res: SmurfingResponse = await api.detectSmurfing();
      setActiveDetector('SMURFING');
      setDetectorName(res.detector);
      setDetectedCount(res.detectedCount);
      setActiveQuery(res.queryDetails);

      const smurfNodeIds = new Set<string>();
      res.smurfingRings.forEach(ring => {
        smurfNodeIds.add(ring.muleAccountId);
      });

      setHighlightedNodeIds(Array.from(smurfNodeIds));
      showToast(`Detected ${res.detectedCount} Structuring Mule Ring(s)!`, 'success');
    } catch (err) {
      showToast('Failed to run Smurfing detector', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Reset Filters & Load Full Topology
  const handleReset = () => {
    setActiveDetector(null);
    setDetectorName(null);
    setDetectedCount(0);
    setHighlightedNodeIds([]);
    setHighlightedLinkIds([]);
    setSelectedNode(null);
    loadInitialData();
  };

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex flex-col selection:bg-red-500 selection:text-white">
      {/* Toast Notification Banner */}
      {toast && (
        <div className={`fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl text-xs font-medium border shadow-2xl flex items-center space-x-2 animate-in fade-in duration-200 ${
          toast.type === 'error' ? 'bg-red-950/90 text-red-300 border-red-500/50' :
          toast.type === 'success' ? 'bg-emerald-950/90 text-emerald-300 border-emerald-500/50' :
          'bg-slate-900/90 text-slate-200 border-slate-700'
        }`}>
          {toast.type === 'error' ? <AlertCircle className="w-4 h-4 text-red-400" /> : <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header Bar */}
      <Header
        connection={connection}
        activeQuery={activeQuery}
        onOpenInspector={() => setIsInspectorOpen(true)}
        onSearch={handleSearch}
        onResetGraph={handleReset}
      />

      {/* Metric Cards Banner */}
      <MetricCards
        stats={stats}
        activeDetectorName={detectorName}
        detectedCount={detectedCount}
      />

      {/* Main Graph Canvas Area */}
      <main className="flex-1 px-6 py-4 flex flex-col space-y-4">
        {loading && graphData.nodes.length === 0 ? (
          <LoadingSkeleton />
        ) : (
          <GraphCanvas
            data={graphData}
            selectedNode={selectedNode}
            highlightedNodeIds={highlightedNodeIds}
            highlightedLinkIds={highlightedLinkIds}
            onSelectNode={(node) => setSelectedNode(node)}
            onExpandNeighborhood={handleExpandNeighborhood}
          />
        )}

        {/* Floating Fraud Detector Command Deck */}
        <FraudDetectorControls
          activeDetector={activeDetector}
          loading={loading}
          onRunMoneyLoops={handleRunMoneyLoops}
          onRunSharedInfra={handleRunSharedInfra}
          onRunSmurfing={handleRunSmurfing}
          onReset={handleReset}
        />
      </main>

      {/* Slide-over Node Inspector Drawer */}
      <NodeDetailsPanel
        node={selectedNode}
        onClose={() => setSelectedNode(null)}
        onExpandNeighborhood={handleExpandNeighborhood}
        onStatusChanged={loadInitialData}
      />

      {/* openCypher Query Inspector Modal */}
      <CypherInspector
        queryDetails={activeQuery}
        isOpen={isInspectorOpen}
        onClose={() => setIsInspectorOpen(false)}
      />
    </div>
  );
};

export default App;
