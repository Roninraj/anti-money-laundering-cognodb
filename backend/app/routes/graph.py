import time
from typing import Dict, Any, List
from fastapi import APIRouter, HTTPException
from app.database import db_manager
from app.cypher_queries import CYPHER_QUERIES

router = APIRouter(prefix="/api/graph", tags=["Graph Network Topology"])

def _extract_node(entity: Any) -> Optional[Dict[str, Any]]:
    """Helper to safely extract Node attributes whether entity is dict, tuple, or Neo4j Node."""
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
            "holderName": props.get("holderName", node_id),
            "status": props.get("status", "NORMAL"),
            "riskScore": props.get("riskScore", 0),
            "balance": props.get("balance", 0.0),
            "type": props.get("type", "UNKNOWN"),
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
        n_raw = row.get("n") or row.get("a")
        r_raw = row.get("r") or row.get("t")
        m_raw = row.get("m") or row.get("neighbor") or row.get("infra")

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
                "id": f"{src_id}-{tgt_id}"
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
    
    # 1. Direct Outgoing & Attached Entities (1-hop)
    q1 = """
    MATCH (n) WHERE n.id = $accountId
    OPTIONAL MATCH (n)-[r]->(m)
    RETURN n, r, m
    LIMIT 50
    """
    r1 = db_manager.execute_cypher(q1, {"accountId": account_id}, use_cache=True, ttl_seconds=10)
    records.extend(r1)
    
    # 2. Direct Incoming transfers (1-hop)
    q2 = """
    MATCH (m) WHERE m.id = $accountId
    MATCH (n)-[r]->(m)
    RETURN n, r, m
    LIMIT 50
    """
    r2 = db_manager.execute_cypher(q2, {"accountId": account_id}, use_cache=True, ttl_seconds=10)
    records.extend(r2)
    
    # 3. 2-Hop Multi-Hop Transfers
    q3 = """
    MATCH (a:Account)-[:TRANSFERRED]->(n:Account)-[r:TRANSFERRED]->(m:Account)
    WHERE a.id = $accountId AND m.id <> $accountId
    RETURN n, r, m
    LIMIT 50
    """
    r3 = db_manager.execute_cypher(q3, {"accountId": account_id}, use_cache=True, ttl_seconds=10)
    records.extend(r3)

    # 4. Extract attached Devices and IPs to find co-located network
    device_ids = [row['m']['id'] for row in r1 if row.get('m') and 'DEV-' in str(row['m'].get('id', ''))]
    ip_ids = [row['m']['id'] for row in r1 if row.get('m') and 'IP-' in str(row['m'].get('id', ''))]
    
    for dev_id in device_ids[:2]:
        q_dev = """
        MATCH (n:Account)-[r:USED_DEVICE]->(m:Device)
        WHERE m.id = $devId AND n.id <> $accountId
        RETURN n, r, m
        LIMIT 15
        """
        records.extend(db_manager.execute_cypher(q_dev, {"devId": dev_id, "accountId": account_id}, use_cache=True, ttl_seconds=10))
        
    for ip_id in ip_ids[:2]:
        q_ip = """
        MATCH (n:Account)-[r:CONNECTED_FROM]->(m:IPAddress)
        WHERE m.id = $ipId AND n.id <> $accountId
        RETURN n, r, m
        LIMIT 15
        """
        records.extend(db_manager.execute_cypher(q_ip, {"ipId": ip_id, "accountId": account_id}, use_cache=True, ttl_seconds=10))

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
            "ip": None,
            "deviceId": None,
            "isProxy": False
        }]

    return {
        "accountId": account_id,
        "graph": graph_data,
        "queryDetails": {
            "name": query_info["name"],
            "cypher": f"MATCH (n) WHERE n.id = '{account_id}' OPTIONAL MATCH (n)-[r*1..2]-(m) RETURN n, r, m LIMIT 50",
            "parameters": {"accountId": account_id},
            "description": query_info["description"],
            "relationalComparison": query_info["relational_comparison"],
            "executionTimeMs": execution_time_ms
        }
    }
