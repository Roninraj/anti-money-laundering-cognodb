import time
from typing import Dict, Any, Optional, List
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
    Executes 5-hop openCypher query to detect circular layering rings in CognoDB.
    Returns both structured loop records and the renderable sub-graph for the canvas.
    """
    start_time = time.time()
    query_info = CYPHER_QUERIES["DETECT_MONEY_LOOPS"]
    results = db_manager.execute_cypher(query_info["cypher"], use_cache=True, ttl_seconds=30)
    execution_time_ms = round((time.time() - start_time) * 1000, 2)

    # Build interactive sub-graph for canvas rendering
    nodes_dict = {}
    links = []

    for row in results:
        node_ids = row.get("nodeIds", [])
        holder_names = row.get("holderNames", [])
        statuses = row.get("nodeStatuses", [])
        txs = row.get("transactions", [])

        # Create nodes
        for i in range(min(5, len(node_ids) - 1)):
            nid = node_ids[i]
            if nid not in nodes_dict:
                nodes_dict[nid] = {
                    "id": nid,
                    "label": "Account",
                    "holderName": holder_names[i] if i < len(holder_names) else nid,
                    "status": statuses[i] if i < len(statuses) else "FLAGGED",
                    "riskScore": 85,
                    "balance": 150000.0,
                    "type": "BUSINESS",
                    "bank": "Bank-UK"
                }

        # Create 5 directed cycle links
        for i in range(min(5, len(node_ids) - 1)):
            src = node_ids[i]
            tgt = node_ids[i + 1] if i + 1 < len(node_ids) else node_ids[0]
            tx = txs[i] if i < len(txs) else {}
            amt = float(tx.get("amount", 0.0))
            links.append({
                "id": f"{src}-{tgt}-loop",
                "source": src,
                "target": tgt,
                "type": "TRANSFERRED",
                "amount": amt,
                "isLaundering": True,
                "launderingType": "Cycle"
            })

    graph_data = {
        "nodes": list(nodes_dict.values()),
        "links": links
    }

    return {
        "detector": "Money Loop Circular Flow Detector",
        "detectedCount": len(results),
        "loops": results,
        "graph": graph_data,
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
    Executes openCypher query discovering scatter-gather and fan-out intermediary layering hubs.
    """
    start_time = time.time()
    query_info = CYPHER_QUERIES["SHARED_INFRASTRUCTURE"]
    results = db_manager.execute_cypher(query_info["cypher"], use_cache=True, ttl_seconds=30)
    execution_time_ms = round((time.time() - start_time) * 1000, 2)

    nodes_dict = {}
    links = []

    for row in results:
        hub_id = row.get("infraId")
        hub_name = row.get("account1Holder") or hub_id
        src_id = row.get("account1Id")
        src_name = row.get("account1Holder", src_id)
        src_status = row.get("account1Status", "NORMAL")
        tgt_id = row.get("account2Id")
        tgt_name = row.get("account2Holder", tgt_id)
        tgt_status = row.get("account2Status", "NORMAL")
        vol = float(row.get("directTransferAmount", 0.0))

        if hub_id and hub_id not in nodes_dict:
            nodes_dict[hub_id] = {
                "id": hub_id,
                "label": "Account",
                "holderName": f"Hub {hub_id}",
                "status": "FLAGGED",
                "riskScore": 90,
                "balance": 250000.0,
                "type": "BUSINESS",
                "bank": str(row.get("ipAddress", "Bank-UK"))
            }

        if src_id and src_id not in nodes_dict:
            nodes_dict[src_id] = {
                "id": src_id,
                "label": "Account",
                "holderName": src_name,
                "status": src_status,
                "riskScore": 70,
                "balance": 80000.0,
                "type": "BUSINESS",
                "bank": "Bank-UK"
            }

        if tgt_id and tgt_id not in nodes_dict:
            nodes_dict[tgt_id] = {
                "id": tgt_id,
                "label": "Account",
                "holderName": tgt_name,
                "status": tgt_status,
                "riskScore": 70,
                "balance": 95000.0,
                "type": "BUSINESS",
                "bank": "Bank-UK"
            }

        if src_id and hub_id:
            links.append({
                "id": f"{src_id}-{hub_id}",
                "source": src_id,
                "target": hub_id,
                "type": "TRANSFERRED",
                "amount": vol / 2,
                "isLaundering": True,
                "launderingType": "Scatter-Gather"
            })
        if hub_id and tgt_id:
            links.append({
                "id": f"{hub_id}-{tgt_id}",
                "source": hub_id,
                "target": tgt_id,
                "type": "TRANSFERRED",
                "amount": vol / 2,
                "isLaundering": True,
                "launderingType": "Scatter-Gather"
            })

    graph_data = {
        "nodes": list(nodes_dict.values()),
        "links": links
    }

    return {
        "detector": "Multi-Branch Layering Hub Detector",
        "detectedCount": len(results),
        "sharedRings": results,
        "graph": graph_data,
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
    results = db_manager.execute_cypher(query_info["cypher"], cypher_params, use_cache=True, ttl_seconds=30)
    execution_time_ms = round((time.time() - start_time) * 1000, 2)

    nodes_dict = {}
    links = []

    for row in results:
        mule_id = row.get("muleAccountId")
        mule_name = row.get("muleHolderName", mule_id)
        mule_status = row.get("muleStatus", "FLAGGED")
        total_inbound = float(row.get("totalInbound", 0.0))
        tx_count = int(row.get("txCount", 3))
        sources = row.get("sourceHolders", [])

        if mule_id and mule_id not in nodes_dict:
            nodes_dict[mule_id] = {
                "id": mule_id,
                "label": "Account",
                "holderName": mule_name,
                "status": mule_status,
                "riskScore": 95,
                "balance": total_inbound,
                "type": "BUSINESS",
                "bank": "Bank-UK"
            }

        # Add sample feeder source nodes
        for idx, src_holder in enumerate(sources[:3]):
            src_id = f"SRC-{mule_id}-{idx}"
            if src_id not in nodes_dict:
                nodes_dict[src_id] = {
                    "id": src_id,
                    "label": "Account",
                    "holderName": src_holder or f"Feeder Account {idx+1}",
                    "status": "NORMAL",
                    "riskScore": 30,
                    "balance": 25000.0,
                    "type": "PERSONAL",
                    "bank": "Bank-UK"
                }
            links.append({
                "id": f"{src_id}-{mule_id}",
                "source": src_id,
                "target": mule_id,
                "type": "TRANSFERRED",
                "amount": round(total_inbound / max(1, tx_count), 2),
                "isLaundering": True,
                "launderingType": "Smurfing"
            })

    graph_data = {
        "nodes": list(nodes_dict.values()),
        "links": links
    }

    return {
        "detector": "Structuring & Smurfing Mule Aggregator Detector",
        "detectedCount": len(results),
        "smurfingRings": results,
        "graph": graph_data,
        "queryDetails": {
            "name": query_info["name"],
            "cypher": query_info["cypher"].strip(),
            "parameters": cypher_params,
            "description": query_info["description"],
            "relationalComparison": query_info["relational_comparison"],
            "executionTimeMs": execution_time_ms
        }
    }
