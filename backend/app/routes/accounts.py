from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.database import db_manager

router = APIRouter(prefix="/api/accounts", tags=["Account Management"])

class StatusUpdate(BaseModel):
    status: str # 'NORMAL', 'SUSPICIOUS', 'FLAGGED', 'SUSPENDED'

@router.get("/{account_id}")
def get_account_details(account_id: str):
    """Retrieves full details for specific account."""
    cypher = """
    MATCH (a:Account {id: $accountId})
    OPTIONAL MATCH (c:Customer)-[:OWNS]->(a)
    OPTIONAL MATCH (a)-[t:TRANSFERRED]-(other:Account)
    RETURN a, c, collect(DISTINCT {
        txId: t.id,
        amount: t.amount,
        isLaundering: t.isLaundering,
        timestamp: t.timestamp,
        counterparty: other.holderName
    }) AS transactions
    """
    results = db_manager.execute_cypher(cypher, {"accountId": account_id}, use_cache=True, ttl_seconds=10)
    if not results:
        # Fallback to search if match not directly returned
        search_res = db_manager.execute_cypher("""
        MATCH (a:Account {id: $accountId}) RETURN a
        """, {"accountId": account_id}, use_cache=True, ttl_seconds=10)
        if not search_res:
            raise HTTPException(status_code=404, detail=f"Account {account_id} not found.")
        return {"account": search_res[0].get("a"), "customer": None, "transactions": []}

    row = results[0]
    account_obj = row.get("a", {})
    if isinstance(account_obj, dict):
        props = account_obj.get("properties", account_obj)
    else:
        props = dict(getattr(account_obj, "_properties", {}))
    
    txs = row.get("transactions", [])
    laundering_tx_count = sum(1 for t in txs if t.get("isLaundering"))
    structuring_tx_count = sum(1 for t in txs if 8000 <= (t.get("amount") or 0) < 10000)
    total_vol = sum((t.get("amount") or 0) for t in txs)
    acc_type = props.get("type", "INDIVIDUAL")
    
    risk_factors = {
        "launderingScore": 35 + (laundering_tx_count * 5) if laundering_tx_count > 0 else 0,
        "structuringScore": 20 if structuring_tx_count >= 2 else (10 if structuring_tx_count == 1 else 0),
        "volumeScore": 15 if total_vol > 500000 else (10 if total_vol > 100000 else 0),
        "infrastructureScore": 15 if (props.get("ip") or props.get("deviceId") or props.get("status") in ["FLAGGED", "SUSPICIOUS"]) else 0,
        "entityScore": 15 if acc_type in ["SHELL", "OFFSHORE"] else (5 if acc_type == "BUSINESS" else 0)
    }

    return {
        "account": row.get("a"),
        "customer": row.get("c"),
        "riskFactors": risk_factors,
        "transactions": txs
    }

@router.patch("/{account_id}/status")
def update_account_status(account_id: str, payload: StatusUpdate):
    """Updates account risk status via parameterized openCypher SET clause."""
    cypher = """
    MATCH (a:Account {id: $accountId})
    SET a.status = $newStatus,
        a.riskScore = CASE
            WHEN $newStatus = 'SUSPENDED' THEN 99
            WHEN $newStatus = 'FLAGGED' THEN 90
            WHEN $newStatus = 'SUSPICIOUS' THEN 75
            ELSE 10
        END
    RETURN a.id AS id, a.status AS status, a.riskScore AS riskScore
    """
    params = {"accountId": account_id, "newStatus": payload.status}
    results = db_manager.execute_write_cypher(cypher, params)
    return {
        "message": f"Updated account {account_id} status to {payload.status}",
        "result": results[0] if results else {"id": account_id, "status": payload.status}
    }
