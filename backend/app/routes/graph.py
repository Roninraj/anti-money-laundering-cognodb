import time
from typing import Dict, Any, List
from fastapi import APIRouter, HTTPException
from app.database import db_manager
from app.cypher_queries import CYPHER_QUERIES

router = APIRouter(prefix="/api/graph", tags=["Graph Network Topology"])

def _format_graph_response(raw_results: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Parses Neo4j records into standardized nodes & links format for force-directed canvas.
    """
    nodes_dict = {}
    links = []

    for row in raw_results:
        # Single element or triple (n, r, m)
        n = row.get("n") or row.get("a")
        r = row.get("r") or row.get("t")
        m = row.get("m") or row.get("neighbor") or row.get("infra")

        if n:
            node_id = n.get("id") or (n.get("properties", {}).get("id") if isinstance(n, dict) else None)
            if node_id and node_id not in nodes_dict:
                props = n.get("properties", n) if isinstance(n, dict) else {}
                label = n.get("label", props.get("label", "Account"))
                nodes_dict[node_id] = {
                    "id": node_id,
                    "label": label,
                    "holderName": props.get("holderName", node_id),
                    "status": props.get("status", "NORMAL"),
                    "riskScore": props.get("riskScore", 0),
                    "balance": props.get("balance", 0.0),
                    "type": props.get("type", "UNKNOWN"),
                    "ip": props.get("ip"),
                    "deviceId": props.get("deviceId"),
                    "isProxy": props.get("isProxy", False)
                }

        if m:
            m_id = m.get("id") or (m.get("properties", {}).get("id") if isinstance(m, dict) else None)
            if m_id and m_id not in nodes_dict:
                props = m.get("properties", m) if isinstance(m, dict) else {}
                label = m.get("label", props.get("label", "Account"))
                nodes_dict[m_id] = {
                    "id": m_id,
                    "label": label,
                    "holderName": props.get("holderName", m_id),
                    "status": props.get("status", "NORMAL"),
                    "riskScore": props.get("riskScore", 0),
                    "balance": props.get("balance", 0.0),
                    "type": props.get("type", "UNKNOWN"),
                    "ip": props.get("ip"),
                    "deviceId": props.get("deviceId"),
                    "isProxy": props.get("isProxy", False)
                }

        if n and m and r:
            src_id = n.get("id") or n.get("properties", {}).get("id")
            tgt_id = m.get("id") or m.get("properties", {}).get("id")
            rel_props = r.get("properties", r) if isinstance(r, dict) else {}
            rel_type = r.get("type", rel_props.get("type", "CONNECTED"))

            if src_id and tgt_id:
                links.append({
                    "source": src_id,
                    "target": tgt_id,
                    "type": rel_type,
                    "amount": rel_props.get("amount", 0.0),
                    "isLaundering": rel_props.get("isLaundering", False),
                    "id": rel_props.get("id", f"{src_id}-{tgt_id}")
                })

    return {
        "nodes": list(nodes_dict.values()),
        "links": links
    }

@router.get("/full")
def get_full_graph():
    """Fetches full AML network topology."""
    start_time = time.time()
    query_info = CYPHER_QUERIES["FULL_GRAPH"]
    results = db_manager.execute_cypher(query_info["cypher"])
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
    params = {"accountId": account_id}
    results = db_manager.execute_cypher(query_info["cypher"], params)
    execution_time_ms = round((time.time() - start_time) * 1000, 2)

    graph_data = _format_graph_response(results)

    return {
        "accountId": account_id,
        "graph": graph_data,
        "queryDetails": {
            "name": query_info["name"],
            "cypher": query_info["cypher"].strip(),
            "parameters": params,
            "description": query_info["description"],
            "relationalComparison": query_info["relational_comparison"],
            "executionTimeMs": execution_time_ms
        }
    }
