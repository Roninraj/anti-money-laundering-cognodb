import time
from fastapi import APIRouter, Query
from app.database import db_manager
from app.cypher_queries import CYPHER_QUERIES

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
    results = db_manager.execute_cypher(query_info["cypher"])
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
    results = db_manager.execute_cypher(query_info["cypher"], params)
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
