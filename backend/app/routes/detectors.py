import time
from typing import Dict, Any, Optional
from fastapi import APIRouter
from pydantic import BaseModel
from app.database import db_manager
from app.cypher_queries import CYPHER_QUERIES

router = APIRouter(prefix="/api/detectors", tags=["Fraud Detectors"])

class SmurfingParams(BaseModel):
    maxThreshold: float = 10000.0
    minThreshold: float = 1000.0
    minTransactions: int = 3

@router.post("/money-loops")
def detect_money_loops():
    """
    Executes multi-hop openCypher query (2..4 hops) to detect circular money flows.
    """
    start_time = time.time()
    query_info = CYPHER_QUERIES["DETECT_MONEY_LOOPS"]
    results = db_manager.execute_cypher(query_info["cypher"], use_cache=True, ttl_seconds=15)
    execution_time_ms = round((time.time() - start_time) * 1000, 2)

    return {
        "detector": "Money Loop Circular Flow Detector",
        "detectedCount": len(results),
        "loops": results,
        "queryDetails": {
            "name": query_info["name"],
            "cypher": query_info["cypher"].strip(),
            "parameters": {},
            "description": query_info["description"],
            "relationalComparison": query_info["relational_comparison"],
            "executionTimeMs": execution_time_ms
        }
    }

@router.post("/shared-infra")
def analyze_shared_infrastructure():
    """
    Executes openCypher query discovering accounts connected through identical Device or IP proxies.
    """
    start_time = time.time()
    query_info = CYPHER_QUERIES["SHARED_INFRASTRUCTURE"]
    results = db_manager.execute_cypher(query_info["cypher"], use_cache=True, ttl_seconds=15)
    execution_time_ms = round((time.time() - start_time) * 1000, 2)

    return {
        "detector": "Shared Device & IP Infrastructure Network Detector",
        "detectedCount": len(results),
        "sharedRings": results,
        "queryDetails": {
            "name": query_info["name"],
            "cypher": query_info["cypher"].strip(),
            "parameters": {},
            "description": query_info["description"],
            "relationalComparison": query_info["relational_comparison"],
            "executionTimeMs": execution_time_ms
        }
    }

@router.post("/smurfing")
def detect_smurfing(params: Optional[SmurfingParams] = None):
    """
    Executes openCypher query identifying mule aggregation accounts receiving multiple sub-$10,000 deposits.
    """
    if params is None:
        params = SmurfingParams()

    start_time = time.time()
    query_info = CYPHER_QUERIES["SMURFING_STRUCTURING"]
    cypher_params = {
        "maxThreshold": params.maxThreshold,
        "minThreshold": params.minThreshold,
        "minTransactions": params.minTransactions
    }
    results = db_manager.execute_cypher(query_info["cypher"], cypher_params, use_cache=True, ttl_seconds=15)
    execution_time_ms = round((time.time() - start_time) * 1000, 2)

    return {
        "detector": "Structuring & Smurfing Mule Aggregator Detector",
        "detectedCount": len(results),
        "smurfingRings": results,
        "queryDetails": {
            "name": query_info["name"],
            "cypher": query_info["cypher"].strip(),
            "parameters": cypher_params,
            "description": query_info["description"],
            "relationalComparison": query_info["relational_comparison"],
            "executionTimeMs": execution_time_ms
        }
    }
