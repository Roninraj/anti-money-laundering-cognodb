import time
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.database import db_manager
from app.cypher_queries import CYPHER_QUERIES

router = APIRouter(prefix="/api/graph", tags=["Graph Network Topology"])

class ExecuteCypherRequest(BaseModel):
    cypher: str
    parameters: Optional[Dict[str, Any]] = None

def _extract_node(entity: Any) -> Optional[Dict[str, Any]]:
    """Helper to safely extract Node attributes directly from CognoDB."""
    if not entity:
        return None
    if isinstance(entity, dict):
        props = entity.get("properties", entity)
        node_id = props.get("id") or entity.get("id")
        if not node_id:
            return None
        return {
            "id": node_id,
            "label": entity.get("label", props.get("label", "Account")),
            "holderName": props.get("holderName") or entity.get("holderName") or node_id,
            "status": props.get("status", "NORMAL"),
            "riskScore": props.get("riskScore", 0),
            "balance": props.get("balance", 0.0),
            "type": props.get("type", "UNKNOWN"),
            "bank": props.get("bank", "Bank-UK"),
            "ip": props.get("ip"),
            "deviceId": props.get("deviceId"),
            "isProxy": props.get("isProxy", False)
        }
    if hasattr(entity, "items") or hasattr(entity, "_properties"):
        props = dict(getattr(entity, "_properties", entity))
        node_id = props.get("id")
        if not node_id:
            return None
        labels = list(getattr(entity, "labels", ["Account"]))
        return {
            "id": node_id,
            "label": labels[0] if labels else "Account",
            "holderName": props.get("holderName", node_id),
            "status": props.get("status", "NORMAL"),
            "riskScore": props.get("riskScore", 0),
            "balance": props.get("balance", 0.0),
            "type": props.get("type", "UNKNOWN"),
            "bank": props.get("bank", "Bank-UK"),
            "ip": props.get("ip"),
            "deviceId": props.get("deviceId"),
            "isProxy": props.get("isProxy", False)
        }
    return None

def _format_graph_response(raw_results: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Parses Neo4j records into standardized nodes & links format for force-directed canvas.
    """
    nodes_dict = {}
    links = []

    for row in raw_results:
        n_raw = row.get("n") or row.get("a") or row.get("src") or row.get("source")
        r_raw = row.get("r") or row.get("t") or row.get("rel") or row.get("transfer")
        m_raw = row.get("m") or row.get("b") or row.get("tgt") or row.get("target") or row.get("neighbor") or row.get("infra")

        n_node = _extract_node(n_raw)
        m_node = _extract_node(m_raw)

        if n_node and n_node["id"] not in nodes_dict:
            nodes_dict[n_node["id"]] = n_node

        if m_node and m_node["id"] not in nodes_dict:
            nodes_dict[m_node["id"]] = m_node

        if n_node and m_node and r_raw:
            src_id = n_node["id"]
            tgt_id = m_node["id"]
            
            rel_type = "TRANSFERRED"
            rel_props = {}
            if isinstance(r_raw, dict):
                rel_props = r_raw.get("properties", r_raw)
                rel_type = r_raw.get("type", rel_props.get("type", "TRANSFERRED"))
            elif hasattr(r_raw, "type"):
                rel_type = getattr(r_raw, "type", "TRANSFERRED")
                rel_props = dict(getattr(r_raw, "_properties", {}))
            elif isinstance(r_raw, tuple) and len(r_raw) >= 2:
                rel_type = str(r_raw[1]) if len(r_raw) > 1 else "TRANSFERRED"
                rel_props = r_raw[0] if isinstance(r_raw[0], dict) else {}

            links.append({
                "source": src_id,
                "target": tgt_id,
                "type": rel_type,
                "amount": float(rel_props.get("amount", 0.0)) if isinstance(rel_props, dict) else 0.0,
                "isLaundering": bool(rel_props.get("isLaundering", False)) if isinstance(rel_props, dict) else False,
                "launderingType": rel_props.get("launderingType", "Normal") if isinstance(rel_props, dict) else "Normal",
                "paymentFormat": rel_props.get("paymentFormat", "ACH") if isinstance(rel_props, dict) else "ACH",
                "timestamp": rel_props.get("timestamp") if isinstance(rel_props, dict) else None,
                "id": f"{src_id}-{tgt_id}-{rel_props.get('id', '')}"
            })

    return {
        "nodes": list(nodes_dict.values()),
        "links": links
    }

@router.get("/full")
def get_full_graph():
    """Fetches full AML network topology from authentic Kaggle dataset."""
    start_time = time.time()
    query_info = CYPHER_QUERIES["FULL_GRAPH"]
    results = db_manager.execute_cypher(query_info["cypher"], use_cache=True, ttl_seconds=15)
    execution_time_ms = round((time.time() - start_time) * 1000, 2)

    graph_data = _format_graph_response(results)

    return {
        "graph": graph_data,
        "queryDetails": {
            "name": query_info["name"],
            "cypher": query_info["cypher"].strip(),
            "description": query_info["description"],
            "relationalComparison": query_info["relational_comparison"],
            "executionTimeMs": execution_time_ms
        }
    }

@router.get("/neighborhood/{account_id}")
def get_neighborhood(account_id: str):
    """Fetches 1-2 hop neighborhood surrounding specific account."""
    start_time = time.time()
    query_info = CYPHER_QUERIES["GET_NEIGHBORHOOD"]
    
    records = []
    
    # 1. Direct Outgoing Transfers (1-hop)
    q1 = """
    MATCH (n:Account {id: $accountId})
    OPTIONAL MATCH (n)-[r:TRANSFERRED]->(m:Account)
    RETURN n, r, m
    LIMIT 50
    """
    r1 = db_manager.execute_cypher(q1, {"accountId": account_id}, use_cache=True, ttl_seconds=10)
    records.extend(r1)
    
    # 2. Direct Incoming transfers (1-hop)
    q2 = """
    MATCH (m:Account {id: $accountId})
    MATCH (n:Account)-[r:TRANSFERRED]->(m)
    RETURN n, r, m
    LIMIT 50
    """
    r2 = db_manager.execute_cypher(q2, {"accountId": account_id}, use_cache=True, ttl_seconds=10)
    records.extend(r2)
    
    # 3. 2-Hop Multi-Hop Transfers (Layering chains)
    q3 = """
    MATCH (a:Account {id: $accountId})-[:TRANSFERRED]->(n:Account)-[r:TRANSFERRED]->(m:Account)
    WHERE m.id <> $accountId
    RETURN n, r, m
    LIMIT 50
    """
    r3 = db_manager.execute_cypher(q3, {"accountId": account_id}, use_cache=True, ttl_seconds=10)
    records.extend(r3)

    execution_time_ms = round((time.time() - start_time) * 1000, 2)
    graph_data = _format_graph_response(records)

    # If no records returned (e.g. unknown account ID), synthesize fallback target node so canvas centers
    if not graph_data["nodes"]:
        graph_data["nodes"] = [{
            "id": account_id,
            "label": "Account",
            "holderName": f"Account {account_id}",
            "status": "NORMAL",
            "riskScore": 10,
            "balance": 50000.0,
            "type": "BUSINESS",
            "bank": "Bank-UK",
            "ip": None,
            "deviceId": None,
            "isProxy": False
        }]

    return {
        "accountId": account_id,
        "graph": graph_data,
        "queryDetails": {
            "name": query_info["name"],
            "cypher": f"MATCH (n:Account {{id: '{account_id}'}}) OPTIONAL MATCH (n)-[r:TRANSFERRED*1..2]-(m:Account) RETURN n, r, m LIMIT 50",
            "parameters": {"accountId": account_id},
            "description": query_info["description"],
            "relationalComparison": query_info["relational_comparison"],
            "executionTimeMs": execution_time_ms
        }
    }

@router.post("/execute-cypher")
def execute_custom_cypher(payload: ExecuteCypherRequest):
    """
    Live Interactive Cypher Console Execution Endpoint.
    Executes parameterized openCypher directly against CognoDB Cloud.
    """
    start_time = time.time()
    query = payload.cypher.strip()
    if not query:
        raise HTTPException(status_code=400, detail="Cypher query cannot be empty.")
    
    q_upper = query.upper()
    if "DROP DATABASE" in q_upper or "DROP CONSTRAINT" in q_upper:
        raise HTTPException(status_code=403, detail="Destructive schema operations are restricted.")

    try:
        if any(w in q_upper for w in ["SET ", "CREATE ", "DELETE ", "MERGE ", "DETACH DELETE"]):
            results = db_manager.execute_write_cypher(query, payload.parameters or {})
        else:
            results = db_manager.execute_cypher(query, payload.parameters or {}, use_cache=False)
        
        execution_time_ms = round((time.time() - start_time) * 1000, 2)
        
        columns = []
        if results and isinstance(results[0], dict):
            columns = list(results[0].keys())

        graph_data = _format_graph_response(results)

        return {
            "success": True,
            "count": len(results),
            "columns": columns,
            "results": results,
            "graph": graph_data if graph_data["nodes"] else None,
            "executionTimeMs": execution_time_ms,
            "query": query,
            "parameters": payload.parameters or {}
        }
    except Exception as e:
        execution_time_ms = round((time.time() - start_time) * 1000, 2)
        return {
            "success": False,
            "error": str(e),
            "count": 0,
            "columns": [],
            "results": [],
            "graph": None,
            "executionTimeMs": execution_time_ms,
            "query": query,
            "parameters": payload.parameters or {}
        }
