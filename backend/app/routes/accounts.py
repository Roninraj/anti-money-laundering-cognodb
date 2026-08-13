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
    results = db_manager.execute_cypher(cypher, {"accountId": account_id})
    if not results:
        # Fallback to search if match not directly returned
        search_res = db_manager.execute_cypher("""
        MATCH (a:Account {id: $accountId}) RETURN a
        """, {"accountId": account_id})
        if not search_res:
            raise HTTPException(status_code=404, detail=f"Account {account_id} not found.")
        return {"account": search_res[0].get("a"), "customer": None, "transactions": []}

    row = results[0]
    return {
        "account": row.get("a"),
        "customer": row.get("c"),
        "transactions": row.get("transactions", [])
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
    results = db_manager.execute_cypher(cypher, params)
    return {
        "message": f"Updated account {account_id} status to {payload.status}",
        "result": results[0] if results else {"id": account_id, "status": payload.status}
    }
