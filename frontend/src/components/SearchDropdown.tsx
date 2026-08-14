import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X, Loader2, ShieldAlert, Clock } from 'lucide-react';
import { api } from '../services/api';
import type { SearchAccountResult, QueryDetails } from '../types/aml';

interface SearchDropdownProps {
  onSelectAccount: (account: SearchAccountResult, queryDetails?: QueryDetails) => void;
  onOpenInspector: () => void;
}

export const SearchDropdown: React.FC<SearchDropdownProps> = ({
  onSelectAccount,
  onOpenInspector
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchAccountResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const [lastQueryDetails, setLastQueryDetails] = useState<QueryDetails | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<number | null>(null);

  // Debounced search query
  const performSearch = useCallback(async (searchTerm: string) => {
    setLoading(true);
    try {
      const res = await api.searchAccounts(searchTerm);
      setResults(res.results || []);
      setLastQueryDetails(res.queryDetails);
      setSelectedIndex(-1);
    } catch (err) {
      console.error('Search query failed:', err);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Handle Input Changes with 200ms debounce
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    setIsOpen(true);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = window.setTimeout(() => {
      performSearch(value.trim());
    }, 200);
  };

  // Focus handler: open dropdown and fetch initial suggestions if empty
  const handleFocus = () => {
    setIsOpen(true);
    if (results.length === 0) {
      performSearch(query.trim());
    }
  };

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Keyboard navigation (ArrowDown, ArrowUp, Enter, Escape)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true);
        performSearch(query.trim());
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < results.length) {
        handleSelect(results[selectedIndex]);
      } else if (results.length > 0) {
        handleSelect(results[0]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      inputRef.current?.blur();
    }
  };

  const handleSelect = (account: SearchAccountResult) => {
    onSelectAccount(account, lastQueryDetails || undefined);
    setIsOpen(false);
  };

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setSelectedIndex(-1);
    inputRef.current?.focus();
    performSearch('');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'FLAGGED':
      case 'SUSPENDED':
        return 'bg-red-950/80 text-red-400 border-red-500/40';
      case 'SUSPICIOUS':
        return 'bg-amber-950/80 text-amber-400 border-amber-500/40';
      case 'NORMAL':
      default:
        return 'bg-emerald-950/80 text-emerald-400 border-emerald-500/40';
    }
  };

  return (
    <div ref={containerRef} className="relative w-80 max-w-sm">
      {/* Search Input Bar */}
      <div className="relative flex items-center">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          placeholder="Search Account ID or Holder..."
          className="w-full bg-slate-900/90 text-xs text-slate-100 placeholder-slate-500 pl-9 pr-14 py-2 rounded-xl border border-slate-700/80 focus:outline-none focus:border-red-500/80 focus:ring-2 focus:ring-red-500/20 shadow-inner transition font-medium"
        />
        
        {/* Left Search Icon or Loading Spinner */}
        <div className="absolute left-2.5 flex items-center pointer-events-none">
          {loading ? (
            <Loader2 className="w-4 h-4 text-red-400 animate-spin" />
          ) : (
            <Search className="w-4 h-4 text-slate-400" />
          )}
        </div>

        {/* Right Controls: Clear Button & Key Hint */}
        <div className="absolute right-2 flex items-center space-x-1">
          {query && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
              title="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono border border-slate-700/50">
            ESC
          </span>
        </div>
      </div>

      {/* Interactive Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-2 z-50 bg-slate-900/95 backdrop-blur-xl border border-slate-700/90 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Header Bar */}
          <div className="px-3.5 py-2 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between text-[11px] text-slate-400">
            <span className="font-semibold text-slate-300">
              {loading
                ? 'Searching CognoDB...'
                : results.length > 0
                ? `Available Matches (${results.length})`
                : 'No Matches'}
            </span>
            {lastQueryDetails && (
              <button
                type="button"
                onClick={onOpenInspector}
                className="flex items-center space-x-1 text-amber-400 hover:text-amber-300 transition"
                title="View Cypher query"
              >
                <Clock className="w-3 h-3" />
                <span className="font-mono text-[10px]">{lastQueryDetails.executionTimeMs}ms</span>
              </button>
            )}
          </div>

          {/* Results List */}
          <div className="max-h-72 overflow-y-auto divide-y divide-slate-800/60">
            {loading && results.length === 0 ? (
              <div className="p-4 text-center space-y-2">
                <Loader2 className="w-5 h-5 text-red-500 animate-spin mx-auto" />
                <p className="text-xs text-slate-400">Executing openCypher match...</p>
              </div>
            ) : results.length > 0 ? (
              results.map((acc, index) => {
                const isSelected = index === selectedIndex;
                const isHighRisk = acc.riskScore >= 75;

                return (
                  <div
                    key={acc.id}
                    onClick={() => handleSelect(acc)}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={`px-3.5 py-2.5 cursor-pointer flex items-center justify-between transition group ${
                      isSelected ? 'bg-red-500/10 border-l-2 border-red-500' : 'hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="flex items-center space-x-3 min-w-0">
                      {/* Risk Icon / Status Dot */}
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center border shrink-0 ${
                          isHighRisk
                            ? 'bg-red-950/80 border-red-500/40 text-red-400'
                            : 'bg-slate-800 border-slate-700 text-slate-300'
                        }`}
                      >
                        <ShieldAlert className="w-4 h-4" />
                      </div>

                      {/* Account Info */}
                      <div className="min-w-0">
                        <div className="flex items-center space-x-2">
                          <p className="text-xs font-semibold text-white truncate group-hover:text-red-400 transition">
                            {acc.holderName}
                          </p>
                          <span
                            className={`text-[9px] px-1.5 py-0.2 rounded font-bold border ${getStatusBadge(
                              acc.status
                            )}`}
                          >
                            {acc.status}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2 text-[11px] text-slate-400 font-mono mt-0.5">
                          <span>{acc.id}</span>
                          <span>•</span>
                          <span className="text-slate-500">{acc.type}</span>
                        </div>
                      </div>
                    </div>

                    {/* Right Meta: Risk & Balance */}
                    <div className="text-right shrink-0 ml-3">
                      <div className="flex items-center justify-end space-x-1">
                        <span className="text-[10px] text-slate-400">Risk:</span>
                        <span
                          className={`text-xs font-bold font-mono ${
                            isHighRisk ? 'text-red-400' : 'text-emerald-400'
                          }`}
                        >
                          {acc.riskScore}
                        </span>
                      </div>
                      {acc.balance !== undefined && (
                        <p className="text-[10px] font-mono text-slate-400 mt-0.5">
                          ${acc.balance.toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="p-5 text-center space-y-1.5">
                <p className="text-xs text-slate-300 font-medium">
                  No accounts found for <span className="text-red-400">"{query}"</span>
                </p>
                <p className="text-[11px] text-slate-500">
                  Try searching by ID (e.g. <span className="font-mono text-slate-400">ACC-101</span>) or name
                </p>
              </div>
            )}
          </div>

          {/* Dropdown Footer */}
          <div className="px-3.5 py-2 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-[10px] text-slate-400">
            <span className="flex items-center space-x-1">
              <span>Press</span>
              <kbd className="px-1 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">↵</kbd>
              <span>to select</span>
            </span>
            <span className="text-slate-500 font-mono">CognoDB openCypher</span>
          </div>
        </div>
      )}
    </div>
  );
};
