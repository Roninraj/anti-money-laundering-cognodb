"""
Kaggle SAML Dataset Direct Loader for CognoDB Cloud.
Dataset: https://www.kaggle.com/datasets/berkanoztas/synthetic-transaction-monitoring-dataset-aml

Streams SAML-D.csv downloaded from Kaggle, parses laundering cycles, fan-in/fan-out,
scatter-gather rings, and seeds CognoDB Cloud using openCypher UNWIND batching.
"""

import os
import sys
import csv
import hashlib
import argparse
import logging
from pathlib import Path
from neo4j import GraphDatabase

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from app.config import settings

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("load_saml_kaggle")

DEFAULT_KAGGLE_CSV = "/home/roninraj/.cache/kagglehub/datasets/berkanoztas/synthetic-transaction-monitoring-dataset-aml/versions/2/SAML-D.csv"

def load_saml_dataset(csv_path: str = DEFAULT_KAGGLE_CSV, max_laundering: int = 1500, max_normal: int = 2500, clear_existing: bool = True):
    uri = settings.cognodb_uri
    user = settings.cognodb_user
    password = settings.cognodb_password

    logger.info(f"Connecting to CognoDB Cloud at {uri}...")

    if "your_saved_password" in password or "demo.databases" in uri:
        logger.warning("COGNODB_PASSWORD or COGNODB_URI is not set in .env! Testing local parser mode.")

    if not os.path.exists(csv_path):
        logger.error(f"SAML dataset CSV file not found at path: {csv_path}")
        return False

    try:
        # 1. Parse Kaggle SAML-D.csv
        logger.info(f"Streaming and filtering Kaggle SAML CSV: {csv_path}")
        laundering_txs = []
        normal_txs = []

        with open(csv_path, mode="r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            
            for row in reader:
                sender = row.get("Sender_account") or row.get("From Account")
                receiver = row.get("Receiver_account") or row.get("To Account")
                amount_str = row.get("Amount") or row.get("Amount Paid")
                is_laund = row.get("Is_laundering") or row.get("Is Laundering")
                laund_type = row.get("Laundering_type") or row.get("Laundering Type") or "Normal"
                payment_type = row.get("Payment_type") or row.get("Payment Format") or "ACH"
                date_str = row.get("Date", "2026-08-10")
                time_str = row.get("Time", "12:00:00")
                sender_loc = row.get("Sender_bank_location", "UK")
                receiver_loc = row.get("Receiver_bank_location", "UK")

                if not sender or not receiver or not amount_str:
                    continue

                try:
                    amount = float(amount_str)
                except ValueError:
                    amount = 1000.0

                is_laund_bool = str(is_laund).strip() in ["1", "true", "True"]

                item = {
                    "fromAcc": f"ACC-{sender}",
                    "toAcc": f"ACC-{receiver}",
                    "fromBank": f"Bank-{sender_loc}",
                    "toBank": f"Bank-{receiver_loc}",
                    "amount": amount,
                    "paymentFormat": payment_type,
                    "isLaundering": is_laund_bool,
                    "launderingType": laund_type,
                    "timestamp": f"{date_str}T{time_str}Z"
                }

                if is_laund_bool:
                    if len(laundering_txs) < max_laundering:
                        laundering_txs.append(item)
                else:
                    if len(normal_txs) < max_normal:
                        normal_txs.append(item)

                if len(laundering_txs) >= max_laundering and len(normal_txs) >= max_normal:
                    break

        combined_txs = laundering_txs + normal_txs
        logger.info(f"Successfully extracted {len(combined_txs)} transactions ({len(laundering_txs)} Laundering, {len(normal_txs)} Normal) from Kaggle SAML-D dataset!")

        if not combined_txs:
            logger.error("No valid transaction rows parsed from CSV.")
            return False

        # Extract unique accounts with multi-factor risk scoring
        acc_stats = {}
        for tx in combined_txs:
            for acc_id, bank in [(tx["fromAcc"], tx["fromBank"]), (tx["toAcc"], tx["toBank"])]:
                if acc_id not in acc_stats:
                    acc_stats[acc_id] = {
                        "bank": bank,
                        "txCount": 0,
                        "launderingTx": 0,
                        "structuringCount": 0,
                        "totalVolume": 0.0
                    }
                acc_stats[acc_id]["txCount"] += 1
                acc_stats[acc_id]["totalVolume"] += tx["amount"]
                if tx["isLaundering"]:
                    acc_stats[acc_id]["launderingTx"] += 1
                if 8000.0 <= tx["amount"] < 10000.0:
                    acc_stats[acc_id]["structuringCount"] += 1

        accounts_dict = {}
        for acc_id, stat in acc_stats.items():
            laund_tx = stat["launderingTx"]
            struct_tx = stat["structuringCount"]
            tot_vol = stat["totalVolume"]
            
            raw_score = 10
            if laund_tx > 0:
                raw_score += 35 + (laund_tx * 5)
            if struct_tx >= 2:
                raw_score += 20
            elif struct_tx == 1:
                raw_score += 10
            if tot_vol > 500000.0:
                raw_score += 15
            elif tot_vol > 100000.0:
                raw_score += 10

            final_score = min(98, max(8, raw_score))
            if final_score >= 85:
                status = "FLAGGED"
                acc_type = "SHELL" if "UK" in stat["bank"] else "BUSINESS"
                balance = 750000.0
            elif final_score >= 60:
                status = "SUSPICIOUS"
                acc_type = "BUSINESS"
                balance = 280000.0
            else:
                status = "NORMAL"
                acc_type = "INDIVIDUAL"
                balance = 32000.0

            # Deterministic distinct company name mapping
            h_int = int(hashlib.sha256(acc_id.encode("utf-8")).hexdigest(), 16)
            prefixes = ["Apex", "Vortex", "Blackwood", "Shadow Peak", "Nova Phoenix", "Omni Matrix", "Ironclad", "DarkSky", "Cayman Star", "Panama Merchant", "Helios", "Silverline", "Titan Meridian", "Zenith", "BlueStar", "Orion", "Cobalt Nexus", "Starlight", "Aero Dynamic", "Pacific Maritime", "Beacon Star", "Valiant", "Monarch", "Summit Global", "Atlas", "Aurora", "Riverside", "Greenleaf", "Horizon", "Beacon", "Skyline", "Pinnacle", "Golden Oak", "Crestview", "Sterling", "Redwood", "Quantum Core", "Solaria", "Nexus Prime", "Evergreen", "Harbor Point"]
            middles = ["Global", "Capital", "Logistics", "Holdings", "Ventures", "Trading", "Commercial", "Partners", "Financial", "Enterprises", "Industries", "Technologies", "Energy", "Maritime", "Aerospace", "Biotech", "Real Estate", "Commodities", "Securities", "Investments", "International", "Solutions"]
            suffixes = ["Ltd", "Corp", "Inc", "LLC", "Group", "PLC", "GmbH", "S.A.", "Trust", "Holdings", "Ventures", "Co"]
            p = prefixes[h_int % len(prefixes)]
            m = middles[(h_int // len(prefixes)) % len(middles)]
            s = suffixes[(h_int // (len(prefixes) * len(middles))) % len(suffixes)]
            comp_name = f"{p} {m} {s}"

            accounts_dict[acc_id] = {
                "id": acc_id,
                "accountNumber": acc_id.replace("ACC-", ""),
                "holderName": comp_name,
                "bank": stat["bank"],
                "status": status,
                "riskScore": final_score,
                "type": acc_type,
                "balance": balance
            }

        logger.info(f"Extracted {len(accounts_dict)} unique Account entities with multi-factor risk scoring from Kaggle SAML topology.")

        # 2. Connect to CognoDB Cloud and seed via UNWIND batching
        if "your_saved_password" in password or "demo.databases" in uri:
            logger.info("CognoDB credentials not configured in .env. CSV parsing verified successfully.")
            return True

        driver = GraphDatabase.driver(uri, auth=(user, password))
        driver.verify_connectivity()
        logger.info("Connected to CognoDB Cloud over Bolt protocol!")

        with driver.session() as session:
            if clear_existing:
                logger.info("Clearing existing database graph...")
                session.run("MATCH (n) DETACH DELETE n")

            # Batch insert Accounts
            logger.info("Batch inserting SAML Accounts into CognoDB via parameterized UNWIND...")
            acc_list = list(accounts_dict.values())
            batch_size = 250

            unwind_accounts_query = """
            UNWIND $batch AS acc
            MERGE (a:Account {id: acc.id})
            ON CREATE SET
                a.accountNumber = acc.accountNumber,
                a.holderName = acc.holderName,
                a.bank = acc.bank,
                a.status = acc.status,
                a.riskScore = acc.riskScore,
                a.type = acc.type,
                a.balance = acc.balance
            """

            for i in range(0, len(acc_list), batch_size):
                batch = acc_list[i:i + batch_size]
                session.run(unwind_accounts_query, {"batch": batch})

            logger.info("Accounts inserted successfully!")

            # Batch insert Transfers
            logger.info("Batch inserting SAML Transfers into CognoDB via parameterized UNWIND...")
            tx_batch_list = []
            for idx, tx in enumerate(combined_txs, start=1):
                tx_batch_list.append({
                    "txId": f"TX-SAML-{idx:05d}",
                    "fromAcc": tx["fromAcc"],
                    "toAcc": tx["toAcc"],
                    "amount": tx["amount"],
                    "format": tx["paymentFormat"],
                    "isLaundering": tx["isLaundering"],
                    "launderingType": tx["launderingType"],
                    "timestamp": tx["timestamp"]
                })

            unwind_transfers_query = """
            UNWIND $batch AS tx
            MATCH (src:Account {id: tx.fromAcc})
            MATCH (tgt:Account {id: tx.toAcc})
            CREATE (src)-[t:TRANSFERRED {
                id: tx.txId,
                amount: tx.amount,
                paymentFormat: tx.format,
                isLaundering: tx.isLaundering,
                launderingType: tx.launderingType,
                timestamp: tx.timestamp
            }]->(tgt)
            """

            for i in range(0, len(tx_batch_list), batch_size):
                batch = tx_batch_list[i:i + batch_size]
                session.run(unwind_transfers_query, {"batch": batch})

            logger.info("Transfers inserted successfully!")

            # Attach Infrastructure Nodes (Devices & Proxy IPs)
            logger.info("Synthesizing Device and Proxy IP nodes for laundering clusters...")
            infra_query = """
            MATCH (a:Account)
            WHERE a.status = 'FLAGGED'
            WITH collect(a) AS flaggedAccs
            MERGE (d:Device {id: 'DEV-DARK-SAML-999'})
            ON CREATE SET d.deviceId = 'DEV-DARK-SAML-999', d.deviceType = 'MOBILE_PROXY', d.os = 'Android 15'
            MERGE (ip:IPAddress {id: 'IP-185-220-101-5'})
            ON CREATE SET ip.ip = '185.220.101.5', ip.isProxy = true, ip.country = 'Panama'
            WITH flaggedAccs, d, ip
            UNWIND flaggedAccs AS fa
            MERGE (fa)-[:USED_DEVICE {lastUsed: datetime()}]->(d)
            MERGE (fa)-[:CONNECTED_FROM {lastLogin: datetime()}]->(ip)
            """
            session.run(infra_query)

            # Verification Summary
            res_nodes = session.run("MATCH (n) RETURN count(n) AS nodeCount").single()["nodeCount"]
            res_rels = session.run("MATCH ()-[r]->() RETURN count(r) AS relCount").single()["relCount"]

            logger.info("==========================================================")
            logger.info(f"✅ Kaggle SAML Dataset Seeding Complete!")
            logger.info(f"📊 Total Nodes in CognoDB Cloud: {res_nodes}")
            logger.info(f"🔗 Total Relationships in CognoDB Cloud: {res_rels}")
            logger.info("==========================================================")

        driver.close()
        return True

    except Exception as e:
        logger.error(f"Failed to load Kaggle SAML dataset into CognoDB: {e}")
        return False

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed Kaggle SAML AML Dataset into CognoDB Cloud")
    parser.add_argument("--csv", type=str, default=DEFAULT_KAGGLE_CSV, help="Path to SAML dataset CSV file")
    parser.add_argument("--laundering-limit", type=int, default=1500, help="Max laundering transactions to import")
    parser.add_argument("--normal-limit", type=int, default=2500, help="Max normal transactions to import")
    args = parser.parse_args()

    load_saml_dataset(args.csv, args.laundering_limit, args.normal_limit)
