import time
from fastapi import APIRouter, Query, BackgroundTasks
from app.database import db_manager
from app.cypher_queries import CYPHER_QUERIES
from scripts.load_saml_kaggle import load_saml_dataset
from pathlib import Path

router = APIRouter(prefix="/api/overview", tags=["Overview"])

@router.get("/health")
def get_health():
    """Checks CognoDB Cloud connection status."""
    return db_manager.check_connection()

@router.get("/stats")
def get_dashboard_stats():
    """Retrieves high-level AML dashboard metrics."""
    start_time = time.time()
    query_info = CYPHER_QUERIES["OVERVIEW_STATS"]
    results = db_manager.execute_cypher(query_info["cypher"], use_cache=True, ttl_seconds=10)
    execution_time_ms = round((time.time() - start_time) * 1000, 2)

    stats = results[0] if results else {
        "totalAccounts": 0,
        "totalTransactions": 0,
        "flaggedAccounts": 0,
        "totalVolume": 0.0
    }

    return {
        "stats": stats,
        "queryDetails": {
            "name": query_info["name"],
            "cypher": query_info["cypher"].strip(),
            "description": query_info["description"],
            "relationalComparison": query_info["relational_comparison"],
            "executionTimeMs": execution_time_ms
        }
    }

@router.get("/search")
def search_accounts(q: str = Query("", description="Account ID, holder name or account number")):
    """Searches accounts matching search term."""
    start_time = time.time()
    query_info = CYPHER_QUERIES["SEARCH_ACCOUNTS"]
    params = {"searchTerm": q}
    results = db_manager.execute_cypher(query_info["cypher"], params, use_cache=True, ttl_seconds=5)
    execution_time_ms = round((time.time() - start_time) * 1000, 2)

    return {
        "results": results,
        "count": len(results),
        "queryDetails": {
            "name": query_info["name"],
            "cypher": query_info["cypher"].strip(),
            "parameters": params,
            "executionTimeMs": execution_time_ms
        }
    }

@router.post("/seed")
def trigger_database_seed():
    """Triggers SAML dataset seeding into CognoDB Cloud."""
    default_csv = str(Path(__file__).resolve().parent.parent.parent / "scripts" / "saml_sample.csv")
    success = load_saml_dataset(default_csv)
    return {
        "status": "SUCCESS" if success else "STANDBY",
        "message": "Seeded SAML Dataset into CognoDB Cloud!" if success else "CognoDB credentials pending in .env"
    }

@router.post("/recalculate-risk")
def recalculate_risk_scores():
    """Recalculates multi-factor AML risk scores across all accounts in the graph."""
    cypher = """
    MATCH (a:Account)
    OPTIONAL MATCH (a)-[t:TRANSFERRED]-(other:Account)
    WITH a,
         count(t) AS totalTx,
         sum(CASE WHEN t.isLaundering = true THEN 1 ELSE 0 END) AS launderingTx,
         coalesce(sum(t.amount), 0.0) AS totalVolume,
         sum(CASE WHEN t.amount >= 8000.0 AND t.amount < 10000.0 THEN 1 ELSE 0 END) AS structuringCount
    OPTIONAL MATCH (a)-[:USED_DEVICE|CONNECTED_FROM]->(infra)
    WITH a, totalTx, launderingTx, totalVolume, structuringCount, count(infra) AS infraCount
    WITH a,
         10 +
         (CASE WHEN launderingTx > 0 THEN 35 + (launderingTx * 5) ELSE 0 END) +
         (CASE WHEN structuringCount >= 2 THEN 20 ELSE 0 END) +
         (CASE WHEN totalVolume > 500000.0 THEN 15 WHEN totalVolume > 100000.0 THEN 10 ELSE 0 END) +
         (CASE WHEN infraCount > 0 THEN 15 ELSE 0 END) +
         (CASE WHEN a.type = 'SHELL' OR a.type = 'OFFSHORE' THEN 15 WHEN a.type = 'BUSINESS' THEN 5 ELSE 0 END) AS rawScore
    WITH a,
         CASE WHEN rawScore > 98 THEN 98 WHEN rawScore < 8 THEN 8 ELSE rawScore END AS finalScore
    SET a.riskScore = finalScore,
        a.status = CASE
            WHEN finalScore >= 85 THEN 'FLAGGED'
            WHEN finalScore >= 60 THEN 'SUSPICIOUS'
            ELSE 'NORMAL'
        END
    RETURN count(a) AS updatedAccounts
    """
    res = db_manager.execute_write_cypher(cypher)
    return {
        "message": "Successfully recalculated multi-factor risk scores across graph.",
        "result": res[0] if res else {"updatedAccounts": 0}
    }
