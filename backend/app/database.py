import logging
import time
from typing import Dict, Any, List, Optional
from neo4j import GraphDatabase, Driver
from app.config import settings
from app.cypher_queries import CYPHER_QUERIES

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
            # Initialize official Neo4j driver (CognoDB speaks openCypher over Bolt protocol)
            self.driver = GraphDatabase.driver(uri, auth=(user, password))
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
        # Determine query type based on text matching
        q_upper = query.upper()

        if "OVERVIEW_STATS" in q_upper or "COUNT(DISTINCT A)" in q_upper:
            return [{
                "totalAccounts": 28,
                "totalTransactions": 64,
                "flaggedAccounts": 8,
                "totalVolume": 1485200.00
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
                },
                {
                    "nodeIds": ["ACC-404", "ACC-505", "ACC-404"],
                    "holderNames": ["Vanguard Import/Export", "Panama Holdings Ltd", "Vanguard Import/Export"],
                    "nodeStatuses": ["SUSPICIOUS", "FLAGGED", "SUSPICIOUS"],
                    "hopCount": 2,
                    "totalVolume": 180000.00,
                    "transactions": [
                        {"id": "TX-LOOP-4", "amount": 180000.0, "timestamp": "2026-08-11T11:00:00Z"},
                        {"id": "TX-LOOP-5", "amount": 178500.0, "timestamp": "2026-08-12T10:30:00Z"}
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
                },
                {
                    "account1Id": "ACC-702",
                    "account1Holder": "Shadow Capital LLC",
                    "account1Status": "SUSPICIOUS",
                    "infraId": "IP-185-220-101-5",
                    "infraType": "IPAddress",
                    "ipAddress": "185.220.101.5",
                    "deviceId": None,
                    "isProxy": True,
                    "account2Id": "ACC-703",
                    "account2Holder": "Vortex Mules Ltd",
                    "account2Status": "SUSPENDED",
                    "directTransferAmount": 87000.00
                }
            ]

        if "SMURFING_STRUCTURING" in q_upper or "AMOUNT < $MAXTHRESHOLD" in q_upper or "T.AMOUNT < 10000" in q_upper:
            return [
                {
                    "muleAccountId": "ACC-888",
                    "muleHolderName": "Aggregation Mule Account",
                    "muleStatus": "FLAGGED",
                    "txCount": 5,
                    "totalInbound": 47250.00,
                    "sourceHolders": ["Smurf Source 1", "Smurf Source 2", "Smurf Source 3", "Smurf Source 4", "Smurf Source 5"]
                }
            ]

        if "SEARCH_ACCOUNTS" in q_upper or "WHERE TOLOWER(A.HOLDERNAME)" in q_upper:
            term = parameters.get("searchTerm", "").lower()
            all_accounts = [
                {"id": "ACC-101", "accountNumber": "10029384", "holderName": "Apex Global Capital", "riskScore": 92, "status": "FLAGGED", "balance": 1450000.0, "type": "BUSINESS"},
                {"id": "ACC-202", "accountNumber": "10029385", "holderName": "Shell Corp Alpha", "riskScore": 88, "status": "SUSPECTED", "balance": 890000.0, "type": "SHELL"},
                {"id": "ACC-303", "accountNumber": "10029386", "holderName": "Cayman Offshore Trust", "riskScore": 95, "status": "SUSPENDED", "balance": 3200000.0, "type": "OFFSHORE"},
                {"id": "ACC-701", "accountNumber": "10029390", "holderName": "DarkSky Trading", "riskScore": 85, "status": "FLAGGED", "balance": 450000.0, "type": "BUSINESS"},
                {"id": "ACC-888", "accountNumber": "10029399", "holderName": "Aggregation Mule Account", "riskScore": 94, "status": "FLAGGED", "balance": 98000.0, "type": "INDIVIDUAL"}
            ]
            if not term:
                return all_accounts
            return [a for a in all_accounts if term in a["holderName"].lower() or term in a["id"].lower()]

        # Generic full graph fallback topology
        return self._generate_full_fallback_graph()

    def _generate_full_fallback_graph(self) -> List[Dict[str, Any]]:
        """Returns standard nodes and relationships for full graph rendering."""
        nodes = [
            {"id": "ACC-101", "label": "Account", "properties": {"id": "ACC-101", "holderName": "Apex Global Capital", "status": "FLAGGED", "riskScore": 92, "type": "BUSINESS", "balance": 1450000.0}},
            {"id": "ACC-202", "label": "Account", "properties": {"id": "ACC-202", "holderName": "Shell Corp Alpha", "status": "SUSPICIOUS", "riskScore": 88, "type": "SHELL", "balance": 890000.0}},
            {"id": "ACC-303", "label": "Account", "properties": {"id": "ACC-303", "holderName": "Cayman Offshore Trust", "status": "SUSPENDED", "riskScore": 95, "type": "OFFSHORE", "balance": 3200000.0}},
            {"id": "ACC-404", "label": "Account", "properties": {"id": "ACC-404", "holderName": "Vanguard Import/Export", "status": "SUSPICIOUS", "riskScore": 76, "type": "BUSINESS", "balance": 640000.0}},
            {"id": "ACC-505", "label": "Account", "properties": {"id": "ACC-505", "holderName": "Panama Holdings Ltd", "status": "FLAGGED", "riskScore": 89, "type": "SHELL", "balance": 1100000.0}},
            {"id": "ACC-701", "label": "Account", "properties": {"id": "ACC-701", "holderName": "DarkSky Trading", "status": "FLAGGED", "riskScore": 85, "type": "BUSINESS", "balance": 450000.0}},
            {"id": "ACC-702", "label": "Account", "properties": {"id": "ACC-702", "holderName": "Shadow Capital LLC", "status": "SUSPICIOUS", "riskScore": 79, "type": "BUSINESS", "balance": 310000.0}},
            {"id": "ACC-703", "label": "Account", "properties": {"id": "ACC-703", "holderName": "Vortex Mules Ltd", "status": "SUSPENDED", "riskScore": 91, "type": "SHELL", "balance": 18000.0}},
            {"id": "ACC-888", "label": "Account", "properties": {"id": "ACC-888", "holderName": "Aggregation Mule Account", "status": "FLAGGED", "riskScore": 94, "type": "INDIVIDUAL", "balance": 98000.0}},
            {"id": "ACC-901", "label": "Account", "properties": {"id": "ACC-901", "holderName": "Acme Clean Corp", "status": "NORMAL", "riskScore": 12, "type": "BUSINESS", "balance": 520000.0}},
            {"id": "ACC-902", "label": "Account", "properties": {"id": "ACC-902", "holderName": "John Doe Retail", "status": "NORMAL", "riskScore": 8, "type": "INDIVIDUAL", "balance": 15400.0}},
            {"id": "DEV-TOR-999", "label": "Device", "properties": {"id": "DEV-TOR-999", "deviceId": "DEV-TOR-999", "deviceType": "MAC_BOOK_PRO", "os": "macOS 15.1"}},
            {"id": "IP-185-220-101-5", "label": "IPAddress", "properties": {"id": "IP-185-220-101-5", "ip": "185.220.101.5", "country": "Panama", "isProxy": True}}
        ]

        relationships = [
            {"source": "ACC-101", "target": "ACC-202", "type": "TRANSFERRED", "properties": {"id": "TX-1", "amount": 250000.0, "isLaundering": True}},
            {"source": "ACC-202", "target": "ACC-303", "type": "TRANSFERRED", "properties": {"id": "TX-2", "amount": 248000.0, "isLaundering": True}},
            {"source": "ACC-303", "target": "ACC-101", "type": "TRANSFERRED", "properties": {"id": "TX-3", "amount": 245000.0, "isLaundering": True}},
            {"source": "ACC-404", "target": "ACC-505", "type": "TRANSFERRED", "properties": {"id": "TX-4", "amount": 180000.0, "isLaundering": True}},
            {"source": "ACC-505", "target": "ACC-404", "type": "TRANSFERRED", "properties": {"id": "TX-5", "amount": 178500.0, "isLaundering": True}},
            {"source": "ACC-701", "target": "DEV-TOR-999", "type": "USED_DEVICE", "properties": {"lastUsed": "2026-08-12T10:00:00Z"}},
            {"source": "ACC-702", "target": "DEV-TOR-999", "type": "USED_DEVICE", "properties": {"lastUsed": "2026-08-12T11:30:00Z"}},
            {"source": "ACC-703", "target": "IP-185-220-101-5", "type": "CONNECTED_FROM", "properties": {"lastLogin": "2026-08-12T12:00:00Z"}},
            {"source": "ACC-701", "target": "IP-185-220-101-5", "type": "CONNECTED_FROM", "properties": {"lastLogin": "2026-08-12T09:45:00Z"}},
            {"source": "ACC-901", "target": "ACC-902", "type": "TRANSFERRED", "properties": {"id": "TX-6", "amount": 3400.0, "isLaundering": False}}
        ]

        result = []
        for rel in relationships:
            src_node = next(n for n in nodes if n["id"] == rel["source"])
            tgt_node = next(n for n in nodes if n["id"] == rel["target"])
            result.append({
                "n": src_node,
                "r": rel,
                "m": tgt_node
            })
        return result

db_manager = DatabaseManager()
