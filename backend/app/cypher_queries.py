"""
Parameterized openCypher queries for Anti-Money Laundering (AML) graph detection.
All queries strictly use $parameter substitution to prevent Cypher injection and maximize execution plan caching.
Operates purely on authentic Kaggle SAML dataset topology.
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
        "name": "Detect Circular Money Loops (5-Hop Layering Rings)",
        "description": "Identifies circular money flows (e.g., A -> B -> C -> D -> E -> A) anchored across the financial graph.",
        "cypher": """
        MATCH (a:Account)-[t1:TRANSFERRED]->(b:Account)-[t2:TRANSFERRED]->(c:Account)-[t3:TRANSFERRED]->(d:Account)-[t4:TRANSFERRED]->(e:Account)-[t5:TRANSFERRED]->(a)
        WHERE a.id < b.id AND a.id < c.id AND a.id < d.id AND a.id < e.id
        RETURN [a.id, b.id, c.id, d.id, e.id, a.id] AS nodeIds,
               [a.holderName, b.holderName, c.holderName, d.holderName, e.holderName, a.holderName] AS holderNames,
               [a.status, b.status, c.status, d.status, e.status, a.status] AS nodeStatuses,
               5 AS hopCount,
               t1.amount + t2.amount + t3.amount + t4.amount + t5.amount AS totalVolume,
               [
                 {id: t1.id, amount: t1.amount, timestamp: t1.timestamp, launderingType: t1.launderingType},
                 {id: t2.id, amount: t2.amount, timestamp: t2.timestamp, launderingType: t2.launderingType},
                 {id: t3.id, amount: t3.amount, timestamp: t3.timestamp, launderingType: t3.launderingType},
                 {id: t4.id, amount: t4.amount, timestamp: t4.timestamp, launderingType: t4.launderingType},
                 {id: t5.id, amount: t5.amount, timestamp: t5.timestamp, launderingType: t5.launderingType}
               ] AS transactions
        ORDER BY totalVolume DESC
        LIMIT 50
        """,
        "relational_comparison": "SQL requires 5 recursive self-joins with complex array uniqueness tracking, running in O(N^5) time vs indexed Cypher path traversal."
    },

    "SHARED_INFRASTRUCTURE": {
        "name": "Analyze Multi-Branch Layering Hubs (Scatter-Gather / Fan-Out)",
        "description": "Detects intermediary aggregation and distribution hubs connecting sender and receiver rings.",
        "cypher": """
        MATCH (hub:Account)<-[t1:TRANSFERRED]-(a1:Account)
        MATCH (hub)-[t2:TRANSFERRED]->(a2:Account)
        WHERE a1.id <> a2.id AND (t1.isLaundering = true OR t2.isLaundering = true OR hub.riskScore >= 60)
        RETURN a1.id AS account1Id,
               a1.holderName AS account1Holder,
               a1.status AS account1Status,
               hub.id AS infraId,
               'LaunderingHub' AS infraType,
               hub.bank AS ipAddress,
               hub.id AS deviceId,
               false AS isProxy,
               a2.id AS account2Id,
               a2.holderName AS account2Holder,
               a2.status AS account2Status,
               coalesce(t1.amount, 0.0) + coalesce(t2.amount, 0.0) AS directTransferAmount
        LIMIT 50
        """,
        "relational_comparison": "In relational schemas, discovering entity networks connected through intermediary bridge entities requires joining multiple 3-way bridge tables."
    },

    "SMURFING_STRUCTURING": {
        "name": "Detect Structuring / Smurfing Rings",
        "description": "Finds mule aggregator accounts receiving multiple inbound transfers just below regulatory reporting thresholds ($10,000).",
        "cypher": """
        MATCH (mule:Account)<-[t:TRANSFERRED]-(source:Account)
        WHERE t.launderingType IN ['Smurfing', 'Structuring', 'Deposit-Send', 'Fan_In', 'Layered_Fan_In']
           OR (t.amount < $maxThreshold AND t.amount >= $minThreshold)
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
        OPTIONAL MATCH path = (a)-[r*1..2]-(neighbor:Account)
        RETURN a, path
        LIMIT 100
        """,
        "relational_comparison": "Retrieving ego-networks in SQL requires separate queries per hop depth, unioning distinct foreign key tables."
    },

    "FULL_GRAPH": {
        "name": "Full Graph Network Topology",
        "description": "Fetches the full topology of accounts and transfers for visualization.",
        "cypher": """
        MATCH (n:Account)
        OPTIONAL MATCH (n)-[r:TRANSFERRED]->(m:Account)
        RETURN n, r, m
        LIMIT 300
        """,
        "relational_comparison": "Constructing visual graphs in relational DBs requires joining multiple entity tables and transforming rows to graph format."
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
