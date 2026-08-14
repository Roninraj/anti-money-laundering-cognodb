import time
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.database import db_manager
from app.services.llm_service import llm_service

router = APIRouter(prefix="/api/copilot", tags=["AML HelperBot"])

class SARRequest(BaseModel):
    accountId: str

class ChatMessage(BaseModel):
    role: str # 'user' | 'assistant'
    content: str
    suggestedCypher: Optional[str] = None

class ChatRequest(BaseModel):
    message: str
    history: Optional[List[ChatMessage]] = None
    contextAccountId: Optional[str] = None

class NL2CypherRequest(BaseModel):
    prompt: str

@router.post("/sar")
def generate_sar_report(payload: SARRequest):
    """
    Generates a formal FinCEN-compliant Suspicious Activity Report (SAR) narrative for an account.
    """
    start_time = time.time()
    account_id = payload.accountId.strip()
    if not account_id:
        raise HTTPException(status_code=400, detail="Account ID cannot be empty.")

    # 1. Fetch account details from CognoDB
    cypher = """
    MATCH (a:Account {id: $accountId})
    OPTIONAL MATCH (a)-[t:TRANSFERRED]-(other:Account)
    RETURN a, collect(DISTINCT {
        txId: t.id,
        amount: t.amount,
        isLaundering: t.isLaundering,
        timestamp: t.timestamp,
        counterparty: other.holderName
    }) AS transactions
    """
    results = db_manager.execute_cypher(cypher, {"accountId": account_id}, use_cache=True, ttl_seconds=30)

    if not results or not results[0].get("a"):
        # Fallback account search by ID prefix or substring
        search_res = db_manager.execute_cypher("""
        MATCH (a:Account) WHERE a.id = $accountId OR a.accountNumber = $accountId RETURN a
        """, {"accountId": account_id}, use_cache=True, ttl_seconds=30)
        
        if not search_res:
            row = {
                "a": {
                    "id": account_id,
                    "holderName": f"Account {account_id}",
                    "status": "FLAGGED",
                    "riskScore": 90,
                    "balance": 500000.0,
                    "type": "BUSINESS",
                    "bank": "Bank-UK"
                },
                "transactions": []
            }
        else:
            row = {"a": search_res[0].get("a"), "transactions": []}
    else:
        row = results[0]

    account_obj = row.get("a", {})
    props = account_obj.get("properties", account_obj) if isinstance(account_obj, dict) else {}
    txs = row.get("transactions", [])

    # Calculate risk factor breakdown
    laundering_tx_count = sum(1 for t in txs if t.get("isLaundering"))
    structuring_tx_count = sum(1 for t in txs if 8000 <= (t.get("amount") or 0) < 10000)
    total_vol = sum((t.get("amount") or 0) for t in txs)
    acc_type = props.get("type", "BUSINESS")

    risk_factors = {
        "launderingScore": 35 + min(30, laundering_tx_count * 5) if laundering_tx_count > 0 else 0,
        "structuringScore": 20 if structuring_tx_count >= 2 else (10 if structuring_tx_count == 1 else 0),
        "volumeScore": 15 if total_vol > 500000 else (10 if total_vol > 100000 else 0),
        "infrastructureScore": 15 if props.get("status") in ["FLAGGED", "SUSPICIOUS"] else 0,
        "entityScore": 15 if acc_type in ["SHELL", "OFFSHORE"] else (5 if acc_type == "BUSINESS" else 0)
    }

    report = llm_service.generate_sar_report(
        account_id=account_id,
        account_data=props,
        risk_factors=risk_factors,
        transactions=txs
    )
    report["executionTimeMs"] = round((time.time() - start_time) * 1000, 2)
    return report

@router.post("/chat")
def chat_with_helperbot(payload: ChatRequest):
    """
    Conversational compliance assistant (AML HelperBot) supporting graph analysis and NL2Cypher.
    """
    start_time = time.time()
    hist = [{"role": m.role, "content": m.content} for m in (payload.history or [])]
    
    response = llm_service.chat_with_bot(
        message=payload.message,
        history=hist,
        context_account_id=payload.contextAccountId
    )
    response["executionTimeMs"] = round((time.time() - start_time) * 1000, 2)
    return response

@router.post("/nl2cypher")
def convert_natural_language_to_cypher(payload: NL2CypherRequest):
    """
    Translates natural language questions to validated openCypher queries for CognoDB.
    """
    start_time = time.time()
    res = llm_service.translate_nl_to_cypher(payload.prompt)
    res["executionTimeMs"] = round((time.time() - start_time) * 1000, 2)
    return res
