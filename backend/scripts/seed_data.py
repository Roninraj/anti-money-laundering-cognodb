"""
CognoDB Seed Script for SAML Anti-Money Laundering Dataset.
Populates CognoDB Cloud using parameterized openCypher queries over the official Neo4j driver.
"""

import os
import sys
import csv
import logging
from pathlib import Path
from neo4j import GraphDatabase

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from app.config import settings

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("seed_data")

# Account Holder Mapping for realistic display names
ACCOUNT_NAMES = {
    "ACC-101": ("Apex Global Capital", "FLAGGED", 92, "BUSINESS", 1450000.0),
    "ACC-202": ("Shell Corp Alpha", "SUSPECTED", 88, "SHELL", 890000.0),
    "ACC-303": ("Cayman Offshore Trust", "SUSPENDED", 95, "OFFSHORE", 3200000.0),
    "ACC-404": ("Vanguard Import/Export", "SUSPICIOUS", 76, "BUSINESS", 640000.0),
    "ACC-505": ("Panama Holdings Ltd", "FLAGGED", 89, "SHELL", 1100000.0),
    "ACC-701": ("DarkSky Trading", "FLAGGED", 85, "BUSINESS", 450000.0),
    "ACC-702": ("Shadow Capital LLC", "SUSPICIOUS", 79, "BUSINESS", 310000.0),
    "ACC-703": ("Vortex Mules Ltd", "SUSPENDED", 91, "SHELL", 18000.0),
    "ACC-888": ("Aggregation Mule Account", "FLAGGED", 94, "INDIVIDUAL", 98000.0),
    "ACC-801": ("Smurf Source Alpha", "SUSPICIOUS", 65, "INDIVIDUAL", 12000.0),
    "ACC-802": ("Smurf Source Beta", "SUSPICIOUS", 68, "INDIVIDUAL", 14000.0),
    "ACC-803": ("Smurf Source Gamma", "SUSPICIOUS", 62, "INDIVIDUAL", 11500.0),
    "ACC-804": ("Smurf Source Delta", "SUSPICIOUS", 64, "INDIVIDUAL", 13200.0),
    "ACC-805": ("Smurf Source Epsilon", "SUSPICIOUS", 69, "INDIVIDUAL", 10800.0),
    "ACC-901": ("Acme Clean Corp", "NORMAL", 12, "BUSINESS", 520000.0),
    "ACC-902": ("John Doe Retail", "NORMAL", 8, "INDIVIDUAL", 15400.0),
    "ACC-903": ("Supplier Inc", "NORMAL", 15, "BUSINESS", 280000.0),
    "ACC-904": ("Global Tech", "NORMAL", 5, "BUSINESS", 950000.0),
    "ACC-905": ("Cloud Hosting Services", "NORMAL", 7, "BUSINESS", 410000.0),
}

def seed_cognodb():
    uri = settings.cognodb_uri
    user = settings.cognodb_user
    password = settings.cognodb_password

    logger.info(f"Connecting to CognoDB Cloud at: {uri}")
    
    if "your_saved_password" in password or "demo.databases" in uri:
        logger.error("COGNODB_PASSWORD or COGNODB_URI is not configured in .env!")
        logger.info("Please copy .env.example to .env and set your CognoDB credentials.")
        return False

    try:
        driver = GraphDatabase.driver(uri, auth=(user, password))
        driver.verify_connectivity()
        logger.info("Connected to CognoDB Cloud successfully!")

        csv_path = Path(__file__).parent / "saml_sample.csv"
        if not csv_path.exists():
            logger.error(f"SAML sample CSV not found at {csv_path}")
            return False

        with driver.session() as session:
            logger.info("Clearing existing graph data...")
            session.run("MATCH (n) DETACH DELETE n")

            logger.info("Parsing SAML transactions dataset...")
            with open(csv_path, mode="r", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                tx_rows = list(reader)

            logger.info(f"Processing {len(tx_rows)} SAML transaction records...")

            # 1. Create Accounts
            account_query = """
            MERGE (a:Account {id: $id})
            ON CREATE SET
                a.accountNumber = $accNum,
                a.holderName = $holderName,
                a.status = $status,
                a.riskScore = $riskScore,
                a.type = $type,
                a.balance = $balance,
                a.createdAt = datetime()
            """

            accounts_created = set()
            for row in tx_rows:
                from_id = row["From Account"]
                to_id = row["To Account"]

                for acc_id in [from_id, to_id]:
                    if acc_id not in accounts_created:
                        holder, status, risk, acc_type, balance = ACCOUNT_NAMES.get(
                            acc_id, (f"Holder {acc_id}", "NORMAL", 20, "INDIVIDUAL", 50000.0)
                        )
                        session.run(account_query, {
                            "id": acc_id,
                            "accNum": acc_id.replace("ACC-", "10029"),
                            "holderName": holder,
                            "status": status,
                            "riskScore": risk,
                            "type": acc_type,
                            "balance": balance
                        })
                        accounts_created.add(acc_id)

            logger.info(f"Seeded {len(accounts_created)} Account nodes.")

            # 2. Create Infrastructure Nodes (Devices & IP Addresses)
            infra_device_query = """
            MERGE (d:Device {id: $deviceId})
            ON CREATE SET d.deviceId = $deviceId, d.deviceType = 'MOBILE_OR_DESKTOP', d.os = 'Android / macOS'
            """

            infra_ip_query = """
            MERGE (ip:IPAddress {id: $ipId})
            ON CREATE SET ip.ip = $ip, ip.isProxy = $isProxy, ip.country = $country
            """

            device_link_query = """
            MATCH (a:Account {id: $accId})
            MATCH (d:Device {id: $deviceId})
            MERGE (a)-[r:USED_DEVICE]->(d)
            ON CREATE SET r.lastUsed = datetime()
            """

            ip_link_query = """
            MATCH (a:Account {id: $accId})
            MATCH (ip:IPAddress {id: $ipId})
            MERGE (a)-[r:CONNECTED_FROM]->(ip)
            ON CREATE SET r.lastLogin = datetime()
            """

            # 3. Create Transfers (Relationships)
            transfer_query = """
            MATCH (src:Account {id: $fromAcc})
            MATCH (tgt:Account {id: $toAcc})
            CREATE (src)-[t:TRANSFERRED {
                id: $txId,
                amount: $amount,
                paymentFormat: $format,
                isLaundering: $isLaundering,
                timestamp: $timestamp
            }]->(tgt)
            """

            tx_counter = 1
            for row in tx_rows:
                from_id = row["From Account"]
                to_id = row["To Account"]
                amount = float(row["Amount Paid"])
                payment_format = row["Payment Format"]
                is_laundering = bool(int(row["Is Laundering"]))
                timestamp = row["Timestamp"]
                ip_addr = row.get("IP Address")
                device_id = row.get("Device ID")

                # Insert transfer relationship
                session.run(transfer_query, {
                    "fromAcc": from_id,
                    "toAcc": to_id,
                    "txId": f"TX-{tx_counter:04d}",
                    "amount": amount,
                    "format": payment_format,
                    "isLaundering": is_laundering,
                    "timestamp": timestamp
                })
                tx_counter += 1

                # Link infrastructure
                if device_id:
                    session.run(infra_device_query, {"deviceId": device_id})
                    session.run(device_link_query, {"accId": from_id, "deviceId": device_id})

                if ip_addr:
                    ip_id = f"IP-{ip_addr.replace('.', '-')}"
                    is_proxy = True if ip_addr.startswith("185.220") or ip_addr.startswith("104.22") else False
                    session.run(infra_ip_query, {
                        "ipId": ip_id,
                        "ip": ip_addr,
                        "isProxy": is_proxy,
                        "country": "Panama" if is_proxy else "United States"
                    })
                    session.run(ip_link_query, {"accId": from_id, "ipId": ip_id})

            logger.info(f"Seeded {tx_counter - 1} TRANSFERRED relationships, Device, and IP hubs into CognoDB!")
            
            # Print verification count
            res = session.run("MATCH (n) RETURN count(n) AS nodeCount")
            node_count = res.single()["nodeCount"]
            res = session.run("MATCH ()-[r]->() RETURN count(r) AS relCount")
            rel_count = res.single()["relCount"]
            
            logger.info(f"✅ Seeding Complete! CognoDB contains {node_count} nodes and {rel_count} relationships.")
            driver.close()
            return True

    except Exception as e:
        logger.error(f"Error seeding CognoDB Cloud: {e}")
        return False

if __name__ == "__main__":
    seed_cognodb()
