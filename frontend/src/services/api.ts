import type {
  OverviewStats,
  ConnectionStatus,
  GraphData,
  QueryDetails,
  MoneyLoopResponse,
  SharedInfraResponse,
  SmurfingResponse,
  AccountDetailsResponse,
  ChatMessage,
  SARReportResponse,
  HelperBotChatResponse,
  NL2CypherResponse
} from '../types/aml';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

async function fetchJson<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  } catch (err: any) {
    console.error(`API Request failed [${endpoint}]:`, err);
    throw err;
  }
}

export const api = {
  getHealth: (): Promise<ConnectionStatus> => fetchJson('/overview/health'),

  getDashboardStats: (): Promise<{ stats: OverviewStats; queryDetails: QueryDetails }> =>
    fetchJson('/overview/stats'),

  searchAccounts: (q: string): Promise<{ results: any[]; count: number; queryDetails: QueryDetails }> =>
    fetchJson(`/overview/search?q=${encodeURIComponent(q)}`),

  getFullGraph: (): Promise<{ graph: GraphData; queryDetails: QueryDetails }> =>
    fetchJson('/graph/full'),

  getNeighborhood: (accountId: string): Promise<{ accountId: string; graph: GraphData; queryDetails: QueryDetails }> =>
    fetchJson(`/graph/neighborhood/${encodeURIComponent(accountId)}`),

  detectMoneyLoops: (): Promise<MoneyLoopResponse> =>
    fetchJson('/detectors/money-loops', { method: 'POST' }),

  analyzeSharedInfra: (): Promise<SharedInfraResponse> =>
    fetchJson('/detectors/shared-infra', { method: 'POST' }),

  detectSmurfing: (): Promise<SmurfingResponse> =>
    fetchJson('/detectors/smurfing', { method: 'POST' }),

  getAccountDetails: (accountId: string): Promise<AccountDetailsResponse> =>
    fetchJson(`/accounts/${encodeURIComponent(accountId)}`),

  updateAccountStatus: (accountId: string, status: string): Promise<{ message: string; result: any }> =>
    fetchJson(`/accounts/${encodeURIComponent(accountId)}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    }),

  // AML HelperBot Endpoints
  generateSARReport: (accountId: string): Promise<SARReportResponse> =>
    fetchJson('/copilot/sar', {
      method: 'POST',
      body: JSON.stringify({ accountId })
    }),

  chatWithHelperBot: (message: string, history?: ChatMessage[], contextAccountId?: string): Promise<HelperBotChatResponse> =>
    fetchJson('/copilot/chat', {
      method: 'POST',
      body: JSON.stringify({ message, history, contextAccountId })
    }),

  translateNLToCypher: (prompt: string): Promise<NL2CypherResponse> =>
    fetchJson('/copilot/nl2cypher', {
      method: 'POST',
      body: JSON.stringify({ prompt })
    }),

  recalculateRiskScores: (): Promise<{ message: string; result: any }> =>
    fetchJson('/overview/recalculate-risk', { method: 'POST' })
};
