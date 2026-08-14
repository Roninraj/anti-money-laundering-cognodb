"""
Parameterized openCypher queries for Anti-Money Laundering (AML) graph detection.
All queries strictly use $parameter substitution to prevent Cypher injection and maximize execution plan caching.
"""

CYPHER_QUERIES = {
    "OVERVIEW_STATS": {
        "name": "Dashboard Overview Metrics",
        "description": "Calculates aggregate counts of accounts, transactions, high-risk accounts, and total volume.",
        "cypher": """
        MATCH (a:Account)
        WITH count(a) AS totalAccounts,
             sum(CASE WHEN a.status IN ['FLAGGED', 'SUSPICIOUS', 'SUSPENDED'] THEN 1 ELSE 0 END) AS flaggedAccounts
        OPTIONAL MATCH ()-[t:TRANSFERRED]->()
        RETURN totalAccounts,
               flaggedAccounts,
               count(t) AS totalTransactions,
               coalesce(sum(t.amount), 0.0) AS totalVolume
        """,
        "relational_comparison": "In relational SQL, calculating graph-wide metrics across multiple polymorphic relationship tables requires expensive JOINs across distinct transaction logs."
    },
    
    "DETECT_MONEY_LOOPS": {
        "name": "Detect Circular Money Loops (Multi-hop 2..4)",
        "description": "Identifies circular money flows (e.g., A -> B -> C -> A) anchored at high-risk accounts to prevent unbounded traversal.",
        "cypher": """
        MATCH (a:Account)
        WHERE a.status IN ['FLAGGED', 'SUSPICIOUS', 'SUSPENDED'] OR a.riskScore >= 60
        MATCH path = (a)-[r:TRANSFERRED*2..4]->(a)
        WHERE ALL(x IN nodes(path)[1..-1] WHERE x <> a)
        WITH path, nodes(path) AS cycleNodes, relationships(path) AS cycleRels
        RETURN [n IN cycleNodes | n.id] AS nodeIds,
               [n IN cycleNodes | n.holderName] AS holderNames,
               [n IN cycleNodes | n.status] AS nodeStatuses,
               length(path) AS hopCount,
               reduce(total = 0.0, rel IN cycleRels | total + rel.amount) AS totalVolume,
               [rel IN cycleRels | {id: rel.id, amount: rel.amount, timestamp: rel.timestamp}] AS transactions
        ORDER BY totalVolume DESC
        LIMIT 50
        """,
        "relational_comparison": "SQL requires recursive Common Table Expressions (CTEs) with complex array tracking to avoid infinite loops, running in O(N^k) time vs indexed Cypher variable-length path traversal."
    },

    "SHARED_INFRASTRUCTURE": {
        "name": "Analyze Shared Infrastructure (Device & IP Hubs)",
        "description": "Detects distinct bank accounts accessing the financial system via identical IP addresses or physical devices using hub-first pattern matching.",
        "cypher": """
        MATCH (d:Device)<-[:USED_DEVICE]-(a1:Account)
        MATCH (d)<-[:USED_DEVICE]-(a2:Account)
        WHERE a1.id < a2.id
        OPTIONAL MATCH (a1)-[t:TRANSFERRED]-(a2)
        RETURN a1.id AS account1Id,
               a1.holderName AS account1Holder,
               a1.status AS account1Status,
               d.id AS infraId,
               'Device' AS infraType,
               null AS ipAddress,
               d.deviceId AS deviceId,
               false AS isProxy,
               a2.id AS account2Id,
               a2.holderName AS account2Holder,
               a2.status AS account2Status,
               coalesce(t.amount, 0.0) AS directTransferAmount
        LIMIT 50
        UNION ALL
        MATCH (ip:IPAddress)<-[:CONNECTED_FROM]-(a1:Account)
        MATCH (ip)<-[:CONNECTED_FROM]-(a2:Account)
        WHERE a1.id < a2.id
        OPTIONAL MATCH (a1)-[t:TRANSFERRED]-(a2)
        RETURN a1.id AS account1Id,
               a1.holderName AS account1Holder,
               a1.status AS account1Status,
               ip.id AS infraId,
               'IPAddress' AS infraType,
               ip.ip AS ipAddress,
               null AS deviceId,
               ip.isProxy AS isProxy,
               a2.id AS account2Id,
               a2.holderName AS account2Holder,
               a2.status AS account2Status,
               coalesce(t.amount, 0.0) AS directTransferAmount
        LIMIT 50
        """,
        "relational_comparison": "In relational schemas, discovering entity networks connected through shared secondary attributes requires joining multiple 3-way bridge tables."
    },

    "SMURFING_STRUCTURING": {
        "name": "Detect Structuring / Smurfing Rings",
        "description": "Finds mule aggregator accounts receiving multiple inbound transfers just below regulatory reporting thresholds ($10,000).",
        "cypher": """
        MATCH (mule:Account)<-[t:TRANSFERRED]-(source:Account)
        WHERE t.amount < $maxThreshold AND t.amount >= $minThreshold
        WITH mule, count(t) AS txCount, sum(t.amount) AS totalInbound, collect(DISTINCT source.holderName) AS sourceHolders
        WHERE txCount >= $minTransactions
        RETURN mule.id AS muleAccountId,
               mule.holderName AS muleHolderName,
               mule.status AS muleStatus,
               txCount,
               totalInbound,
               sourceHolders
        ORDER BY totalInbound DESC
        LIMIT 50
        """,
        "relational_comparison": "SQL GROUP BY aggregation filters transaction tables, but cannot trace where funds disperse next without multi-stage recursive subqueries."
    },

    "GET_NEIGHBORHOOD": {
        "name": "1-2 Hop Entity Neighborhood",
        "description": "Retrieves immediate and secondary connections for a targeted account ID using indexed direct pointer traversal.",
        "cypher": """
        MATCH (a:Account {id: $accountId})
        OPTIONAL MATCH path = (a)-[r*1..2]-(neighbor)
        RETURN a, path
        LIMIT 100
        """,
        "relational_comparison": "Retrieving ego-networks in SQL requires separate queries per hop depth, unioning distinct foreign key tables."
    },

    "FULL_GRAPH": {
        "name": "Full Graph Network Topology",
        "description": "Fetches the full topology of accounts, devices, IPs, customers, and transfers for visualization.",
        "cypher": """
        MATCH (n)
        OPTIONAL MATCH (n)-[r]->(m)
        RETURN n, r, m
        LIMIT 300
        """,
        "relational_comparison": "Constructing visual graphs in relational DBs requires joining 5+ entity tables and transforming rows to graph format."
    },

    "SEARCH_ACCOUNTS": {
        "name": "Search Accounts by ID or Holder Name",
        "description": "Queries accounts using prefix index matches and substring fallback, ordered by risk score.",
        "cypher": """
        MATCH (a:Account)
        WHERE $searchTerm = ""
           OR a.id STARTS WITH $searchTerm
           OR a.accountNumber STARTS WITH $searchTerm
           OR toLower(a.holderName) CONTAINS toLower($searchTerm)
           OR toLower(a.id) CONTAINS toLower($searchTerm)
        RETURN a.id AS id,
               a.accountNumber AS accountNumber,
               a.holderName AS holderName,
               a.riskScore AS riskScore,
               a.status AS status,
               a.balance AS balance,
               a.type AS type
        ORDER BY a.riskScore DESC
        LIMIT 20
        """,
        "relational_comparison": "Standard indexed search across Account attributes."
    }
}
