import React from 'react';

export const LoadingSkeleton: React.FC = () => {
  return (
    <div className="w-full h-[620px] bg-slate-950/80 rounded-2xl border border-slate-800 p-8 flex flex-col justify-between skeleton-shimmer">
      <div className="flex justify-between items-center">
        <div className="w-48 h-8 bg-slate-800/60 rounded-xl" />
        <div className="w-32 h-8 bg-slate-800/60 rounded-xl" />
      </div>
      <div className="flex justify-center items-center h-full">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 rounded-full border-2 border-red-500 border-t-transparent animate-spin mx-auto" />
          <p className="text-xs text-slate-400 font-mono animate-pulse">
            Executing openCypher Graph Traversal against CognoDB Cloud...
          </p>
        </div>
      </div>
      <div className="flex justify-between items-center">
        <div className="w-64 h-6 bg-slate-800/60 rounded-xl" />
        <div className="w-24 h-6 bg-slate-800/60 rounded-xl" />
      </div>
    </div>
  );
};
