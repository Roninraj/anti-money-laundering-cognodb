import logging
import time
from typing import Dict, Any, List, Optional
from neo4j import GraphDatabase, Driver
from app.config import settings

logger = logging.getLogger("aml_database")
logger.setLevel(logging.INFO)

class DatabaseManager:
    """
    Manages Neo4j Bolt driver lifecycle for CognoDB Cloud.
    Includes connection error handling and fallback synthetic engine.
    """
    def __init__(self):
        self.driver: Optional[Driver] = None
        self.is_connected: bool = False
        self.connection_error: Optional[str] = None
        self._initialize_driver()

    def _initialize_driver(self):
        uri = settings.cognodb_uri
        user = settings.cognodb_user
        password = settings.cognodb_password

        # Check if placeholder credentials
        if "your_saved_password" in password or "demo.databases" in uri:
            logger.info("CognoDB credentials not configured. Running in High-Fidelity Standby/Demo mode.")
            self.is_connected = False
            self.connection_error = "Credentials not set in .env. Running in Standby/Demo mode."
            return

        try:
            # Initialize official Neo4j driver with connection pool limits for CognoDB free tier
            self.driver = GraphDatabase.driver(
                uri,
                auth=(user, password),
                max_connection_lifetime=300,
                max_connection_pool_size=50,
                connection_acquisition_timeout=15.0
            )
            # Test connectivity
            self.driver.verify_connectivity()
            self.is_connected = True
            self.connection_error = None
            logger.info(f"Successfully connected to CognoDB Cloud at {uri}")
        except Exception as e:
            self.is_connected = False
            self.connection_error = str(e)
            logger.warning(f"Could not connect to CognoDB Cloud: {e}. Falling back to In-Memory Engine.")

    def check_connection(self) -> Dict[str, Any]:
        if self.driver and self.is_connected:
            try:
                self.driver.verify_connectivity()
                return {"status": "ONLINE", "uri": settings.cognodb_uri, "mode": "CognoDB Bolt Live"}
            except Exception as e:
                self.is_connected = False
                self.connection_error = str(e)
        return {
            "status": "DEMO_STANDBY",
            "uri": settings.cognodb_uri,
            "mode": "In-Memory High-Fidelity Graph Engine",
            "reason": self.connection_error or "DB credentials pending"
        }

    def execute_cypher(self, query: str, parameters: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """
        Executes raw parameterized Cypher using official Neo4j driver.
        """
        if parameters is None:
            parameters = {}

        if not self.is_connected or not self.driver:
            # Fallback to local demo query resolver if database is unavailable
            return self._fallback_cypher_executor(query, parameters)

        try:
            with self.driver.session() as session:
                result = session.run(query, parameters)
                return [record.data() for record in result]
        except Exception as e:
            logger.error(f"Cypher execution failed: {e}")
            # Fall back gracefully so UI never crashes
            return self._fallback_cypher_executor(query, parameters)

    def close(self):
        if self.driver:
            self.driver.close()
            logger.info("CognoDB driver connection closed.")

    def _fallback_cypher_executor(self, query: str, parameters: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        In-memory fallback engine representing SAML dataset topology when DB is offline.
        """
        q_upper = query.upper()

        if "OVERVIEW_STATS" in q_upper or "COUNT(DISTINCT A)" in q_upper or "COUNT(A)" in q_upper:
            return [{
                "totalAccounts": 4781,
                "totalTransactions": 4000,
                "flaggedAccounts": 1390,
                "totalVolume": 96854937.00
            }]

        if "DETECT_MONEY_LOOPS" in q_upper or "TRANSFERRED*2..4" in q_upper:
            return [
                {
                    "nodeIds": ["ACC-101", "ACC-202", "ACC-303", "ACC-101"],
                    "holderNames": ["Apex Global Capital", "Shell Corp Alpha", "Cayman Offshore Trust", "Apex Global Capital"],
                    "nodeStatuses": ["FLAGGED", "SUSPECTED", "SUSPENDED", "FLAGGED"],
                    "hopCount": 3,
                    "totalVolume": 250000.00,
                    "transactions": [
                        {"id": "TX-LOOP-1", "amount": 250000.0, "timestamp": "2026-08-10T14:30:00Z"},
                        {"id": "TX-LOOP-2", "amount": 248000.0, "timestamp": "2026-08-11T09:15:00Z"},
                        {"id": "TX-LOOP-3", "amount": 245000.0, "timestamp": "2026-08-12T16:45:00Z"}
                    ]
                }
            ]

        if "SHARED_INFRASTRUCTURE" in q_upper or "USED_DEVICE|CONNECTED_FROM" in q_upper:
            return [
                {
                    "account1Id": "ACC-701",
                    "account1Holder": "DarkSky Trading",
                    "account1Status": "FLAGGED",
                    "infraId": "DEV-TOR-999",
                    "infraType": "Device",
                    "ipAddress": "185.220.101.5",
                    "deviceId": "DEV-TOR-999",
                    "isProxy": True,
                    "account2Id": "ACC-702",
                    "account2Holder": "Shadow Capital LLC",
                    "account2Status": "SUSPICIOUS",
                    "directTransferAmount": 95000.00
                }
            ]

        if "SMURFING_STRUCTURING" in q_upper or "AMOUNT < $MAXTHRESHOLD" in q_upper:
            return [
                {
                    "muleAccountId": "ACC-888",
                    "muleHolderName": "Aggregation Mule Account",
                    "muleStatus": "FLAGGED",
                    "txCount": 5,
                    "totalInbound": 47250.00,
                    "sourceHolders": ["Smurf Source 1", "Smurf Source 2", "Smurf Source 3"]
                }
            ]

        if "SEARCH_ACCOUNTS" in q_upper:
            term = parameters.get("searchTerm", "").lower()
            all_accounts = [
                {"id": "ACC-101", "accountNumber": "101", "holderName": "Apex Global Capital", "riskScore": 92, "status": "FLAGGED", "balance": 1450000.0, "type": "BUSINESS"},
                {"id": "ACC-202", "accountNumber": "202", "holderName": "Shell Corp Alpha", "riskScore": 88, "status": "SUSPICIOUS", "balance": 890000.0, "type": "SHELL"},
                {"id": "ACC-303", "accountNumber": "303", "holderName": "Cayman Offshore Trust", "riskScore": 95, "status": "SUSPENDED", "balance": 3200000.0, "type": "OFFSHORE"},
                {"id": "ACC-701", "accountNumber": "701", "holderName": "DarkSky Trading", "riskScore": 91, "status": "FLAGGED", "balance": 520000.0, "type": "BUSINESS"},
                {"id": "ACC-702", "accountNumber": "702", "holderName": "Shadow Capital LLC", "riskScore": 84, "status": "SUSPICIOUS", "balance": 310000.0, "type": "BUSINESS"},
                {"id": "ACC-888", "accountNumber": "888", "holderName": "Aggregation Mule Account", "riskScore": 94, "status": "FLAGGED", "balance": 47250.0, "type": "INDIVIDUAL"},
                {"id": "ACC-7401327478", "accountNumber": "7401327478", "holderName": "Account ACC-7401327478 (Bank-UK)", "riskScore": 92, "status": "FLAGGED", "balance": 750000.0, "type": "BUSINESS"},
                {"id": "ACC-4336451277", "accountNumber": "4336451277", "holderName": "Account ACC-4336451277 (Bank-UK)", "riskScore": 88, "status": "FLAGGED", "balance": 750000.0, "type": "BUSINESS"},
                {"id": "ACC-9001123445", "accountNumber": "9001123445", "holderName": "Safe Horizon Retail", "riskScore": 12, "status": "NORMAL", "balance": 45000.0, "type": "INDIVIDUAL"}
            ]
            if not term:
                return all_accounts
            return [a for a in all_accounts if term in a["holderName"].lower() or term in a["id"].lower() or term in str(a.get("accountNumber", "")).lower()]

        return self._generate_full_fallback_graph()

    def _generate_full_fallback_graph(self) -> List[Dict[str, Any]]:
        nodes = [
            {"id": "ACC-101", "label": "Account", "properties": {"id": "ACC-101", "holderName": "Apex Global Capital", "status": "FLAGGED", "riskScore": 92, "type": "BUSINESS", "balance": 1450000.0}},
            {"id": "ACC-202", "label": "Account", "properties": {"id": "ACC-202", "holderName": "Shell Corp Alpha", "status": "SUSPICIOUS", "riskScore": 88, "type": "SHELL", "balance": 890000.0}},
            {"id": "ACC-303", "label": "Account", "properties": {"id": "ACC-303", "holderName": "Cayman Offshore Trust", "status": "SUSPENDED", "riskScore": 95, "type": "OFFSHORE", "balance": 3200000.0}},
            {"id": "DEV-TOR-999", "label": "Device", "properties": {"id": "DEV-TOR-999", "deviceId": "DEV-TOR-999", "deviceType": "MAC_BOOK_PRO", "os": "macOS 15.1"}},
            {"id": "IP-185-220-101-5", "label": "IPAddress", "properties": {"id": "IP-185-220-101-5", "ip": "185.220.101.5", "country": "Panama", "isProxy": True}}
        ]

        relationships = [
            {"source": "ACC-101", "target": "ACC-202", "type": "TRANSFERRED", "properties": {"id": "TX-1", "amount": 250000.0, "isLaundering": True}},
            {"source": "ACC-202", "target": "ACC-303", "type": "TRANSFERRED", "properties": {"id": "TX-2", "amount": 248000.0, "isLaundering": True}},
            {"source": "ACC-303", "target": "ACC-101", "type": "TRANSFERRED", "properties": {"id": "TX-3", "amount": 245000.0, "isLaundering": True}}
        ]

        result = []
        for rel in relationships:
            src_node = next(n for n in nodes if n["id"] == rel["source"])
            tgt_node = next(n for n in nodes if n["id"] == rel["target"])
            result.append({"n": src_node, "r": rel, "m": tgt_node})
        return result

db_manager = DatabaseManager()
