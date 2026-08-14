import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3-force';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import type { GraphData, GraphNode, GraphLink } from '../types/aml';

interface GraphCanvasProps {
  data: GraphData;
  selectedNode: GraphNode | null;
  highlightedNodeIds: string[];
  highlightedLinkIds: string[];
  onSelectNode: (node: GraphNode) => void;
  onExpandNeighborhood: (nodeId: string) => void;
}

export const GraphCanvas: React.FC<GraphCanvasProps> = ({
  data,
  selectedNode,
  highlightedNodeIds,
  highlightedLinkIds,
  onSelectNode,
  onExpandNeighborhood
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Simulation & Canvas State
  const simulationRef = useRef<d3.Simulation<GraphNode, GraphLink> | null>(null);
  const transformRef = useRef({ x: 0, y: 0, k: 1 });
  const isDraggingRef = useRef(false);
  const dragNodeRef = useRef<GraphNode | null>(null);
  const lastMousePosRef = useRef({ x: 0, y: 0 });
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);

  // Helper: Node Color Mapping based on risk status and label
  const getNodeColor = (node: GraphNode): string => {
    if (node.label === 'Device' || node.label === 'IPAddress') {
      return node.isProxy ? '#a855f7' : '#3b82f6'; // Purple for Proxy IP, Blue for Device
    }
    switch (node.status) {
      case 'FLAGGED':
      case 'SUSPENDED':
        return '#ef4444'; // Red
      case 'SUSPICIOUS':
        return '#f59e0b'; // Yellow
      case 'NORMAL':
      default:
        return '#10b981'; // Green
    }
  };

  // Helper: Node Radius based on Risk Score
  const getNodeRadius = (node: GraphNode): number => {
    if (node.label === 'Device' || node.label === 'IPAddress') return 12;
    const base = 12;
    const bonus = Math.min((node.riskScore || 0) / 10, 10);
    return base + bonus;
  };

  // Helper: Clean and concise account name formatter (Strictly Account Names, No Raw Account Numbers)
  const formatDisplayName = (node: GraphNode): string => {
    // 1. Infrastructure Labels
    if (node.label === 'Device') return node.deviceId ? `Device ${node.deviceId}` : 'Hardware Hub';
    if (node.label === 'IPAddress') return node.ip ? `IP: ${node.ip}` : 'Proxy IP';

    let name = node.holderName || '';

    // 2. Named Entity (e.g. Apex Global Capital, Shell Corp Alpha, Bank-UK Business)
    if (name && !name.startsWith('Account ACC-')) {
      return name.length > 22 ? name.substring(0, 20) + '…' : name;
    }

    // 3. Transform boilerplate "Account ACC-..." into understandable real account name
    const bankMatch = name.match(/\((Bank-[^)]+)\)/);
    const bank = bankMatch ? bankMatch[1] : 'Commercial';
    const type = node.type && node.type !== 'UNKNOWN' ? node.type : (node.status === 'FLAGGED' ? 'Shell' : 'Corporate');
    const typeLabel = type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();

    return `${bank} ${typeLabel}`;
  };

  // Setup D3 Force Simulation & Render Loop
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    const width = containerRef.current.clientWidth || 1100;
    const height = containerRef.current.clientHeight || 620;
    const dpr = window.devicePixelRatio || 1;

    // Set HiDPI canvas backing store once
    const canvas = canvasRef.current;
    canvas.width = width * dpr;
    canvas.height = height * dpr;

    // Reset center transform
    transformRef.current = { x: width / 2, y: height / 2, k: 0.9 };

    // Deep clone data to avoid mutating original props in D3
    const nodes: GraphNode[] = data.nodes.map(n => ({ ...n }));
    const links: GraphLink[] = data.links.map(l => ({ ...l }));

    const sim = d3.forceSimulation<GraphNode>(nodes)
      .force('link', d3.forceLink<GraphNode, GraphLink>(links).id(d => d.id).distance(180))
      .force('charge', d3.forceManyBody().strength(-600))
      .force('center', d3.forceCenter(0, 0))
      .force('collide', d3.forceCollide<GraphNode>().radius(d => getNodeRadius(d) + 32))
      .alphaDecay(0.02);

    simulationRef.current = sim;

    // Particle Animation timer for money transfer edges
    let particleOffset = 0;
    let animationFrameId: number;

    const render = () => {
      if (!canvasRef.current) return;
      const ctx = canvasRef.current.getContext('2d');
      if (!ctx) return;

      const curWidth = (containerRef.current?.clientWidth || width);
      const curHeight = (containerRef.current?.clientHeight || height);

      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, curWidth, curHeight);

      const { x: tx, y: ty, k: tk } = transformRef.current;
      ctx.translate(tx, ty);
      ctx.scale(tk, tk);

      particleOffset = (particleOffset + 0.8) % 30;

      // 1. Draw Links / Relationships
      links.forEach(link => {
        const source = link.source as GraphNode;
        const target = link.target as GraphNode;
        if (!source.x || !source.y || !target.x || !target.y) return;

        const isHighlighted = highlightedLinkIds.includes(link.id) ||
          (highlightedNodeIds.includes(source.id) && highlightedNodeIds.includes(target.id));

        ctx.beginPath();
        ctx.moveTo(source.x, source.y);
        ctx.lineTo(target.x, target.y);

        if (isHighlighted) {
          ctx.strokeStyle = '#f43f5e'; // Highlighted Fraud Loop Path
          ctx.lineWidth = 3.5;
        } else if (link.isLaundering) {
          ctx.strokeStyle = 'rgba(239, 68, 68, 0.65)';
          ctx.lineWidth = 2.2;
        } else {
          ctx.strokeStyle = 'rgba(71, 85, 105, 0.35)';
          ctx.lineWidth = 1.2;
        }

        ctx.stroke();

        // Draw Edge Transfer Flow Particles (Animated Dots)
        if (link.type === 'TRANSFERRED') {
          const dx = target.x - source.x;
          const dy = target.y - source.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > 0) {
            const normX = dx / dist;
            const normY = dy / dist;
            ctx.fillStyle = isHighlighted ? '#fda4af' : link.isLaundering ? '#ef4444' : '#38bdf8';

            for (let d = particleOffset; d < dist - 15; d += 45) {
              const px = source.x + normX * d;
              const py = source.y + normY * d;
              ctx.beginPath();
              ctx.arc(px, py, isHighlighted ? 3 : 1.8, 0, 2 * Math.PI);
              ctx.fill();
            }
          }
        }
      });

      // 2. Draw Nodes
      nodes.forEach(node => {
        if (!node.x || !node.y) return;

        const radius = getNodeRadius(node);
        const color = getNodeColor(node);
        const isSelected = selectedNode?.id === node.id;
        const isHighlighted = highlightedNodeIds.includes(node.id);
        const isHighRisk = (node.riskScore || 0) >= 70 || node.status === 'FLAGGED' || node.status === 'SUSPENDED';

        // Draw Outer Glowing Halo for Selected or Highlighted Nodes
        if (isSelected || isHighlighted) {
          ctx.beginPath();
          ctx.arc(node.x, node.y, radius + (isSelected ? 8 : 5), 0, 2 * Math.PI);
          ctx.fillStyle = isSelected ? 'rgba(59, 130, 246, 0.35)' : 'rgba(239, 68, 68, 0.35)';
          ctx.fill();
          ctx.lineWidth = 2;
          ctx.strokeStyle = isSelected ? '#60a5fa' : '#f87171';
          ctx.stroke();
        }

        // Draw Core Node Circle
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#0f172a';
        ctx.stroke();

        // Node Label Text (Decluttered, only concise name with dark pill)
        const shouldShowLabel = tk >= 0.5 || isSelected || isHighlighted || isHighRisk;
        if (shouldShowLabel) {
          const displayName = formatDisplayName(node);
          ctx.font = `${isSelected ? 'bold 11px' : '10px'} system-ui, -apple-system, sans-serif`;
          const textWidth = ctx.measureText(displayName).width;
          const labelY = node.y + radius + 13;

          // Background pill
          ctx.fillStyle = isSelected ? 'rgba(15, 23, 42, 0.95)' : 'rgba(15, 23, 42, 0.8)';
          ctx.beginPath();
          ctx.roundRect ? ctx.roundRect(node.x - textWidth / 2 - 4, labelY - 9, textWidth + 8, 14, 4) :
            ctx.rect(node.x - textWidth / 2 - 4, labelY - 9, textWidth + 8, 14);
          ctx.fill();

          // Text fill
          ctx.fillStyle = isSelected ? '#ffffff' : isHighRisk ? '#fca5a5' : '#cbd5e1';
          ctx.textAlign = 'center';
          ctx.fillText(displayName, node.x, labelY + 2);
        }
      });

      ctx.restore();
      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      sim.stop();
      cancelAnimationFrame(animationFrameId);
    };
  }, [data, selectedNode, highlightedNodeIds, highlightedLinkIds]);

  // Canvas Mouse & Drag Interaction Event Handlers
  const getCanvasMousePos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const screenToWorld = (screenX: number, screenY: number) => {
    const { x: tx, y: ty, k: tk } = transformRef.current;
    return {
      x: (screenX - tx) / tk,
      y: (screenY - ty) / tk
    };
  };

  const findNodeAtPosition = (worldX: number, worldY: number): GraphNode | null => {
    if (!simulationRef.current) return null;
    const nodes = simulationRef.current.nodes();
    for (let i = nodes.length - 1; i >= 0; i--) {
      const node = nodes[i];
      if (node.x && node.y) {
        const dx = worldX - node.x;
        const dy = worldY - node.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist <= getNodeRadius(node) + 5) {
          return node;
        }
      }
    }
    return null;
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getCanvasMousePos(e);
    lastMousePosRef.current = pos;
    const world = screenToWorld(pos.x, pos.y);
    const clickedNode = findNodeAtPosition(world.x, world.y);

    if (clickedNode) {
      isDraggingRef.current = true;
      dragNodeRef.current = clickedNode;
      clickedNode.fx = clickedNode.x;
      clickedNode.fy = clickedNode.y;
      onSelectNode(clickedNode);
    } else {
      isDraggingRef.current = true;
      dragNodeRef.current = null;
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getCanvasMousePos(e);
    const world = screenToWorld(pos.x, pos.y);
    const nodeUnderMouse = findNodeAtPosition(world.x, world.y);
    setHoveredNode(nodeUnderMouse);

    if (!isDraggingRef.current) return;

    const dx = pos.x - lastMousePosRef.current.x;
    const dy = pos.y - lastMousePosRef.current.y;
    lastMousePosRef.current = pos;

    if (dragNodeRef.current) {
      dragNodeRef.current.fx = (dragNodeRef.current.fx || 0) + dx / transformRef.current.k;
      dragNodeRef.current.fy = (dragNodeRef.current.fy || 0) + dy / transformRef.current.k;
      simulationRef.current?.alpha(0.3).restart();
    } else {
      // Pan canvas
      transformRef.current.x += dx;
      transformRef.current.y += dy;
    }
  };

  const handleMouseUp = () => {
    if (dragNodeRef.current) {
      dragNodeRef.current.fx = null;
      dragNodeRef.current.fy = null;
      dragNodeRef.current = null;
    }
    isDraggingRef.current = false;
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    const pos = getCanvasMousePos(e);

    const newK = Math.max(0.2, Math.min(4, transformRef.current.k * zoomFactor));
    const wx = (pos.x - transformRef.current.x) / transformRef.current.k;
    const wy = (pos.y - transformRef.current.y) / transformRef.current.k;

    transformRef.current.k = newK;
    transformRef.current.x = pos.x - wx * newK;
    transformRef.current.y = pos.y - wy * newK;
  };

  const handleDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getCanvasMousePos(e);
    const world = screenToWorld(pos.x, pos.y);
    const targetNode = findNodeAtPosition(world.x, world.y);
    if (targetNode && targetNode.label === 'Account') {
      onExpandNeighborhood(targetNode.id);
    }
  };

  const handleZoomIn = () => {
    transformRef.current.k = Math.min(4, transformRef.current.k * 1.25);
  };

  const handleZoomOut = () => {
    transformRef.current.k = Math.max(0.2, transformRef.current.k * 0.8);
  };

  const handleResetView = () => {
    if (!containerRef.current) return;
    transformRef.current = {
      x: containerRef.current.clientWidth / 2,
      y: containerRef.current.clientHeight / 2,
      k: 1
    };
    simulationRef.current?.alpha(0.5).restart();
  };

  return (
    <div ref={containerRef} className="relative w-full h-[620px] bg-slate-950/80 rounded-2xl border border-slate-800/80 overflow-hidden shadow-2xl">
      {/* Canvas */}
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        onDoubleClick={handleDoubleClick}
        className="w-full h-full cursor-grab active:cursor-grabbing"
      />

      {/* Floating Zoom & Control Palette */}
      <div className="absolute bottom-4 right-4 flex flex-col space-y-2 glass-panel p-1.5 rounded-xl">
        <button
          onClick={handleZoomIn}
          className="p-2 hover:bg-slate-800 rounded-lg text-slate-300 transition"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={handleZoomOut}
          className="p-2 hover:bg-slate-800 rounded-lg text-slate-300 transition"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={handleResetView}
          className="p-2 hover:bg-slate-800 rounded-lg text-slate-300 transition"
          title="Center Graph"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>

      {/* Interactive Legend Bar */}
      <div className="absolute top-4 left-4 glass-panel px-3 py-2 rounded-xl flex items-center space-x-4 text-xs font-medium text-slate-300">
        <div className="flex items-center space-x-1.5">
          <span className="w-3 h-3 rounded-full bg-red-500 shadow-sm shadow-red-500/50" />
          <span>Flagged / Suspended</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <span className="w-3 h-3 rounded-full bg-amber-500" />
          <span>Suspicious</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <span className="w-3 h-3 rounded-full bg-emerald-500" />
          <span>Normal</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <span className="w-3 h-3 rounded-full bg-blue-500" />
          <span>Device / IP Hub</span>
        </div>
      </div>

      {/* Hover Card Tooltip */}
      {hoveredNode && (
        <div className="absolute top-4 right-4 glass-panel p-3 rounded-xl max-w-xs text-xs pointer-events-none border-slate-700 shadow-2xl">
          <div className="flex items-center justify-between gap-2">
            <span className="font-bold text-white text-sm">{hoveredNode.holderName}</span>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
              hoveredNode.status === 'FLAGGED' || hoveredNode.status === 'SUSPENDED' ? 'bg-red-500/20 text-red-400' :
              hoveredNode.status === 'SUSPICIOUS' ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'
            }`}>
              {hoveredNode.status}
            </span>
          </div>
          <p className="text-slate-400 mt-1">ID: <span className="font-mono text-slate-200">{hoveredNode.id}</span></p>
          {hoveredNode.label === 'Account' && (
            <div className="mt-2 flex items-center justify-between text-[11px] text-slate-300 pt-2 border-t border-slate-800">
              <span>Risk Score: <strong className="text-red-400">{hoveredNode.riskScore}/100</strong></span>
              <span>Balance: <strong>${hoveredNode.balance?.toLocaleString()}</strong></span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
