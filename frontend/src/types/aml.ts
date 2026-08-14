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
  }>;
}

export interface MoneyLoopResponse {
  detector: string;
  detectedCount: number;
  loops: MoneyLoopItem[];
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
  queryDetails: QueryDetails;
}

export interface AccountDetailsResponse {
  account: GraphNode;
  customer?: any;
  transactions: Array<{
    txId: string;
    amount: number;
    isLaundering: boolean;
    timestamp: string;
    counterparty: string;
  }>;
}
