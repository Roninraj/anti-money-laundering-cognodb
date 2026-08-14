export type RiskStatus = 'NORMAL' | 'SUSPICIOUS' | 'FLAGGED' | 'SUSPENDED';

export type NodeType = 'Account' | 'Customer' | 'Device' | 'IPAddress';

export interface SearchAccountResult {
  id: string;
  accountNumber?: string;
  holderName: string;
  riskScore: number;
  status: RiskStatus;
  balance: number;
  type: string;
}

export interface GraphNode {
  id: string;
  label: NodeType;
  holderName: string;
  status: RiskStatus;
  riskScore: number;
  balance: number;
  type: string;
  bank?: string;
  ip?: string;
  deviceId?: string;
  isProxy?: boolean;
  // Canvas physics properties
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
}

export interface GraphLink {
  id: string;
  source: string | GraphNode;
  target: string | GraphNode;
  type: string;
  amount: number;
  isLaundering: boolean;
  launderingType?: string;
  paymentFormat?: string;
  timestamp?: string;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

export interface OverviewStats {
  totalAccounts: number;
  totalTransactions: number;
  flaggedAccounts: number;
  totalVolume: number;
}

export interface ConnectionStatus {
  status: 'ONLINE' | 'DEMO_STANDBY';
  uri: string;
  mode: string;
  reason?: string;
}

export interface QueryDetails {
  name: string;
  cypher: string;
  parameters?: Record<string, any>;
  description?: string;
  relationalComparison?: string;
  executionTimeMs: number;
}

export interface ExecuteCypherResponse {
  success: boolean;
  error?: string;
  count: number;
  columns: string[];
  results: any[];
  graph?: GraphData | null;
  executionTimeMs: number;
  query: string;
  parameters?: Record<string, any>;
}

export interface MoneyLoopItem {
  nodeIds: string[];
  holderNames: string[];
  nodeStatuses: RiskStatus[];
  hopCount: number;
  totalVolume: number;
  transactions: Array<{
    id: string;
    amount: number;
    timestamp: string;
    launderingType?: string;
  }>;
}

export interface MoneyLoopResponse {
  detector: string;
  detectedCount: number;
  loops: MoneyLoopItem[];
  graph?: GraphData;
  queryDetails: QueryDetails;
}

export interface SharedInfraItem {
  account1Id: string;
  account1Holder: string;
  account1Status: RiskStatus;
  infraId: string;
  infraType: string;
  ipAddress?: string;
  deviceId?: string;
  isProxy: boolean;
  account2Id: string;
  account2Holder: string;
  account2Status: RiskStatus;
  directTransferAmount: number;
}

export interface SharedInfraResponse {
  detector: string;
  detectedCount: number;
  sharedRings: SharedInfraItem[];
  graph?: GraphData;
  queryDetails: QueryDetails;
}

export interface SmurfingItem {
  muleAccountId: string;
  muleHolderName: string;
  muleStatus: RiskStatus;
  txCount: number;
  totalInbound: number;
  sourceHolders: string[];
}

export interface SmurfingResponse {
  detector: string;
  detectedCount: number;
  smurfingRings: SmurfingItem[];
  graph?: GraphData;
  queryDetails: QueryDetails;
}

export interface RiskFactorBreakdown {
  launderingScore: number;
  structuringScore: number;
  volumeScore: number;
  infrastructureScore: number;
  entityScore: number;
}

export interface AccountDetailsResponse {
  account: GraphNode;
  customer?: any;
  riskFactors?: RiskFactorBreakdown;
  transactions: Array<{
    txId: string;
    amount: number;
    isLaundering: boolean;
    timestamp: string;
    counterparty: string;
  }>;
}

export interface AgentStep {
  name: string;
  status: 'COMPLETED' | 'RUNNING' | 'PENDING';
  detail: string;
  tool?: string;
  cypher?: string;
  executionTimeMs?: number;
}

export interface AgentAction {
  label: string;
  action: 'GENERATE_SAR' | 'RENDER_GRAPH' | 'SEND_MESSAGE' | 'OPEN_CYPHER';
  payload?: any;
  accountId?: string;
  prompt?: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  suggestedCypher?: string;
  thoughtProcess?: string;
  steps?: AgentStep[];
  queryResults?: ExecuteCypherResponse | null;
  suggestedActions?: AgentAction[];
}

export interface SARReportResponse {
  accountId: string;
  holderName: string;
  riskScore: number;
  status: RiskStatus;
  sarNarrative: string;
  generatedBy: string;
  executionTimeMs: number;
}

export interface HelperBotChatResponse {
  reply: string;
  suggestedCypher?: string;
  thoughtProcess?: string;
  steps?: AgentStep[];
  queryResults?: ExecuteCypherResponse | null;
  suggestedActions?: AgentAction[];
  botName: string;
  executionTimeMs: number;
}

export interface NL2CypherResponse {
  cypher: string;
  explanation: string;
  executionTimeMs: number;
}
